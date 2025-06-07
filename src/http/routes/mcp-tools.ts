/**
 * MCP Tools routes for HTTP transport
 * Handles tool listing and execution with streaming support
 */

import { Express, Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { ConnectionManager, ProgressUpdate } from '../streaming/connection-manager.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler, validateJsonContentType, validateRequiredParams } from '../middleware.js';
import { allTools } from '../../tools/index.js';
import { handleToolCall, AllHandlerDependencies } from '../../handlers/index.js';

/**
 * Setup MCP tool routes
 */
export function setupMcpToolRoutes(
  app: Express,
  mcpServer: Server,
  connectionManager: ConnectionManager,
  handlerDeps?: AllHandlerDependencies
): void {
  
  // List available tools
  app.get('/mcp/tools', asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.debug('Listing MCP tools', { ip: req.ip });
      
      res.json({
        tools: allTools,
        count: allTools.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error listing tools:', error);
      res.status(500).json({
        error: 'Failed to list tools',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }));

  // Execute a specific tool
  app.post('/mcp/tools/:toolName', 
    validateJsonContentType,
    validateRequiredParams(['toolName']),
    asyncHandler(async (req: Request, res: Response) => {
      const { toolName } = req.params;
      const { arguments: toolArgs, clientId, streaming = false } = req.body;

      try {
        logger.debug(`Executing tool: ${toolName}`, { 
          ip: req.ip, 
          clientId,
          streaming,
          argsKeys: toolArgs ? Object.keys(toolArgs) : []
        });

        // Validate tool arguments
        if (toolArgs && typeof toolArgs !== 'object') {
          return res.status(400).json({
            error: 'Invalid Arguments',
            message: 'Tool arguments must be an object',
            timestamp: new Date().toISOString(),
          });
        }

        // Send progress update if streaming and clientId provided
        if (streaming && clientId) {
          const progressUpdate: ProgressUpdate = {
            type: 'status',
            data: {
              status: 'started',
              toolName,
              message: `Starting execution of ${toolName}`,
            },
            timestamp: new Date(),
            clientId,
          };
          connectionManager.sendToClient(clientId, progressUpdate);
        }

        // Execute the tool using existing handler logic
        const startTime = Date.now();
        
        // Use provided dependencies or create minimal object
        const deps = handlerDeps || {};
        
        const result = await handleToolCall(toolName, toolArgs || {}, deps);

        const duration = Date.now() - startTime;

        // Send completion update if streaming
        if (streaming && clientId) {
          const progressUpdate: ProgressUpdate = {
            type: 'result',
            data: {
              status: 'completed',
              toolName,
              result,
              duration,
            },
            timestamp: new Date(),
            clientId,
          };
          connectionManager.sendToClient(clientId, progressUpdate);
        }

        // Return result
        res.json({
          toolName,
          result,
          duration,
          streaming,
          clientId: streaming ? clientId : undefined,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        logger.error(`Error executing tool ${toolName}:`, error);

        // Send error update if streaming
        if (streaming && clientId) {
          const progressUpdate: ProgressUpdate = {
            type: 'error',
            data: {
              status: 'error',
              toolName,
              error: error instanceof Error ? error.message : String(error),
            },
            timestamp: new Date(),
            clientId,
          };
          connectionManager.sendToClient(clientId, progressUpdate);
        }

        // Determine error status code
        let statusCode = 500;
        if (error instanceof McpError) {
          switch (error.code) {
            case ErrorCode.InvalidParams:
              statusCode = 400;
              break;
            case ErrorCode.MethodNotFound:
              statusCode = 404;
              break;
            case ErrorCode.InvalidRequest:
              statusCode = 400;
              break;
            default:
              statusCode = 500;
          }
        }

        res.status(statusCode).json({
          error: 'Tool Execution Failed',
          toolName,
          message: error instanceof Error ? error.message : String(error),
          streaming,
          clientId: streaming ? clientId : undefined,
          timestamp: new Date().toISOString(),
        });
      }
    })
  );

  logger.debug('MCP tools routes setup completed');
}