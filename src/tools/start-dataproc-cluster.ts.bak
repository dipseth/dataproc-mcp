/**
 * Standalone MCP Framework tool for starting Dataproc clusters
 * This version integrates with the existing handler system
 */

import { MCPTool } from 'mcp-framework';
import { z } from 'zod';
import { handleStartDataprocCluster } from '../handlers/cluster-handlers.js';
import { AllHandlerDependencies } from '../handlers/index.js';

// Import services to create dependencies
import { getCredentialsConfig } from '../config/credentials.js';
import { getServerConfig } from '../config/server.js';
import { InitializationManager } from '../services/initialization-manager.js';
import { ProfileManager } from '../services/profile.js';
import { ClusterTracker } from '../services/tracker.js';
import { DefaultParameterManager } from '../services/default-params.js';
import { ResponseFilter } from '../services/response-filter.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { SemanticQueryService } from '../services/semantic-query.js';
import { TemplatingIntegration, initializeTemplatingIntegration } from '../services/templating-integration.js';

interface StartDataprocClusterInput {
  clusterName: string;
  clusterConfig?: string;
}

class StartDataprocClusterTool extends MCPTool<StartDataprocClusterInput> {
  name = 'start_dataproc_cluster';
  description = 'Start a Google Cloud Dataproc cluster';

  protected schema = {
    clusterName: {
      type: z.string(),
      description: 'Name for the new cluster',
    },
    clusterConfig: {
      type: z.string().optional(),
      description: 'Optional: Dataproc cluster config (JSON object)',
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

      // Create minimal dependencies object
      const handlerDeps: AllHandlerDependencies = {
        defaultParamManager,
        profileManager,
        clusterTracker,
        // Optional services can be undefined
        responseFilter: undefined,
        knowledgeIndexer: undefined,
        jobTracker: undefined,
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

  protected async execute(input: StartDataprocClusterInput): Promise<unknown> {
    try {
      console.log('[DEBUG] StartDataprocClusterTool: Executing with input:', input);
      
      // Create handler dependencies
      const handlerDeps = await this.createHandlerDependencies();
      
      // Call the existing handler
      const result = await handleStartDataprocCluster(input, handlerDeps);
      
      console.log('[DEBUG] StartDataprocClusterTool: Handler result:', result);
      return result;
      
    } catch (error) {
      console.error('[ERROR] StartDataprocClusterTool: Execution failed:', error);
      
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

export default StartDataprocClusterTool;