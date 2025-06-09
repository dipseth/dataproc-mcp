#!/usr/bin/env node

/**
 * Standalone MCP Framework Server
 * Uses the official MCP Framework with auto-discovery for tools
 */

import { MCPServer } from 'mcp-framework';
import { logger } from './utils/logger.js';
import { AllHandlerDependencies, handleToolCall } from './handlers/index.js';
import DependencyRegistry from './tools/DependencyRegistry.js';

// Import services (same as main server)
import { getCredentialsConfig } from './config/credentials.js';
import { getServerConfig } from './config/server.js';
import { InitializationManager } from './services/initialization-manager.js';
import { getStartupStatus } from './services/startup-status.js';
import { ProfileManager } from './services/profile.js';
import { ClusterTracker } from './services/tracker.js';
import { ClusterManager } from './services/cluster-manager.js';
import { JobTracker } from './services/job-tracker.js';
import { JobOutputHandler } from './services/job-output-handler.js';
import { AsyncQueryPoller } from './services/async-query-poller.js';
import { ResponseFilter } from './services/response-filter.js';
import { QdrantManager } from './services/qdrant-manager.js';
import { SemanticQueryService } from './services/semantic-query.js';
import { KnowledgeIndexer } from './services/knowledge-indexer.js';
import { DefaultParameterManager } from './services/default-params.js';
import {
  TemplatingIntegration,
  initializeTemplatingIntegration,
} from './services/templating-integration.js';

// Parse command line arguments
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 8080;

// Initialize services (same as main server)
let initManager: InitializationManager;
let profileManager: ProfileManager;
let clusterTracker: ClusterTracker;
let clusterManager: ClusterManager;
let jobTracker: JobTracker;
let jobOutputHandler: JobOutputHandler;
let asyncQueryPoller: AsyncQueryPoller;
let defaultParamManager: DefaultParameterManager;
let responseFilter: ResponseFilter | undefined;
let qdrantManager: QdrantManager | undefined;
let semanticQueryService: SemanticQueryService | undefined;
let knowledgeIndexer: KnowledgeIndexer | undefined;
let templatingIntegration: TemplatingIntegration | undefined;

// Initialize all services
async function initializeServices() {
  initManager = new InitializationManager();

  // Initialize default parameters first
  const defaultParams = await initManager.initializeDefaultParams();
  if (defaultParams) {
    defaultParamManager = defaultParams;
  }

  // Initialize core services
  await initManager.initializeCoreServices();

  // Initialize response optimization services
  await initManager.initializeResponseOptimization();

  const services = initManager.getServices();
  responseFilter = services.responseFilter;
  qdrantManager = services.qdrantManager;
  semanticQueryService = services.semanticQueryService;
  knowledgeIndexer = services.knowledgeIndexer;
  jobTracker = services.jobTracker;
  asyncQueryPoller = services.asyncQueryPoller;

  // Initialize profile manager
  const serverConfig = await getServerConfig();
  profileManager = new ProfileManager(serverConfig.profileManager);
  await profileManager.initialize();

  // Initialize cluster tracker
  clusterTracker = new ClusterTracker();
  await clusterTracker.initialize();

  // Initialize cluster manager
  clusterManager = new ClusterManager(profileManager, clusterTracker);

  // Initialize job output handler
  jobOutputHandler = new JobOutputHandler();

  // Initialize templating integration
  templatingIntegration = await initializeTemplatingIntegration(
    {
      enableTemplating: true,
      fallbackToLegacy: true,
      enablePerformanceMetrics: true,
      enableCaching: true,
    },
    defaultParamManager,
    profileManager
  );
}

async function main() {
  try {
    console.log('[INFO] Starting MCP Framework Server...');
    
    // Initialize all services
    await initializeServices();

    // Create handler dependencies
    const handlerDeps: AllHandlerDependencies = {
      defaultParamManager,
      responseFilter,
      knowledgeIndexer,
      profileManager,
      clusterTracker,
      jobTracker,
      asyncQueryPoller,
      semanticQueryService,
      templatingIntegration,
    };

    // Initialize dependency registry for auto-discovery tools
    const dependencyRegistry = DependencyRegistry.getInstance();
    dependencyRegistry.setDependencies(handlerDeps);
    console.log('[INFO] Dependency registry initialized for MCP Framework tools');

    // Create MCP Framework server
    const server = new MCPServer({
      transport: httpMode ? {
        type: 'http-stream',
        options: {
          port,
          endpoint: '/mcp',
          responseMode: 'batch',
          cors: {
            allowOrigin: '*'
          },
        }
      } : {
        type: 'stdio'
      }
    });

    console.log('[INFO] MCP Framework server will use auto-discovery from tools/ directory');
    console.log('[INFO] Problematic non-tool files have been renamed to .bak to avoid loading errors');

    // Start the server
    await server.start();

    if (httpMode) {
      console.log(`[INFO] MCP Framework HTTP Server started on http://localhost:${port}/mcp`);
    } else {
      console.log('[INFO] MCP Framework STDIO Server started');
    }

    // Start AsyncQueryPoller for automatic query tracking
    if (asyncQueryPoller) {
      asyncQueryPoller.startPolling();
    }

    // Display startup summary
    const startupStatus = getStartupStatus();
    startupStatus.displayStartupSummary();

  } catch (error) {
    console.error('[ERROR] MCP Framework Server failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('[INFO] MCP Framework Server: Received SIGINT, shutting down gracefully...');
  if (asyncQueryPoller) {
    await asyncQueryPoller.shutdown();
  }
  if (jobTracker) {
    await jobTracker.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[INFO] MCP Framework Server: Received SIGTERM, shutting down gracefully...');
  if (asyncQueryPoller) {
    await asyncQueryPoller.shutdown();
  }
  if (jobTracker) {
    await jobTracker.shutdown();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error('[ERROR] MCP Framework Server: Fatal error:', error);
  process.exit(1);
});