import { RequestInit, Response } from 'node-fetch';
import { QueryResultResponse } from '../types/response.js';
import { promises as fs } from 'fs';
import path from 'path';
import { getStateFilePath } from '../utils/config-path-resolver.js';
/**
 * Query service for executing Hive queries on Dataproc clusters
 */

import { getGcloudAccessTokenWithConfig, createJobClient } from '../config/credentials.js';
import { QueryOptions, QueryJob, JobState, QueryResult } from '../types/query.js';
import fetch from 'node-fetch';

/**
 * Fetch with timeout wrapper
 * @param url URL to fetch
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds (default: 30 seconds)
 * @returns Promise that resolves to Response or rejects on timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Submits a Hive query to a Dataproc cluster
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster to run the query on
 * @param query Hive query to execute
 * @param options Optional query configuration options
 * @param async Whether to wait for query completion (false) or return immediately (true)
 * @returns Query job information
 */
export async function submitHiveQuery(
  projectId: string,
  region: string,
  clusterName: string,
  query: string,
  async: boolean = false,
  options?: QueryOptions
): Promise<QueryJob> {
  const startTime = Date.now();
  console.error(`[TIMING] submitHiveQuery: Starting MCP tool execution`);
  console.log('[DEBUG] submitHiveQuery: Starting with params:', {
    projectId,
    region,
    clusterName,
    queryLength: query.length,
    async,
  });

  try {
    // Use REST API by default (like working list_clusters)
    console.error(`[TIMING] submitHiveQuery: Using REST API approach`);
    const job = await submitHiveQueryWithRest(projectId, region, clusterName, query, options);

    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] submitHiveQuery: SUCCESS - total: ${totalDuration}ms`);

    // If async mode, return the job information immediately
    if (async) {
      return job as QueryJob;
    }

    // Otherwise, wait for the job to complete using REST API
    const jobId = job.reference?.jobId;
    if (!jobId) {
      throw new Error('Job ID not found in response');
    }

    // Poll for job completion using REST API
    const completedJob = await waitForJobCompletionWithRest(
      projectId,
      region,
      jobId,
      options?.timeoutMs || 600000 // Default timeout: 10 minutes
    );

    return completedJob;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] submitHiveQuery: FAILED after ${totalDuration}ms`);
    console.error('[DEBUG] submitHiveQuery: Error details:', {
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error) {
      throw new Error(`Error submitting Hive query: ${error.message}`);
    }
    throw new Error('Unknown error submitting Hive query');
  }
}

/**
 * Waits for a job to complete by polling its status
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to monitor
 * @param timeoutMs Timeout in milliseconds
 * @param pollIntervalMs Polling interval in milliseconds
 * @returns Completed job information
 */
export async function waitForJobCompletion(
  projectId: string,
  region: string,
  jobId: string,
  timeoutMs: number = 600000,
  pollIntervalMs: number = 5000
): Promise<QueryJob> {
  // Get server configuration for enhanced authentication
  // const config = await getServerConfig(); // Unused variable
  // const _authConfig = config.authentication; // Unused variable

  // Use enhanced authentication to create job client
  const jobClient = await createJobClient({
    region,
  });

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const [job] = await jobClient.getJob({
      projectId,
      region,
      jobId,
    });

    const status = job.status?.state;

    // Check if the job is in a terminal state
    if (status === JobState.DONE || status === JobState.CANCELLED || status === JobState.ERROR) {
      return job as QueryJob;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Job did not complete within the timeout period (${timeoutMs}ms)`);
}

/**
 * Gets the status of a job
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to check
 * @returns Job status information
 */
export async function getJobStatus(
  projectId: string,
  region: string,
  jobId: string
): Promise<QueryJob> {
  const startTime = Date.now();
  console.error(`[TIMING] getJobStatus: Starting MCP tool execution`);
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getJobStatus: Starting with params:', { projectId, region, jobId });

  try {
    // Use REST API by default (like working list_clusters)
    console.error(`[TIMING] getJobStatus: Using REST API approach`);
    const job = await getJobStatusWithRest(projectId, region, jobId);

    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getJobStatus: SUCCESS - total: ${totalDuration}ms`);
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getJobStatus: API call successful, job status:', job.status?.state);
    return job as QueryJob;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getJobStatus: FAILED after ${totalDuration}ms`);
    console.error('[DEBUG] getJobStatus: Error encountered:', error);
    if (error instanceof Error) {
      throw new Error(`Error getting job status: ${error.message}`);
    }
    throw new Error('Unknown error getting job status');
  }
}

/**
 * Gets the results of a completed Hive query using direct REST API calls
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to get results for
 * @returns Query results
 */
export async function getQueryResultsWithRest(
  projectId: string,
  region: string,
  jobId: string,
  options: {
    maxDisplayRows?: number;
    format?: 'text' | 'json' | 'csv';
    enableSemanticIndexing?: boolean;
  } = {}
): Promise<QueryResultResponse> {
  const { maxDisplayRows = 10, format = 'text', enableSemanticIndexing = true } = options;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Starting with params:', {
      projectId,
      region,
      jobId,
      maxDisplayRows,
      format,
      enableSemanticIndexing,
    });

  // First, check if the job is complete using REST API
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Checking job status');
  const jobStatus = await getJobStatusWithRest(projectId, region, jobId);

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Job status:', jobStatus.status?.state);

  if (jobStatus.status?.state !== 'DONE') {
    console.error(
      '[DEBUG] getQueryResultsWithRest: Job not complete, current state:',
      jobStatus.status?.state
    );
    throw new Error(`Job is not complete. Current state: ${jobStatus.status?.state}`);
  }

  // Get the driver output URI from the job status
  const driverOutputUri = jobStatus.driverOutputResourceUri;
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Driver output URI:', driverOutputUri);

  if (!driverOutputUri) {
    throw new Error('No driver output URI found in job status');
  }

  try {
    // Import required services dynamically to avoid circular dependencies
    const { JobOutputHandler } = await import('./job-output-handler.js');

    // Initialize job output handler
    const outputHandler = new JobOutputHandler();

    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] getQueryResultsWithRest: Downloading and parsing output from:',
        driverOutputUri
      );

    // Download and parse the output using the same pattern as get_job_results
    const parsedOutput = await outputHandler.getJobOutput(driverOutputUri, format, {
      useCache: true,
      validateHash: true,
    });

    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] getQueryResultsWithRest: Successfully parsed output, type:',
        typeof parsedOutput
      );

    // Convert parsed output to QueryResultResponse format
    const queryResult = await convertToQueryResultResponse(parsedOutput, maxDisplayRows);

    // Index results for semantic search if enabled
    if (enableSemanticIndexing && queryResult.rows.length > 0) {
      try {
        console.error('[DEBUG] getQueryResultsWithRest: Starting KnowledgeIndexer integration');
        console.error(
          '[DEBUG] getQueryResultsWithRest: enableSemanticIndexing =',
          enableSemanticIndexing
        );
        console.error(
          '[DEBUG] getQueryResultsWithRest: queryResult.rows.length =',
          queryResult.rows.length
        );

        // Import the global knowledgeIndexer instance to ensure consistency
        const { getGlobalKnowledgeIndexer } = await import('../index.js');
        const knowledgeIndexer = getGlobalKnowledgeIndexer();

        console.error(
          '[DEBUG] getQueryResultsWithRest: knowledgeIndexer instance =',
          knowledgeIndexer ? 'AVAILABLE' : 'NULL'
        );

        if (!knowledgeIndexer) {
          console.error(
            '[DEBUG] getQueryResultsWithRest: Global KnowledgeIndexer not available, skipping indexing'
          );
          // Don't return early - continue with the rest of the function
        } else {
          console.error(
            '[DEBUG] getQueryResultsWithRest: Indexing job submission for semantic search'
          );

          const jobData = {
            jobId,
            jobType: 'hive',
            clusterName: jobStatus.placement?.clusterName || 'unknown',
            projectId,
            region,
            status: jobStatus.status?.state || 'DONE',
            submissionTime: new Date().toISOString(),
            results: queryResult,
          };

          console.error(
            '[DEBUG] getQueryResultsWithRest: Job data to index:',
            JSON.stringify(jobData, null, 2)
          );

          if (process.env.LOG_LEVEL === 'debug') {
            const collectionInfo = knowledgeIndexer.getCollectionInfo();
            console.error(
              `[DEBUG] getQueryResultsWithRest: Using global KnowledgeIndexer with collection: ${collectionInfo.collectionName}`
            );
          }

          await knowledgeIndexer.indexJobSubmission(jobData);

          console.error(
            '[DEBUG] getQueryResultsWithRest: Successfully indexed results for semantic search'
          );
        }
      } catch (indexError) {
        // Don't fail the main operation if indexing fails
        console.error(
          '[WARN] getQueryResultsWithRest: Failed to index results for semantic search:',
          indexError
        );
        if (indexError instanceof Error) {
          console.error('[WARN] getQueryResultsWithRest: Error details:', indexError.message);
          console.error('[WARN] getQueryResultsWithRest: Error stack:', indexError.stack);
        }
      }
    } else {
      console.error('[DEBUG] getQueryResultsWithRest: Skipping KnowledgeIndexer integration');
      console.error(
        '[DEBUG] getQueryResultsWithRest: enableSemanticIndexing =',
        enableSemanticIndexing
      );
      console.error(
        '[DEBUG] getQueryResultsWithRest: queryResult.rows.length =',
        queryResult.rows.length
      );
    }

    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] getQueryResultsWithRest: Returning result with',
        queryResult.rows.length,
        'rows'
      );

    return queryResult;
  } catch (error) {
    console.error('[ERROR] getQueryResultsWithRest: Failed to process query results:', error);
    throw new Error(
      `Failed to get query results: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Convert parsed output to QueryResultResponse format
 */
async function convertToQueryResultResponse(
  parsedOutput: unknown,
  maxDisplayRows: number
): Promise<QueryResultResponse> {
  // Handle different output formats from the parser
  if (parsedOutput && typeof parsedOutput === 'object') {
    // Check if it's already in table format (from Hive output parser)
    if (
      'tables' in parsedOutput &&
      Array.isArray((parsedOutput as { tables?: unknown[] }).tables)
    ) {
      const tables = (parsedOutput as { tables: { columns?: string[]; rows?: unknown[][] }[] })
        .tables;
      if (tables.length > 0) {
        const table = tables[0]; // Use first table
        const columns = table.columns || [];
        const rows = table.rows || [];

        return {
          schema: {
            fields: columns.map((col: string) => ({
              name: col,
              type: 'STRING', // Default type, could be enhanced with type detection
            })),
          },
          rows: rows
            .slice(0, maxDisplayRows)
            .map((row: unknown) =>
              columns.map((col: string) => (row as Record<string, unknown>)[col] || '')
            ),
          totalRows: rows.length,
        };
      }
    }

    // Handle CSV format
    if (Array.isArray(parsedOutput) && parsedOutput.length > 0) {
      const firstRow = parsedOutput[0];
      if (typeof firstRow === 'object' && firstRow !== null) {
        const columns = Object.keys(firstRow);
        return {
          schema: {
            fields: columns.map((col) => ({
              name: col,
              type: 'STRING',
            })),
          },
          rows: parsedOutput
            .slice(0, maxDisplayRows)
            .map((row: unknown) =>
              columns.map((col) => (row as Record<string, unknown>)[col] || '')
            ),
          totalRows: parsedOutput.length,
        };
      }
    }
  }

  // Handle plain text or other formats
  const textOutput = typeof parsedOutput === 'string' ? parsedOutput : JSON.stringify(parsedOutput);
  const lines = textOutput.split('\n').filter((line) => line.trim().length > 0);

  return {
    schema: {
      fields: [{ name: 'output', type: 'STRING' }],
    },
    rows: lines.slice(0, maxDisplayRows).map((line) => [line]),
    totalRows: lines.length,
  };
}

/**
 * Submits a Hive query to a Dataproc cluster using direct REST API calls
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param clusterName Name of the cluster to run the query on
 * @param query Hive query to execute
 * @param options Optional query configuration options
 * @returns Query job information
 */
export async function submitHiveQueryWithRest(
  projectId: string,
  region: string,
  clusterName: string,
  query: string,
  options?: QueryOptions
): Promise<QueryJob> {
  console.log('[DEBUG] submitHiveQueryWithRest: Starting with params:', {
    projectId,
    region,
    clusterName,
    queryLength: query.length,
  });

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Getting token from gcloud CLI with config');
  const _token = await getGcloudAccessTokenWithConfig();

  // Ensure the URL is correctly formed with the full domain and :submit suffix
  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs:submit`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Making REST API request to:', url);
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Request method: POST');
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Authorization header: Bearer [token]');

  // Create the Hive job configuration
  const hiveJob: Record<string, unknown> = {
    queryList: {
      queries: [query],
    },
  };

  // Add optional properties if provided
  if (options?.properties) {
    hiveJob.properties = options.properties;
  }

  // Create the job submission request
  const requestBody = {
    job: {
      placement: {
        clusterName,
      },
      hiveJob,
      labels: {
        'created-by': 'dataproc-mcp-server',
      },
    },
  };

  try {
    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] submitHiveQueryWithRest: Request body:',
        JSON.stringify(requestBody, null, 2)
      );

    // Log the full request details
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] submitHiveQueryWithRest: Making fetch request with:');
    if (process.env.LOG_LEVEL === 'debug') console.error('- URL:', url);
    if (process.env.LOG_LEVEL === 'debug') console.error('- Method: POST');
    if (process.env.LOG_LEVEL === 'debug')
      console.error('- Headers: Authorization and Content-Type');
    if (process.env.LOG_LEVEL === 'debug')
      console.error('- Body length:', JSON.stringify(requestBody).length);

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      30000
    ); // 30 second timeout

    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] submitHiveQueryWithRest: Received response with status:',
        response.status
      );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] submitHiveQueryWithRest: API error:', response.status, errorText);
      console.error(
        '[DEBUG] submitHiveQueryWithRest: Response headers:',
        JSON.stringify(Object.fromEntries([...response.headers]), null, 2)
      );
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] submitHiveQueryWithRest: API request successful');
    return result as QueryJob;
  } catch (error) {
    console.error('[DEBUG] submitHiveQueryWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error submitting Hive query with REST API: ${error.message}`);
    }
    throw new Error('Unknown error submitting Hive query with REST API');
  }
}

/**
 * Gets the status of a job using direct REST API calls
 * This bypasses the client libraries and uses a token from gcloud CLI
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to check
 * @returns Job status information
 */
export async function getJobStatusWithRest(
  projectId: string,
  region: string,
  jobId: string
): Promise<QueryJob> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getJobStatusWithRest: Starting with params:', {
      projectId,
      region,
      jobId,
    });

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getJobStatusWithRest: Getting token from gcloud CLI with config');
  const _token = await getGcloudAccessTokenWithConfig();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs/${jobId}`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getJobStatusWithRest: Making REST API request to:', url);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${_token}`,
          'Content-Type': 'application/json',
        },
      },
      30000
    ); // 30 second timeout

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] getJobStatusWithRest: API error:', response.status, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getJobStatusWithRest: API request successful');
    return result as QueryJob;
  } catch (error) {
    console.error('[DEBUG] getJobStatusWithRest: Error:', error);
    if (error instanceof Error) {
      throw new Error(`Error getting job status with REST API: ${error.message}`);
    }
    throw new Error('Unknown error getting job status with REST API');
  }
}

/**
 * Gets the results of a completed Hive query
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to get results for
 * @param maxResults Maximum number of results to return
 * @param pageToken Page token for pagination
 * @returns Query results
 */
export async function getQueryResults(
  projectId: string,
  region: string,
  jobId: string,
  maxResults?: number,
  pageToken?: string
): Promise<QueryResult> {
  console.log('[DEBUG] getQueryResults: Starting with params:', {
    projectId,
    region,
    jobId,
    maxResults,
    pageToken,
  });

  try {
    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getQueryResults: Using enhanced REST API implementation');

    // Use the enhanced REST API implementation
    const queryResultResponse = await getQueryResultsWithRest(projectId, region, jobId, {
      maxDisplayRows: maxResults || 10,
      format: 'text',
      enableSemanticIndexing: true,
    });

    if (process.env.LOG_LEVEL === 'debug')
      console.error(
        '[DEBUG] getQueryResults: Successfully retrieved results with',
        queryResultResponse.rows.length,
        'rows'
      );

    // Apply response optimization to avoid token waste
    const optimizedResult = await optimizeQueryResultsResponse(queryResultResponse, {
      projectId,
      region,
      jobId,
      maxResults,
    });

    return optimizedResult;
  } catch (error) {
    console.error('[DEBUG] getQueryResults: Error encountered:', error);
    throw error;
  }
}

/**
 * Optimizes query results response using Qdrant as primary storage
 * GCS → Memory → Qdrant (with optional local file download)
 */
async function optimizeQueryResultsResponse(
  queryResultResponse: QueryResultResponse,
  context: {
    projectId: string;
    region: string;
    jobId: string;
    maxResults?: number;
    saveLocalFile?: boolean; // Optional parameter for local file download
    clusterName?: string; // Optional clusterName from job context
  }
): Promise<QueryResult> {
  const { projectId, region, jobId, saveLocalFile = false } = context;
  let { clusterName } = context;

  try {
    // Try to get clusterName from job details if not provided
    if (!clusterName || clusterName === 'unknown') {
      try {
        const { getDataprocJobStatus } = await import('./job.js');
        const jobDetails = await getDataprocJobStatus({
          projectId,
          region,
          jobId,
        });
        clusterName = (jobDetails as any)?.placement?.clusterName || clusterName || 'unknown';
      } catch (jobError) {
        console.warn(`[WARN] Could not fetch job details for clusterName: ${jobError}`);
        clusterName = clusterName || 'unknown';
      }
    }

    // Import Qdrant services dynamically
    const { QdrantStorageService } = await import('./qdrant-storage.js');

    // Calculate summary statistics
    const rowCount = queryResultResponse.rows.length;
    const schemaFieldCount = queryResultResponse.schema?.fields?.length || 0;
    const dataSize = JSON.stringify(queryResultResponse).length;
    const timestamp = new Date().toISOString();

    // Extract content insights for better indexing
    let contentType = 'structured_data';
    let contentSummary = '';
    let firstRowSample = '';

    if (queryResultResponse.rows.length > 0) {
      const firstRow = queryResultResponse.rows[0];
      if (Array.isArray(firstRow) && firstRow.length > 0) {
        const firstValue = String(firstRow[0] || '');
        firstRowSample = firstValue.substring(0, 200);

        if (
          firstValue.includes('INFO') ||
          firstValue.includes('ERROR') ||
          firstValue.includes('WARN')
        ) {
          contentType = 'job_execution_logs';
          contentSummary = 'Spark/Hive job execution logs with processing details';
        } else {
          contentType = 'query_results';
          contentSummary = 'Structured query results data';
        }
      }
    }

    // Prepare data for Qdrant storage
    const qdrantPayload = {
      // Metadata for filtering and search
      jobId,
      projectId,
      region,
      timestamp,
      contentType,
      totalRows: queryResultResponse.totalRows || rowCount,
      schemaFields: schemaFieldCount,
      dataSize,

      // Full content stored in Qdrant payload (not just embeddings)
      schema: queryResultResponse.schema,
      rows: queryResultResponse.rows,
      summary: contentSummary,

      // Searchable text for embeddings
      searchableContent: `Job ${jobId} results: ${contentSummary}. ${schemaFieldCount} fields, ${rowCount} rows. ${firstRowSample ? 'Sample: ' + firstRowSample : ''}`,
    };

    // Store in Qdrant with embeddings + full payload
    let qdrantId: string | null = null;
    try {
      // Use the global KnowledgeIndexer's QdrantStorageService for consistency
      const { getGlobalKnowledgeIndexer } = await import('../index.js');
      const knowledgeIndexer = getGlobalKnowledgeIndexer();

      if (!knowledgeIndexer) {
        throw new Error('KnowledgeIndexer not available for query result storage');
      }

      // Store via KnowledgeIndexer to ensure unified collection and consistent embedding
      // Get verified Qdrant URL - NO FALLBACKS
      const { getCachedQdrantUrl } = await import('./qdrant-connection-manager.js');
      const qdrantUrl = getCachedQdrantUrl();
      if (!qdrantUrl) {
        throw new Error('No verified Qdrant URL available. Qdrant must be initialized first.');
      }

      const qdrantStorage = new QdrantStorageService({
        url: qdrantUrl, // ONLY use verified URL
        collectionName: 'dataproc_knowledge', // Unified collection for all data
        vectorSize: 384, // Standard for Transformers.js
        distance: 'Cosine' as const,
      });

      // Create metadata for Qdrant storage
      const originalTokenCount = dataSize / 4; // Rough estimate: 4 chars per token
      const filteredTokenCount = 500; // Our optimized response size
      const compressionRatio = filteredTokenCount / originalTokenCount;

      const metadata = {
        toolName: 'get_query_results',
        timestamp,
        projectId,
        region,
        clusterName: clusterName || 'unknown', // Now extracted from job context
        responseType: 'query_results',
        originalTokenCount: Math.round(originalTokenCount),
        filteredTokenCount,
        compressionRatio,
        type: 'query_result',
      };

      // Store using the existing storeClusterData method (it can handle any data)
      qdrantId = await qdrantStorage.storeClusterData(qdrantPayload, metadata);

      console.log(`[INFO] Query results stored in Qdrant with ID: ${qdrantId}`);
    } catch (qdrantError) {
      console.warn(
        '[WARN] Failed to store in Qdrant, continuing without vector storage:',
        qdrantError
      );
    }

    // Optional local file storage (disabled by default)
    let filePath: string | null = null;
    if (saveLocalFile) {
      try {
        const outputDir = getStateFilePath('output');
        await fs.mkdir(outputDir, { recursive: true });
        const filename = `query-results-${jobId}-${timestamp.replace(/[:.]/g, '-')}.json`;
        filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, JSON.stringify(qdrantPayload, null, 2));
        console.log(`[INFO] Query results also saved locally to: ${filePath}`);
      } catch (fileError) {
        console.warn('[WARN] Failed to save local file:', fileError);
      }
    }

    // Create optimized response with Qdrant reference
    const optimizedResult: QueryResult = {
      schema: queryResultResponse.schema,
      rows: [
        {
          values: [
            `Query results optimized and stored in Qdrant vector database.

📊 **Results Summary:**
- Job ID: ${jobId}
- Total Rows: ${queryResultResponse.totalRows || rowCount}
- Schema Fields: ${schemaFieldCount}
- Data Size: ${(dataSize / 1024).toFixed(2)} KB
- Content Type: ${contentSummary}
- Storage: Qdrant vector database${qdrantId ? ` (ID: ${qdrantId})` : ' (storage failed)'}

🔍 **Semantic Search Available:**
- Use 'query_knowledge' MCP tool to search results
- Example: "query_knowledge('${jobId} results')"
- Example: "query_knowledge('errors in job ${jobId}')"
- Example: "query_knowledge('${contentType} from ${projectId}')"

💡 **Data Access:**
- Semantic search: Use 'query_knowledge' tool with natural language queries
- Full retrieval: Query Qdrant directly with job ID ${jobId}${filePath ? `\n- Local file: ${filePath}` : ''}

🎯 **Optimization:** ${Math.round((1 - 500 / dataSize) * 100)}% token reduction achieved
🚀 **Performance:** Data stored in memory → Qdrant (no disk I/O by default)`,
          ],
        },
      ],
      totalRows: 1, // Summary response has 1 row
      pageToken: undefined,
    };

    console.log(`[INFO] Query results optimized: ${dataSize} bytes stored in Qdrant`);
    console.log(`[INFO] Response size reduced by ~${Math.round((1 - 500 / dataSize) * 100)}%`);

    return optimizedResult;
  } catch (error) {
    console.warn('[WARN] Failed to optimize query results response, returning original:', error);

    // Fallback to original format if optimization fails
    const queryResult: QueryResult = {
      schema: queryResultResponse.schema,
      rows: queryResultResponse.rows.map((row) => ({ values: row })),
      totalRows: queryResultResponse.totalRows,
      pageToken: undefined,
    };

    return queryResult;
  }
}

/**
 * Waits for a job to complete by polling its status using REST API
 * @param projectId GCP project ID
 * @param region Dataproc region
 * @param jobId Job ID to monitor
 * @param timeoutMs Timeout in milliseconds
 * @param pollIntervalMs Polling interval in milliseconds
 * @returns Completed job information
 */
export async function waitForJobCompletionWithRest(
  projectId: string,
  region: string,
  jobId: string,
  timeoutMs: number = 600000,
  pollIntervalMs: number = 5000
): Promise<QueryJob> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await getJobStatusWithRest(projectId, region, jobId);

    const status = job.status?.state;

    // Check if the job is in a terminal state
    if (status === JobState.DONE || status === JobState.CANCELLED || status === JobState.ERROR) {
      return job as QueryJob;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Job did not complete within the timeout period (${timeoutMs}ms)`);
}
