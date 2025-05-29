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

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { logger } from "./utils/logger.js";
import { DefaultParameterManager } from "./services/default-params.js";
import * as fs from 'fs';
import * as path from 'path';

// Import our services
import { createCluster, createClusterFromYaml, deleteCluster, listClusters, getCluster } from "./services/cluster.js";
import {
  submitHiveQuery,
  submitHiveQueryWithRest,
  getJobStatus,
  getJobStatusWithRest,
  getQueryResults
} from "./services/query.js";
import { JobState } from "./types/query.js";
import { getCredentialsConfig } from "./config/credentials.js";
import { getServerConfig } from "./config/server.js";
import { ProfileManager } from "./services/profile.js";
import { ClusterTracker } from "./services/tracker.js";
import { ClusterManager } from "./services/cluster-manager.js";
import { JobTracker } from "./services/job-tracker.js";
import { JobOutputHandler } from "./services/job-output-handler.js";

// Parse command line arguments
const args = process.argv.slice(2);
const httpMode = args.includes('--http');
const portIndex = args.indexOf('--port');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 3000;

// Check for credentials
const credentials = getCredentialsConfig();
if (!credentials.keyFilename && !credentials.useApplicationDefault) {
  console.warn('No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or USE_APPLICATION_DEFAULT=true');
}

// Initialize services
let profileManager: ProfileManager;
let clusterTracker: ClusterTracker;
let clusterManager: ClusterManager;
let jobTracker: JobTracker;
let jobOutputHandler: JobOutputHandler;
let defaultParamManager: DefaultParameterManager;

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

// Create the MCP server with full capabilities
const server = new Server(
  {
    name: "dataproc-server",
    version: "0.3.0",
  },
  {
    capabilities: {
      resources: {
        listChanged: true
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
        name: "start_dataproc_cluster",
        description: "Start a Google Cloud Dataproc cluster",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID (optional if default configured)" },
            region: { type: "string", description: "Dataproc region (optional if default configured, e.g., us-central1)" },
            clusterName: { type: "string", description: "Name for the new cluster" },
            clusterConfig: { type: "object", description: "Optional: Dataproc cluster config (JSON object)" },
          },
          required: ["clusterName"],
        },
      },
      
      // New tool: create cluster from YAML
      {
        name: "create_cluster_from_yaml",
        description: "Create a Dataproc cluster using a YAML configuration file",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            yamlPath: { type: "string", description: "Path to the YAML configuration file" },
            overrides: { type: "object", description: "Optional: Runtime configuration overrides" },
          },
          required: ["projectId", "region", "yamlPath"],
        },
      },
      
      // New tool: create cluster from profile
      {
        name: "create_cluster_from_profile",
        description: "Create a Dataproc cluster using a predefined profile",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            profileName: { type: "string", description: "Name of the profile to use" },
            clusterName: { type: "string", description: "Name for the new cluster" },
            overrides: { type: "object", description: "Optional: Runtime configuration overrides" },
          },
          required: ["projectId", "region", "profileName", "clusterName"],
        },
      },
      
      // New tool: list clusters
      {
        name: "list_clusters",
        description: "List Dataproc clusters in a project and region",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID (optional if default configured)" },
            region: { type: "string", description: "Dataproc region (optional if default configured, e.g., us-central1)" },
            filter: { type: "string", description: "Optional: Filter string" },
            pageSize: { type: "number", description: "Optional: Page size" },
            pageToken: { type: "string", description: "Optional: Page token for pagination" },
          },
          required: [],
        },
      },
      
      // New tool: list tracked clusters
      {
        name: "list_tracked_clusters",
        description: "List clusters that were created and tracked by this MCP server",
        inputSchema: {
          type: "object",
          properties: {
            profileId: { type: "string", description: "Optional: Filter by profile ID" },
          },
          required: [],
        },
      },
      
      // New tool: list available profiles
      {
        name: "list_profiles",
        description: "List available cluster configuration profiles",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Optional: Filter by category" },
          },
          required: [],
        },
      },
      
      // New tool: get profile details
      {
        name: "get_profile",
        description: "Get details for a specific cluster configuration profile",
        inputSchema: {
          type: "object",
          properties: {
            profileId: { type: "string", description: "ID of the profile" },
          },
          required: ["profileId"],
        },
      },
      
      // New tool: get cluster details
      {
        name: "get_cluster",
        description: "Get details for a specific Dataproc cluster",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name of the cluster" },
          },
          required: ["projectId", "region", "clusterName"],
        },
      },
      
      // New tool: submit Hive query
      {
        name: "submit_hive_query",
        description: "Submit a Hive query to a Dataproc cluster",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name of the cluster to run the query on" },
            query: { type: "string", description: "Hive query to execute" },
            async: { type: "boolean", description: "Optional: Whether to wait for query completion (false) or return immediately (true)" },
            queryOptions: {
              type: "object",
              description: "Optional: Query configuration options",
              properties: {
                timeoutMs: { type: "number", description: "Optional: Timeout in milliseconds" },
                parameters: { type: "object", description: "Optional: Query parameters" },
                properties: { type: "object", description: "Optional: Query properties" },
              },
            },
          },
          required: ["projectId", "region", "clusterName", "query"],
        },
      },
      
      // New tool: get query status
      {
        name: "get_query_status",
        description: "Get the status of a Hive query job",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            jobId: { type: "string", description: "Job ID to check" },
          },
          required: ["projectId", "region", "jobId"],
        },
      },
      
      // New tool: get query results
      {
        name: "get_query_results",
        description: "Get the results of a completed Hive query",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            jobId: { type: "string", description: "Job ID to get results for" },
            maxResults: { type: "number", description: "Optional: Maximum number of results to return" },
            pageToken: { type: "string", description: "Optional: Page token for pagination" },
          },
          required: ["projectId", "region", "jobId"],
        },
      },
      
      // New tool: delete cluster
      {
        name: "delete_cluster",
        description: "Delete a Dataproc cluster",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name of the cluster to delete" },
          },
          required: ["projectId", "region", "clusterName"],
        },
      },

      // New tool: submit Dataproc job (generic)
      {
        name: "submit_dataproc_job",
        description: "Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.) to a cluster. Supports async mode.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name of the cluster to run the job on" },
            jobType: { type: "string", description: "Type of job (hive, spark, pyspark, presto, etc.)" },
            jobConfig: { type: "object", description: "Job configuration object (type-specific)" },
            async: { type: "boolean", description: "Whether to submit asynchronously (default: false)" }
          },
          required: ["projectId", "region", "clusterName", "jobType", "jobConfig"],
        },
      },

      // New tool: get Dataproc job status
      {
        name: "get_job_status",
        description: "Get the status of a Dataproc job by job ID.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID (optional if default configured)" },
            region: { type: "string", description: "Dataproc region (optional if default configured, e.g., us-central1)" },
            jobId: { type: "string", description: "Job ID to check" }
          },
          required: ["jobId"],
        },
      },

      // New tool: get Dataproc job results
      {
        name: "get_job_results",
        description: "Get the results of a completed Dataproc job by job ID.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            jobId: { type: "string", description: "Job ID to get results for" },
            maxResults: { type: "number", description: "Optional: Maximum number of rows to display in the response (default: 10)" }
          },
          required: ["projectId", "region", "jobId"],
        },
      },

      // New tool: get Zeppelin notebook URL for a cluster
      {
        name: "get_zeppelin_url",
        description: "Get the Zeppelin notebook URL for a Dataproc cluster (if enabled).",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name of the cluster" }
          },
          required: ["projectId", "region", "clusterName"],
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
          mimeType: "application/json"
        },
        // Profile resources
        ...allProfiles.map((profile: any) => ({
          uri: `dataproc://profile/${profile.id}`,
          name: `Profile: ${profile.name}`,
          description: `Cluster configuration profile for ${profile.category}`,
          mimeType: "application/json"
        })),
        // Cluster resources  
        ...trackedClusters.map((cluster: any) => {
          const projectId = cluster.metadata?.projectId || 'unknown';
          const region = cluster.metadata?.region || 'unknown';
          return {
            uri: `dataproc://cluster/${projectId}/${region}/${cluster.clusterName}`,
            name: `Cluster: ${cluster.clusterName}`,
            description: `Dataproc cluster in ${region}`,
            mimeType: "application/json"
          };
        }),
        // Job resources
        ...trackedJobs.map((job: any) => ({
          uri: `dataproc://job/${job.projectId}/${job.region}/${job.jobId}`,
          name: `Job: ${job.jobId}`,
          description: `Dataproc job status and results`,
          mimeType: "application/json"
        }))
      ]
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
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(defaults, null, 2)
        }]
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
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(profile, null, 2)
        }]
      };
    }
    
    if (uri.startsWith('dataproc://cluster/')) {
      const parts = uri.replace('dataproc://cluster/', '').split('/');
      const [projectId, region, clusterName] = parts;
      const cluster = await getCluster(projectId, region, clusterName);
      return {
        contents: [{
          uri,
          mimeType: "application/json", 
          text: JSON.stringify(cluster, null, 2)
        }]
      };
    }
    
    if (uri.startsWith('dataproc://job/')) {
      const parts = uri.replace('dataproc://job/', '').split('/');
      const [projectId, region, jobId] = parts;
      const jobStatus = await getJobStatusWithRest(projectId, region, jobId);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(jobStatus, null, 2)
        }]
      };
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
  
  if (typeof args !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Invalid arguments");
  }
  
  try {
    // Handle each tool
    switch (toolName) {
      case "start_dataproc_cluster": {
        // Get default parameters if not provided
        let { projectId, region, clusterName, clusterConfig } = args;
        
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
        if (!projectId || !region || !clusterName) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters: projectId, region, clusterName");
        }

        logger.debug('MCP start_dataproc_cluster: Called with params:', { projectId, region, clusterName, clusterConfig });

        let response;
        try {
          response = await createCluster(
            String(projectId),
            String(region),
            String(clusterName),
            clusterConfig as any
          );
          logger.debug('MCP start_dataproc_cluster: createCluster response:', response);
        } catch (error) {
          logger.error('MCP start_dataproc_cluster: Error from createCluster:', error);
          throw error;
        }

        return {
          content: [
            {
              type: "text",
              text: `Cluster ${clusterName} started successfully in region ${region}.\nCluster details:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }
      
      case "list_clusters": {
        // Get default parameters if not provided
        let { projectId, region, filter, pageSize, pageToken } = args;
        
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
        if (!projectId || !region) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters: projectId, region");
        }
        const response = await listClusters(
          String(projectId),
          String(region),
          filter ? String(filter) : undefined,
          pageSize ? Number(pageSize) : undefined,
          pageToken ? String(pageToken) : undefined
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Clusters in project ${projectId}, region ${region}:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }
      
      case "get_job_status": {
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
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters: projectId, region, jobId");
        }
        logger.debug('MCP get_job_status: Called with params:', { projectId, region, jobId });
        
        try {
          const { getDataprocJobStatus } = await import("./services/job.js");
          const status = await getDataprocJobStatus({
            projectId: String(projectId),
            region: String(region),
            jobId: String(jobId)
          });
          
          return {
            content: [
              {
                type: "text",
                text: `Job status for ${jobId}:\n${JSON.stringify(status, null, 2)}`
              }
            ]
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_job_status: Error:', error);
          throw error;
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
          type: "text",
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
  if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Starting initialization');
  
  try {
    // Initialize services if not already done
    if (!profileManager) {
      const serverConfig = await getServerConfig();
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ProfileManager');
      profileManager = new ProfileManager(serverConfig.profileManager);
      await profileManager.initialize();
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ClusterTracker');
      clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
      await clusterTracker.initialize();
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing JobOutputHandler');
      jobOutputHandler = new JobOutputHandler();
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing JobTracker');
      jobTracker = new JobTracker();
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ClusterManager');
      clusterManager = new ClusterManager(profileManager, clusterTracker);
    }
    
    // Create and configure transport - for now, always use stdio
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Creating StdioServerTransport');
    const transport = new StdioServerTransport();
    
    if (httpMode) {
      console.error('[INFO] HTTP mode requested but not yet implemented. Using stdio mode.');
      console.error('[INFO] For simultaneous testing, run multiple instances:');
      console.error('[INFO] 1. MCP Inspector: npx @modelcontextprotocol/inspector build/index.js');
      console.error('[INFO] 2. VS Code: Configure .roo/mcp.json to use stdio transport');
    }
    
    // Connect server to transport
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Connecting server to transport');
    await server.connect(transport);
    
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Successfully connected and ready to receive requests');
  } catch (error) {
    console.error('[DEBUG] MCP Server: Initialization error:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('[DEBUG] MCP Server: Fatal error:', error);
  process.exit(1);
});
