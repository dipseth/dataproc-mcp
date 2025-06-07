/**
 * MCP Framework tool for deleting Dataproc clusters
 * Wraps existing handler from src/handlers/cluster-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleDeleteCluster } from '../handlers/cluster-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface DeleteClusterInput {
  clusterName: string;
}

export class DeleteClusterTool extends MCPTool<DeleteClusterInput> {
  name = 'delete_cluster';
  description = 'Delete a Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name of the cluster to delete',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: DeleteClusterInput): Promise<unknown> {
    try {
      return await handleDeleteCluster(input, this.handlerDeps);
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

export default DeleteClusterTool;