/**
 * Server-Sent Events routes for HTTP transport
 * Handles real-time event streaming to clients
 */

import { Express, Request, Response } from 'express';
import { ConnectionManager } from '../streaming/connection-manager.js';
import { logger } from '../../utils/logger.js';
import { validateRequiredParams } from '../middleware.js';

/**
 * Setup Server-Sent Events routes
 */
export function setupSSERoutes(app: Express, connectionManager: ConnectionManager): void {
  
  // SSE endpoint for real-time updates
  app.get('/mcp/events/:clientId', 
    validateRequiredParams(['clientId']),
    (req: Request, res: Response) => {
      const { clientId } = req.params;
      
      try {
        logger.debug(`Setting up SSE connection for client: ${clientId}`, { ip: req.ip });

        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
        });

        // Send initial connection message
        res.write(`data: ${JSON.stringify({
          type: 'connection',
          data: {
            status: 'connected',
            clientId,
            message: 'SSE connection established',
          },
          timestamp: new Date().toISOString(),
        })}\n\n`);

        // Add client to connection manager
        const added = connectionManager.addConnection(clientId, res);
        
        if (!added) {
          logger.warn(`Failed to add client ${clientId} to connection manager`);
          res.write(`data: ${JSON.stringify({
            type: 'error',
            data: {
              status: 'error',
              message: 'Failed to establish connection - server at capacity',
            },
            timestamp: new Date().toISOString(),
          })}\n\n`);
          res.end();
          return;
        }

        // Send periodic heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            res.write(`data: ${JSON.stringify({
              type: 'heartbeat',
              data: {
                status: 'alive',
                timestamp: new Date().toISOString(),
              },
              timestamp: new Date().toISOString(),
            })}\n\n`);
          } catch (error) {
            logger.debug(`Heartbeat failed for client ${clientId}:`, error);
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Send heartbeat every 30 seconds

        // Handle client disconnect
        req.on('close', () => {
          logger.debug(`Client ${clientId} disconnected`);
          clearInterval(heartbeatInterval);
          connectionManager.removeConnection(clientId);
        });

        req.on('error', (error) => {
          logger.error(`SSE connection error for client ${clientId}:`, error);
          clearInterval(heartbeatInterval);
          connectionManager.removeConnection(clientId);
        });

        logger.debug(`SSE connection established for client: ${clientId}`);

      } catch (error) {
        logger.error(`Error setting up SSE for client ${clientId}:`, error);
        res.status(500).json({
          error: 'SSE Setup Failed',
          message: error instanceof Error ? error.message : String(error),
          clientId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // Get connection statistics
  app.get('/mcp/events', (req: Request, res: Response) => {
    try {
      const stats = connectionManager.getStats();
      const activeConnections = connectionManager.getActiveConnections();
      
      res.json({
        statistics: stats,
        activeConnections: activeConnections.map(conn => ({
          id: conn.id,
          connectedAt: conn.connectedAt,
          lastActivity: conn.lastActivity,
          isActive: conn.isActive,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting connection stats:', error);
      res.status(500).json({
        error: 'Failed to get connection statistics',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Send test message to a specific client (for debugging)
  app.post('/mcp/events/:clientId/test', 
    validateRequiredParams(['clientId']),
    (req: Request, res: Response) => {
      const { clientId } = req.params;
      const { message = 'Test message' } = req.body;

      try {
        const success = connectionManager.sendToClient(clientId, {
          type: 'status',
          data: {
            status: 'test',
            message,
            source: 'manual_test',
          },
          timestamp: new Date(),
          clientId,
        });

        if (success) {
          res.json({
            success: true,
            message: 'Test message sent successfully',
            clientId,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Client not found or inactive',
            clientId,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error(`Error sending test message to client ${clientId}:`, error);
        res.status(500).json({
          error: 'Failed to send test message',
          message: error instanceof Error ? error.message : String(error),
          clientId,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  logger.debug('SSE routes setup completed');
}