/**
 * MCP Framework tool for querying cluster data
 * Wraps existing handler from src/handlers/knowledge-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleQueryClusterData } from '../handlers/knowledge-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface QueryClusterDataInput {
  query: string;
  projectId?: string;
  region?: string;
  clusterName?: string;
  limit?: number;
}

export class QueryClusterDataTool extends MCPTool<QueryClusterDataInput> {
  name = 'query_cluster_data';
  description = 'Query stored cluster data using natural language (e.g., "pip packages", "machine types", "network config")';

  protected schema = {
    query: {
      type: z.string(),
      description: 'Natural language query (e.g., "pip packages", "machine configuration", "network settings")',
    },
    projectId: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud Project ID',
    },
    region: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud region',
    },
    clusterName: {
      type: z.string().optional(),
      description: 'Filter by specific cluster name (optional)',
    },
    limit: {
      type: z.number().optional(),
      description: 'Maximum number of results (default: 5)',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: QueryClusterDataInput): Promise<unknown> {
    try {
      return await handleQueryClusterData(input, this.handlerDeps);
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

export default QueryClusterDataTool;