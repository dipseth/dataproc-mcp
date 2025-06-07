/**
 * Knowledge base and analytics tool definitions
 * Extracted from main server file for better organization
 */

export const knowledgeTools = [
  // New tool: semantic query for stored cluster data
  {
    name: 'query_cluster_data',
    description:
      'Query stored cluster data using natural language (e.g., "pip packages", "machine types", "network config")',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
        query: {
          type: 'string',
          description:
            'Natural language query (e.g., "pip packages", "machine configuration", "network settings")',
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
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
      },
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
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
      },
      required: [],
    },
  },

  // New tool: query knowledge base
  {
    name: 'query_knowledge',
    description:
      '🧠 Query the comprehensive knowledge base using natural language (clusters, jobs, errors, all)\n\n' +
      '**Enhanced Features:**\n' +
      '• Structured data retrieval with schema/rows separation for query results\n' +
      '• Raw Qdrant document access with compression status\n' +
      '• Proper clusterName display (no more "unknown" values)\n' +
      '• Decompression support for compressed data\n' +
      '• Detailed metadata including compression ratios and token counts\n' +
      '• Tag-based search for exact field matching (solves UUID search problem)\n\n' +
      '**Search Types:**\n' +
      '• **Semantic Search**: `"hive query results"` - Natural language queries\n' +
      '• **Tag-based Search**: `"jobId:20d1092f-9aa8-4f4d-b4e3-bfbdbdd8d431"` - Exact field matching\n' +
      '• **Hybrid Search**: `"jobId:12345 SHOW DATABASES"` - Tags + semantic content\n\n' +
      '**Supported Tags:**\n' +
      '• `jobId:value` - Search by job ID\n' +
      '• `clusterName:value` - Search by cluster name\n' +
      '• `projectId:value` - Search by project ID\n' +
      '• `region:value` - Search by region\n' +
      '• `toolName:value` - Search by tool name\n' +
      '• `type:value` - Search by data type\n\n' +
      '**Examples:**\n' +
      '• `query: "jobId:20d1092f-9aa8-4f4d-b4e3-bfbdbdd8d431", includeRawDocument: true` - Find specific job\n' +
      '• `query: "clusterName:my-cluster hive"` - Jobs on specific cluster with hive\n' +
      '• `query: "projectId:my-project type:query_result"` - Query results from project\n' +
      '• `query: "machine learning clusters", type: "clusters"` - Semantic cluster search\n' +
      '• `query: "toolName:submit_hive_query SHOW"` - Hive queries containing "SHOW"',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional: Google Cloud Project ID' },
        region: { type: 'string', description: 'Optional: Google Cloud region' },
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
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
        includeRawDocument: {
          type: 'boolean',
          description:
            'Include raw Qdrant document with full payload, compression status, and metadata (default: false)',
        },
      },
      required: ['query'],
    },
  },
];
