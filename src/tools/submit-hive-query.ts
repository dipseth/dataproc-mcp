/**
 * Standalone MCP Framework tool for submitting Hive queries
 * This version integrates with the existing handler system
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleSubmitHiveQuery } from '../handlers/job-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

// Import services to create dependencies
import { getCredentialsConfig } from '../config/credentials.js';
import { getServerConfig } from '../config/server.js';
import { InitializationManager } from '../services/initialization-manager.js';
import { ProfileManager } from '../services/profile.js';
import { ClusterTracker } from '../services/tracker.js';
import { JobTracker } from '../services/job-tracker.js';
import { DefaultParameterManager } from '../services/default-params.js';
import { ResponseFilter } from '../services/response-filter.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { SemanticQueryService } from '../services/semantic-query.js';
import { TemplatingIntegration, initializeTemplatingIntegration } from '../services/templating-integration.js';

interface SubmitHiveQueryInput {
  clusterName: string;
  query: string;
  async?: boolean;
  verbose?: boolean;
  queryOptions?: string;
}

class SubmitHiveQueryTool extends MCPTool<SubmitHiveQueryInput> {
  name = 'submit_hive_query';
  description = 'Submit a Hive query to a Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name of the cluster to run the query on',
    },
    query: {
      type: z.string(),
      description: 'Hive query to execute',
    },
    async: {
      type: z.boolean().optional(),
      description: 'Optional: Whether to wait for query completion (false) or return immediately (true)',
    },
    verbose: {
      type: z.boolean().optional(),
      description: 'Optional: Return full response without filtering (default: false)',
    },
    queryOptions: {
      type: z.string().optional(),
      description: 'Optional: Query configuration options',
    },
  };

  private async createHandlerDependencies(): Promise<AllHandlerDependencies> {
    try {
      // Initialize minimal services needed for the handler
      const initManager = new InitializationManager();
      
      // Initialize default parameters
      const defaultParams = await initManager.initializeDefaultParams();
      const defaultParamManager = defaultParams; // Can be undefined

      // Initialize basic services
      const serverConfig = await getServerConfig();
      const profileManager = new ProfileManager(serverConfig.profileManager);
      await profileManager.initialize();

      const clusterTracker = new ClusterTracker();
      await clusterTracker.initialize();

      // Initialize job tracker for Hive queries
      const jobTracker = new JobTracker();

      // Create minimal dependencies object
      const handlerDeps: AllHandlerDependencies = {
        defaultParamManager,
        profileManager,
        clusterTracker,
        jobTracker,
        // Optional services can be undefined
        responseFilter: undefined,
        knowledgeIndexer: undefined,
        asyncQueryPoller: undefined,
        semanticQueryService: undefined,
        templatingIntegration: undefined,
      };

      return handlerDeps;
    } catch (error) {
      console.error('[ERROR] Failed to create handler dependencies:', error);
      // Return minimal dependencies
      return {
        defaultParamManager: undefined,
        profileManager: undefined,
        clusterTracker: undefined,
        responseFilter: undefined,
        knowledgeIndexer: undefined,
        jobTracker: undefined,
        asyncQueryPoller: undefined,
        semanticQueryService: undefined,
        templatingIntegration: undefined,
      };
    }
  }

  protected async execute(input: SubmitHiveQueryInput): Promise<unknown> {
    try {
      console.log('[DEBUG] SubmitHiveQueryTool: Executing with input:', input);
      
      // Create handler dependencies
      const handlerDeps = await this.createHandlerDependencies();
      
      // Call the existing handler
      const result = await handleSubmitHiveQuery(input, handlerDeps);
      
      console.log('[DEBUG] SubmitHiveQueryTool: Handler result:', result);
      return result;
      
    } catch (error) {
      console.error('[ERROR] SubmitHiveQueryTool: Execution failed:', error);
      
      // Return proper MCP response format
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          },
        ],
      };
    }
  }
}

export default SubmitHiveQueryTool;