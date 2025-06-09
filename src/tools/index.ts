/**
 * MCP Framework tools index
 * Exports tool classes and definitions for the MCP Framework server
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
  // Add other tool definitions as needed...
];

export default allTools;