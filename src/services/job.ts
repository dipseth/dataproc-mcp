/**
 * Generic Dataproc job submission and management service
 * Supports Hive, Spark, PySpark, Presto, and other job types
 */

import fetch from 'node-fetch';
import { getGcloudAccessToken } from '../config/credentials.js';

export type DataprocJobType = 'hive' | 'spark' | 'pyspark' | 'presto' | 'pig' | 'hadoop' | 'sparkR' | 'sparkSql';

export interface SubmitDataprocJobOptions {
  projectId: string;
  region: string;
  clusterName: string;
  jobType: DataprocJobType;
  jobConfig: any;
  async?: boolean;
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

/**
 * Get Dataproc job results (for jobs that produce output)
 */
export async function getDataprocJobResults(options: { projectId: string, region: string, jobId: string }): Promise<any> {
  // For most Dataproc jobs, results are written to GCS or logs; this is a placeholder for future extension.
  // For now, just return the job details/status.
  return getDataprocJobStatus(options);
}

/**
 * Get Zeppelin notebook URL for a Dataproc cluster (if enabled)
 */
export function getZeppelinUrl(projectId: string, region: string, clusterName: string): string {
  // Standard Dataproc Zeppelin URL pattern
  return `https://${region}.dataproc.cloud.google.com/zeppelin/${projectId}/${region}/${clusterName}`;
}