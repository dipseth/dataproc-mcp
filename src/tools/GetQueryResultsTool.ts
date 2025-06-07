/**
 * MCP Framework tool for getting query results
 * Wraps existing handler from src/handlers/job-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetQueryResults } from '../handlers/job-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface GetQueryResultsInput {
  jobId: string;
  maxResults?: number;
  pageToken?: string;
}

export class GetQueryResultsTool extends MCPTool<GetQueryResultsInput> {
  name = 'get_query_results';
  description = 'Get the results of a completed Hive query with enhanced async support and semantic search integration';

  protected schema = {
    jobId: {
      type: z.string(),
      description: 'Job ID to get results for',
    },
    maxResults: {
      type: z.number().optional(),
      description: 'Optional: Maximum number of rows to display in the response (default: 10)',
    },
    pageToken: {
      type: z.string().optional(),
      description: 'Optional: Page token for pagination',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: GetQueryResultsInput): Promise<unknown> {
    try {
      return await handleGetQueryResults(input, this.handlerDeps);
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

export default GetQueryResultsTool;