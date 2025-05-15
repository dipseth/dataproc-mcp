/**
 * Generic Dataproc job submission and management service
 * Supports Hive, Spark, PySpark, Presto, and other job types
 */

import fetch from 'node-fetch';
import { getGcloudAccessToken } from '../config/credentials.js';
import { JobOutputHandler, JobOutputOptions } from './job-output-handler.js';
import { OutputFormat } from '../types/gcs-types.js';
import { CacheConfig } from '../types/cache-types.js';

export type DataprocJobType = 'hive' | 'spark' | 'pyspark' | 'presto' | 'pig' | 'hadoop' | 'sparkR' | 'sparkSql';

export interface SubmitDataprocJobOptions {
  projectId: string;
  region: string;
  clusterName: string;
  jobType: DataprocJobType;
  jobConfig: any;
  async?: boolean;
}

export interface GetJobResultsOptions extends JobOutputOptions {
  /**
   * Whether to wait for job completion
   */
  wait?: boolean;

  /**
   * Custom timeout for waiting (ms)
   */
  waitTimeout?: number;

  /**
   * Expected output format
   */
  format?: OutputFormat;
}

/**
 * Submit a Dataproc job (generic)
 */
export async function submitDataprocJob(options: SubmitDataprocJobOptions): Promise<any> {
  const { projectId, region, clusterName, jobType, jobConfig, async } = options;
  const token = getGcloudAccessToken();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs:submit`;

  // Build the job object based on type
  let job: any = {
    placement: { clusterName }
  };

  switch (jobType) {
    case 'hive':
      job.hiveJob = jobConfig;
      break;
    case 'spark':
      job.sparkJob = jobConfig;
      break;
    case 'pyspark':
      job.pysparkJob = jobConfig;
      break;
    case 'presto':
      job.prestoJob = jobConfig;
      break;
    case 'pig':
      job.pigJob = jobConfig;
      break;
    case 'hadoop':
      job.hadoopJob = jobConfig;
      break;
    case 'sparkR':
      job.sparkRJob = jobConfig;
      break;
    case 'sparkSql':
      job.sparkSqlJob = jobConfig;
      break;
    default:
      throw new Error(`Unsupported job type: ${jobType}`);
  }

  const requestBody = { job };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dataproc job submission failed: ${response.status} - ${errorText}`);
  }

  const result: any = await response.json();

  // If async, return immediately with job reference
  if (async) {
    return {
      jobReference: result.reference || result.jobReference || { jobId: result.id },
      operation: result
    };
  }

  // Otherwise, poll for job completion
  const jobId = result.reference?.jobId || result.jobReference?.jobId || result.id;
  if (!jobId) throw new Error('No jobId found in Dataproc job submission response');

  let jobStatus;
  do {
    await new Promise(res => setTimeout(res, 2000));
    jobStatus = await getDataprocJobStatus({ projectId, region, jobId });
  } while (jobStatus.status?.state !== 'DONE' &&
           jobStatus.status?.state !== 'ERROR' &&
           jobStatus.status?.state !== 'CANCELLED');

  return {
    jobId,
    status: jobStatus.status?.state,
    details: jobStatus
  };
}

/**
 * Get Dataproc job status
 */
export async function getDataprocJobStatus(options: { projectId: string, region: string, jobId: string }): Promise<any> {
  const { projectId, region, jobId } = options;
  const token = getGcloudAccessToken();

  const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs/${jobId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Dataproc job status: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Output handler instance with default cache config
const outputHandler = new JobOutputHandler();

/**
 * Get Dataproc job results (for jobs that produce output)
 */
export async function getDataprocJobResults<T>(
  options: {
    projectId: string;
    region: string;
    jobId: string;
  } & GetJobResultsOptions
): Promise<T> {
  const { projectId, region, jobId, wait, waitTimeout, format = 'text', ...outputOptions } = options;

  // Wait for job completion if requested
  if (wait) {
    const startTime = Date.now();
    let jobStatus;

    do {
      jobStatus = await getDataprocJobStatus({ projectId, region, jobId });
      
      if (waitTimeout && Date.now() - startTime > waitTimeout) {
        throw new Error(`Timeout waiting for job completion after ${waitTimeout}ms`);
      }

      if (jobStatus.status?.state === 'ERROR' || jobStatus.status?.state === 'CANCELLED') {
        throw new Error(`Job failed with state: ${jobStatus.status?.state}`);
      }

      if (jobStatus.status?.state !== 'DONE') {
        await new Promise(res => setTimeout(res, 2000));
      }
    } while (jobStatus.status?.state !== 'DONE');
  }

  // Get job details to find output location
  const jobDetails = await getDataprocJobStatus({ projectId, region, jobId });
  
  if (!jobDetails.driverOutputResourceUri) {
    throw new Error('No output location found in job details');
  }

  // Get job output from GCS
  return outputHandler.getJobOutput<T>(
    jobDetails.driverOutputResourceUri,
    format,
    outputOptions
  );
}

/**
 * Get Zeppelin notebook URL for a Dataproc cluster (if enabled)
 */
export function getZeppelinUrl(projectId: string, region: string, clusterName: string): string {
  // Standard Dataproc Zeppelin URL pattern
  return `https://${region}.dataproc.cloud.google.com/zeppelin/${projectId}/${region}/${clusterName}`;
}