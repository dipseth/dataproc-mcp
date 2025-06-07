/**
 * MCP Framework tool for getting cluster insights
 * Wraps existing handler from src/handlers/knowledge-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetClusterInsights } from '../handlers/knowledge-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import DependencyRegistry from './DependencyRegistry.js';

interface GetClusterInsightsInput {
  projectId?: string;
  region?: string;
}

export class GetClusterInsightsTool extends MCPTool<GetClusterInsightsInput> {
  name = 'get_cluster_insights';
  description = '📊 Get comprehensive insights about discovered clusters, machine types, components, and recent discoveries';

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

  constructor(handlerDeps?: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps || DependencyRegistry.getInstance().getDependencies();
  }

  protected async execute(input: GetClusterInsightsInput): Promise<unknown> {
    try {
      return await handleGetClusterInsights(input, this.handlerDeps);
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

export default GetClusterInsightsTool;