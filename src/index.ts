#!/usr/bin/env node

/**
 * MCP server for Google Cloud Dataproc operations
 * Provides tools for:
 * - Creating clusters (from JSON or YAML)
 * - Listing clusters
 * - Running Hive queries
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";

// Import our services
import { createCluster, createClusterFromYaml, deleteCluster, listClusters, getCluster } from "./services/cluster.js";
import {
  submitHiveQuery,
  submitHiveQueryWithRest,
  getJobStatus,
  getJobStatusWithRest,
  getQueryResults
} from "./services/query.js";
import { getCredentialsConfig } from "./config/credentials.js";
import { getServerConfig } from "./config/server.js";
import { ProfileManager } from "./services/profile.js";
import { ClusterTracker } from "./services/tracker.js";
import { ClusterManager } from "./services/cluster-manager.js";

// Check for credentials
const credentials = getCredentialsConfig();
if (!credentials.keyFilename && !credentials.useApplicationDefault) {
  console.warn('No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or USE_APPLICATION_DEFAULT=true');
}

// Initialize services
let profileManager: ProfileManager;
let clusterTracker: ClusterTracker;
let clusterManager: ClusterManager;

// Create the MCP server
const server = new Server(
  {
    name: "dataproc-server",
    version: "0.3.0",
  },
  {
    capabilities: {
      resources: {},
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
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            clusterName: { type: "string", description: "Name for the new cluster" },
            clusterConfig: { type: "object", description: "Optional: Dataproc cluster config (JSON object)" },
          },
          required: ["projectId", "region", "clusterName"],
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
            profileId: { type: "string", description: "ID of the profile to use" },
            clusterName: { type: "string", description: "Optional: Override for the cluster name" },
            overrides: { type: "object", description: "Optional: Runtime configuration overrides" },
          },
          required: ["projectId", "region", "profileId"],
        },
      },
      
      // New tool: list clusters
      {
        name: "list_clusters",
        description: "List Dataproc clusters in a project and region",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            filter: { type: "string", description: "Optional: Filter string" },
            pageSize: { type: "number", description: "Optional: Page size" },
            pageToken: { type: "string", description: "Optional: Page token for pagination" },
          },
          required: ["projectId", "region"],
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
            projectId: { type: "string", description: "GCP project ID" },
            region: { type: "string", description: "Dataproc region (e.g., us-central1)" },
            jobId: { type: "string", description: "Job ID to check" }
          },
          required: ["projectId", "region", "jobId"],
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
            jobId: { type: "string", description: "Job ID to get results for" }
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
        // Validate required parameters
        if (!args.projectId || !args.region || !args.clusterName) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }

        const { projectId, region, clusterName, clusterConfig } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP start_dataproc_cluster: Called with params:', { projectId, region, clusterName, clusterConfig });

        let response;
        try {
          response = await createCluster(
            String(projectId),
            String(region),
            String(clusterName),
            clusterConfig as any
          );
          if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP start_dataproc_cluster: createCluster response:', response);
        } catch (error) {
          console.error('[DEBUG] MCP start_dataproc_cluster: Error from createCluster:', error);
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
      
      case "create_cluster_from_yaml": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.yamlPath) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, yamlPath, overrides } = args;
        const response = await createClusterFromYaml(
          String(projectId),
          String(region),
          String(yamlPath),
          overrides as any
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Cluster created successfully from YAML configuration.\nCluster details:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }
      
      case "list_clusters": {
        // Validate required parameters
        if (!args.projectId || !args.region) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, filter, pageSize, pageToken } = args;
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
      
      case "get_cluster": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.clusterName) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, clusterName } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP get_cluster: Calling getCluster with params:', { projectId, region, clusterName });
        
        // Use the same service account for impersonation as in the test script
        const impersonateServiceAccount = 'grpn-sa-terraform-data-science@prj-grp-central-sa-prod-0b25.iam.gserviceaccount.com';
        
        const response = await getCluster(
          String(projectId),
          String(region),
          String(clusterName),
          impersonateServiceAccount
        );
        
        return {
          content: [
            {
              type: "text",
              text: `Cluster details for ${clusterName}:\n${JSON.stringify(response, null, 2)}`,
            },
          ],
        };
      }
      
      // New generic job handlers
      case "submit_dataproc_job": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.clusterName || !args.jobType || !args.jobConfig) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, clusterName, jobType, jobConfig, async } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP submit_dataproc_job: Called with params:', { projectId, region, clusterName, jobType, async });
        
        try {
          const { submitDataprocJob } = await import("./services/job.js");
          const response = await submitDataprocJob({
            projectId: String(projectId),
            region: String(region),
            clusterName: String(clusterName),
            jobType: String(jobType) as any,
            jobConfig,
            async: Boolean(async)
          });
          
          return {
            content: [
              {
                type: "text",
                text: Boolean(async)
                  ? `${jobType} job submitted asynchronously. Job ID: ${response.jobReference?.jobId}`
                  : `${jobType} job completed. Job ID: ${response.jobId}\nStatus: ${response.status}\nDetails: ${JSON.stringify(response, null, 2)}`
              }
            ]
          };
        } catch (error) {
          console.error('[DEBUG] MCP submit_dataproc_job: Error:', error);
          throw error;
        }
      }
      
      case "get_job_status": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.jobId) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, jobId } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP get_job_status: Called with params:', { projectId, region, jobId });
        
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
                text: `Job status for ${jobId}:\nState: ${status.status?.state}\nDetails: ${JSON.stringify(status, null, 2)}`
              }
            ]
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_job_status: Error:', error);
          throw error;
        }
      }
      
      case "get_job_results": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.jobId) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, jobId } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP get_job_results: Called with params:', { projectId, region, jobId });
        
        try {
          const { getDataprocJobResults } = await import("./services/job.js");
          const results = await getDataprocJobResults({
            projectId: String(projectId),
            region: String(region),
            jobId: String(jobId)
          });
          
          return {
            content: [
              {
                type: "text",
                text: `Job results for ${jobId}:\n${JSON.stringify(results, null, 2)}`
              }
            ]
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_job_results: Error:', error);
          throw error;
        }
      }
      
      case "get_zeppelin_url": {
        const { projectId, region, clusterName } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP get_zeppelin_url: Called with params:', { projectId, region, clusterName });
        try {
          const { getZeppelinUrl } = await import("./services/job.js");
          const url = getZeppelinUrl(String(projectId), String(region), String(clusterName));
          return {
            content: [
              {
                type: "text",
                text: `Zeppelin notebook URL for cluster ${clusterName}:\n${url}`
              }
            ]
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_zeppelin_url: Error:', error);
          throw error;
        }
      }
      
      case "delete_cluster": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.clusterName) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, clusterName } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP delete_cluster: Called with params:', { projectId, region, clusterName });
        
        try {
          const response = await clusterManager.deleteCluster(
            String(projectId),
            String(region),
            String(clusterName)
          );
          
          return {
            content: [
              {
                type: "text",
                text: `Cluster ${clusterName} deleted successfully in region ${region}.\nOperation details:\n${JSON.stringify(response, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP delete_cluster: Error:', error);
          throw error;
        }
      }
      
      case "create_cluster_from_profile": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.profileId) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, profileId, clusterName, overrides } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP create_cluster_from_profile: Called with params:', { projectId, region, profileId, clusterName, overrides });
        
        try {
          const response = await clusterManager.createClusterFromProfile(
            String(projectId),
            String(region),
            String(profileId),
            clusterName ? String(clusterName) : undefined,
            overrides as any
          );
          
          return {
            content: [
              {
                type: "text",
                text: `Cluster created successfully from profile ${profileId}.\nCluster details:\n${JSON.stringify(response, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP create_cluster_from_profile: Error:', error);
          throw error;
        }
      }
      
      case "list_tracked_clusters": {
        const { profileId } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP list_tracked_clusters: Called with params:', { profileId });
        
        try {
          let trackedClusters;
          
          if (profileId) {
            trackedClusters = clusterManager.getTrackedClustersByProfile(String(profileId));
          } else {
            trackedClusters = clusterManager.listTrackedClusters();
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Tracked clusters${profileId ? ` for profile ${profileId}` : ''}:\n${JSON.stringify(trackedClusters, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP list_tracked_clusters: Error:', error);
          throw error;
        }
      }
      
      case "list_profiles": {
        const { category } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP list_profiles: Called with params:', { category });
        
        try {
          let profiles;
          
          if (category) {
            if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP list_profiles: Getting profiles by category:', category);
            profiles = clusterManager.getProfilesByCategory(String(category));
          } else {
            if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP list_profiles: Getting all profiles');
            profiles = clusterManager.listProfiles();
          }
          
          if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP list_profiles: Found profiles:', profiles);
          
          return {
            content: [
              {
                type: "text",
                text: `Available profiles${category ? ` in category ${category}` : ''}:\n${JSON.stringify(profiles, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP list_profiles: Error:', error);
          throw error;
        }
      }
      
      case "get_profile": {
        // Validate required parameters
        if (!args.profileId) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { profileId } = args;
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP get_profile: Called with params:', { profileId });
        
        try {
          const profile = clusterManager.getProfile(String(profileId));
          
          if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
          }
          
          return {
            content: [
              {
                type: "text",
                text: `Profile details for ${profileId}:\n${JSON.stringify(profile, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          console.error('[DEBUG] MCP get_profile: Error:', error);
          throw error;
        }
      }
      
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    
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
    // Check credentials before starting
    const credentials = getCredentialsConfig();
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Using credentials config:', credentials);
    
    // Load server configuration
    const serverConfig = await getServerConfig();
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Using server config:', serverConfig);
    
    // Initialize profile manager
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ProfileManager');
    profileManager = new ProfileManager(serverConfig.profileManager);
    await profileManager.initialize();
    
    // Initialize cluster tracker
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ClusterTracker');
    clusterTracker = new ClusterTracker(serverConfig.clusterTracker);
    await clusterTracker.initialize();
    
    // Initialize cluster manager
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ClusterManager');
    clusterManager = new ClusterManager(profileManager, clusterTracker);
    
    // Create and configure transport
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Creating StdioServerTransport');
    const transport = new StdioServerTransport();
    
    // Connect server to transport with detailed error handling
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Connecting server to transport');
    await server.connect(transport);
    
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Successfully connected and ready to receive requests');
  } catch (error) {
    console.error('[DEBUG] MCP Server: Initialization error:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error("[DEBUG] MCP Server: Fatal error:", error);
  process.exit(1);
});
