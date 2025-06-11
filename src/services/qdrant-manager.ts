/**
 * QdrantManager Service
 * Automatically manages Qdrant server lifecycle - starts, stops, and monitors
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createServer } from 'net';
import { logger } from '../utils/logger.js';
import { getStateFilePath, getAppRoot } from '../utils/config-path-resolver.js';

export interface QdrantManagerConfig {
  autoStart: boolean;
  preferredPort: number;
  dataPath?: string;
  dockerImage: string;
  maxStartupTime: number;
  healthCheckInterval: number;
}

export class QdrantManager {
  private config: QdrantManagerConfig;
  private process: ChildProcess | null = null;
  private actualPort: number | null = null;
  private isRunning = false;
  private startupPromise: Promise<string> | null = null;

  constructor(config: Partial<QdrantManagerConfig> = {}) {
    this.config = {
      autoStart: true,
      preferredPort: 6333,
      dockerImage: 'qdrant/qdrant:latest',
      maxStartupTime: 30000, // 30 seconds
      healthCheckInterval: 1000, // 1 second
      ...config,
    };
  }

  /**
   * Get an available port starting from preferred port
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 100; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found starting from ${startPort}`);
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Check if Qdrant is healthy at given URL
   */
  private async healthCheck(url: string): Promise<boolean> {
    try {
      const response = await globalThis.fetch(`${url}/collections`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Start Qdrant server automatically
   */
  async startQdrant(): Promise<string> {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this._startQdrant();
    return this.startupPromise;
  }

  private async _startQdrant(): Promise<string> {
    try {
      console.log('🚀 Starting Qdrant server...');

      // Find available port
      this.actualPort = await this.findAvailablePort(this.config.preferredPort);
      const qdrantUrl = `http://localhost:${this.actualPort}`;

      // Check if Qdrant is already running on this port
      if (await this.healthCheck(qdrantUrl)) {
        console.log(`✅ Qdrant already running on port ${this.actualPort}`);
        this.isRunning = true;
        return qdrantUrl;
      }

      // Create data directory
      const dataPath = this.config.dataPath || getStateFilePath('qdrant-data');
      await fs.mkdir(dataPath, { recursive: true });

      // Try Docker first, then fallback to binary
      const qdrantProcess =
        (await this.tryStartWithDocker(dataPath)) || (await this.tryStartWithBinary(dataPath));

      if (!qdrantProcess) {
        throw new Error('Failed to start Qdrant with both Docker and binary methods');
      }

      this.process = qdrantProcess;

      // Wait for Qdrant to be ready
      const startTime = Date.now();
      while (Date.now() - startTime < this.config.maxStartupTime) {
        if (await this.healthCheck(qdrantUrl)) {
          console.log(`✅ Qdrant started successfully on port ${this.actualPort}`);
          this.isRunning = true;
          return qdrantUrl;
        }
        await new Promise((resolve) => setTimeout(resolve, this.config.healthCheckInterval));
      }

      throw new Error(`Qdrant failed to start within ${this.config.maxStartupTime}ms`);
    } catch (error) {
      console.error('❌ Failed to start Qdrant:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Try starting Qdrant with Docker
   */
  private async tryStartWithDocker(dataPath: string): Promise<ChildProcess | null> {
    try {
      const dockerArgs = [
        'run',
        '--rm',
        '-d',
        '-p',
        `${this.actualPort}:6333`,
        '-v',
        `${dataPath}:/qdrant/storage`,
        '--name',
        `qdrant-mcp-${this.actualPort}`,
        this.config.dockerImage,
      ];

      const process = spawn('docker', dockerArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Wait a bit to see if Docker command succeeds
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (process.killed || process.exitCode !== null) {
        throw new Error('Docker process exited early');
      }

      logger.debug(`🐳 Qdrant Docker container started with ID: ${process.pid}`);
      return process;
    } catch (error) {
      logger.debug('🐳 Docker start failed:', error);
      return null;
    }
  }

  /**
   * Try starting Qdrant with binary (if available)
   */
  private async tryStartWithBinary(dataPath: string): Promise<ChildProcess | null> {
    try {
      // Try common binary locations
      const binaryPaths = [
        'qdrant',
        '/usr/local/bin/qdrant',
        '/opt/homebrew/bin/qdrant',
        path.join(getAppRoot(), 'bin', 'qdrant'),
      ];

      let binaryPath: string | null = null;
      for (const binPath of binaryPaths) {
        try {
          await fs.access(binPath);
          binaryPath = binPath;
          break;
        } catch {
          continue;
        }
      }

      if (!binaryPath) {
        throw new Error('Qdrant binary not found');
      }

      const qdrantProcess = spawn(
        binaryPath,
        [
          '--storage-path',
          dataPath,
          '--http-port',
          String(this.actualPort || this.config.preferredPort),
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        }
      );

      logger.debug(`📦 Qdrant binary started with PID: ${qdrantProcess.pid}`);
      return qdrantProcess;
    } catch (error) {
      logger.debug('📦 Binary start failed:', error);
      return null;
    }
  }

  /**
   * Stop Qdrant server
   */
  async stopQdrant(): Promise<void> {
    if (!this.isRunning || !this.process) {
      return;
    }

    console.log('🛑 Stopping Qdrant server...');

    try {
      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Force kill if still running
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }

      // If Docker, also stop container
      if (this.actualPort) {
        try {
          spawn('docker', ['stop', `qdrant-mcp-${this.actualPort}`], { stdio: 'ignore' });
        } catch {
          // Ignore Docker errors
        }
      }
    } catch (error) {
      console.warn('Warning during Qdrant shutdown:', error);
    }

    this.cleanup();
    console.log('✅ Qdrant stopped');
  }

  /**
   * Get current Qdrant URL if running
   */
  getQdrantUrl(): string | null {
    if (this.isRunning && this.actualPort) {
      return `http://localhost:${this.actualPort}`;
    }
    return null;
  }

  /**
   * Check if Qdrant is currently running
   */
  isQdrantRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the port Qdrant is running on
   */
  getPort(): number | null {
    return this.actualPort;
  }

  /**
   * Cleanup internal state
   */
  private cleanup(): void {
    this.process = null;
    this.actualPort = null;
    this.isRunning = false;
    this.startupPromise = null;
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown(): void {
    const shutdown = () => {
      console.log('🔄 Graceful shutdown initiated...');
      this.stopQdrant().finally(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => this.cleanup());
  }

  /**
   * Auto-start Qdrant if configured
   */
  async autoStart(): Promise<string | null> {
    if (!this.config.autoStart) {
      return null;
    }

    try {
      return await this.startQdrant();
    } catch (error) {
      console.warn('Auto-start failed, continuing without Qdrant:', error);
      return null;
    }
  }
}
