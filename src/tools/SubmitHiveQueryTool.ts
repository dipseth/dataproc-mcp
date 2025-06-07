/**
 * MCP Framework tool for submitting Hive queries
 * Wraps existing handler from src/handlers/job-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleSubmitHiveQuery } from '../handlers/job-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface SubmitHiveQueryInput {
  clusterName: string;
  query: string;
  async?: boolean;
  verbose?: boolean;
  queryOptions?: Record<string, any>;
}

export class SubmitHiveQueryTool extends MCPTool<SubmitHiveQueryInput> {
  name = 'submit_hive_query';
  description = 'Submit a Hive query to a Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name of the cluster to run the query on',
    },
    query: {
      type: z.string(),
      description: 'Hive query to execute',
    },
    async: {
      type: z.boolean().optional(),
      description: 'Optional: Whether to wait for query completion (false) or return immediately (true)',
    },
    verbose: {
      type: z.boolean().optional(),
      description: 'Optional: Return full response without filtering (default: false)',
    },
    queryOptions: {
      type: z.record(z.any()).optional(),
      description: 'Optional: Query configuration options',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: SubmitHiveQueryInput): Promise<unknown> {
    try {
      return await handleSubmitHiveQuery(input, this.handlerDeps);
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

export default SubmitHiveQueryTool;