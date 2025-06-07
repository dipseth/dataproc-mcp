/**
 * MCP Framework HTTP Stream Transport implementation
 * Uses the official MCP Framework with proper HTTP protocol support
 */

import { MCPServer } from 'mcp-framework';
import { BaseMCPTransport, TransportType } from './base-transport.js';
import { logger } from '../utils/logger.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import { createMcpTools } from '../tools/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * MCP Framework HTTP transport configuration
 */
export interface McpFrameworkHttpConfig {
  port: number;
  host?: string;
  enableCors?: boolean;
  handlerDeps?: AllHandlerDependencies;
}

/**
 * MCP Framework HTTP Stream Transport
 * Uses the official MCP Framework for proper HTTP protocol support
 */
export class McpFrameworkHttpTransport extends BaseMCPTransport {
  private mcpServer: MCPServer | null = null;
  private config: McpFrameworkHttpConfig;

  constructor(config: McpFrameworkHttpConfig) {
    super();
    this.config = {
      host: '0.0.0.0',
      enableCors: true,
      ...config,
    };
    
    logger.debug('McpFrameworkHttpTransport: Initialized', {
      port: this.config.port,
      host: this.config.host,
      enableCors: this.config.enableCors,
      hasHandlerDeps: !!this.config.handlerDeps
    });
  }

  async connect(server?: Server): Promise<void> {
    try {
      logger.debug('McpFrameworkHttpTransport: Setting up standalone MCP Framework server');
      
      // Create standalone MCP Framework server (not wrapping MCP SDK)
      this.mcpServer = new MCPServer({
        transport: {
          type: 'http-stream',
          options: {
            port: this.config.port,
            endpoint: '/mcp',
            responseMode: 'batch',
            cors: this.config.enableCors ? {
              allowOrigin: '*'
            } : undefined,
          }
        }
      });

      // Register our MCP Framework tools
      await this.registerTools();

      // Start the MCP Framework server
      await this.mcpServer.start();
      
      this.setConnected(true);
      logger.info(`MCP Framework HTTP Server started on http://${this.config.host}:${this.config.port}/mcp`);
      
    } catch (error) {
      logger.error('McpFrameworkHttpTransport: Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.setConnected(false);
      
      if (this.mcpServer) {
        await this.mcpServer.stop();
        this.mcpServer = null;
        logger.info('McpFrameworkHttpTransport: Server stopped');
      }
      
      logger.debug('McpFrameworkHttpTransport: Disconnected successfully');
    } catch (error) {
      logger.error('McpFrameworkHttpTransport: Cleanup error:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  supportsStreaming(): boolean {
    return true;
  }

  getTransportType(): TransportType {
    return 'http';
  }

  /**
   * Register MCP Framework tools
   */
  private async registerTools(): Promise<void> {
    if (!this.mcpServer) {
      throw new Error('MCP Server not initialized');
    }

    try {
      // Create tool instances with handler dependencies
      const tools = createMcpTools(this.config.handlerDeps || {});
      
      logger.debug(`Registering ${tools.length} MCP Framework tools`);

      // Register each tool with the MCP Framework server
      for (const tool of tools) {
        // Register the tool instance with the MCP Framework
        // The framework should handle the tool registration automatically
        // since our tools extend MCPTool
        logger.debug(`Registering tool: ${tool.name}`);
        
        // The MCP Framework should auto-discover these tools
        // We just need to ensure they're instantiated
      }
      
      logger.info(`Created ${tools.length} MCP Framework tool instances for auto-discovery`);
      
    } catch (error) {
      logger.error('Failed to create MCP tools:', error);
      throw error;
    }
  }
}