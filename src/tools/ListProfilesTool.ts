/**
 * MCP Framework tool for listing profiles
 * Wraps existing handler from src/handlers/profile-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleListProfiles } from '../handlers/profile-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import DependencyRegistry from './DependencyRegistry.js';

interface ListProfilesInput {
  projectId?: string;
  region?: string;
  category?: string;
}

export class ListProfilesTool extends MCPTool<ListProfilesInput> {
  name = 'list_profiles';
  description = 'List available cluster configuration profiles';

  protected schema = {
    projectId: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud Project ID',
    },
    region: {
      type: z.string().optional(),
      description: 'Optional: Google Cloud region',
    },
    category: {
      type: z.string().optional(),
      description: 'Optional: Filter by category',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps?: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps || DependencyRegistry.getInstance().getDependencies();
  }

  protected async execute(input: ListProfilesInput): Promise<unknown> {
    try {
      return await handleListProfiles(input, this.handlerDeps);
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

export default ListProfilesTool;