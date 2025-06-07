/**
 * MCP Framework tool for getting profile details
 * Wraps existing handler from src/handlers/profile-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleGetProfile } from '../handlers/profile-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

interface GetProfileInput {
  profileId: string;
  projectId?: string;
  region?: string;
}

export class GetProfileTool extends MCPTool<GetProfileInput> {
  name = 'get_profile';
  description = 'Get details for a specific cluster configuration profile';

  protected schema = {
    profileId: {
      type: z.string(),
      description: 'ID of the profile',
    },
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

  constructor(handlerDeps: AllHandlerDependencies) {
    super();
    this.handlerDeps = handlerDeps;
  }

  protected async execute(input: GetProfileInput): Promise<unknown> {
    try {
      return await handleGetProfile(input, this.handlerDeps);
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

export default GetProfileTool;