/**
 * Transport Factory for MCP server
 * Creates appropriate transport instances based on configuration and command line arguments
 */

import { MCPTransport } from './base-transport.js';
import { StdioTransport } from './stdio-transport.js';
import { HttpTransport, HttpTransportConfig } from './http-transport.js';
import { McpFrameworkHttpTransport, McpFrameworkHttpConfig } from './mcp-framework-http-transport.js';
import { logger } from '../utils/logger.js';

/**
 * Configuration options for transport creation
 */
export interface TransportConfig {
  /** Whether HTTP mode is requested */
  httpMode: boolean;
  /** Port number for HTTP transport (default: 3000) */
  port: number;
  /** Additional transport-specific options */
  options?: Record<string, unknown>;
  /** Handler dependencies for HTTP transport */
  handlerDeps?: any; // Using any to avoid circular dependency
}

/**
 * Factory class for creating MCP transports
 */
export class TransportFactory {
  /**
   * Create a transport instance based on the provided configuration
   * @param config - Transport configuration
   * @returns Promise resolving to the created transport
   */
  static async createTransport(config: TransportConfig): Promise<MCPTransport> {
    logger.debug('TransportFactory: Creating transport', {
      httpMode: config.httpMode,
      port: config.port,
      hasHandlerDeps: !!config.handlerDeps
    });

    if (config.httpMode) {
      logger.debug('TransportFactory: Creating MCP Framework HTTP transport');
      
      const mcpHttpConfig: McpFrameworkHttpConfig = {
        port: config.port,
        enableCors: true,
        handlerDeps: config.handlerDeps,
        ...config.options,
      };

      try {
        const mcpHttpTransport = new McpFrameworkHttpTransport(mcpHttpConfig);
        logger.debug('TransportFactory: MCP Framework HTTP transport created successfully');
        return mcpHttpTransport;
      } catch (error) {
        logger.error('TransportFactory: Failed to create MCP Framework HTTP transport:', error);
        console.error('[ERROR] Failed to create MCP Framework HTTP transport:', error);
        console.error('[ERROR] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : typeof error
        });
        console.error('[INFO] Falling back to legacy HTTP transport');
        
        // Try legacy HTTP transport as fallback
        try {
          const httpConfig: HttpTransportConfig = {
            port: config.port,
            enableCors: true,
            enableRateLimit: true,
            maxConnections: 100,
            handlerDeps: config.handlerDeps,
            ...config.options,
          };
          
          const httpTransport = new HttpTransport(httpConfig);
          logger.debug('TransportFactory: Legacy HTTP transport created successfully');
          return httpTransport;
        } catch (legacyError) {
          logger.error('TransportFactory: Failed to create legacy HTTP transport:', legacyError);
          console.error('[ERROR] Failed to create legacy HTTP transport:', legacyError);
          console.error('[INFO] Falling back to STDIO transport');
          // Fall through to STDIO transport as final fallback
        }
      }
    }

    // Default to STDIO transport for backward compatibility
    logger.debug('TransportFactory: Creating STDIO transport');
    return new StdioTransport();
  }

  /**
   * Create a transport from command line arguments
   * Parses the arguments and creates appropriate transport configuration
   * @param args - Command line arguments (typically process.argv.slice(2))
   * @returns Promise resolving to the created transport
   */
  static async createFromArgs(args: string[]): Promise<MCPTransport> {
    const httpMode = args.includes('--http');
    const portIndex = args.indexOf('--port');
    const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 3000;

    const config: TransportConfig = {
      httpMode,
      port,
    };

    logger.debug('TransportFactory: Parsed command line args:', { httpMode, port });
    return this.createTransport(config);
  }

  /**
   * Get available transport types
   * @returns Array of supported transport type strings
   */
  static getSupportedTransports(): string[] {
    return ['stdio', 'http']; // http will be implemented in Phase 2
  }

  /**
   * Check if a transport type is supported
   * @param transportType - The transport type to check
   * @returns true if supported, false otherwise
   */
  static isTransportSupported(transportType: string): boolean {
    return this.getSupportedTransports().includes(transportType);
  }
}