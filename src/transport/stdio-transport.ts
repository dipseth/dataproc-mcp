/**
 * STDIO Transport implementation for MCP server
 * Wraps the existing StdioServerTransport from the MCP SDK
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseMCPTransport, TransportType } from './base-transport.js';
import { logger } from '../utils/logger.js';

/**
 * STDIO transport implementation
 * Maintains exact same behavior as the original StdioServerTransport usage
 */
export class StdioTransport extends BaseMCPTransport {
  private transport: StdioServerTransport | null = null;

  constructor() {
    super();
    logger.debug('StdioTransport: Initialized');
  }

  async connect(server: Server): Promise<void> {
    try {
      if (this.connected) {
        logger.warn('StdioTransport: Already connected, skipping connection');
        return;
      }

      logger.debug('StdioTransport: Creating StdioServerTransport');
      this.transport = new StdioServerTransport();
      
      logger.debug('StdioTransport: Connecting server to transport');
      await server.connect(this.transport);
      
      this.setServer(server);
      this.setConnected(true);
      
      logger.debug('StdioTransport: Successfully connected');
    } catch (error) {
      logger.error('StdioTransport: Connection failed:', error);
      this.setConnected(false);
      this.transport = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (!this.connected) {
        logger.debug('StdioTransport: Already disconnected');
        return;
      }

      logger.debug('StdioTransport: Disconnecting');
      
      // The StdioServerTransport doesn't have an explicit disconnect method
      // Connection cleanup is handled by the server itself
      this.transport = null;
      this.setServer(null);
      this.setConnected(false);
      
      logger.debug('StdioTransport: Successfully disconnected');
    } catch (error) {
      logger.error('StdioTransport: Disconnect failed:', error);
      throw error;
    }
  }

  supportsStreaming(): boolean {
    // STDIO transport supports streaming through stdin/stdout
    return true;
  }

  getTransportType(): TransportType {
    return 'stdio';
  }

  /**
   * Get the underlying StdioServerTransport instance
   * @returns the transport instance or null if not connected
   */
  getUnderlyingTransport(): StdioServerTransport | null {
    return this.transport;
  }
}