/**
 * MCP Framework tool for getting job analytics
 * Wraps existing handler from src/handlers/knowledge-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetJobAnalytics } from '../handlers/knowledge-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface GetJobAnalyticsInput {
  projectId?: string;
  region?: string;
}

export class GetJobAnalyticsTool extends MCPTool<GetJobAnalyticsInput> {
  name = 'get_job_analytics';
  description = '📈 Get analytics about job submissions, success rates, error patterns, and performance metrics';

  protected schema = {
    projectId: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud Project ID',
    },
    region: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud region',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: GetJobAnalyticsInput): Promise<unknown> {
    try {
      return await handleGetJobAnalytics(input, this.handlerDeps);
    } catch (error) {
      // Convert McpError to proper response format
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
      
      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      };
    }
  }
}

export default GetJobAnalyticsTool;