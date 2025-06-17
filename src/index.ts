#!/usr/bin/env node

/**
 * MCP server for Google Cloud Dataproc operations
 * Provides tools for:
 * - Creating clusters (from JSON or YAML)
 * - Listing clusters
 * - Running Hive queries
 */

// Import MCP stdio handler first to ensure all console output is properly handled
import './utils/mcp-stdio-handler.js';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { DefaultParameterManager } from './services/default-params.js';
import SecurityMiddleware from './security/middleware.js';
import CredentialManager from './security/credential-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { getConfigFilePath, logConfigPathDiagnostics } from './utils/config-path-resolver.js';

// Import package.json for version info
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Import our services
import { getCredentialsConfig } from './config/credentials.js';
import { getServerConfig } from './config/server.js';
import { InitializationManager } from './services/initialization-manager.js';
import { getStartupStatus } from './services/startup-status.js';

// Import tool definitions and handlers
import { allTools } from './tools/index.js';
import { handleToolCall, AllHandlerDependencies } from './handlers/index.js';
import {
  handleListPrompts,
  handleGetPrompt,
  handleCompletion,
  initializeEnhancedPromptGenerator,
} from './handlers/prompt-handlers.js';
import { registerDataprocPrompts } from './prompts/dataproc-prompts.js';
import { initializePromptTemplatesService } from './services/prompt-templates.js';
import { DataprocPromptGenerator } from './prompts/prompt-generator.js';
import { KnowledgeReindexer } from './services/knowledge-reindexer.js';
import { EnhancedPromptDynamicFunctions } from './prompts/dynamic-functions.js';
import { ENHANCED_PROMPT_TEMPLATES } from './prompts/enhanced-prompt-templates.js';

// Import services
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
import { MockDataLoader } from './services/mock-data-loader.js';
import {
  TemplatingIntegration,
  initializeTemplatingIntegration,
  getTemplatingIntegration,
} from './services/templating-integration.js';
import { ParameterInjector } from './services/parameter-injector.js';
import { DynamicResolver } from './services/dynamic-resolver.js';
import { DataprocHttpServer } from './server/http-server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const httpMode = args.includes('--http') || args.includes('--http-server');
const oauthMode = args.includes('--oauth');
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : undefined;

// Check for credentials
const credentials = getCredentialsConfig();
if (!credentials.keyFilename && !credentials.useApplicationDefault) {
  console.warn(
    'No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or USE_APPLICATION_DEFAULT=true'
  );
}

// Initialize services
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
let parameterInjector: ParameterInjector | undefined;
let dynamicResolver: DynamicResolver | undefined;
let enhancedPromptGenerator: DataprocPromptGenerator | undefined;
let knowledgeReindexer: KnowledgeReindexer | undefined;
let httpServer: DataprocHttpServer | undefined;

/**
 * Get the global KnowledgeIndexer instance
 * Used to ensure consistency between storage and retrieval operations
 */
export function getGlobalKnowledgeIndexer(): KnowledgeIndexer | null {
  return knowledgeIndexer || null;
}

// Initialize default parameter manager
try {
  // Use centralized configuration path resolution
  const defaultParamsPath = getConfigFilePath('default-params.json');

  if (process.env.LOG_LEVEL === 'debug') {
    logConfigPathDiagnostics('DefaultParameterManager');
  }

  if (fs.existsSync(defaultParamsPath)) {
    const defaultParamsConfig = JSON.parse(fs.readFileSync(defaultParamsPath, 'utf8'));
    defaultParamManager = new DefaultParameterManager(defaultParamsConfig);
    console.error(`[INFO] Default parameters loaded from: ${defaultParamsPath}`);
  } else {
    console.error(`[INFO] No default parameters file found at: ${defaultParamsPath}`);
  }
} catch (error) {
  console.warn('Could not load default parameters:', error);
}

// Initialize response filter and Qdrant manager using InitializationManager
async function initializeResponseOptimization() {
  initManager = new InitializationManager();

  // Initialize default parameters first
  const defaultParams = await initManager.initializeDefaultParams();
  if (defaultParams) {
    defaultParamManager = defaultParams;
  }

  // Initialize core services
  await initManager.initializeCoreServices();

  // Initialize response optimization services (includes KnowledgeIndexer)
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

  // Initialize prompt templates service
  initializePromptTemplatesService(defaultParamManager, profileManager);

  // Initialize parameter injector and dynamic resolver
  parameterInjector = new ParameterInjector(
    {
      validation: {
        enableStrictMode: true,
        allowUnknownParameters: false,
        validateTypes: true,
      },
      performance: {
        enableCaching: true,
        cacheTimeoutMs: 300000, // 5 minutes
      },
    },
    defaultParamManager,
    profileManager
  );

  dynamicResolver = new DynamicResolver({
    enableCaching: true,
    maxCacheSize: 500,
    defaultTtlMs: 600000, // 10 minutes
    executionTimeoutMs: 10000, // 10 seconds
  });

  // Initialize enhanced prompt system
  try {
    // Create dynamic functions executor
    const dynamicFunctions = new EnhancedPromptDynamicFunctions(
      knowledgeIndexer,
      jobTracker,
      knowledgeIndexer?.getQdrantService()
    );

    // Create enhanced prompt generator with proper dependencies
    enhancedPromptGenerator = new DataprocPromptGenerator(
      {
        enableTemplating: true,
        enableKnowledgeIntegration: !!knowledgeIndexer,
        enableProfileIntegration: !!profileManager,
        cacheConfig: {
          enableCaching: true,
          defaultTtlMs: 300000, // 5 minutes
          maxCacheSize: 1000,
        },
        dynamicResolution: {
          executeAtGenerationTime: true,
          timeoutMs: 10000, // 10 seconds
        },
        reindexing: {
          enableScheduledReindexing: true,
          intervalMs: 3600000, // 1 hour
          batchSize: 100,
          maxRetries: 3,
        },
      },
      {
        templatingIntegration,
        knowledgeIndexer,
        profileManager,
        parameterInjector,
        dynamicResolver,
        defaultParameterManager: defaultParamManager,
      }
    );

    // Load enhanced prompt templates
    for (const template of ENHANCED_PROMPT_TEMPLATES) {
      enhancedPromptGenerator.registerTemplate(template);
    }

    // Initialize knowledge reindexer
    if (knowledgeIndexer) {
      knowledgeReindexer = new KnowledgeReindexer(knowledgeIndexer, {
        intervalMs: 3600000, // 1 hour
        batchSize: 100,
        maxRetries: 3,
      });

      knowledgeReindexer.startScheduledReindexing();
      logger.info('Knowledge reindexer started successfully');
    }

    // Initialize enhanced prompt generator in handlers
    initializeEnhancedPromptGenerator(enhancedPromptGenerator);

    logger.info('Enhanced prompt system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize enhanced prompt system:', error);
    // Continue with legacy prompt system
  }
}

// Get startup status
const startupStatus = getStartupStatus();

// Create the server
const server = new McpServer(
  {
    name: 'dataproc-server',
    version: packageJson.version,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Register Dataproc prompts using the new SDK approach
registerDataprocPrompts(server);

// Define all available tools
server.server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools,
  };
});

// List available resources
server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];

    // Add default configuration resource
    if (defaultParamManager) {
      const defaults = {
        projectId: 'Not configured',
        region: 'Not configured',
        zone: 'Not configured',
      };

      try {
        defaults.projectId = String(defaultParamManager.getParameterValue('projectId'));
      } catch (error) {
        // Ignore parameter errors
      }

      try {
        defaults.region = String(defaultParamManager.getParameterValue('region'));
      } catch (error) {
        // Ignore parameter errors
      }

      try {
        defaults.zone = String(defaultParamManager.getParameterValue('zone'));
      } catch (error) {
        // Ignore parameter errors
      }

      resources.push({
        uri: 'dataproc://config/defaults',
        name: 'Default Configuration',
        description: 'Default project ID and region extracted from profiles',
        mimeType: 'application/json',
      });
    }

    // Add profile resources (using template-based URIs if templating is enabled)
    if (profileManager) {
      const profiles = profileManager.getAllProfiles();
      for (const profile of profiles) {
        let uri = `dataproc://profile/${profile.category}/${profile.id}`;

        // Use templating integration if available
        if (templatingIntegration && templatingIntegration.isEnabled()) {
          try {
            const templateResult = await templatingIntegration.resolveResourceUri('get_profile', {
              category: profile.category,
              profileName: profile.id,
            });
            uri = templateResult.uri;
          } catch (error) {
            // Fallback to legacy URI on template resolution error
            logger.debug(
              `Template resolution failed for profile ${profile.id}, using legacy URI`,
              error
            );
          }
        }

        resources.push({
          uri,
          name: `Profile: ${profile.name}`,
          description: `Cluster configuration profile for ${profile.category}`,
          mimeType: 'application/json',
        });
      }
    }

    return { resources };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
});

// Read resource content
server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    if (uri === 'dataproc://config/defaults') {
      const defaults = {
        projectId: 'Not configured',
        region: 'Not configured',
        zone: 'Not configured',
      };

      if (defaultParamManager) {
        try {
          defaults.projectId = String(defaultParamManager.getParameterValue('projectId'));
        } catch (error) {
          // Ignore parameter errors
        }

        try {
          defaults.region = String(defaultParamManager.getParameterValue('region'));
        } catch (error) {
          // Ignore parameter errors
        }

        try {
          defaults.zone = String(defaultParamManager.getParameterValue('zone'));
        } catch (error) {
          // Ignore parameter errors
        }
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(defaults, null, 2),
          },
        ],
      };
    }

    // Handle profile resources (with template URI support)
    if (uri.startsWith('dataproc://profile/')) {
      const pathParts = uri.replace('dataproc://profile/', '').split('/');
      const category = decodeURIComponent(pathParts[0]);
      const profileId = decodeURIComponent(pathParts[1]);

      if (profileManager) {
        const profile = profileManager.getProfile(profileId);
        if (profile) {
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(profile, null, 2),
              },
            ],
          };
        } else {
          logger.debug(`Profile not found: ${profileId} (category: ${category})`);
          logger.debug(
            `Available profiles: ${Array.from(profileManager.getAllProfiles().map((p) => p.id)).join(', ')}`
          );
        }
      }
    }

    // Handle template-based URIs if templating is enabled
    if (templatingIntegration && templatingIntegration.isEnabled()) {
      try {
        // Try to resolve the URI using template system
        // This is a simplified approach - in a full implementation, we'd need
        // to reverse-engineer the parameters from the URI
        logger.debug(`Attempting template-based resource resolution for URI: ${uri}`);

        // For now, fall through to legacy handling
        // Future enhancement: implement URI-to-parameters reverse mapping
      } catch (error) {
        logger.debug(`Template-based resource resolution failed for ${uri}`, error);
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error}`);
  }
});

// Handle tool calls
server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments;

  if (typeof args !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments');
  }

  try {
    // Create dependencies object for handlers
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

    // Use the extracted handler registry
    return await handleToolCall(toolName, args, handlerDeps);
  } catch (error) {
    logger.error(`MCP ${toolName}: Error:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Handle prompt requests
server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return await handleListPrompts();
});

server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return await handleGetPrompt(request.params);
});

server.server.setRequestHandler(CompleteRequestSchema, async (request) => {
  return await handleCompletion(request.params);
});

// Main function to start the server
async function main() {
  try {
    // Initialize response optimization services
    await initializeResponseOptimization();

    // Security middleware and credential manager are already initialized
    // No additional initialization needed

    // CRITICAL: Initialize the MCP server BEFORE starting HTTP server
    // This ensures the server is ready to handle connections
    console.error('[INFO] Initializing MCP server...');

    // Pre-initialize the server by setting up a dummy transport to ensure readiness
    // This forces the server to complete its internal initialization
    await new Promise<void>((resolve) => {
      // The server is considered ready once all handlers are registered
      // Since we've already registered all handlers above, we just need to ensure
      // the server is in a ready state
      setTimeout(() => {
        console.error('[INFO] MCP server initialization complete');
        resolve();
      }, 100); // Small delay to ensure all async registrations complete
    });

    if (httpMode) {
      // HTTP mode with OAuth proxy support
      console.error('[INFO] Starting HTTP server with MCP Streamable HTTP transport...');

      // Get server configuration to determine port and OAuth settings
      const serverConfig = await getServerConfig();
      const actualPort = cliPort || serverConfig.httpServer?.port || 8080;
      const enableOAuth = oauthMode || serverConfig.httpServer?.enableOAuthProxy || false;

      httpServer = new DataprocHttpServer({
        port: actualPort,
        httpsPort: serverConfig.httpServer?.httpsPort || 8443,
        enableHttps: serverConfig.httpServer?.enableHttps !== false, // Default to true
        enableOAuthProxy: enableOAuth,
        mcpServer: server,
      });

      await httpServer.start();

      console.error('[INFO] HTTP server started successfully!');
      const httpsPort = serverConfig.httpServer?.httpsPort || 8443;
      const enableHttps = serverConfig.httpServer?.enableHttps !== false;

      console.error(`[INFO] HTTP MCP endpoint: http://localhost:${actualPort}/mcp`);
      console.error(`[INFO] HTTP Health check: http://localhost:${actualPort}/health`);

      if (enableHttps) {
        console.error(`[INFO] HTTPS MCP endpoint: https://localhost:${httpsPort}/mcp`);
        console.error(`[INFO] HTTPS Health check: https://localhost:${httpsPort}/health`);
      }

      if (enableOAuth) {
        if (enableHttps) {
          console.error(
            `[INFO] OAuth authorization server: https://localhost:${httpsPort}/.well-known/oauth-authorization-server`
          );
          console.error(
            `[INFO] OAuth endpoints: https://localhost:${httpsPort}/authorize, /token, /register`
          );
        }
        console.error(`[INFO] OAuth proxy: http://localhost:${actualPort}/oauth`);
      }
    } else {
      // Default stdio mode
      console.error('[INFO] Starting in stdio mode...');
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }

    // Start AsyncQueryPoller for automatic query tracking
    if (asyncQueryPoller) {
      asyncQueryPoller.startPolling();
    }

    // Display clean startup summary
    startupStatus.displayStartupSummary();
  } catch (error) {
    console.error('[DEBUG] MCP Server: Initialization error:', error);
    throw error;
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.error('[INFO] MCP Server: Received SIGINT, shutting down gracefully...');
  if (httpServer) {
    await httpServer.stop();
  }
  if (enhancedPromptGenerator) {
    await enhancedPromptGenerator.shutdown();
  }
  if (knowledgeReindexer) {
    await knowledgeReindexer.shutdown();
  }
  if (parameterInjector) {
    await parameterInjector.shutdown();
  }
  if (dynamicResolver) {
    await dynamicResolver.shutdown();
  }
  if (asyncQueryPoller) {
    await asyncQueryPoller.shutdown();
  }
  if (jobTracker) {
    await jobTracker.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[INFO] MCP Server: Received SIGTERM, shutting down gracefully...');
  if (httpServer) {
    await httpServer.stop();
  }
  if (enhancedPromptGenerator) {
    await enhancedPromptGenerator.shutdown();
  }
  if (knowledgeReindexer) {
    await knowledgeReindexer.shutdown();
  }
  if (parameterInjector) {
    await parameterInjector.shutdown();
  }
  if (dynamicResolver) {
    await dynamicResolver.shutdown();
  }
  if (asyncQueryPoller) {
    await asyncQueryPoller.shutdown();
  }
  if (jobTracker) {
    await jobTracker.shutdown();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error('[DEBUG] MCP Server: Fatal error:', error);
  process.exit(1);
});
