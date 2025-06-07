/**
 * MCP Framework tool for starting Dataproc clusters
 * Wraps existing handler from src/handlers/cluster-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleStartDataprocCluster } from '../handlers/cluster-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface StartClusterInput {
  clusterName: string;
  clusterConfig?: Record<string, any>;
}

export class StartDataprocClusterTool extends MCPTool<StartClusterInput> {
  name = 'start_dataproc_cluster';
  description = 'Start a Google Cloud Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name for the new cluster',
    },
    clusterConfig: {
      type: z.record(z.any()).optional(),
      description: 'Optional: Dataproc cluster config (JSON object)',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: StartClusterInput): Promise<unknown> {
    try {
      return await handleStartDataprocCluster(input, this.handlerDeps);
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

export default StartDataprocClusterTool;