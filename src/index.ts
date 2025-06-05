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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger } from './utils/logger.js';
import { DefaultParameterManager } from './services/default-params.js';
import SecurityMiddleware from './security/middleware.js';
import CredentialManager from './security/credential-manager.js';
import {
  StartDataprocClusterSchema,
  CreateClusterFromYamlSchema,
  CreateClusterFromProfileSchema,
  ListClustersSchema,
  GetClusterSchema,
  DeleteClusterSchema,
  SubmitHiveQuerySchema,
  GetJobStatusSchema,
  GetQueryResultsSchema,
  SubmitDataprocJobSchema,
  GetJobResultsSchema,
  GetZeppelinUrlSchema,
  ListTrackedClustersSchema,
  ListProfilesSchema,
  GetProfileSchema,
  CheckActiveJobsSchema,
} from './validation/schemas.js';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

// Import package.json for version info
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Import our services
import {
  createCluster,
  createClusterFromYaml,
  deleteCluster,
  listClusters,
  getCluster,
} from './services/cluster.js';
import {
  submitHiveQuery,
  submitHiveQueryWithRest,
  getJobStatus,
  getJobStatusWithRest,
  getQueryResults,
  getQueryResultsWithRest,
} from './services/query.js';
import { JobState } from './types/query.js';
import { getCredentialsConfig } from './config/credentials.js';
import { getServerConfig } from './config/server.js';
import { InitializationManager } from './services/initialization-manager.js';
import { getStartupStatus } from './services/startup-status.js';

// Semantic Search Services - Optional enhancement for natural language queries
// These services provide intelligent data extraction and vector similarity search
// with graceful degradation when Qdrant is unavailable

// Parse command line arguments
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 3000;

// Check for credentials
const credentials = getCredentialsConfig();
if (!credentials.keyFilename && !credentials.useApplicationDefault) {
  console.warn(
    'No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or USE_APPLICATION_DEFAULT=true'
  );
}

// Initialize services
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

let initManager: InitializationManager;
let profileManager: ProfileManager;
let clusterTracker: ClusterTracker;
let clusterManager: ClusterManager;
let jobTracker: JobTracker;
let jobOutputHandler: JobOutputHandler;
let asyncQueryPoller: AsyncQueryPoller;
let defaultParamManager: DefaultParameterManager;
let responseFilter: ResponseFilter;
let qdrantManager: QdrantManager;
let semanticQueryService: SemanticQueryService;
let knowledgeIndexer: KnowledgeIndexer;

/**
 * Get the global KnowledgeIndexer instance
 * Used to ensure consistency between storage and retrieval operations
 */
export function getGlobalKnowledgeIndexer(): KnowledgeIndexer | null {
  return knowledgeIndexer || null;
}

// Initialize default parameter manager
try {
  const defaultParamsPath = path.join(process.cwd(), 'config', 'default-params.json');
  if (fs.existsSync(defaultParamsPath)) {
    const defaultParamsConfig = JSON.parse(fs.readFileSync(defaultParamsPath, 'utf8'));
    defaultParamManager = new DefaultParameterManager(defaultParamsConfig);
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

  // Initialize response optimization services (Qdrant-dependent)
  await initManager.initializeResponseOptimization();

  // Get initialized services
  const services = initManager.getServices();
  profileManager = services.profileManager;
  clusterTracker = services.clusterTracker;
  clusterManager = services.clusterManager;
  jobTracker = services.jobTracker;
  jobOutputHandler = services.jobOutputHandler;
  asyncQueryPoller = services.asyncQueryPoller;

  // Handle optional services
  if (services.responseFilter) {
    responseFilter = services.responseFilter;
  }
  if (services.qdrantManager) {
    qdrantManager = services.qdrantManager;
  }
  if (services.semanticQueryService) {
    semanticQueryService = services.semanticQueryService;
  }
  if (services.knowledgeIndexer) {
    knowledgeIndexer = services.knowledgeIndexer;
  }
}

// Create the MCP server with full capabilities
const server = new Server(
  {
    name: 'dataproc-server',
    version: packageJson.version,
  },
  {
    capabilities: {
      resources: {
        listChanged: true,
      },
      tools: {},
      prompts: {},
    },
  }
);

// Define all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Original tool
      {
        name: 'start_dataproc_cluster',
        description: 'Start a Google Cloud Dataproc cluster',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'GCP project ID (optional if default configured)',
            },
            region: {
              type: 'string',
              description: 'Dataproc region (optional if default configured, e.g., us-central1)',
            },
            clusterName: { type: 'string', description: 'Name for the new cluster' },
            clusterConfig: {
              type: 'object',
              description: 'Optional: Dataproc cluster config (JSON object)',
            },
          },
          required: ['clusterName'],
        },
      },

      // New tool: create cluster from YAML
      {
        name: 'create_cluster_from_yaml',
        description: 'Create a Dataproc cluster using a YAML configuration file',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            yamlPath: { type: 'string', description: 'Path to the YAML configuration file' },
            overrides: { type: 'object', description: 'Optional: Runtime configuration overrides' },
          },
          required: ['projectId', 'region', 'yamlPath'],
        },
      },

      // New tool: create cluster from profile
      {
        name: 'create_cluster_from_profile',
        description: 'Create a Dataproc cluster using a predefined profile',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            profileName: { type: 'string', description: 'Name of the profile to use' },
            clusterName: { type: 'string', description: 'Name for the new cluster' },
            overrides: { type: 'object', description: 'Optional: Runtime configuration overrides' },
          },
          required: ['projectId', 'region', 'profileName', 'clusterName'],
        },
      },

      // New tool: list clusters
      {
        name: 'list_clusters',
        description: 'List Dataproc clusters in a project and region',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'GCP project ID (optional if default configured)',
            },
            region: {
              type: 'string',
              description: 'Dataproc region (optional if default configured, e.g., us-central1)',
            },
            filter: { type: 'string', description: 'Optional: Filter string' },
            pageSize: { type: 'number', description: 'Optional: Page size' },
            pageToken: { type: 'string', description: 'Optional: Page token for pagination' },
            verbose: {
              type: 'boolean',
              description: 'Optional: Return full response without filtering (default: false)',
            },
            semanticQuery: {
              type: 'string',
              description:
                'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
            },
          },
          required: [],
        },
      },

      // New tool: list tracked clusters
      {
        name: 'list_tracked_clusters',
        description: 'List clusters that were created and tracked by this MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'Optional: Filter by profile ID' },
          },
          required: [],
        },
      },

      // New tool: list available profiles
      {
        name: 'list_profiles',
        description: 'List available cluster configuration profiles',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Optional: Filter by category' },
          },
          required: [],
        },
      },

      // New tool: get profile details
      {
        name: 'get_profile',
        description: 'Get details for a specific cluster configuration profile',
        inputSchema: {
          type: 'object',
          properties: {
            profileId: { type: 'string', description: 'ID of the profile' },
          },
          required: ['profileId'],
        },
      },

      // New tool: get cluster details
      {
        name: 'get_cluster',
        description: 'Get details for a specific Dataproc cluster',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            clusterName: { type: 'string', description: 'Name of the cluster' },
            verbose: {
              type: 'boolean',
              description: 'Optional: Return full response without filtering (default: false)',
            },
            semanticQuery: {
              type: 'string',
              description:
                'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
            },
          },
          required: ['projectId', 'region', 'clusterName'],
        },
      },

      // New tool: submit Hive query
      {
        name: 'submit_hive_query',
        description: 'Submit a Hive query to a Dataproc cluster',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            clusterName: { type: 'string', description: 'Name of the cluster to run the query on' },
            query: { type: 'string', description: 'Hive query to execute' },
            async: {
              type: 'boolean',
              description:
                'Optional: Whether to wait for query completion (false) or return immediately (true)',
            },
            verbose: {
              type: 'boolean',
              description: 'Optional: Return full response without filtering (default: false)',
            },
            queryOptions: {
              type: 'object',
              description: 'Optional: Query configuration options',
              properties: {
                timeoutMs: { type: 'number', description: 'Optional: Timeout in milliseconds' },
                parameters: { type: 'object', description: 'Optional: Query parameters' },
                properties: { type: 'object', description: 'Optional: Query properties' },
              },
            },
          },
          required: ['projectId', 'region', 'clusterName', 'query'],
        },
      },

      // New tool: get query status
      {
        name: 'get_query_status',
        description: 'Get the status of a Hive query job',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            jobId: { type: 'string', description: 'Job ID to check' },
          },
          required: ['projectId', 'region', 'jobId'],
        },
      },

      // Enhanced tool: get query results with async support and semantic search
      {
        name: 'get_query_results',
        description:
          'Get the results of a completed Hive query with enhanced async support and semantic search integration',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            jobId: { type: 'string', description: 'Job ID to get results for' },
            maxResults: {
              type: 'number',
              description:
                'Optional: Maximum number of rows to display in the response (default: 10)',
            },
            pageToken: { type: 'string', description: 'Optional: Page token for pagination' },
          },
          required: ['projectId', 'region', 'jobId'],
        },
      },

      // New tool: delete cluster
      {
        name: 'delete_cluster',
        description: 'Delete a Dataproc cluster',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            clusterName: { type: 'string', description: 'Name of the cluster to delete' },
          },
          required: ['projectId', 'region', 'clusterName'],
        },
      },

      // New tool: submit Dataproc job (generic)
      {
        name: 'submit_dataproc_job',
        description:
          'Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.) to a cluster. Supports async mode.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            clusterName: { type: 'string', description: 'Name of the cluster to run the job on' },
            jobType: {
              type: 'string',
              description: 'Type of job (hive, spark, pyspark, presto, etc.)',
            },
            jobConfig: { type: 'object', description: 'Job configuration object (type-specific)' },
            async: {
              type: 'boolean',
              description: 'Whether to submit asynchronously (default: false)',
            },
          },
          required: ['projectId', 'region', 'clusterName', 'jobType', 'jobConfig'],
        },
      },

      // New tool: get Dataproc job status
      {
        name: 'get_job_status',
        description: 'Get the status of a Dataproc job by job ID.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'GCP project ID (optional if default configured)',
            },
            region: {
              type: 'string',
              description: 'Dataproc region (optional if default configured, e.g., us-central1)',
            },
            jobId: { type: 'string', description: 'Job ID to check' },
            verbose: {
              type: 'boolean',
              description: 'Optional: Return full response without filtering (default: false)',
            },
          },
          required: ['jobId'],
        },
      },

      // New tool: get Dataproc job results
      {
        name: 'get_job_results',
        description: 'Get the results of a completed Dataproc job by job ID.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            jobId: { type: 'string', description: 'Job ID to get results for' },
            maxResults: {
              type: 'number',
              description:
                'Optional: Maximum number of rows to display in the response (default: 10)',
            },
          },
          required: ['projectId', 'region', 'jobId'],
        },
      },

      // New tool: get Zeppelin notebook URL for a cluster
      {
        name: 'get_zeppelin_url',
        description: 'Get the Zeppelin notebook URL for a Dataproc cluster (if enabled).',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'GCP project ID' },
            region: { type: 'string', description: 'Dataproc region (e.g., us-central1)' },
            clusterName: { type: 'string', description: 'Name of the cluster' },
          },
          required: ['projectId', 'region', 'clusterName'],
        },
      },

      // New tool: quick status check for active jobs
      {
        name: 'check_active_jobs',
        description:
          "🚀 Quick status check for all active and recent jobs - perfect for seeing what's running!",
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'GCP project ID (optional, shows all if not specified)',
            },
            region: {
              type: 'string',
              description: 'Dataproc region (optional, shows all if not specified)',
            },
            includeCompleted: {
              type: 'boolean',
              description: 'Include recently completed jobs (default: false)',
            },
          },
          required: [],
        },
      },

      // New tool: semantic query for stored cluster data
      {
        name: 'query_cluster_data',
        description:
          'Query stored cluster data using natural language (e.g., "pip packages", "machine types", "network config")',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Natural language query (e.g., "pip packages", "machine configuration", "network settings")',
            },
            projectId: {
              type: 'string',
              description: 'Filter by GCP project ID (optional)',
            },
            region: {
              type: 'string',
              description: 'Filter by region (optional)',
            },
            clusterName: {
              type: 'string',
              description: 'Filter by specific cluster name (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 5)',
            },
          },
          required: ['query'],
        },
      },

      // New tool: get cluster discovery insights
      {
        name: 'get_cluster_insights',
        description:
          '📊 Get comprehensive insights about discovered clusters, machine types, components, and recent discoveries',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },

      // New tool: get job analytics
      {
        name: 'get_job_analytics',
        description:
          '📈 Get analytics about job submissions, success rates, error patterns, and performance metrics',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },

      // New tool: query knowledge base
      {
        name: 'query_knowledge',
        description:
          '🧠 Query the comprehensive knowledge base using natural language (clusters, jobs, errors, all)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language query about clusters, jobs, or errors',
            },
            type: {
              type: 'string',
              enum: ['clusters', 'cluster', 'jobs', 'job', 'errors', 'error', 'all'],
              description:
                'Type of knowledge to search (default: all). Supports both singular and plural forms.',
            },
            projectId: {
              type: 'string',
              description: 'Filter by GCP project ID (optional)',
            },
            region: {
              type: 'string',
              description: 'Filter by region (optional)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Initialize services if not already done
    if (!profileManager) {
      const serverConfig = await getServerConfig();
      profileManager = new ProfileManager(serverConfig.profileManager);
      await profileManager.initialize();
    }
    if (!clusterTracker) {
      const serverConfig = await getServerConfig();
      clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
      await clusterTracker.initialize();
    }
    if (!jobTracker) {
      jobTracker = new JobTracker();
    }
    if (!asyncQueryPoller) {
      asyncQueryPoller = new AsyncQueryPoller(jobTracker);
    }
    if (!clusterManager) {
      clusterManager = new ClusterManager(profileManager, clusterTracker);
    }

    const allProfiles = profileManager.getAllProfiles();
    const trackedClusters = clusterManager ? clusterManager.listTrackedClusters() : [];
    const trackedJobs = jobTracker.listJobs();

    return {
      resources: [
        // Default configuration resource
        {
          uri: `dataproc://config/defaults`,
          name: `Default Configuration`,
          description: `Default project ID and region extracted from profiles`,
          mimeType: 'application/json',
        },
        // Profile resources
        ...allProfiles.map((profile: any) => ({
          uri: `dataproc://profile/${profile.id}`,
          name: `Profile: ${profile.name}`,
          description: `Cluster configuration profile for ${profile.category}`,
          mimeType: 'application/json',
        })),
        // Cluster resources
        ...trackedClusters.map((cluster: any) => {
          const projectId = cluster.metadata?.projectId || 'unknown';
          const region = cluster.metadata?.region || 'unknown';
          return {
            uri: `dataproc://cluster/${projectId}/${region}/${cluster.clusterName}`,
            name: `Cluster: ${cluster.clusterName}`,
            description: `Dataproc cluster in ${region}`,
            mimeType: 'application/json',
          };
        }),
        // Job resources
        ...trackedJobs.map((job: any) => ({
          uri: `dataproc://job/${job.projectId}/${job.region}/${job.jobId}`,
          name: `Job: ${job.jobId}`,
          description: `Dataproc job status and results`,
          mimeType: 'application/json',
        })),
        // Query resources (NEW) - Async trackable queries
        ...trackedJobs
          .filter(
            (job: any) =>
              job.toolName && ['submit_hive_query', 'submit_dataproc_job'].includes(job.toolName)
          )
          .map((job: any) => ({
            uri: `dataproc://query/${job.projectId}/${job.region}/${job.jobId}`,
            name: `Query: ${job.jobId}`,
            description: `Async ${job.toolName} query - ${job.status}${jobTracker?.isAutoUpdateEnabled(job.jobId) ? ' (auto-updating)' : ''}`,
            mimeType: 'application/json',
          })),
      ],
    };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    if (uri === 'dataproc://config/defaults') {
      // Return default configuration from profiles and default parameter manager
      const defaults: any = {};

      if (defaultParamManager) {
        try {
          defaults.projectId = defaultParamManager.getParameterValue('projectId');
          defaults.region = defaultParamManager.getParameterValue('region');
          defaults.zone = defaultParamManager.getParameterValue('zone');
        } catch (error) {
          // Ignore parameter errors
        }
      }

      // Also extract from profiles if available
      if (profileManager) {
        const profiles = profileManager.getAllProfiles();
        if (profiles.length > 0) {
          const firstProfile = profiles[0];
          if (firstProfile.metadata?.projectId) {
            defaults.projectId = firstProfile.metadata.projectId;
          }
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

    if (uri.startsWith('dataproc://profile/')) {
      const profileId = uri.replace('dataproc://profile/', '');
      if (!profileManager) {
        const serverConfig = await getServerConfig();
        profileManager = new ProfileManager(serverConfig.profileManager);
        await profileManager.initialize();
      }
      const profile = profileManager.getProfile(profileId);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(profile, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('dataproc://cluster/')) {
      const parts = uri.replace('dataproc://cluster/', '').split('/');
      const [projectId, region, clusterName] = parts;
      const cluster = await getCluster(projectId, region, clusterName);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(cluster, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('dataproc://job/')) {
      const parts = uri.replace('dataproc://job/', '').split('/');
      const [projectId, region, jobId] = parts;
      const jobStatus = await getJobStatusWithRest(projectId, region, jobId);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(jobStatus, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('dataproc://query/')) {
      const parts = uri.replace('dataproc://query/', '').split('/');
      const [projectId, region, jobId] = parts;

      // Get enhanced query information from AsyncQueryPoller
      const queryInfo = asyncQueryPoller.getQueryInfo(jobId);
      const jobStatus = await getJobStatusWithRest(projectId, region, jobId);

      const enhancedQueryData = {
        jobId,
        projectId,
        region,
        status: jobStatus,
        queryInfo: queryInfo || null,
        isAutoUpdating: jobTracker?.isAutoUpdateEnabled(jobId) || false,
        pollerStats: asyncQueryPoller.getStatus(),
        lastUpdated: new Date().toISOString(),
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(enhancedQueryData, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('qdrant://dataproc/')) {
      // Handle Qdrant storage resource retrieval
      if (responseFilter) {
        try {
          const resourceId = uri.replace('qdrant://dataproc/', '');
          const qdrantData = await responseFilter.getStoredResponse(resourceId);

          if (qdrantData) {
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(qdrantData, null, 2),
                },
              ],
            };
          } else {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Qdrant resource not found: ${resourceId}`
            );
          }
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to retrieve Qdrant resource: ${error}`
          );
        }
      } else {
        throw new McpError(ErrorCode.InvalidRequest, 'Qdrant storage not available');
      }
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error}`);
  }
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments;

  if (typeof args !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments');
  }

  try {
    // Handle each tool
    switch (toolName) {
      case 'start_dataproc_cluster': {
        // Apply security middleware
        SecurityMiddleware.checkRateLimit(`start_dataproc_cluster:${JSON.stringify(args)}`);

        // Sanitize input
        const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

        // Validate input with Zod schema
        let validatedArgs;
        try {
          validatedArgs = SecurityMiddleware.validateInput(
            StartDataprocClusterSchema,
            sanitizedArgs
          );
        } catch (error) {
          SecurityMiddleware.auditLog(
            'Input validation failed',
            {
              tool: 'start_dataproc_cluster',
              error: error instanceof Error ? error.message : 'Unknown error',
              args: SecurityMiddleware.sanitizeForLogging(args),
            },
            'warn'
          );
          throw new McpError(
            ErrorCode.InvalidParams,
            error instanceof Error ? error.message : 'Invalid input'
          );
        }

        // Get default parameters if not provided
        let { projectId, region, clusterName, clusterConfig } = validatedArgs;

        if (!projectId && defaultParamManager) {
          try {
            projectId = defaultParamManager.getParameterValue('projectId');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        if (!region && defaultParamManager) {
          try {
            region = defaultParamManager.getParameterValue('region');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        // Validate required parameters after defaults
        if (!projectId || !region) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region'
          );
        }

        // Additional GCP constraint validation
        SecurityMiddleware.validateGCPConstraints({ projectId, region, clusterName });

        // Audit log the operation
        SecurityMiddleware.auditLog('Cluster creation initiated', {
          tool: 'start_dataproc_cluster',
          projectId,
          region,
          clusterName,
          hasConfig: !!clusterConfig,
        });

        logger.debug(
          'MCP start_dataproc_cluster: Called with validated params:',
          SecurityMiddleware.sanitizeForLogging({ projectId, region, clusterName, clusterConfig })
        );

        let response;
        try {
          response = await createCluster(projectId, region, clusterName, clusterConfig);

          SecurityMiddleware.auditLog('Cluster creation completed', {
            tool: 'start_dataproc_cluster',
            projectId,
            region,
            clusterName,
            success: true,
          });

          logger.debug(
            'MCP start_dataproc_cluster: createCluster response:',
            SecurityMiddleware.sanitizeForLogging(response)
          );
        } catch (error) {
          SecurityMiddleware.auditLog(
            'Cluster creation failed',
            {
              tool: 'start_dataproc_cluster',
              projectId,
              region,
              clusterName,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            'error'
          );

          logger.error('MCP start_dataproc_cluster: Error from createCluster:', error);
          throw error;
        }

        return {
          content: [
            {
              type: 'text',
              text: `Cluster ${clusterName} started successfully in region ${region}.\nCluster details:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
            },
          ],
        };
      }

      case 'list_clusters': {
        // Apply security middleware
        SecurityMiddleware.checkRateLimit(`list_clusters:${JSON.stringify(args)}`);

        // Sanitize input
        const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

        // Validate input with Zod schema
        let validatedArgs;
        try {
          validatedArgs = SecurityMiddleware.validateInput(ListClustersSchema, sanitizedArgs);
        } catch (error) {
          SecurityMiddleware.auditLog(
            'Input validation failed',
            {
              tool: 'list_clusters',
              error: error instanceof Error ? error.message : 'Unknown error',
              args: SecurityMiddleware.sanitizeForLogging(args),
            },
            'warn'
          );
          throw new McpError(
            ErrorCode.InvalidParams,
            error instanceof Error ? error.message : 'Invalid input'
          );
        }

        // Get default parameters if not provided
        let { projectId, region, filter, pageSize, pageToken } = validatedArgs;

        if (!projectId && defaultParamManager) {
          try {
            projectId = defaultParamManager.getParameterValue('projectId');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        if (!region && defaultParamManager) {
          try {
            region = defaultParamManager.getParameterValue('region');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        // Validate required parameters after defaults
        if (!projectId || !region) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region'
          );
        }

        // Additional GCP constraint validation
        SecurityMiddleware.validateGCPConstraints({ projectId, region });

        // Audit log the operation
        SecurityMiddleware.auditLog('Cluster list requested', {
          tool: 'list_clusters',
          projectId,
          region,
          hasFilter: !!filter,
          pageSize,
        });

        const response = await listClusters(projectId, region, filter, pageSize, pageToken);

        SecurityMiddleware.auditLog('Cluster list completed', {
          tool: 'list_clusters',
          projectId,
          region,
          clusterCount: Array.isArray(response?.clusters) ? response.clusters.length : 0,
        });

        // Index cluster knowledge if available
        if (knowledgeIndexer && response?.clusters) {
          try {
            for (const cluster of response.clusters) {
              await knowledgeIndexer.indexClusterConfiguration(cluster as any);
            }
            logger.info(`Indexed ${response.clusters.length} clusters for knowledge base`);
          } catch (indexError) {
            logger.warn('Failed to index cluster knowledge:', indexError);
          }
        }

        // Handle semantic query using KnowledgeIndexer if available
        if (args.semanticQuery && knowledgeIndexer) {
          try {
            const queryResults = await knowledgeIndexer.queryKnowledge(String(args.semanticQuery), {
              type: 'cluster',
              projectId: projectId ? String(projectId) : undefined,
              region: region ? String(region) : undefined,
              limit: 5,
            });

            if (queryResults.length === 0) {
              // Fall back to regular formatted response with semantic query note
              let fallbackText = `🔍 **Semantic Query**: "${args.semanticQuery}"\n❌ **No semantic results found**\n\n`;

              // Use the same response filtering logic as regular queries
              if (responseFilter && !args.verbose) {
                try {
                  const filteredResponse = await responseFilter.filterResponse(
                    'list_clusters',
                    response,
                    {
                      toolName: 'list_clusters',
                      timestamp: new Date().toISOString(),
                      projectId,
                      region,
                      responseType: 'cluster_list',
                      originalTokenCount: JSON.stringify(response).length,
                      filteredTokenCount: 0,
                      compressionRatio: 1.0,
                    }
                  );

                  const formattedContent =
                    filteredResponse.type === 'summary'
                      ? filteredResponse.summary || filteredResponse.content
                      : filteredResponse.content;

                  fallbackText += formattedContent;
                  fallbackText += `\n\n💡 **Note**: Semantic search requires Qdrant vector database. To enable:\n`;
                  fallbackText += `- Start Qdrant: \`docker run -p 6334:6333 qdrant/qdrant\`\n`;
                  fallbackText += `- Or use regular cluster operations without semantic queries`;
                } catch (filterError) {
                  logger.warn('Response filtering failed in semantic fallback:', filterError);
                  fallbackText += `📋 **Regular cluster list**:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`;
                }
              } else {
                fallbackText += `📋 **Regular cluster list**:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`;
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: fallbackText,
                  },
                ],
              };
            }

            // Format semantic results
            let semanticResponse = `🔍 **Semantic Query**: "${args.semanticQuery}"\n`;
            semanticResponse += `📊 **Found**: ${queryResults.length} matching clusters\n\n`;

            queryResults.forEach((result, index) => {
              const data = result.data as any;
              semanticResponse += `**${index + 1}. ${data.clusterName}** (${data.projectId}/${data.region})\n`;
              semanticResponse += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
              semanticResponse += `   📅 Last seen: ${data.lastSeen}\n`;

              // Show machine types if available
              if (data.configurations?.machineTypes?.length > 0) {
                semanticResponse += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
              }

              // Show components if available
              if (data.configurations?.components?.length > 0) {
                semanticResponse += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
              }

              // Show pip packages if available
              if (data.pipPackages?.length > 0) {
                semanticResponse += `   📦 Pip packages: ${data.pipPackages.slice(0, 3).join(', ')}${data.pipPackages.length > 3 ? '...' : ''}\n`;
              }

              semanticResponse += `   📝 Summary: ${result.summary}\n\n`;
            });

            return {
              content: [
                {
                  type: 'text',
                  text: semanticResponse,
                },
              ],
            };
          } catch (semanticError) {
            logger.warn('Semantic query failed, falling back to response filter:', semanticError);
          }
        }

        // Apply response filtering if available (fallback for non-semantic queries or semantic query failures)
        if (responseFilter && !args.verbose) {
          try {
            const filteredResponse = await responseFilter.filterResponse(
              'list_clusters',
              response,
              {
                toolName: 'list_clusters',
                timestamp: new Date().toISOString(),
                projectId,
                region,
                responseType: 'cluster_list',
                originalTokenCount: JSON.stringify(response).length,
                filteredTokenCount: 0,
                compressionRatio: 1.0,
              }
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    filteredResponse.type === 'summary'
                      ? filteredResponse.summary || filteredResponse.content
                      : filteredResponse.content,
                },
              ],
            };
          } catch (filterError) {
            logger.warn(
              'Response filtering failed, falling back to original response:',
              filterError
            );
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Clusters in project ${projectId}, region ${region}:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
            },
          ],
        };
      }

      case 'get_job_status': {
        // Get default parameters if not provided
        let { projectId, region, jobId } = args;

        if (!projectId && defaultParamManager) {
          try {
            projectId = defaultParamManager.getParameterValue('projectId');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        if (!region && defaultParamManager) {
          try {
            region = defaultParamManager.getParameterValue('region');
          } catch (error) {
            // Ignore error, will be caught by validation below
          }
        }

        // Validate required parameters
        if (!projectId || !region || !jobId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, jobId'
          );
        }
        logger.debug('MCP get_job_status: Called with params:', { projectId, region, jobId });

        try {
          const { getDataprocJobStatus } = await import('./services/job.js');
          const status = await getDataprocJobStatus({
            projectId: String(projectId),
            region: String(region),
            jobId: String(jobId),
          });

          // Apply response filtering if available
          if (responseFilter && !args.verbose) {
            try {
              const filteredResponse = await responseFilter.filterResponse(
                'get_job_status',
                status,
                {
                  toolName: 'get_job_status',
                  timestamp: new Date().toISOString(),
                  projectId: String(projectId),
                  region: String(region),
                  responseType: 'job_status',
                  originalTokenCount: JSON.stringify(status).length,
                  filteredTokenCount: 0,
                  compressionRatio: 1.0,
                }
              );

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      filteredResponse.type === 'summary'
                        ? filteredResponse.summary || filteredResponse.content
                        : filteredResponse.content,
                  },
                ],
              };
            } catch (filterError) {
              logger.warn(
                'Response filtering failed, falling back to original response:',
                filterError
              );
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `Job status for ${jobId}:\n${JSON.stringify(status, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_job_status: Error:', error);
          throw error;
        }
      }

      case 'list_profiles': {
        // Use the global profile manager that should already be initialized
        if (!profileManager) {
          throw new Error('ProfileManager not initialized. Server may still be starting up.');
        }

        const { category } = args;
        const profiles = profileManager.getAllProfiles();

        // Filter by category if provided
        const filteredProfiles = category
          ? profiles.filter((profile: any) => profile.category === category)
          : profiles;

        // Create a concise summary of profiles
        const summary = filteredProfiles
          .map((profile: any) => {
            const hasMetadata = profile.metadata && Object.keys(profile.metadata).length > 0;
            const projectId = profile.metadata?.projectId ? ` (${profile.metadata.projectId})` : '';
            const tags = profile.metadata?.tags ? ` [${profile.metadata.tags.join(', ')}]` : '';
            return `  📁 ${profile.id} → ${profile.name}${projectId}${tags}`;
          })
          .join('\n');

        const categoryInfo = category ? ` (filtered by category: ${category})` : '';

        return {
          content: [
            {
              type: 'text',
              text: `📋 Available Profiles${categoryInfo} (${filteredProfiles.length} found):\n\n${summary}\n\n💡 Use get_profile tool with profileId for detailed configuration.`,
            },
          ],
        };
      }

      case 'get_profile': {
        // Initialize profile manager if not already done
        if (!profileManager) {
          const serverConfig = await getServerConfig();
          profileManager = new ProfileManager(serverConfig.profileManager);
          await profileManager.initialize();
        }

        const { profileId } = args;
        if (!profileId) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: profileId');
        }

        const profile = profileManager.getProfile(String(profileId));

        return {
          content: [
            {
              type: 'text',
              text: `Profile details:\n${JSON.stringify(profile, null, 2)}`,
            },
          ],
        };
      }

      case 'create_cluster_from_yaml': {
        const { projectId, region, yamlPath, overrides } = args;

        if (!projectId || !region || !yamlPath) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, yamlPath'
          );
        }

        const response = await createClusterFromYaml(
          String(projectId),
          String(region),
          String(yamlPath),
          overrides as any
        );

        return {
          content: [
            {
              type: 'text',
              text: `Cluster created from YAML successfully:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'create_cluster_from_profile': {
        // Initialize services if not already done
        if (!profileManager) {
          const serverConfig = await getServerConfig();
          profileManager = new ProfileManager(serverConfig.profileManager);
          await profileManager.initialize();
        }
        if (!clusterTracker) {
          const serverConfig = await getServerConfig();
          clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
          await clusterTracker.initialize();
        }
        if (!clusterManager) {
          clusterManager = new ClusterManager(profileManager, clusterTracker);
        }

        const { projectId, region, profileName, clusterName, overrides } = args;

        if (!projectId || !region || !profileName || !clusterName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, profileName, clusterName'
          );
        }

        const response = await clusterManager.createClusterFromProfile(
          String(projectId),
          String(region),
          String(profileName),
          String(clusterName),
          overrides as any
        );

        return {
          content: [
            {
              type: 'text',
              text: `Cluster created from profile successfully:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'get_cluster': {
        const { projectId, region, clusterName } = args;

        if (!projectId || !region || !clusterName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, clusterName'
          );
        }

        const response = await getCluster(String(projectId), String(region), String(clusterName));

        // Index cluster configuration for knowledge base
        if (knowledgeIndexer && response) {
          try {
            await knowledgeIndexer.indexClusterConfiguration(response as any);
          } catch (indexError) {
            logger.warn('Failed to index cluster configuration:', indexError);
          }
        }

        // Handle semantic query using KnowledgeIndexer if available
        if (args.semanticQuery && knowledgeIndexer) {
          try {
            const queryResults = await knowledgeIndexer.queryKnowledge(String(args.semanticQuery), {
              type: 'cluster',
              projectId: String(projectId),
              region: String(region),
              limit: 5,
            });

            if (queryResults.length === 0) {
              // Fall back to regular formatted response with semantic query note
              let fallbackText = `🔍 **Semantic Query**: "${args.semanticQuery}"\n❌ **No semantic results found for cluster ${clusterName}**\n\n`;

              // Use the same response filtering logic as regular queries
              if (responseFilter && !args.verbose) {
                try {
                  const filteredResponse = await responseFilter.filterResponse(
                    'get_cluster',
                    response,
                    {
                      toolName: 'get_cluster',
                      timestamp: new Date().toISOString(),
                      projectId: String(projectId),
                      region: String(region),
                      clusterName: String(clusterName),
                      responseType: 'cluster_details',
                      originalTokenCount: JSON.stringify(response).length,
                      filteredTokenCount: 0,
                      compressionRatio: 1.0,
                    }
                  );

                  const formattedContent =
                    filteredResponse.type === 'summary'
                      ? filteredResponse.summary || filteredResponse.content
                      : filteredResponse.content;

                  fallbackText += `📋 **Regular cluster details**:\n${formattedContent}`;
                  fallbackText += `\n\n💡 **Note**: Semantic search requires Qdrant vector database. To enable:\n`;
                  fallbackText += `- Start Qdrant: \`docker run -p 6334:6333 qdrant/qdrant\`\n`;
                  fallbackText += `- Or use regular cluster operations without semantic queries`;
                } catch (filterError) {
                  logger.warn('Response filtering failed in semantic fallback:', filterError);
                  fallbackText += `📋 **Regular cluster details**:\n${JSON.stringify(response, null, 2)}`;
                }
              } else {
                fallbackText += `📋 **Regular cluster details**:\n${JSON.stringify(response, null, 2)}`;
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: fallbackText,
                  },
                ],
              };
            }

            // Format semantic results
            let semanticResponse = `🔍 **Semantic Query**: "${args.semanticQuery}"\n`;
            semanticResponse += `🎯 **Target Cluster**: ${clusterName} (${projectId}/${region})\n`;
            semanticResponse += `📊 **Found**: ${queryResults.length} matching results\n\n`;

            queryResults.forEach((result, index) => {
              const data = result.data as any;
              semanticResponse += `**${index + 1}. ${data.clusterName}** (${data.projectId}/${data.region})\n`;
              semanticResponse += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
              semanticResponse += `   📅 Last seen: ${data.lastSeen}\n`;

              // Show machine types if available
              if (data.configurations?.machineTypes?.length > 0) {
                semanticResponse += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
              }

              // Show components if available
              if (data.configurations?.components?.length > 0) {
                semanticResponse += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
              }

              // Show pip packages if available
              if (data.pipPackages?.length > 0) {
                semanticResponse += `   📦 Pip packages: ${data.pipPackages.slice(0, 3).join(', ')}${data.pipPackages.length > 3 ? '...' : ''}\n`;
              }

              semanticResponse += `   📝 Summary: ${result.summary}\n\n`;
            });

            return {
              content: [
                {
                  type: 'text',
                  text: semanticResponse,
                },
              ],
            };
          } catch (semanticError) {
            logger.warn('Semantic query failed, falling back to response filter:', semanticError);
          }
        }

        // Apply response filtering if available (fallback for non-semantic queries or semantic query failures)
        if (responseFilter && !args.verbose) {
          try {
            const filteredResponse = await responseFilter.filterResponse('get_cluster', response, {
              toolName: 'get_cluster',
              timestamp: new Date().toISOString(),
              projectId: String(projectId),
              region: String(region),
              clusterName: String(clusterName),
              responseType: 'cluster_details',
              originalTokenCount: JSON.stringify(response).length,
              filteredTokenCount: 0,
              compressionRatio: 1.0,
            });

            return {
              content: [
                {
                  type: 'text',
                  text:
                    filteredResponse.type === 'summary'
                      ? filteredResponse.summary || filteredResponse.content
                      : filteredResponse.content,
                },
              ],
            };
          } catch (filterError) {
            logger.warn(
              'Response filtering failed, falling back to original response:',
              filterError
            );
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Cluster details:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_cluster': {
        const { projectId, region, clusterName } = args;

        if (!projectId || !region || !clusterName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, clusterName'
          );
        }

        const response = await deleteCluster(
          String(projectId),
          String(region),
          String(clusterName)
        );

        return {
          content: [
            {
              type: 'text',
              text: `Cluster deleted successfully:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'list_tracked_clusters': {
        // Initialize services if not already done
        if (!clusterTracker) {
          const serverConfig = await getServerConfig();
          clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
          await clusterTracker.initialize();
        }
        if (!clusterManager) {
          if (!profileManager) {
            const serverConfig = await getServerConfig();
            profileManager = new ProfileManager(serverConfig.profileManager);
            await profileManager.initialize();
          }
          clusterManager = new ClusterManager(profileManager, clusterTracker);
        }

        const clusters = clusterManager.listTrackedClusters();

        return {
          content: [
            {
              type: 'text',
              text: `Tracked clusters:\n${JSON.stringify(clusters, null, 2)}`,
            },
          ],
        };
      }

      case 'submit_hive_query': {
        const { projectId, region, clusterName, query, async, queryOptions } = args;

        if (!projectId || !region || !clusterName || !query) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, clusterName, query'
          );
        }

        const response = await submitHiveQuery(
          String(projectId),
          String(region),
          String(clusterName),
          String(query),
          queryOptions as any,
          Boolean(async)
        );

        // Index job knowledge if available
        if (knowledgeIndexer && response.jobUuid) {
          try {
            await knowledgeIndexer.indexJobSubmission({
              jobId: response.jobUuid,
              jobType: 'hive',
              clusterName: String(clusterName),
              projectId: String(projectId),
              region: String(region),
              query: String(query),
              status: String(response.status) || 'unknown',
              submissionTime: new Date().toISOString(),
              results: (response as any).results, // Results may be available later
              error: (response as any).error, // Error may be available later
            });
            logger.info(`Indexed Hive job ${response.jobUuid} for knowledge base`);
          } catch (indexError) {
            logger.warn('Failed to index job knowledge:', indexError);
          }
        }

        // If async mode and we have a job ID, register with AsyncQueryPoller
        if (Boolean(async) && response.jobUuid) {
          asyncQueryPoller.registerQuery({
            jobId: response.jobUuid,
            projectId: String(projectId),
            region: String(region),
            toolName: 'submit_hive_query',
            submissionTime: new Date().toISOString(),
          });

          // Apply response filtering if available for async response
          if (responseFilter && !args.verbose) {
            try {
              const filteredResponse = await responseFilter.filterResponse(
                'submit_hive_query',
                response,
                {
                  toolName: 'submit_hive_query',
                  timestamp: new Date().toISOString(),
                  projectId: String(projectId),
                  region: String(region),
                  clusterName: String(clusterName),
                  responseType: 'hive_query_async',
                  originalTokenCount: JSON.stringify(response).length,
                  filteredTokenCount: 0,
                  compressionRatio: 1.0,
                }
              );

              const asyncMessage = `\n\nQuery registered for automatic status updates. Use dataproc://query/${projectId}/${region}/${response.jobUuid} resource to monitor progress.`;

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      (filteredResponse.type === 'summary'
                        ? filteredResponse.summary || filteredResponse.content
                        : filteredResponse.content) + asyncMessage,
                  },
                ],
              };
            } catch (filterError) {
              logger.warn(
                'Response filtering failed, falling back to original response:',
                filterError
              );
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `Hive query submitted (async mode - auto-tracking enabled):\n${JSON.stringify(response, null, 2)}\n\nQuery registered for automatic status updates. Use dataproc://query/${projectId}/${region}/${response.jobUuid} resource to monitor progress.`,
              },
            ],
          };
        }

        // Apply response filtering if available for sync response
        if (responseFilter && !args.verbose) {
          try {
            const filteredResponse = await responseFilter.filterResponse(
              'submit_hive_query',
              response,
              {
                toolName: 'submit_hive_query',
                timestamp: new Date().toISOString(),
                projectId: String(projectId),
                region: String(region),
                clusterName: String(clusterName),
                responseType: 'hive_query_sync',
                originalTokenCount: JSON.stringify(response).length,
                filteredTokenCount: 0,
                compressionRatio: 1.0,
              }
            );

            return {
              content: [
                {
                  type: 'text',
                  text:
                    filteredResponse.type === 'summary'
                      ? filteredResponse.summary || filteredResponse.content
                      : filteredResponse.content,
                },
              ],
            };
          } catch (filterError) {
            logger.warn(
              'Response filtering failed, falling back to original response:',
              filterError
            );
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Hive query submitted:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'get_query_status': {
        const { projectId, region, jobId } = args;

        if (!projectId || !region || !jobId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, jobId'
          );
        }

        const response = await getJobStatusWithRest(
          String(projectId),
          String(region),
          String(jobId)
        );

        return {
          content: [
            {
              type: 'text',
              text: `Query status:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'get_query_results': {
        const { projectId, region, jobId, maxResults, pageToken } = args;

        if (!projectId || !region || !jobId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, jobId'
          );
        }

        const response = await getQueryResults(
          String(projectId),
          String(region),
          String(jobId),
          maxResults ? Number(maxResults) : undefined,
          pageToken ? String(pageToken) : undefined
        );

        return {
          content: [
            {
              type: 'text',
              text: `Query results:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }

      case 'submit_dataproc_job': {
        const { projectId, region, clusterName, jobType, jobConfig, async } = args;

        if (!projectId || !region || !clusterName || !jobType || !jobConfig) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, clusterName, jobType, jobConfig'
          );
        }

        try {
          const { submitDataprocJob } = await import('./services/job.js');
          const response = await submitDataprocJob({
            projectId: String(projectId),
            region: String(region),
            clusterName: String(clusterName),
            jobType: String(jobType) as any,
            jobConfig: jobConfig as any,
            async: Boolean(async),
          });

          // Index job knowledge if available
          if (knowledgeIndexer && response.jobId) {
            try {
              await knowledgeIndexer.indexJobSubmission({
                jobId: response.jobId,
                jobType: String(jobType),
                clusterName: String(clusterName),
                projectId: String(projectId),
                region: String(region),
                status: String(response.status) || 'unknown',
                submissionTime: new Date().toISOString(),
                results: (response as any).results, // Results may be available later
                error: (response as any).error, // Error may be available later
              });
              logger.info(`Indexed ${jobType} job ${response.jobId} for knowledge base`);
            } catch (indexError) {
              logger.warn('Failed to index job knowledge:', indexError);
            }
          }

          // If async mode and we have a job ID, register with AsyncQueryPoller
          if (Boolean(async) && response.jobId) {
            asyncQueryPoller.registerQuery({
              jobId: response.jobId,
              projectId: String(projectId),
              region: String(region),
              toolName: 'submit_dataproc_job',
              submissionTime: new Date().toISOString(),
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Dataproc job submitted (async mode - auto-tracking enabled):\n${JSON.stringify(response, null, 2)}\n\nJob registered for automatic status updates. Use dataproc://query/${projectId}/${region}/${response.jobId} resource to monitor progress.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Dataproc job submitted:\n${JSON.stringify(response, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to submit job: ${error}`);
        }
      }

      case 'get_job_results': {
        const { projectId, region, jobId, maxResults } = args;

        if (!projectId || !region || !jobId) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, jobId'
          );
        }

        try {
          const { getDataprocJobResults } = await import('./services/job.js');
          const response = await getDataprocJobResults({
            projectId: String(projectId),
            region: String(region),
            jobId: String(jobId),
            maxDisplayRows: maxResults ? Number(maxResults) : 10,
          });

          // Index job results for knowledge base (update existing job with results)
          if (knowledgeIndexer && response) {
            try {
              // We need to get job details to extract more information
              const { getDataprocJobStatus } = await import('./services/job.js');
              const jobDetails = await getDataprocJobStatus({
                projectId: String(projectId),
                region: String(region),
                jobId: String(jobId),
              });

              await knowledgeIndexer.indexJobSubmission({
                jobId: String(jobId),
                jobType: 'unknown', // We'll extract this from job details if available
                clusterName: (jobDetails as any)?.placement?.clusterName || 'unknown',
                projectId: String(projectId),
                region: String(region),
                status: (jobDetails as any)?.status?.state || 'DONE',
                submissionTime:
                  (jobDetails as any)?.statusHistory?.[0]?.stateStartTime ||
                  new Date().toISOString(),
                results: response,
                duration: undefined, // Duration calculation can be added later
              });
              logger.info(`Indexed job results for ${jobId} in knowledge base`);
            } catch (indexError) {
              logger.warn('Failed to index job results:', indexError);
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `Job results:\n${JSON.stringify(response, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to get job results: ${error}`);
        }
      }

      case 'get_zeppelin_url': {
        const { projectId, region, clusterName } = args;

        if (!projectId || !region || !clusterName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameters: projectId, region, clusterName'
          );
        }

        // Get cluster details to check if Zeppelin is enabled
        const cluster = await getCluster(String(projectId), String(region), String(clusterName));

        // Check if Zeppelin is enabled in the cluster configuration
        const zeppelinEnabled = (
          cluster?.config?.softwareConfig?.optionalComponents as string[] | undefined
        )?.includes('ZEPPELIN');

        if (!zeppelinEnabled) {
          return {
            content: [
              {
                type: 'text',
                text: `Zeppelin is not enabled on cluster ${clusterName}. To enable Zeppelin, recreate the cluster with ZEPPELIN in optionalComponents.`,
              },
            ],
          };
        }

        // Extract Zeppelin URL from cluster endpoint configuration
        const zeppelinUrl = cluster?.config?.endpointConfig?.httpPorts?.Zeppelin;

        if (!zeppelinUrl) {
          return {
            content: [
              {
                type: 'text',
                text: `Zeppelin URL not available for cluster ${clusterName}. The cluster may still be initializing or Zeppelin endpoint is not configured.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Zeppelin URL for cluster ${clusterName}: ${zeppelinUrl}`,
            },
          ],
        };
      }

      case 'check_active_jobs': {
        const { projectId, region, includeCompleted } = args;

        // Get all tracked jobs
        const allJobs = jobTracker.listJobs();

        // Filter jobs based on parameters
        let filteredJobs = allJobs;

        if (projectId) {
          filteredJobs = filteredJobs.filter((job) => job.projectId === projectId);
        }

        if (region) {
          filteredJobs = filteredJobs.filter((job) => job.region === region);
        }

        if (!includeCompleted) {
          filteredJobs = filteredJobs.filter(
            (job) => !['DONE', 'COMPLETED', 'FAILED', 'CANCELLED', 'ERROR'].includes(job.status)
          );
        }

        // Get async query poller stats
        const pollerStats = asyncQueryPoller.getStatus();

        // Categorize jobs
        const runningJobs = filteredJobs.filter((job) =>
          ['RUNNING', 'PENDING', 'SETUP_DONE'].includes(job.status)
        );
        const completedJobs = filteredJobs.filter((job) =>
          ['DONE', 'COMPLETED'].includes(job.status)
        );
        const failedJobs = filteredJobs.filter((job) =>
          ['FAILED', 'CANCELLED', 'ERROR'].includes(job.status)
        );

        // Create summary
        const summary = {
          totalJobs: filteredJobs.length,
          runningJobs: runningJobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          pollerActive: pollerStats.isPolling,
          activeQueries: pollerStats.activeQueries,
          lastPollTime: pollerStats.lastPollTime,
        };

        // Format response
        let response = `🚀 **Job Status Dashboard**\n\n`;
        response += `📊 **Summary**: ${summary.totalJobs} total jobs`;
        if (projectId) response += ` in ${projectId}`;
        if (region) response += ` (${region})`;
        response += `\n`;
        response += `   • 🟢 Running: ${summary.runningJobs}\n`;
        response += `   • ✅ Completed: ${summary.completedJobs}\n`;
        response += `   • ❌ Failed: ${summary.failedJobs}\n\n`;

        response += `🔄 **AsyncQueryPoller**: ${pollerStats.isPolling ? '🟢 Active' : '🔴 Inactive'}\n`;
        response += `   • Active Queries: ${pollerStats.activeQueries}\n`;
        response += `   • Total Polls: ${pollerStats.totalPolls}\n`;
        response += `   • Uptime: ${pollerStats.uptime ? Math.round(pollerStats.uptime / 1000) : 0}s\n\n`;

        if (runningJobs.length > 0) {
          response += `🏃 **Currently Running Jobs**:\n`;
          runningJobs.forEach((job) => {
            const duration = job.submissionTime
              ? Math.round((Date.now() - new Date(job.submissionTime).getTime()) / 1000)
              : 0;
            response += `   • ${job.jobId} (${job.toolName}) - ${job.status} - ${duration}s\n`;
            response += `     📍 Resource: dataproc://query/${job.projectId}/${job.region}/${job.jobId}\n`;
          });
          response += `\n`;
        }

        if (includeCompleted && completedJobs.length > 0) {
          response += `✅ **Recently Completed Jobs**:\n`;
          completedJobs.slice(-5).forEach((job) => {
            const duration = job.duration ? Math.round(job.duration / 1000) : 'unknown';
            response += `   • ${job.jobId} (${job.toolName}) - completed in ${duration}s\n`;
          });
        }

        if (runningJobs.length === 0 && !includeCompleted) {
          response += `🎉 **All quiet!** No jobs currently running.\n`;
          response += `💡 Use \`includeCompleted: true\` to see recent completions.`;
        }

        return {
          content: [
            {
              type: 'text',
              text: response,
            },
          ],
        };
      }

      case 'query_cluster_data': {
        const { query, projectId, region, clusterName, limit } = args;

        if (!knowledgeIndexer) {
          return {
            content: [
              {
                type: 'text',
                text: 'Knowledge indexer not available. Response optimization may not be enabled.',
              },
            ],
          };
        }

        try {
          const queryResults = await knowledgeIndexer.queryKnowledge(String(query), {
            type: 'cluster', // Fixed: changed from 'clusters' to 'cluster' to match stored data
            projectId: projectId ? String(projectId) : undefined,
            region: region ? String(region) : undefined,
            limit: limit ? Number(limit) : 5,
          });

          if (queryResults.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `🔍 **Query**: "${query}"\n\n❌ **No results found**\n\nTry:\n• Different search terms\n• Broader query (e.g., "configuration" instead of specific property)\n• Check if clusters have been stored (run list_clusters first)`,
                },
              ],
            };
          }

          // Format results using knowledge indexer format
          let response = `🔍 **Query**: "${query}"\n`;
          response += `📊 **Found**: ${queryResults.length} results\n\n`;

          queryResults.forEach((result, index) => {
            const data = result.data as any;
            response += `**${index + 1}. ${data.clusterName}** (${data.projectId}/${data.region})\n`;
            response += `   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
            response += `   📅 Last seen: ${data.lastSeen}\n`;

            // Show machine types if available
            if (data.configurations?.machineTypes?.length > 0) {
              response += `   🖥️  Machine types: ${data.configurations.machineTypes.join(', ')}\n`;
            }

            // Show components if available
            if (data.configurations?.components?.length > 0) {
              response += `   🔧 Components: ${data.configurations.components.join(', ')}\n`;
            }

            // Show pip packages if available
            if (data.pipPackages?.length > 0) {
              response += `   📦 Pip packages: ${data.pipPackages.slice(0, 3).join(', ')}${data.pipPackages.length > 3 ? '...' : ''}\n`;
            }

            response += `   📝 Summary: ${result.summary}\n\n`;
          });

          return {
            content: [
              {
                type: 'text',
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error querying cluster knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
          };
        }
      }

      case 'get_cluster_insights': {
        if (!knowledgeIndexer) {
          return {
            content: [
              {
                type: 'text',
                text: 'Knowledge indexer not available. Response optimization may not be enabled.',
              },
            ],
          };
        }

        try {
          const insights = knowledgeIndexer.getClusterInsights();

          let response = `📊 **Cluster Discovery Insights**\n\n`;
          response += `🏗️ **Overview**:\n`;
          response += `   • Total Clusters: ${insights.totalClusters}\n`;
          response += `   • Unique Projects: ${insights.uniqueProjects}\n`;
          response += `   • Unique Regions: ${insights.uniqueRegions}\n\n`;

          if (insights.commonMachineTypes.length > 0) {
            response += `🖥️ **Common Machine Types**:\n`;
            insights.commonMachineTypes.forEach((type) => {
              response += `   • ${type}\n`;
            });
            response += `\n`;
          }

          if (insights.commonComponents.length > 0) {
            response += `🔧 **Common Components**:\n`;
            insights.commonComponents.forEach((comp) => {
              response += `   • ${comp}\n`;
            });
            response += `\n`;
          }

          if (insights.commonPipelines.length > 0) {
            response += `🚀 **Common Pipelines**:\n`;
            insights.commonPipelines.forEach((pipeline) => {
              response += `   • ${pipeline}\n`;
            });
            response += `\n`;
          }

          if (insights.recentDiscoveries.length > 0) {
            response += `🆕 **Recent Discoveries** (Last 24h):\n`;
            insights.recentDiscoveries.forEach((cluster) => {
              const timeSince = Math.round(
                (Date.now() - new Date(cluster.firstSeen).getTime()) / (1000 * 60 * 60)
              );
              response += `   • ${cluster.clusterName} (${cluster.projectId}/${cluster.region}) - ${timeSince}h ago\n`;
            });
          } else {
            response += `🆕 **Recent Discoveries**: None in the last 24 hours\n`;
          }

          response += `\n💡 **Tip**: Use \`query_knowledge\` to search for specific cluster configurations or patterns`;

          return {
            content: [
              {
                type: 'text',
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting cluster insights: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }

      case 'get_job_analytics': {
        if (!knowledgeIndexer) {
          return {
            content: [
              {
                type: 'text',
                text: 'Knowledge indexer not available. Response optimization may not be enabled.',
              },
            ],
          };
        }

        try {
          const analytics = knowledgeIndexer.getJobTypeAnalytics();

          let response = `📈 **Job Analytics Dashboard**\n\n`;
          response += `📊 **Overview**:\n`;
          response += `   • Total Jobs: ${analytics.totalJobs}\n`;
          response += `   • Success Rate: ${analytics.successRate.toFixed(1)}%\n\n`;

          if (Object.keys(analytics.jobTypeDistribution).length > 0) {
            response += `🔧 **Job Type Distribution**:\n`;
            Object.entries(analytics.jobTypeDistribution)
              .sort(([, a], [, b]) => b - a)
              .forEach(([type, count]) => {
                const percentage =
                  analytics.totalJobs > 0 ? ((count / analytics.totalJobs) * 100).toFixed(1) : '0';
                response += `   • ${type.toUpperCase()}: ${count} jobs (${percentage}%)\n`;
              });
            response += `\n`;
          }

          if (Object.keys(analytics.avgDuration).length > 0) {
            response += `⏱️ **Average Duration by Type**:\n`;
            Object.entries(analytics.avgDuration).forEach(([type, duration]) => {
              const durationSec = Math.round(duration / 1000);
              response += `   • ${type.toUpperCase()}: ${durationSec}s\n`;
            });
            response += `\n`;
          }

          if (analytics.commonErrors.length > 0) {
            response += `❌ **Top Error Patterns**:\n`;
            analytics.commonErrors.slice(0, 5).forEach((error, index) => {
              response += `   ${index + 1}. ${error.errorType} (${error.frequency}x)\n`;
              if (error.suggestedFixes.length > 0) {
                response += `      💡 Fix: ${error.suggestedFixes[0]}\n`;
              }
            });
          } else {
            response += `✅ **Error Patterns**: No errors recorded yet\n`;
          }

          response += `\n💡 **Tip**: Use \`query_knowledge --type errors\` to search for specific error solutions`;

          return {
            content: [
              {
                type: 'text',
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting job analytics: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }

      case 'query_knowledge': {
        const { query, type, projectId, region, limit } = args;

        if (!knowledgeIndexer) {
          return {
            content: [
              {
                type: 'text',
                text: 'Knowledge indexer not available. Response optimization may not be enabled.',
              },
            ],
          };
        }

        try {
          const results = await knowledgeIndexer.queryKnowledge(String(query), {
            type: type ? (String(type) as any) : 'all',
            projectId: projectId ? String(projectId) : undefined,
            region: region ? String(region) : undefined,
            limit: limit ? Number(limit) : 10,
          });

          if (results.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `🔍 **Query**: "${query}"\n\n❌ **No results found**\n\nTry:\n• Different search terms\n• Broader query scope\n• Check if data has been indexed (run operations first)`,
                },
              ],
            };
          }

          let response = `🔍 **Knowledge Query**: "${query}"\n`;
          if (type && type !== 'all') response += `📂 **Type Filter**: ${type}\n`;
          response += `📊 **Found**: ${results.length} results\n\n`;

          results.forEach((result, index) => {
            response += `**${index + 1}. ${result.type?.toUpperCase() || 'UNKNOWN'}** (${(result.confidence * 100).toFixed(1)}% match)\n`;
            response += `   📝 ${result.summary}\n\n`;
          });

          response += `💡 **Tip**: Use \`get_cluster_insights\` or \`get_job_analytics\` for structured overviews`;

          return {
            content: [
              {
                type: 'text',
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error querying knowledge base: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
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

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const startupStatus = getStartupStatus();

  try {
    // Initialize response optimization services before starting the server
    await initializeResponseOptimization();

    // Perform health check for Qdrant connection
    await startupStatus.performHealthCheck();

    // Initialize services if not already done
    if (!profileManager) {
      const serverConfig = await getServerConfig();

      profileManager = new ProfileManager(serverConfig.profileManager);
      await profileManager.initialize();

      clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
      await clusterTracker.initialize();

      jobOutputHandler = new JobOutputHandler();
      jobTracker = new JobTracker();
      asyncQueryPoller = new AsyncQueryPoller(jobTracker);

      // Set up automatic job indexing when jobs complete
      if (knowledgeIndexer) {
        asyncQueryPoller.on('jobCompleted', async (event) => {
          try {
            // Get job results for completed jobs
            const { getDataprocJobResults, getDataprocJobStatus } = await import(
              './services/job.js'
            );

            let jobResults: any = null;
            let jobDetails: any = null;

            try {
              jobDetails = await getDataprocJobStatus({
                projectId: event.projectId,
                region: event.region,
                jobId: event.jobId,
              });

              // Try to get results for completed jobs
              if (['COMPLETED', 'DONE'].includes(event.finalStatus)) {
                jobResults = await getDataprocJobResults({
                  projectId: event.projectId,
                  region: event.region,
                  jobId: event.jobId,
                  maxDisplayRows: 10,
                });
              }
            } catch (resultError) {
              logger.warn(`Failed to get results for completed job ${event.jobId}:`, resultError);
            }

            await knowledgeIndexer.indexJobSubmission({
              jobId: event.jobId,
              jobType: event.toolName?.includes('hive') ? 'hive' : 'unknown',
              clusterName: (jobDetails as any)?.placement?.clusterName || 'unknown',
              projectId: event.projectId,
              region: event.region,
              status: event.finalStatus,
              submissionTime:
                (jobDetails as any)?.statusHistory?.[0]?.stateStartTime || event.completedAt,
              results: jobResults,
              duration: event.duration,
            });

            logger.info(
              `🎯 Auto-indexed completed job ${event.jobId} (${event.toolName}) with results`
            );
          } catch (indexError) {
            logger.warn(`Failed to auto-index completed job ${event.jobId}:`, indexError);
          }
        });
      }

      clusterManager = new ClusterManager(profileManager, clusterTracker);
    }

    // Create and configure transport - for now, always use stdio
    const transport = new StdioServerTransport();

    if (httpMode) {
      console.error('[INFO] HTTP mode requested but not yet implemented. Using stdio mode.');
      console.error('[INFO] For simultaneous testing, run multiple instances:');
      console.error('[INFO] 1. MCP Inspector: npx @modelcontextprotocol/inspector build/index.js');
      console.error('[INFO] 2. VS Code: Configure .roo/mcp.json to use stdio transport');
    }

    // Connect server to transport
    await server.connect(transport);

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
