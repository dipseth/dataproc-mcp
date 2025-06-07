/**
 * Standalone MCP Framework tool for listing Dataproc clusters
 * This version works without external dependencies for auto-discovery
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';

interface ListClustersInput {
  verbose?: boolean;
  semanticQuery?: string;
}

export class ListClustersStandaloneTool extends MCPTool<ListClustersInput> {
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

  protected async execute(input: ListClustersInput): Promise<unknown> {
    try {
      // For now, return a simple error message indicating missing configuration
      return {
        content: [
          {
            type: 'text',
            text: `Error: Missing required parameters: projectId, region. Please configure default parameters or provide them in the request.`,
          },
        ],
      };
    } catch (error) {
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

export default ListClustersStandaloneTool;