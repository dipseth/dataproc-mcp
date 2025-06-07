/**
 * MCP Framework tool for listing Dataproc clusters
 * Wraps existing handler from src/handlers/cluster-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleListClusters } from '../handlers/cluster-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface ListClustersInput {
  verbose?: boolean;
  semanticQuery?: string;
}

export class ListClustersTool extends MCPTool<ListClustersInput> {
  name = 'list_clusters';
  description = 'List Dataproc clusters in a project and region';

  protected schema = {
    verbose: {
      type: z.boolean().optional(),
      description: 'Optional: Return full response without filtering (default: false)',
    },
    semanticQuery: {
      type: z.string().optional(),
      description: 'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: ListClustersInput): Promise<unknown> {
    try {
      return await handleListClusters(input, this.handlerDeps);
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

export default ListClustersTool;