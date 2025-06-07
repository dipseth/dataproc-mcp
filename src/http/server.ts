/**
 * Express server setup for HTTP MCP transport
 * Configures routes and endpoints for MCP tools and resources
 */

import { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ConnectionManager } from './streaming/connection-manager.js';
import { logger } from '../utils/logger.js';
import { asyncHandler, validateJsonContentType } from './middleware.js';
import { AllHandlerDependencies } from '../handlers/index.js';

// Import route handlers
import { setupMcpToolRoutes } from './routes/mcp-tools.js';
import { setupMcpResourceRoutes } from './routes/mcp-resources.js';
import { setupSSERoutes } from './routes/sse-events.js';
import { setupHealthRoute } from './routes/health.js';

/**
 * Setup all routes for the Express app
 */
export function setupRoutes(
  app: Express,
  mcpServer: Server,
  connectionManager: ConnectionManager,
  handlerDeps?: AllHandlerDependencies
): void {
  logger.debug('Setting up HTTP routes');

  // Health check endpoint
  setupHealthRoute(app);

  // MCP tool endpoints
  setupMcpToolRoutes(app, mcpServer, connectionManager, handlerDeps);

  // MCP resource endpoints  
  setupMcpResourceRoutes(app, mcpServer);

  // Server-Sent Events endpoints
  setupSSERoutes(app, connectionManager);

  // Root endpoint with API information
  app.get('/', asyncHandler(async (req: Request, res: Response) => {
    res.json({
      name: 'Dataproc MCP Server',
      version: '4.1.0',
      description: 'HTTP transport for Model Context Protocol server providing Google Cloud Dataproc operations',
      transport: 'http',
      capabilities: {
        streaming: true,
        tools: true,
        resources: true,
        events: true,
      },
      endpoints: {
        health: 'GET /health',
        tools: {
          list: 'GET /mcp/tools',
          execute: 'POST /mcp/tools/:toolName',
        },
        resources: {
          list: 'GET /mcp/resources',
          get: 'GET /mcp/resources/:uri',
        },
        events: {
          stream: 'GET /mcp/events/:clientId',
        },
      },
      documentation: 'https://dipseth.github.io/dataproc-mcp/',
      timestamp: new Date().toISOString(),
    });
  }));

  // 404 handler - must be last
  app.use((req: Request, res: Response) => {
    const requestId = res.get('X-Request-ID') || 'unknown';
    
    logger.debug(`HTTP 404 - ${req.method} ${req.path}`, {
      requestId,
      ip: req.ip,
    });

    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.method} ${req.path} not found`,
      requestId,
      timestamp: new Date().toISOString(),
      availableEndpoints: [
        'GET /',
        'GET /health',
        'GET /mcp/tools',
        'POST /mcp/tools/:toolName',
        'GET /mcp/resources',
        'GET /mcp/resources/:uri',
        'GET /mcp/events/:clientId',
      ],
    });
  });

  logger.debug('HTTP routes setup completed');
}