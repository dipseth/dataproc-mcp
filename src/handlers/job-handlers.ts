/**
 * Job operation handlers
 * Extracted from main server file for better organization
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import SecurityMiddleware from '../security/middleware.js';
import {
  SubmitHiveQuerySchema,
  GetJobStatusSchema,
  GetQueryResultsSchema,
  // SubmitDataprocJobSchema,
  // GetJobResultsSchema,
  CheckActiveJobsSchema,
} from '../validation/schemas.js';
import { submitHiveQuery, getJobStatus, getQueryResults } from '../services/query.js';
import { DefaultParameterManager } from '../services/default-params.js';
import { ResponseFilter } from '../services/response-filter.js';
import { KnowledgeIndexer } from '../services/knowledge-indexer.js';
import { JobTracker } from '../services/job-tracker.js';
import { AsyncQueryPoller } from '../services/async-query-poller.js';
import { TemplatingIntegration } from '../services/templating-integration.js';

export interface JobHandlerDependencies {
  defaultParamManager?: DefaultParameterManager;
  responseFilter?: ResponseFilter;
  knowledgeIndexer?: KnowledgeIndexer;
  jobTracker?: JobTracker;
  asyncQueryPoller?: AsyncQueryPoller;
  templatingIntegration?: TemplatingIntegration;
}

export async function handleSubmitHiveQuery(args: any, deps: JobHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`submit_hive_query:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(SubmitHiveQuerySchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'submit_hive_query',
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
  let { projectId, region } = validatedArgs;
  const { clusterName, query, async, queryOptions } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region || !clusterName || !query) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Missing required parameters: projectId, region, clusterName, query'
    );
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region, clusterName });

  // Audit log the operation
  SecurityMiddleware.auditLog('Hive query submission initiated', {
    tool: 'submit_hive_query',
    projectId,
    region,
    clusterName,
    queryLength: query.length,
    async: !!async,
  });

  logger.debug(
    'MCP submit_hive_query: Called with validated params:',
    SecurityMiddleware.sanitizeForLogging({
      projectId,
      region,
      clusterName,
      query: query.substring(0, 100) + '...',
      async,
      queryOptions,
    })
  );

  let response;
  try {
    response = await submitHiveQuery(projectId, region, clusterName, query, async, queryOptions);

    SecurityMiddleware.auditLog('Hive query submission completed', {
      tool: 'submit_hive_query',
      projectId,
      region,
      clusterName,
      jobId: response?.reference?.jobId,
      success: true,
    });

    logger.debug(
      'MCP submit_hive_query: submitHiveQuery response:',
      SecurityMiddleware.sanitizeForLogging(response)
    );
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Hive query submission failed',
      {
        tool: 'submit_hive_query',
        projectId,
        region,
        clusterName,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'error'
    );

    logger.error('MCP submit_hive_query: Error from submitHiveQuery:', error);
    throw error;
  }

  // Index query for knowledge base
  if (deps.knowledgeIndexer && response?.reference?.jobId) {
    try {
      await deps.knowledgeIndexer.indexJobSubmission({
        jobId: response.reference.jobId,
        jobType: 'hive',
        projectId,
        region,
        clusterName,
        query,
        status: 'SUBMITTED',
        submissionTime: new Date().toISOString(),
      });
    } catch (indexError) {
      logger.warn('Failed to index query submission:', indexError);
    }
  }

  // Track job if async and tracker available
  if (async && deps.jobTracker && response?.reference?.jobId) {
    try {
      deps.jobTracker.addOrUpdateJob({
        jobId: response.reference.jobId,
        projectId,
        region,
        clusterName,
        toolName: 'submit_hive_query',
        status: 'SUBMITTED',
        submissionTime: new Date().toISOString(),
      });
    } catch (trackError) {
      logger.warn('Failed to track async job:', trackError);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: async
          ? `Hive query submitted asynchronously. Job ID: ${response?.reference?.jobId}\nUse get_query_status to check progress.`
          : `Hive query completed successfully.\nResults:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

export async function handleGetQueryStatus(args: any, deps: JobHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_query_status:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetJobStatusSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_query_status',
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
  let { projectId, region } = validatedArgs;
  const { jobId } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region || !jobId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Missing required parameters: projectId, region, jobId'
    );
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region });

  // Audit log the operation
  SecurityMiddleware.auditLog('Query status check initiated', {
    tool: 'get_query_status',
    projectId,
    region,
    jobId,
  });

  const response = await getJobStatus(projectId, region, jobId);

  SecurityMiddleware.auditLog('Query status check completed', {
    tool: 'get_query_status',
    projectId,
    region,
    jobId,
    status: response?.status?.state,
  });

  return {
    content: [
      {
        type: 'text',
        text: `Job ${jobId} status:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

export async function handleGetQueryResults(args: any, deps: JobHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`get_query_results:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(GetQueryResultsSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'get_query_results',
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
  let { projectId, region } = validatedArgs;
  const { jobId, maxResults, pageToken } = validatedArgs;

  if (!projectId && deps.defaultParamManager) {
    try {
      projectId = deps.defaultParamManager.getParameterValue('projectId');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  if (!region && deps.defaultParamManager) {
    try {
      region = deps.defaultParamManager.getParameterValue('region');
    } catch (error) {
      // Ignore error, will be caught by validation below
    }
  }

  // Validate required parameters after defaults
  if (!projectId || !region || !jobId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Missing required parameters: projectId, region, jobId'
    );
  }

  // Additional GCP constraint validation
  SecurityMiddleware.validateGCPConstraints({ projectId, region });

  // Audit log the operation
  SecurityMiddleware.auditLog('Query results retrieval initiated', {
    tool: 'get_query_results',
    projectId,
    region,
    jobId,
    maxResults,
  });

  const response = await getQueryResults(projectId, region, jobId, maxResults, pageToken);

  SecurityMiddleware.auditLog('Query results retrieval completed', {
    tool: 'get_query_results',
    projectId,
    region,
    jobId,
    resultCount: response?.rows?.length || 0,
  });

  // Index query results for knowledge base
  if (deps.knowledgeIndexer && response) {
    try {
      await deps.knowledgeIndexer.indexJobSubmission({
        jobId,
        jobType: 'hive',
        projectId,
        region,
        clusterName: 'unknown',
        status: 'COMPLETED',
        results: response,
      });
    } catch (indexError) {
      logger.warn('Failed to index query results:', indexError);
    }
  }

  // Handle response filtering
  if (deps.responseFilter && !args.verbose) {
    try {
      const filteredResponse = await deps.responseFilter.filterResponse(
        'get_query_results',
        response,
        {
          toolName: 'get_query_results',
          timestamp: new Date().toISOString(),
          projectId,
          region,
          responseType: 'query_results',
          originalTokenCount: JSON.stringify(response).length,
          filteredTokenCount: 0,
          compressionRatio: 1.0,
        }
      );

      const formattedContent =
        filteredResponse.type === 'summary'
          ? filteredResponse.summary || filteredResponse.content
          : filteredResponse.content;

      return {
        content: [
          {
            type: 'text',
            text: formattedContent,
          },
        ],
      };
    } catch (filterError) {
      logger.warn('Response filtering failed, returning raw response:', filterError);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Query results for job ${jobId}:\n${JSON.stringify(SecurityMiddleware.sanitizeForLogging(response), null, 2)}`,
      },
    ],
  };
}

export async function handleCheckActiveJobs(args: any, deps: JobHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`check_active_jobs:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);

  // Validate input with Zod schema
  let validatedArgs;
  try {
    validatedArgs = SecurityMiddleware.validateInput(CheckActiveJobsSchema, sanitizedArgs);
  } catch (error) {
    SecurityMiddleware.auditLog(
      'Input validation failed',
      {
        tool: 'check_active_jobs',
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

  const { projectId, region, includeCompleted } = validatedArgs;

  // Audit log the operation
  SecurityMiddleware.auditLog('Active jobs check initiated', {
    tool: 'check_active_jobs',
    projectId,
    region,
    includeCompleted,
  });

  // Use job tracker if available
  if (deps.jobTracker) {
    try {
      let activeJobs = deps.jobTracker.listJobs();

      // Filter by project and region if specified
      if (projectId || region) {
        activeJobs = activeJobs.filter(
          (job) => (!projectId || job.projectId === projectId) && (!region || job.region === region)
        );
      }

      // Filter by status
      if (!includeCompleted) {
        activeJobs = activeJobs.filter(
          (job) => !['COMPLETED', 'DONE', 'FAILED', 'CANCELLED', 'ERROR'].includes(job.status)
        );
      }

      SecurityMiddleware.auditLog('Active jobs check completed', {
        tool: 'check_active_jobs',
        projectId,
        region,
        jobCount: activeJobs.length,
      });

      return {
        content: [
          {
            type: 'text',
            text: `🚀 **Active Jobs Summary**\n\n${activeJobs.length === 0 ? '✅ No active jobs found' : activeJobs.map((job, index) => `**${index + 1}. Job ${job.jobId}**\n   Status: ${job.status}\n   Cluster: ${job.clusterName || 'unknown'}\n   Started: ${job.submissionTime}`).join('\n\n')}`,
          },
        ],
      };
    } catch (error) {
      logger.warn('Job tracker failed, falling back to basic response:', error);
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: '🚀 **Active Jobs Check**\n\n⚠️ Job tracking service not available. Use individual job status tools to check specific jobs.',
      },
    ],
  };
}

// Additional job handlers would go here (submitDataprocJob, getJobResults, etc.)
// For brevity, I'm showing the main patterns. The remaining handlers follow similar patterns.

/**
 * Submit a generic Dataproc job
 */
export async function handleSubmitDataprocJob(args: any, deps: JobHandlerDependencies) {
  // Apply security middleware
  SecurityMiddleware.checkRateLimit(`submit_dataproc_job:${JSON.stringify(args)}`);

  // Sanitize input
  const sanitizedArgs = SecurityMiddleware.sanitizeObject(args);
  const typedArgs = sanitizedArgs as any;

  // Basic validation
  if (!typedArgs.clusterName || typeof typedArgs.clusterName !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'clusterName is required and must be a string');
  }
  if (!typedArgs.jobType || typeof typedArgs.jobType !== 'string') {
    throw new McpError(ErrorCode.InvalidParams, 'jobType is required and must be a string');
  }
  if (!typedArgs.jobConfig || typeof typedArgs.jobConfig !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, 'jobConfig is required and must be an object');
  }

  const { clusterName, jobType, jobConfig, async } = typedArgs;

  try {
    // For now, delegate to Hive query handler if it's a Hive job
    if (jobType.toLowerCase() === 'hive') {
      const hiveQuery = jobConfig.query || jobConfig.queryList?.queries?.[0];
      if (hiveQuery) {
        return handleSubmitHiveQuery({ clusterName, query: hiveQuery, async }, deps);
      }
    }

    // For other job types, return a placeholder implementation
    return {
      content: [
        {
          type: 'text',
          text: `Generic Dataproc job submission for type "${jobType}" is not yet fully implemented. Currently only Hive jobs are supported via submit_hive_query.`,
        },
      ],
    };

  } catch (error) {
    logger.error('Failed to submit Dataproc job:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to submit Dataproc job: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get job status (enhanced version of get_query_status)
 */
export async function handleGetJobStatus(args: any, deps: JobHandlerDependencies) {
  // For now, delegate to the existing query status handler
  return handleGetQueryStatus(args, deps);
}

/**
 * Get job results (enhanced version of get_query_results)
 */
export async function handleGetJobResults(args: any, deps: JobHandlerDependencies) {
  // For now, delegate to the existing query results handler
  return handleGetQueryResults(args, deps);
}
