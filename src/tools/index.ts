/**
 * MCP Framework tools index
 * Exports all tool classes for the MCP Framework server
 */

import { StartDataprocClusterTool } from './StartDataprocClusterTool.js';
import { ListClustersTool } from './ListClustersTool.js';
import { SubmitHiveQueryTool } from './SubmitHiveQueryTool.js';
import { GetClusterTool } from './GetClusterTool.js';
import { DeleteClusterTool } from './DeleteClusterTool.js';
import { ListTrackedClustersTool } from './ListTrackedClustersTool.js';
import { GetQueryStatusTool } from './GetQueryStatusTool.js';
import { GetQueryResultsTool } from './GetQueryResultsTool.js';
import { CheckActiveJobsTool } from './CheckActiveJobsTool.js';
import { ListProfilesTool } from './ListProfilesTool.js';
import { GetProfileTool } from './GetProfileTool.js';
import { QueryClusterDataTool } from './QueryClusterDataTool.js';
import { GetClusterInsightsTool } from './GetClusterInsightsTool.js';
import { GetJobAnalyticsTool } from './GetJobAnalyticsTool.js';
import { QueryKnowledgeTool } from './QueryKnowledgeTool.js';
import { AllHandlerDependencies } from '../handlers/index.js';

/**
 * Create all MCP Framework tool instances
 */
export function createMcpTools(handlerDeps: AllHandlerDependencies) {
  return [
    // Cluster tools
    new StartDataprocClusterTool(handlerDeps),
    new ListClustersTool(handlerDeps),
    new GetClusterTool(handlerDeps),
    new DeleteClusterTool(handlerDeps),
    new ListTrackedClustersTool(handlerDeps),
    
    // Job tools
    new SubmitHiveQueryTool(handlerDeps),
    new GetQueryStatusTool(handlerDeps),
    new GetQueryResultsTool(handlerDeps),
    new CheckActiveJobsTool(handlerDeps),
    
    // Profile tools
    new ListProfilesTool(handlerDeps),
    new GetProfileTool(handlerDeps),
    
    // Knowledge tools
    new QueryClusterDataTool(handlerDeps),
    new GetClusterInsightsTool(handlerDeps),
    new GetJobAnalyticsTool(handlerDeps),
    new QueryKnowledgeTool(handlerDeps),
  ];
}

/**
 * Get tool names for reference
 */
export function getMcpToolNames(): string[] {
  return [
    // Cluster tools
    'start_dataproc_cluster',
    'list_clusters',
    'get_cluster',
    'delete_cluster',
    'list_tracked_clusters',
    
    // Job tools
    'submit_hive_query',
    'get_query_status',
    'get_query_results',
    'check_active_jobs',
    
    // Profile tools
    'list_profiles',
    'get_profile',
    
    // Knowledge tools
    'query_cluster_data',
    'get_cluster_insights',
    'get_job_analytics',
    'query_knowledge',
  ];
}

/**
 * Export allTools for compatibility with existing code
 * This is the tool definitions array used by the original MCP SDK server
 */
export const allTools = [
  {
    name: 'start_dataproc_cluster',
    description: 'Start a Google Cloud Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'Name for the new cluster',
        },
        clusterConfig: {
          type: 'object',
          description: 'Optional: Dataproc cluster config (JSON object)',
        },
      },
      required: ['clusterName'],
    },
  },
  {
    name: 'list_clusters',
    description: 'List Dataproc clusters in a project and region',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: {
          type: 'boolean',
          description: 'Optional: Return full response without filtering (default: false)',
        },
        semanticQuery: {
          type: 'string',
          description: 'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
        },
      },
    },
  },
  {
    name: 'submit_hive_query',
    description: 'Submit a Hive query to a Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'Name of the cluster to run the query on',
        },
        query: {
          type: 'string',
          description: 'Hive query to execute',
        },
        async: {
          type: 'boolean',
          description: 'Optional: Whether to wait for query completion (false) or return immediately (true)',
        },
        verbose: {
          type: 'boolean',
          description: 'Optional: Return full response without filtering (default: false)',
        },
        queryOptions: {
          type: 'object',
          description: 'Optional: Query configuration options',
        },
      },
      required: ['clusterName', 'query'],
    },
  },
  {
    name: 'get_cluster',
    description: 'Get details for a specific Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'Name of the cluster',
        },
        verbose: {
          type: 'boolean',
          description: 'Optional: Return full response without filtering (default: false)',
        },
        semanticQuery: {
          type: 'string',
          description: 'Optional: Semantic query to extract specific information (e.g., "pip packages", "machine types", "network config")',
        },
      },
      required: ['clusterName'],
    },
  },
  {
    name: 'delete_cluster',
    description: 'Delete a Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'Name of the cluster to delete',
        },
      },
      required: ['clusterName'],
    },
  },
  {
    name: 'list_tracked_clusters',
    description: 'List clusters that were created and tracked by this MCP server',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
        profileId: {
          type: 'string',
          description: 'Optional: Filter by profile ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_query_status',
    description: 'Get the status of a Hive query job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'Job ID to check',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'get_query_results',
    description: 'Get the results of a completed Hive query with enhanced async support and semantic search integration',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: {
          type: 'string',
          description: 'Job ID to get results for',
        },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of rows to display in the response (default: 10)',
        },
        pageToken: {
          type: 'string',
          description: 'Optional: Page token for pagination',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'check_active_jobs',
    description: '🚀 Quick status check for all active and recent jobs - perfect for seeing what\'s running!',
    inputSchema: {
      type: 'object',
      properties: {
        includeCompleted: {
          type: 'boolean',
          description: 'Include recently completed jobs (default: false)',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_profiles',
    description: 'List available cluster configuration profiles',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
        category: {
          type: 'string',
          description: 'Optional: Filter by category',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_profile',
    description: 'Get details for a specific cluster configuration profile',
    inputSchema: {
      type: 'object',
      properties: {
        profileId: {
          type: 'string',
          description: 'ID of the profile',
        },
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
      },
      required: ['profileId'],
    },
  },
  {
    name: 'query_cluster_data',
    description: 'Query stored cluster data using natural language (e.g., "pip packages", "machine types", "network config")',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query (e.g., "pip packages", "machine configuration", "network settings")',
        },
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
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
  {
    name: 'get_cluster_insights',
    description: '📊 Get comprehensive insights about discovered clusters, machine types, components, and recent discoveries',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_job_analytics',
    description: '📈 Get analytics about job submissions, success rates, error patterns, and performance metrics',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_knowledge',
    description: '🧠 Query the comprehensive knowledge base using natural language (clusters, jobs, errors, all)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query about clusters, jobs, or errors',
        },
        projectId: {
          type: 'string',
          description: 'Optional: Google Cloud Project ID',
        },
        region: {
          type: 'string',
          description: 'Optional: Google Cloud region',
        },
        type: {
          type: 'string',
          enum: ['clusters', 'cluster', 'jobs', 'job', 'errors', 'error', 'all'],
          description: 'Type of knowledge to search (default: all). Supports both singular and plural forms.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
        includeRawDocument: {
          type: 'boolean',
          description: 'Include raw Qdrant document with full payload, compression status, and metadata (default: false)',
        },
      },
      required: ['query'],
    },
  },
];

export default allTools;