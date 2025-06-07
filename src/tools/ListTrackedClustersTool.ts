/**
 * MCP Framework tool for listing tracked clusters
 * Wraps existing handler from src/handlers/profile-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleListTrackedClusters } from '../handlers/profile-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface ListTrackedClustersInput {
  projectId?: string;
  region?: string;
  profileId?: string;
}

export class ListTrackedClustersTool extends MCPTool<ListTrackedClustersInput> {
  name = 'list_tracked_clusters';
  description = 'List clusters that were created and tracked by this MCP server';

  protected schema = {
    projectId: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud Project ID',
    },
    region: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud region',
    },
    profileId: {
      type: z.string().optional(),
      description: 'Optional: Filter by profile ID',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: ListTrackedClustersInput): Promise<unknown> {
    try {
      return await handleListTrackedClusters(input, this.handlerDeps);
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

export default ListTrackedClustersTool;