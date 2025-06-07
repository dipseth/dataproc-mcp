/**
 * MCP Framework tool for getting query status
 * Wraps existing handler from src/handlers/job-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetQueryStatus } from '../handlers/job-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface GetQueryStatusInput {
  jobId: string;
}

export class GetQueryStatusTool extends MCPTool<GetQueryStatusInput> {
  name = 'get_query_status';
  description = 'Get the status of a Hive query job';

  protected schema = {
    jobId: {
      type: z.string(),
      description: 'Job ID to check',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: GetQueryStatusInput): Promise<unknown> {
    try {
      return await handleGetQueryStatus(input, this.handlerDeps);
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

export default GetQueryStatusTool;