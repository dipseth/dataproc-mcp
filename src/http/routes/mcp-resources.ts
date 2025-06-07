/**
 * MCP Resources routes for HTTP transport
 * Handles resource listing and content retrieval
 */

import { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler, validateRequiredParams } from '../middleware.js';

/**
 * Setup MCP resource routes
 */
export function setupMcpResourceRoutes(app: Express, mcpServer: Server): void {
  
  // List available resources
  app.get('/mcp/resources', asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.debug('Listing MCP resources', { ip: req.ip });
      
      // Create a mock request to trigger the existing resource handler
      const mockRequest = {
        method: 'resources/list',
        params: {},
      };

      // We'll need to access the server's resource list directly
      // For now, return a basic structure that matches the expected format
      const resources = [
        {
          uri: 'dataproc://config/defaults',
          name: 'Default Configuration',
          description: 'Default project ID and region extracted from profiles',
          mimeType: 'application/json',
        },
      ];

      res.json({
        resources,
        count: resources.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error listing resources:', error);
      res.status(500).json({
        error: 'Failed to list resources',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }));

  // Get specific resource content
  app.get('/mcp/resources/*', 
    asyncHandler(async (req: Request, res: Response) => {
      try {
        // Extract URI from the path (everything after /mcp/resources/)
        const uri = req.path.replace('/mcp/resources/', '');
        
        if (!uri) {
          return res.status(400).json({
            error: 'Missing Resource URI',
            message: 'Resource URI is required',
            timestamp: new Date().toISOString(),
          });
        }

        logger.debug(`Getting resource: ${uri}`, { ip: req.ip });

        // For now, return a basic response structure
        // This will be enhanced when we integrate with the actual resource handlers
        if (uri === 'dataproc://config/defaults') {
          const defaultConfig = {
            projectId: 'Not configured',
            region: 'Not configured',
            zone: 'Not configured',
          };

          res.json({
            uri,
            mimeType: 'application/json',
            content: defaultConfig,
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(404).json({
            error: 'Resource Not Found',
            message: `Resource with URI '${uri}' not found`,
            uri,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('Error getting resource:', error);
        res.status(500).json({
          error: 'Failed to get resource',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    })
  );

  logger.debug('MCP resources routes setup completed');
}