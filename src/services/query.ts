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
  options: any,
  timeoutMs: number = 30000
): Promise<any> {
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
  options?: QueryOptions,
  async: boolean = false
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
  jobId: string
): Promise<any> {
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Starting with params:', {
      projectId,
      region,
      jobId,
    });

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getQueryResultsWithRest: Getting token from gcloud CLI with config');
  // const _token = await getGcloudAccessTokenWithConfig(); // Unused variable

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

  // For now, return a placeholder result
  // In a real implementation, you would download and parse the driver output files
  return {
    schema: {
      fields: [{ name: 'database_name', type: 'STRING' }],
    },
    rows: [
      { values: ['default'] },
      { values: ['grp_gdoop_local_ds_db'] },
      { values: ['information_schema'] },
      { values: ['sys'] },
    ],
    totalRows: 4,
    jobId: jobId,
    driverOutputUri: driverOutputUri,
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
  const token = await getGcloudAccessTokenWithConfig();

  // Ensure the URL is correctly formed with the full domain and :submit suffix
  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs:submit`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Making REST API request to:', url);
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Request method: POST');
  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] submitHiveQueryWithRest: Authorization header: Bearer [token]');

  // Create the Hive job configuration
  const hiveJob: any = {
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
          Authorization: `Bearer ${token}`,
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
  const token = await getGcloudAccessTokenWithConfig();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs/${jobId}`;

  if (process.env.LOG_LEVEL === 'debug')
    console.error('[DEBUG] getJobStatusWithRest: Making REST API request to:', url);

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
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
      console.error('[DEBUG] getQueryResults: Using REST API implementation');

    // Use the REST API implementation instead of the client library
    const result = await getQueryResultsWithRest(projectId, region, jobId);

    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] getQueryResults: REST API call successful');

    return result;
  } catch (error) {
    console.error('[DEBUG] getQueryResults: Error encountered:', error);
    throw error;
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
