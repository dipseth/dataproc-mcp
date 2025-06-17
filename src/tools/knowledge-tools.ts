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
      '**🔍 RESULT DISCOVERY EXAMPLES:**\n' +
      '• `jobId:abc123-def456 contentType:query_results` - Get actual Hive/Spark results\n' +
      '• `jobId:xyz789 type:query_result includeRawDocument:true` - Complete job output\n' +
      '• `clusterName:analytics-prod contentType:query_results` - All results from cluster\n' +
      '• `projectId:data-warehouse contentType:query_results` - Project query outputs\n\n' +
      '**🎯 COMMON PATTERNS:**\n' +
      '• Find table counts: `jobId:YOUR_ID contentType:query_results` → ["42857"]\n' +
      '• Get schema info: `DESCRIBE TABLE contentType:query_results` → column details\n' +
      '• Check job status: `jobId:YOUR_ID type:job` → execution metadata\n' +
      '• Cluster analysis: `clusterName:spark-cluster machine types` → hardware info\n\n' +
      '**🚀 POWER USER TIPS:**\n' +
      '• Combine tags: `jobId:123 clusterName:prod contentType:query_results`\n' +
      '• Time-based: `toolName:submit_hive_query 2024-12 contentType:query_results`\n' +
      '• Error hunting: `ERROR contentType:query_results` → failed query outputs\n' +
      '• Performance: `EXPLAIN contentType:query_results` → query plans',
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
