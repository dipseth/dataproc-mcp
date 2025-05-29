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
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import { logger } from "./utils/logger.js";

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

// Create the MCP server with basic initialization
// Note: The full server with updated capabilities will be created in main()
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
        logger.debug('MCP get_cluster: Calling getCluster with params:', { projectId, region, clusterName });
        
        const response = await getCluster(
          String(projectId),
          String(region),
          String(clusterName)
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
        logger.debug('MCP submit_dataproc_job: Called with params:', { projectId, region, clusterName, jobType, async });
        
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
          
          jobTracker.addOrUpdateJob({
            jobId: response.jobId || response.jobReference?.jobId,
            toolName: toolName,
            status: response.status || 'SUBMITTED',
            projectId: String(projectId),
            region: String(region),
            clusterName: String(clusterName),
            resultsCached: false // Initially no results cached
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
          logger.error('MCP submit_dataproc_job: Error:', error);
          throw error;
        }
      }
      
      case "get_job_status": {
        // Validate required parameters
        if (!args.projectId || !args.region || !args.jobId) {
          throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
        }
        
        const { projectId, region, jobId } = args;
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
        
        const { projectId, region, jobId, maxResults } = args;
        
        // Use maxResults as maxDisplayRows if provided, otherwise default to 10
        const maxDisplayRows = maxResults ? Number(maxResults) : 10;
        
        logger.debug('MCP get_job_results: Called with params:', { projectId, region, jobId });
        
        try {
          const { getDataprocJobResults } = await import("./services/job.js");
          logger.debug('MCP get_job_results: Calling getDataprocJobResults with params:', {
            projectId,
            region,
            jobId,
            wait: true // Add wait parameter to ensure job completion
          });
          
          const results: any = await getDataprocJobResults({
            projectId: String(projectId),
            region: String(region),
            jobId: String(jobId),
            wait: true, // Add wait parameter to ensure job completion
            maxDisplayRows // Pass the maxDisplayRows parameter
          });
          
          logger.debug('MCP get_job_results: Results from getDataprocJobResults:', {
            hasParsedOutput: 'parsedOutput' in results,
            resultKeys: Object.keys(results),
            status: results.status?.state
          });
          
          if (results && typeof results === 'object' && 'parsedOutput' in results) {
            logger.debug('MCP get_job_results: parsedOutput is present, formatting results');
            
            // Extract the tables from the parsed output
            const parsedOutput = results.parsedOutput;
            let formattedOutput = '';
            
            if (parsedOutput && parsedOutput.tables && parsedOutput.tables.length > 0) {
              // Format as TSV for better readability
              const table = parsedOutput.tables[0];
              
              // Add diagnostic log to check table structure
              logger.debug('get_job_results: Table structure:', {
                columnTypes: table.columns.map((col: string) => typeof col),
                rowCount: table.rows.length,
                sampleRow: table.rows.length > 0 ? Object.keys(table.rows[0]) : []
              });
              
              // Add the column headers
              formattedOutput += table.columns.join('\t') + '\n';
              
              // Add a separator line
              formattedOutput += table.columns.map(() => '--------').join('\t') + '\n';
              
              // Add the rows (limit to maxDisplayRows for brevity)
              const maxRows = Math.min(table.rows.length, maxDisplayRows);
              for (let i = 0; i < maxRows; i++) {
                const row = table.rows[i];
                formattedOutput += table.columns.map((col: string) => row[col] || '').join('\t') + '\n';
              }
              
              // Add a note if there are more rows
              if (table.rows.length > maxDisplayRows) {
                formattedOutput += `\n... (${table.rows.length - maxDisplayRows} more rows not shown)`;
              }
            } else if (parsedOutput && parsedOutput.csv) {
              // If CSV is available, use that instead
              const csvLines = parsedOutput.csv.split('\n');
              const maxLines = Math.min(csvLines.length, maxDisplayRows + 1); // Header + maxDisplayRows rows
              
              // Add diagnostic log to check CSV structure
              logger.debug('get_job_results: CSV structure:', {
                totalLines: csvLines.length,
                displayedLines: maxLines,
                maxDisplayRows,
                sampleLine: csvLines.length > 0 ? csvLines[0] : '',
                hasRawOutput: 'rawOutput' in parsedOutput
              });
              
              formattedOutput = csvLines.slice(0, maxLines).join('\n');
              
              // Add a note if there are more lines
              if (csvLines.length > maxLines) {
                formattedOutput += `\n... (${csvLines.length - maxLines} more rows not shown)`;
              }
            }
            
            // Include information about the TSV file
            const tsvFileInfo = results.tsvFilePath
              ? `\n\nComplete results saved to: ${results.tsvFilePath}`
              : '';
            
            return {
              content: [
                {
                  type: "text",
                  text: `Job results for ${jobId}:\n\n${formattedOutput}${tsvFileInfo}`,
                },
              ],
            };
          } else {
            logger.debug('MCP get_job_results: parsedOutput is missing, returning basic job info');
            
            // Add diagnostic log to check job details structure
            logger.debug('MCP get_job_results: Job details structure:', {
              hasRawOutput: 'rawOutput' in results,
              resultKeys: Object.keys(results),
              jobType: Object.keys(results).find(key => key.endsWith('Job')) || 'UNKNOWN'
            });
            
            // Return just basic job info without the full details
            const basicInfo = {
              jobId: results.jobId || results.reference?.jobId,
              status: results.status?.state || 'UNKNOWN',
              jobType: Object.keys(results).find(key => key.endsWith('Job')) || 'UNKNOWN'
            };
            
            return {
              content: [
                {
                  type: "text",
                  text: `Job results for ${jobId}:\n${JSON.stringify(basicInfo, null, 2)}\nNo parsed output available.`,
                },
              ],
            };
          }
        } catch (error: any) {
          logger.error('MCP get_job_results: Error:', error);
          logger.error('MCP get_job_results: Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
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
    
    // Initialize job output handler
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing JobOutputHandler');
    jobOutputHandler = new JobOutputHandler();
    
    // Initialize job tracker
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing JobTracker');
    jobTracker = new JobTracker();
    
    // Initialize cluster manager
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Initializing ClusterManager');
    clusterManager = new ClusterManager(profileManager, clusterTracker);
    
    // Create a new server with updated capabilities
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Creating server with updated capabilities');
    const updatedServer = new Server(
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
          prompts: {
            listChanged: true
          },
        },
      }
    );
    
    // Create and configure transport - for now, always use stdio
    // HTTP mode can be added later when needed
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Creating StdioServerTransport');
    const transport = new StdioServerTransport();
    
    if (httpMode) {
      console.error('[INFO] HTTP mode requested but not yet implemented. Using stdio mode.');
      console.error('[INFO] For simultaneous testing, run multiple instances:');
      console.error('[INFO] 1. MCP Inspector: npx @modelcontextprotocol/inspector build/index.js');
      console.error('[INFO] 2. VS Code: Configure .roo/mcp.json to use stdio transport');
    }
    
    // Connect server to transport with detailed error handling
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Connecting server to transport');
    // Add resource and prompt capabilities through request handlers
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Setting up resource and prompt handlers');
    
    // Copy tool handlers from the original server to the updated server
    updatedServer.setRequestHandler(ListToolsRequestSchema, async () => {
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

    // Copy tool call handlers from the original server to the updated server
    updatedServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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
          
          case "create_cluster_from_profile": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.profileName || !args.clusterName) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters: projectId, region, profileName and clusterName");
            }
            
            const { projectId, region, profileName, clusterName, overrides } = args;
            logger.debug('MCP create_cluster_from_profile: Called with params:', { projectId, region, profileName, clusterName, overrides });
            
            try {
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
                    type: "text",
                    text: `Cluster ${clusterName} created successfully from profile ${profileName}.\nCluster details:\n${JSON.stringify(response, null, 2)}`,
                  },
                ],
              };
            } catch (error) {
              logger.error('MCP create_cluster_from_profile: Error:', error);
              throw error;
            }
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
            logger.debug('MCP get_cluster: Calling getCluster with params:', { projectId, region, clusterName });
            
            const response = await getCluster(
              String(projectId),
              String(region),
              String(clusterName)
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
            logger.debug('MCP submit_dataproc_job: Called with params:', { projectId, region, clusterName, jobType, async });
            
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
              
              jobTracker.addOrUpdateJob({
                jobId: response.jobId || response.jobReference?.jobId,
                toolName: toolName,
                status: response.status || 'SUBMITTED',
                projectId: String(projectId),
                region: String(region),
                clusterName: String(clusterName),
                resultsCached: false // Initially no results cached
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
              logger.error('MCP submit_dataproc_job: Error:', error);
              throw error;
            }
          }

          case "get_job_status": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.jobId) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, jobId } = args;
            logger.debug('MCP get_job_status: Called with params:', { projectId, region, jobId });
            
            try {
              const response = await getJobStatus(String(projectId), String(region), String(jobId));
              
              return {
                content: [
                  {
                    type: "text",
                    text: `Job status for ${jobId}:\n${JSON.stringify(response, null, 2)}`
                  }
                ]
              };
            } catch (error) {
              logger.error('MCP get_job_status: Error:', error);
              throw error;
            }
          }

          case "get_job_results": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.jobId) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, jobId, maxResults } = args;
            logger.debug('MCP get_job_results: Called with params:', { projectId, region, jobId, maxResults });
            
            try {
              // First check if we have cached results
              let cachedResults = null;
              try {
                cachedResults = await jobOutputHandler.getCachedOutput(String(jobId));
                if (cachedResults) {
                  logger.debug('MCP get_job_results: Found cached results for job:', jobId);
                  
                  // Update job tracker to indicate results are cached
                  jobTracker.addOrUpdateJob({
                    jobId: String(jobId),
                    toolName: 'get_job_results',
                    status: 'DONE',
                    projectId: String(projectId),
                    region: String(region),
                    clusterName: 'unknown', // We don't have cluster name in this context
                    resultsCached: true
                  });
                  
                  return {
                    content: [
                      {
                        type: "text",
                        text: `Job results for ${jobId} (from cache):\n${JSON.stringify(cachedResults, null, 2)}`
                      }
                    ]
                  };
                }
              } catch (cacheError) {
                logger.debug('MCP get_job_results: No cached results found for job:', jobId);
              }
              
              // If no cached results, get fresh results
              const { getDataprocJobResults } = await import("./services/job.js");
              const response = await getDataprocJobResults({
                projectId: String(projectId),
                region: String(region),
                jobId: String(jobId),
                maxDisplayRows: maxResults ? Number(maxResults) : 10
              });
              
              // Update job tracker
              jobTracker.addOrUpdateJob({
                jobId: String(jobId),
                toolName: 'get_job_results',
                status: 'DONE',
                projectId: String(projectId),
                region: String(region),
                clusterName: 'unknown', // We don't have cluster name in this context
                resultsCached: false
              });
              
              return {
                content: [
                  {
                    type: "text",
                    text: `Job results for ${jobId}:\n${JSON.stringify(response, null, 2)}`
                  }
                ]
              };
            } catch (error) {
              logger.error('MCP get_job_results: Error:', error);
              throw error;
            }
          }

          case "get_zeppelin_url": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.clusterName) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, clusterName } = args;
            logger.debug('MCP get_zeppelin_url: Called with params:', { projectId, region, clusterName });
            
            try {
              // Get cluster details to check if Zeppelin is enabled
              const cluster = await getCluster(String(projectId), String(region), String(clusterName));
              
              // Check if Zeppelin is enabled in the cluster configuration
              const zeppelinEnabled = cluster?.config?.softwareConfig?.optionalComponents?.includes('ZEPPELIN');
              
              if (!zeppelinEnabled) {
                return {
                  content: [
                    {
                      type: "text",
                      text: `Zeppelin is not enabled on cluster ${clusterName}. To enable Zeppelin, include 'ZEPPELIN' in the optionalComponents when creating the cluster.`
                    }
                  ]
                };
              }
              
              // Construct Zeppelin URL
              const zeppelinUrl = `https://${clusterName}-m.${region}.c.${projectId}.internal:8080`;
              
              return {
                content: [
                  {
                    type: "text",
                    text: `Zeppelin URL for cluster ${clusterName}: ${zeppelinUrl}\n\nNote: This URL is accessible from within the VPC. For external access, you may need to set up a proxy or configure firewall rules.`
                  }
                ]
              };
            } catch (error) {
              logger.error('MCP get_zeppelin_url: Error:', error);
              throw error;
            }
          }
          
          case "delete_cluster": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.clusterName) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, clusterName } = args;
            const response = await deleteCluster(
              String(projectId),
              String(region),
              String(clusterName)
            );
            
            return {
              content: [
                {
                  type: "text",
                  text: `Cluster ${clusterName} deletion initiated.\nOperation details:\n${JSON.stringify(response, null, 2)}`,
                },
              ],
            };
          }
          
          case "list_tracked_clusters": {
            const { profileId } = args;
            const clusters = clusterTracker.exportClusters();
            
            return {
              content: [
                {
                  type: "text",
                  text: `Tracked clusters:\n${JSON.stringify(clusters, null, 2)}`,
                },
              ],
            };
          }
          
          case "list_profiles": {
            const { category } = args;
            const profiles = profileManager.exportProfiles();
            
            return {
              content: [
                {
                  type: "text",
                  text: `Available profiles:\n${JSON.stringify(profiles, null, 2)}`,
                },
              ],
            };
          }
          
          case "get_profile": {
            // Validate required parameters
            if (!args.profileId) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameter: profileId");
            }
            
            const { profileId } = args;
            const profile = await profileManager.getProfile(String(profileId));
            
            return {
              content: [
                {
                  type: "text",
                  text: `Profile details for ${profileId}:\n${JSON.stringify(profile, null, 2)}`,
                },
              ],
            };
          }
          
          case "submit_hive_query": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.clusterName || !args.query) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, clusterName, query, async, queryOptions } = args;
            const response = await submitHiveQuery(
              String(projectId),
              String(region),
              String(clusterName),
              String(query),
              queryOptions || {},
              Boolean(async)
            );
            
            return {
              content: [
                {
                  type: "text",
                  text: Boolean(async)
                    ? `Hive query submitted asynchronously. Job ID: ${response.reference?.jobId || response.jobUuid}`
                    : `Hive query completed. Job ID: ${response.jobUuid}\nStatus: ${response.status}\nDetails: ${JSON.stringify(response, null, 2)}`,
                },
              ],
            };
          }
          
          case "get_query_status": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.jobId) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, jobId } = args;
            const response = await getJobStatus(
              String(projectId),
              String(region),
              String(jobId)
            );
            
            return {
              content: [
                {
                  type: "text",
                  text: `Query status for job ${jobId}:\n${JSON.stringify(response, null, 2)}`,
                },
              ],
            };
          }
          
          case "get_query_results": {
            // Validate required parameters
            if (!args.projectId || !args.region || !args.jobId) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }
            
            const { projectId, region, jobId, maxResults, pageToken } = args;
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
                  type: "text",
                  text: `Query results for job ${jobId}:\n${JSON.stringify(response, null, 2)}`,
                },
              ],
            };
          }
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
      } catch (error) {
        logger.error('MCP tool call error:', error);
        throw error;
      }
    });
    
    // Define resource list request schema using Zod
    const ListResourcesRequestSchema = z.object({
      method: z.literal("list_resources"),
    });
    
    // Define resource read request schema using Zod
    const ReadResourceRequestSchema = z.object({
      method: z.literal("read_resource"),
      params: z.object({
        uri: z.string(),
      }),
    });
    
    // Define prompt list request schema using Zod
    const ListPromptsRequestSchema = z.object({
      method: z.literal("list_prompts"),
    });
    
    // Define prompt read request schema using Zod
    const ReadPromptRequestSchema = z.object({
      method: z.literal("read_prompt"),
      params: z.object({
        id: z.string(),
      }),
    });
    
    // Define types for the request parameters
    type ReadResourceRequest = z.infer<typeof ReadResourceRequestSchema>;
    type ReadPromptRequest = z.infer<typeof ReadPromptRequestSchema>;
    
    // Handler for listing resources
    updatedServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Resource list handler called');
      
      // Get tracked clusters
      const trackedClusters = clusterManager.listTrackedClusters();
      
      // Get tracked jobs
      const trackedJobs = jobTracker.listJobs();
      
      // Build resource list
      const resources = [
        // Cluster resources
        ...trackedClusters.map((cluster) => {
          // Get project ID and region from metadata if available
          const projectId = cluster.metadata?.projectId || 'unknown';
          const region = cluster.metadata?.region || 'unknown';
          const status = cluster.metadata?.status || 'Unknown status';
          
          return {
            uri: `dataproc://clusters/${projectId}/${region}/${cluster.clusterName}`,
            name: `Cluster: ${cluster.clusterName}`,
            description: `Dataproc cluster in ${region} (${status})`,
          };
        }),
        
        // Job resources
        ...trackedJobs.map(job => ({
          uri: `dataproc://jobs/${job.projectId}/${job.region}/${job.jobId}`,
          name: `Job: ${job.jobId}`,
          description: `Dataproc job (${job.toolName}) - ${job.status}`,
        })),
      ];
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Returning resource list:', resources);
      return { resources };
    });
    
    // Handler for reading resources
    updatedServer.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Resource read handler called with URI:', request.params.uri);
      
      const uri = request.params.uri;
      
      try {
        // Parse the URI to determine resource type
        if (uri.startsWith('dataproc://clusters/')) {
          // Handle cluster resource
          const parts = uri.replace('dataproc://clusters/', '').split('/');
          if (parts.length !== 3) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid cluster URI format: ${uri}`);
          }
          
          const [projectId, region, clusterName] = parts;
          const cluster = await getCluster(projectId, region, clusterName);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(cluster, null, 2),
              },
            ],
          };
        } else if (uri.startsWith('dataproc://jobs/')) {
          // Handle job resource
          const parts = uri.replace('dataproc://jobs/', '').split('/');
          if (parts.length !== 3) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid job URI format: ${uri}`);
          }
          
          const [projectId, region, jobId] = parts;
          
          // Get job status
          const status = await getJobStatus(projectId, region, jobId);
          
          // Get job results if available
          let results = null;
          if (status && status.status?.state === JobState.DONE) {
            try {
              results = await jobOutputHandler.getCachedOutput(jobId);
            } catch (error) {
              console.error(`[DEBUG] MCP Server: Error getting cached output for job ${jobId}:`, error);
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status, results }, null, 2),
              },
            ],
          };
        } else {
          throw new McpError(ErrorCode.InvalidParams, `Unknown resource URI: ${uri}`);
        }
      } catch (error) {
        console.error(`[DEBUG] MCP Server: Error reading resource ${uri}:`, error);
        throw error;
      }
    });
    
    // Handler for listing prompts
    updatedServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Prompt list handler called');
      
      // Define available prompts
      const prompts = [
        {
          id: "dataproc-cluster-creation",
          name: "Dataproc Cluster Creation",
          description: "Guidelines for creating Dataproc clusters",
        },
        {
          id: "dataproc-job-submission",
          name: "Dataproc Job Submission",
          description: "Guidelines for submitting jobs to Dataproc clusters",
        },
      ];
      
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Returning prompt list:', prompts);
      return { prompts };
    });
    
    // Handler for reading prompts
    updatedServer.setRequestHandler(ReadPromptRequestSchema, async (request: ReadPromptRequest) => {
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] MCP Server: Prompt read handler called with ID:', request.params.id);
      
      const id = request.params.id;
      
      try {
        if (id === "dataproc-cluster-creation") {
          return {
            content: [
              {
                type: "text",
                text: `# Dataproc Cluster Creation Guidelines

When creating a Dataproc cluster, consider the following:

1. **Region Selection**: Choose a region close to your data and users to minimize latency.
2. **Machine Types**: Select appropriate machine types based on your workload:
   - Standard machines for general-purpose workloads
   - High-memory machines for memory-intensive applications
   - High-CPU machines for compute-intensive tasks
3. **Cluster Size**: Start with a small cluster and scale as needed.
4. **Initialization Actions**: Use initialization actions to install additional software or configure the cluster.
5. **Network Configuration**: Configure VPC and firewall rules appropriately.
6. **Component Selection**: Choose only the components you need to minimize cluster startup time.
7. **Autoscaling**: Enable autoscaling for workloads with variable resource requirements.

For production workloads, consider using a predefined profile with the \`create_cluster_from_profile\` tool.`,
              },
            ],
          };
        } else if (id === "dataproc-job-submission") {
          return {
            content: [
              {
                type: "text",
                text: `# Dataproc Job Submission Guidelines

When submitting jobs to Dataproc, follow these best practices:

1. **Job Types**:
   - Use Hive for SQL-like queries on structured data
   - Use Spark for complex data processing
   - Use PySpark for Python-based data processing
   - Use Presto for interactive SQL queries

2. **Performance Optimization**:
   - Partition your data appropriately
   - Use appropriate file formats (Parquet, ORC)
   - Set appropriate executor memory and cores
   - Use caching for frequently accessed data

3. **Monitoring**:
   - Monitor job progress using the \`get_job_status\` tool
   - Retrieve results using the \`get_job_results\` or \`get_query_results\` tools

4. **Error Handling**:
   - Check job status before retrieving results
   - Handle job failures gracefully
   - Retry failed jobs with appropriate backoff

5. **Resource Management**:
   - Submit jobs to appropriately sized clusters
   - Consider using preemptible VMs for cost savings
   - Delete clusters when no longer needed`,
              },
            ],
          };
        } else {
          throw new McpError(ErrorCode.InvalidParams, `Unknown prompt ID: ${id}`);
        }
      } catch (error) {
        console.error(`[DEBUG] MCP Server: Error reading prompt ${id}:`, error);
        throw error;
      }
    });
    
    // Connect server to transport
    await updatedServer.connect(transport);
    
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
