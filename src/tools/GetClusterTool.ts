/**
 * MCP Framework tool for getting cluster details
 * Wraps existing handler from src/handlers/cluster-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetCluster } from '../handlers/cluster-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import DependencyRegistry from './DependencyRegistry.js';

interface GetClusterInput {
  clusterName: string;
  verbose?: boolean;
  semanticQuery?: string;
}

export class GetClusterTool extends MCPTool<GetClusterInput> {
  name = 'get_cluster';
  description = 'Get details for a specific Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name of the cluster',
    },
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

  constructor(handlerDeps?: AllHandlerDependencies) {
    super();
    // Use provided dependencies or get from registry
    this.handlerDeps = handlerDeps || DependencyRegistry.getInstance().getDependencies();
  }

  protected async execute(input: GetClusterInput): Promise<unknown> {
    try {
      return await handleGetCluster(input, this.handlerDeps);
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

export default GetClusterTool;