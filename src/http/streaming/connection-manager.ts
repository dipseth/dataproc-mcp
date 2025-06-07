/**
 * Connection Manager for HTTP Transport
 * Manages multiple client connections and Server-Sent Events streams
 */

import { Response } from 'express';
import { logger } from '../../utils/logger.js';

/**
 * Client connection information
 */
export interface ClientConnection {
  id: string;
  response: Response;
  connectedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

/**
 * Progress update data for SSE
 */
export interface ProgressUpdate {
  type: 'progress' | 'status' | 'result' | 'error';
  data: any;
  timestamp: Date;
  clientId?: string;
}

/**
 * Manages multiple client connections for Server-Sent Events
 */
export class ConnectionManager {
  private connections: Map<string, ClientConnection> = new Map();
  private maxConnections: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxConnections: number = 100) {
    this.maxConnections = maxConnections;
    this.startCleanupTimer();
    logger.debug(`ConnectionManager: Initialized with max connections: ${maxConnections}`);
  }

  /**
   * Add a new client connection
   */
  addConnection(clientId: string, response: Response): boolean {
    try {
      // Check if we've reached max connections
      if (this.connections.size >= this.maxConnections) {
        logger.warn(`ConnectionManager: Max connections (${this.maxConnections}) reached`);
        return false;
      }

      // Check if client already exists
      if (this.connections.has(clientId)) {
        logger.warn(`ConnectionManager: Client ${clientId} already connected, replacing connection`);
        this.removeConnection(clientId);
      }

      const connection: ClientConnection = {
        id: clientId,
        response,
        connectedAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
      };

      this.connections.set(clientId, connection);
      
      // Setup connection cleanup on client disconnect
      response.on('close', () => {
        logger.debug(`ConnectionManager: Client ${clientId} disconnected`);
        this.removeConnection(clientId);
      });

      response.on('error', (error) => {
        logger.error(`ConnectionManager: Connection error for client ${clientId}:`, error);
        this.removeConnection(clientId);
      });

      logger.debug(`ConnectionManager: Added client ${clientId} (total: ${this.connections.size})`);
      return true;
    } catch (error) {
      logger.error(`ConnectionManager: Error adding connection for ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Remove a client connection
   */
  removeConnection(clientId: string): boolean {
    try {
      const connection = this.connections.get(clientId);
      if (!connection) {
        return false;
      }

      // Mark as inactive
      connection.isActive = false;

      // Try to close the response if still open
      try {
        if (!connection.response.headersSent) {
          connection.response.end();
        }
      } catch (error) {
        // Ignore errors when closing response
        logger.debug(`ConnectionManager: Error closing response for ${clientId}:`, error);
      }

      this.connections.delete(clientId);
      logger.debug(`ConnectionManager: Removed client ${clientId} (total: ${this.connections.size})`);
      return true;
    } catch (error) {
      logger.error(`ConnectionManager: Error removing connection for ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send update to a specific client
   */
  sendToClient(clientId: string, update: ProgressUpdate): boolean {
    try {
      const connection = this.connections.get(clientId);
      if (!connection || !connection.isActive) {
        logger.debug(`ConnectionManager: Client ${clientId} not found or inactive`);
        return false;
      }

      const sseData = this.formatSSEData(update);
      connection.response.write(sseData);
      connection.lastActivity = new Date();

      logger.debug(`ConnectionManager: Sent update to client ${clientId}`);
      return true;
    } catch (error) {
      logger.error(`ConnectionManager: Error sending to client ${clientId}:`, error);
      this.removeConnection(clientId);
      return false;
    }
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcast(update: ProgressUpdate): number {
    let successCount = 0;
    
    for (const [clientId, connection] of this.connections) {
      if (connection.isActive) {
        try {
          const sseData = this.formatSSEData(update);
          connection.response.write(sseData);
          connection.lastActivity = new Date();
          successCount++;
        } catch (error) {
          logger.error(`ConnectionManager: Error broadcasting to client ${clientId}:`, error);
          this.removeConnection(clientId);
        }
      }
    }

    logger.debug(`ConnectionManager: Broadcasted to ${successCount}/${this.connections.size} clients`);
    return successCount;
  }

  /**
   * Get connection information for a client
   */
  getConnection(clientId: string): ClientConnection | null {
    return this.connections.get(clientId) || null;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): ClientConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const activeConnections = this.getActiveConnections();
    return {
      total: this.connections.size,
      active: activeConnections.length,
      maxConnections: this.maxConnections,
      oldestConnection: activeConnections.length > 0 
        ? Math.min(...activeConnections.map(c => c.connectedAt.getTime()))
        : null,
    };
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    logger.info(`ConnectionManager: Closing ${this.connections.size} connections`);
    
    const closePromises = Array.from(this.connections.keys()).map(clientId => 
      new Promise<void>((resolve) => {
        this.removeConnection(clientId);
        resolve();
      })
    );

    await Promise.all(closePromises);
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('ConnectionManager: All connections closed');
  }

  /**
   * Format data for Server-Sent Events
   */
  private formatSSEData(update: ProgressUpdate): string {
    const data = {
      type: update.type,
      data: update.data,
      timestamp: update.timestamp.toISOString(),
      clientId: update.clientId,
    };

    return `data: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * Start cleanup timer for stale connections
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // Cleanup every 30 seconds
  }

  /**
   * Remove stale connections (inactive for more than 5 minutes)
   */
  private cleanupStaleConnections(): void {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const staleConnections: string[] = [];

    for (const [clientId, connection] of this.connections) {
      const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
      if (timeSinceActivity > staleThreshold) {
        staleConnections.push(clientId);
      }
    }

    if (staleConnections.length > 0) {
      logger.debug(`ConnectionManager: Cleaning up ${staleConnections.length} stale connections`);
      staleConnections.forEach(clientId => this.removeConnection(clientId));
    }
  }
}