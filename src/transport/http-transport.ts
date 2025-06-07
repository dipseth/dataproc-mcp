/**
 * HTTP Transport implementation for MCP server
 * Provides Express-based HTTP server with streaming capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { BaseMCPTransport, TransportType } from './base-transport.js';
import { logger } from '../utils/logger.js';
import express, { Express } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { ConnectionManager } from '../http/streaming/connection-manager.js';
import { setupMiddleware } from '../http/middleware.js';
import { setupRoutes } from '../http/server.js';
import { AllHandlerDependencies } from '../handlers/index.js';

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  port: number;
  host?: string;
  enableCors?: boolean;
  enableRateLimit?: boolean;
  maxConnections?: number;
  handlerDeps?: AllHandlerDependencies;
}

/**
 * HTTP transport implementation with streaming support
 * Provides REST API endpoints and Server-Sent Events for real-time updates
 */
export class HttpTransport extends BaseMCPTransport {
  private app: Express | null = null;
  private httpServer: HttpServer | null = null;
  private connectionManager: ConnectionManager | null = null;
  private config: HttpTransportConfig;

  constructor(config: HttpTransportConfig) {
    super();
    this.config = {
      host: '0.0.0.0',
      enableCors: true,
      enableRateLimit: true,
      maxConnections: 100,
      ...config,
    };
    logger.debug('HttpTransport: Initialized', {
      port: this.config.port,
      host: this.config.host,
      enableCors: this.config.enableCors,
      enableRateLimit: this.config.enableRateLimit,
      maxConnections: this.config.maxConnections,
      hasHandlerDeps: !!this.config.handlerDeps
    });
  }

  async connect(server: Server): Promise<void> {
    try {
      if (this.connected) {
        logger.warn('HttpTransport: Already connected, skipping connection');
        return;
      }

      logger.debug('HttpTransport: Setting up Express application');
      
      // Create Express app
      this.app = express();
      
      // Create HTTP server
      this.httpServer = createServer(this.app);
      
      // Initialize connection manager
      this.connectionManager = new ConnectionManager(this.config.maxConnections || 100);
      
      // Setup middleware
      setupMiddleware(this.app, this.config);
      
      // Setup routes with MCP server instance and handler dependencies
      setupRoutes(this.app, server, this.connectionManager, this.config.handlerDeps);
      
      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(this.config.port, this.config.host, () => {
          logger.info(`HttpTransport: Server listening on ${this.config.host}:${this.config.port}`);
          resolve();
        });
        
        this.httpServer!.on('error', (error) => {
          logger.error('HttpTransport: Server error:', error);
          reject(error);
        });
      });
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.setServer(server);
      this.setConnected(true);
      
      logger.info('HttpTransport: Successfully connected and started HTTP server');
      
      // Display connection info
      console.error(`[INFO] HTTP MCP Server started on http://${this.config.host}:${this.config.port}`);
      console.error(`[INFO] Available endpoints:`);
      console.error(`[INFO]   GET  /health - Health check`);
      console.error(`[INFO]   GET  /mcp/tools - List available tools`);
      console.error(`[INFO]   POST /mcp/tools/:toolName - Execute MCP tool`);
      console.error(`[INFO]   GET  /mcp/resources - List available resources`);
      console.error(`[INFO]   GET  /mcp/resources/:uri - Get resource content`);
      console.error(`[INFO]   GET  /mcp/events/:clientId - SSE stream for updates`);
      
    } catch (error) {
      logger.error('HttpTransport: Connection failed:', error);
      this.setConnected(false);
      await this.cleanup();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.connected) {
        logger.debug('HttpTransport: Already disconnected');
        return;
      }

      logger.debug('HttpTransport: Disconnecting HTTP transport');
      
      await this.cleanup();
      
      this.setServer(null);
      this.setConnected(false);
      
      logger.info('HttpTransport: Successfully disconnected');
    } catch (error) {
      logger.error('HttpTransport: Disconnect failed:', error);
      throw error;
    }
  }

  supportsStreaming(): boolean {
    // HTTP transport supports streaming through SSE and chunked responses
    return true;
  }

  getTransportType(): TransportType {
    return 'http';
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express | null {
    return this.app;
  }

  /**
   * Get the HTTP server instance
   */
  getHttpServer(): HttpServer | null {
    return this.httpServer;
  }

  /**
   * Get the connection manager
   */
  getConnectionManager(): ConnectionManager | null {
    return this.connectionManager;
  }

  /**
   * Get transport configuration
   */
  getConfig(): HttpTransportConfig {
    return { ...this.config };
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`HttpTransport: Received ${signal}, shutting down gracefully...`);
      await this.disconnect();
      process.exit(0);
    };

    // Note: We don't add process listeners here to avoid conflicts with main server
    // The main server should handle graceful shutdown and call disconnect()
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Close all SSE connections
      if (this.connectionManager) {
        await this.connectionManager.closeAllConnections();
        this.connectionManager = null;
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer!.close((error) => {
            if (error) {
              logger.error('HttpTransport: Error closing HTTP server:', error);
              reject(error);
            } else {
              logger.debug('HttpTransport: HTTP server closed');
              resolve();
            }
          });
        });
        this.httpServer = null;
      }

      this.app = null;
      
      logger.debug('HttpTransport: Cleanup completed');
    } catch (error) {
      logger.error('HttpTransport: Cleanup error:', error);
      throw error;
    }
  }
}