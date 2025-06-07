/**
 * Base transport interface for MCP server
 * Provides abstraction layer for different transport mechanisms (STDIO, HTTP, etc.)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Transport types supported by the MCP server
 */
export type TransportType = 'stdio' | 'http';

/**
 * Abstract base interface for MCP transports
 * All transport implementations must implement this interface
 */
export interface MCPTransport {
  /**
   * Connect the server to this transport
   * @param server - The MCP server instance to connect
   */
  connect(server: Server): Promise<void>;

  /**
   * Disconnect from the transport
   * Performs cleanup and graceful shutdown
   */
  disconnect(): Promise<void>;

  /**
   * Check if the transport is currently connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;

  /**
   * Check if this transport supports streaming operations
   * @returns true if streaming is supported, false otherwise
   */
  supportsStreaming(): boolean;

  /**
   * Get the transport type identifier
   * @returns the transport type
   */
  getTransportType(): TransportType;
}

/**
 * Abstract base class for MCP transports
 * Provides common functionality and enforces the interface contract
 */
export abstract class BaseMCPTransport implements MCPTransport {
  protected connected: boolean = false;
  protected server: Server | null = null;

  abstract connect(server: Server): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract supportsStreaming(): boolean;
  abstract getTransportType(): TransportType;

  isConnected(): boolean {
    return this.connected;
  }

  protected setConnected(connected: boolean): void {
    this.connected = connected;
  }

  protected setServer(server: Server | null): void {
    this.server = server;
  }

  protected getServer(): Server | null {
    return this.server;
  }
}