/**
 * Health check route for HTTP MCP transport
 */

import { Express, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import { asyncHandler } from '../middleware.js';

/**
 * Setup health check route
 */
export function setupHealthRoute(app: Express): void {
  app.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      transport: 'http',
      capabilities: {
        streaming: true,
        tools: true,
        resources: true,
        events: true,
      },
    };

    logger.debug('Health check requested', { ip: req.ip });
    res.json(healthData);
  }));

  logger.debug('Health route setup completed');
}