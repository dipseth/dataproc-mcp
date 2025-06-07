/**
 * MCP Framework tool for checking active jobs
 * Wraps existing handler from src/handlers/job-handlers.ts
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleCheckActiveJobs } from '../handlers/job-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';
import DependencyRegistry from './DependencyRegistry.js';

interface CheckActiveJobsInput {
  includeCompleted?: boolean;
}

export class CheckActiveJobsTool extends MCPTool<CheckActiveJobsInput> {
  name = 'check_active_jobs';
  description = '🚀 Quick status check for all active and recent jobs - perfect for seeing what\'s running!';

  protected schema = {
    includeCompleted: {
      type: z.boolean().optional(),
      description: 'Include recently completed jobs (default: false)',
    },
  };

  private handlerDeps: AllHandlerDependencies;

  constructor(handlerDeps?: AllHandlerDependencies) {
    super();
    // Use provided dependencies or get from registry
    this.handlerDeps = handlerDeps || DependencyRegistry.getInstance().getDependencies();
  }

  protected async execute(input: CheckActiveJobsInput): Promise<unknown> {
    try {
      return await handleCheckActiveJobs(input, this.handlerDeps);
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

export default CheckActiveJobsTool;