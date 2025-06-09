/**
 * Job submission and management tool definitions
 * Extracted from main server file for better organization
 */

export const jobTools = [
  // New tool: submit Hive query
  {
    name: 'submit_hive_query',
    description: 'Submit a Hive query to a Dataproc cluster',
    inputSchema: {
      type: 'object',
      properties: {
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
      required: ['clusterName', 'query'],
    },
  },

  // New tool: get query status
  {
    name: 'get_query_status',
    description: 'Get the status of a Hive query job',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job ID to check' },
      },
      required: ['jobId'],
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
        jobId: { type: 'string', description: 'Job ID to get results for' },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of rows to display in the response (default: 10)',
        },
        pageToken: { type: 'string', description: 'Optional: Page token for pagination' },
      },
      required: ['jobId'],
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
      required: ['clusterName', 'jobType', 'jobConfig'],
    },
  },

  // New tool: get Dataproc job status
  {
    name: 'get_job_status',
    description: 'Get the status of a Dataproc job by job ID.',
    inputSchema: {
      type: 'object',
      properties: {
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
        jobId: { type: 'string', description: 'Job ID to get results for' },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of rows to display in the response (default: 10)',
        },
      },
      required: ['jobId'],
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
        includeCompleted: {
          type: 'boolean',
          description: 'Include recently completed jobs (default: false)',
        },
      },
      required: [],
    },
  },
];

export default jobTools;
