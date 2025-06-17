/**
 * Job submission and management tool definitions
 * Extracted from main server file for better organization
 */

export const jobTools = [
  // New tool: submit Hive query
  {
    name: 'submit_hive_query',
    description:
      'Submit a Hive query to a Dataproc cluster with enhanced result discovery.\n\n' +
      '**🚀 QUICK START EXAMPLES:**\n' +
      '• `SHOW DATABASES` - List all databases\n' +
      '• `SELECT COUNT(*) FROM my_table` - Get row count\n' +
      '• `DESCRIBE my_table` - Show table schema\n' +
      '• `SHOW TABLES IN my_database` - List tables in database\n\n' +
      '**📊 RESULT ACCESS:**\n' +
      'After submission, use query_knowledge with jobId to get actual results:\n' +
      '`query_knowledge("jobId:YOUR_JOB_ID contentType:query_results")`\n\n' +
      '**⚡ ASYNC MODE:**\n' +
      'Set async:true for long-running queries, then monitor with get_job_status',
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
      'Submit a Dataproc job (Hive, Spark, PySpark, Presto, etc.) to a cluster with enhanced monitoring.\n\n' +
      '**🔧 SUPPORTED JOB TYPES:**\n' +
      '• **hive** - SQL queries on Hadoop data\n' +
      '• **spark** - Scala/Java Spark applications\n' +
      '• **pyspark** - Python Spark jobs\n' +
      '• **presto** - Fast SQL analytics\n' +
      '• **hadoop** - MapReduce jobs\n\n' +
      '**📝 JOB CONFIG EXAMPLES:**\n' +
      '• Hive: `{"query": "SELECT COUNT(*) FROM table"}`\n' +
      '• PySpark: `{"mainPythonFileUri": "{@./test-spark-job.py}", "args": ["arg1"]}`\n' +
      '• Spark: `{"mainClass": "com.example.Main", "jarFileUris": ["{@./app.jar}"]}`\n\n' +
      '**🔧 LOCAL FILE STAGING:**\n' +
      '• Use `{@./relative/path}` for files relative to config directory\n' +
      '• Use `{@/absolute/path}` for absolute file paths\n' +
      '• Files are automatically staged to GCS and cleaned up after job completion\n' +
      '• Supports .py, .jar, .sql, .R file extensions\n\n' +
      '**🎯 RESULT WORKFLOW:**\n' +
      '1. Submit job → Get jobId\n' +
      '2. Monitor: get_job_status(jobId)\n' +
      '3. Results: query_knowledge("jobId:YOUR_ID contentType:query_results")',
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
    description:
      'Get the status of a Dataproc job by job ID with smart result discovery.\n\n' +
      '**📊 STATUS TYPES:**\n' +
      '• PENDING - Job queued for execution\n' +
      '• RUNNING - Job currently executing\n' +
      '• DONE - Job completed successfully ✅\n' +
      '• ERROR - Job failed with errors ❌\n' +
      '• CANCELLED - Job was cancelled\n\n' +
      '**🎯 WHEN STATUS = DONE:**\n' +
      'Automatically shows result discovery hints:\n' +
      '`query_knowledge("jobId:YOUR_ID contentType:query_results")`\n\n' +
      '**💡 MONITORING WORKFLOW:**\n' +
      '1. Submit job (async mode)\n' +
      '2. Check status periodically\n' +
      '3. When DONE, get actual results via query_knowledge',
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

  // Enhanced tool: get Dataproc job results with smart discovery hints
  {
    name: 'get_job_results',
    description:
      'Get the results of a completed Dataproc job by job ID.\n\n' +
      '**🎯 FOR COMPLETE RESULTS INCLUDING ACTUAL DATA:**\n' +
      'Use query_knowledge with combined tags for better results:\n' +
      '• `jobId:YOUR_JOB_ID contentType:query_results` - Get actual query results\n' +
      '• `jobId:YOUR_JOB_ID type:query_result` - Alternative format\n' +
      '• `jobId:YOUR_JOB_ID` - Get job metadata and result hints\n\n' +
      '**💡 EXAMPLE:**\n' +
      'query_knowledge("jobId:89feded7-902b-4698-b076-12008a8929a7 contentType:query_results")\n' +
      '→ Returns actual data: ["220144"]\n\n' +
      '**Note:** This tool returns optimization metadata. For actual query output data, use the query_knowledge patterns above.',
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
