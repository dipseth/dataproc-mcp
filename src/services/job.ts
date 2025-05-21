/**
 * Generic Dataproc job submission and management service
 * Supports Hive, Spark, PySpark, Presto, and other job types
 */

import fetch from 'node-fetch';
import { getGcloudAccessToken, getGcloudAccessTokenWithConfig } from '../config/credentials.js';
import { JobOutputHandler, JobOutputOptions } from './job-output-handler.js';
import { OutputFormat } from '../types/gcs-types.js';
import { CacheConfig } from '../types/cache-types.js';
import { GCSService } from './gcs.js';
import { logger } from '../utils/logger.js';

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
  
  // Use the service account from the server configuration
  const token = await getGcloudAccessTokenWithConfig();

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
  
  // Use the service account from the server configuration
  const token = await getGcloudAccessTokenWithConfig();

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

  console.log(`[DEBUG] getDataprocJobResults: Starting with jobId=${jobId}, format=${format}, wait=${wait}`);

  // Wait for job completion if requested
  if (wait) {
    const startTime = Date.now();
    let jobStatus;

    do {
      jobStatus = await getDataprocJobStatus({ projectId, region, jobId });
      console.log(`[DEBUG] getDataprocJobResults: Job status while waiting: ${jobStatus.status?.state}`);
      
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
  console.log('[DEBUG] getDataprocJobResults: Job details retrieved:', {
    jobId,
    status: jobDetails.status?.state,
    hasDriverControlFilesUri: !!jobDetails.driverControlFilesUri,
    hasDriverOutputResourceUri: !!jobDetails.driverOutputResourceUri
  });
  
  logger.debug('getDataprocJobResults: Got job details:', {
    jobId,
    status: jobDetails.status?.state,
    hasDriverOutputUri: !!jobDetails.driverOutputResourceUri
  });
  
  try {
    // APPROACH 1: Try to use driverOutputResourceUri directly first
    if (jobDetails.driverOutputResourceUri) {
      console.log(`[DEBUG] getDataprocJobResults: Found driverOutputResourceUri: ${jobDetails.driverOutputResourceUri}`);
      
      try {
        // Try to get output directly from driverOutputResourceUri
        const parsedOutput = await outputHandler.getJobOutput(
          jobDetails.driverOutputResourceUri,
          format,
          {
            ...outputOptions,
            useCache: true
          }
        );
        
        console.log('[DEBUG] getDataprocJobResults: Successfully processed output from driverOutputResourceUri');
        
        // Check if we got a valid result
        if (parsedOutput) {
          return {
            ...jobDetails,
            parsedOutput
          } as unknown as T;
        }
      } catch (directOutputError) {
        console.error('[DEBUG] getDataprocJobResults: Error processing driverOutputResourceUri:', directOutputError);
        // Continue to try other approaches
      }
    }
    
    // APPROACH 2: Try to use local cached files if available
    // This is useful for testing and when files have been downloaded locally
    try {
      const localPath = `outputthere/${jobId}/driveroutput.000000000`;
      const fs = await import('fs/promises');
      
      // Check if the file exists locally
      try {
        await fs.access(localPath);
        console.log(`[DEBUG] getDataprocJobResults: Found local output file at ${localPath}`);
        
        // Read the file
        const content = await fs.readFile(localPath, 'utf8');
        
        // Create a new OutputParser instance to parse the content
        const outputParser = new (await import('./output-parser.js')).OutputParser();
        
        // Parse the content
        const parsedOutput = await outputParser.parse(
          content,
          format,
          {
            ...outputOptions,
            trim: true
          }
        );
        
        console.log('[DEBUG] getDataprocJobResults: Successfully processed local output file');
        
        return {
          ...jobDetails,
          parsedOutput
        } as unknown as T;
      } catch (localFileError: any) {
        console.log(`[DEBUG] getDataprocJobResults: Local file not found or error: ${localFileError.message || 'Unknown error'}`);
        // Continue to next approach
      }
    } catch (localError) {
      console.error('[DEBUG] getDataprocJobResults: Error processing local files:', localError);
      // Continue to next approach
    }

    // APPROACH 3: Fall back to driverControlFilesUri directory
    const { driverControlFilesUri } = jobDetails;

    if (!driverControlFilesUri) {
      console.log('[DEBUG] getDataprocJobResults: No driverControlFilesUri found, returning job details only');
      logger.debug('getDataprocJobResults: No driverControlFilesUri found, returning job details only');
      return jobDetails as unknown as T;
    }

    console.log(`[DEBUG] getDataprocJobResults: Attempting to process job output from directory: ${driverControlFilesUri}`);
    logger.debug(`getDataprocJobResults: Attempting to process job output from directory: ${driverControlFilesUri}`);

    // List all files in the driverControlFilesUri directory
    const gcsService = new GCSService();
    let objectUris: string[] = [];
    try {
      objectUris = await gcsService.listObjectsWithPrefix(driverControlFilesUri);
      console.log(`[DEBUG] getDataprocJobResults: Found ${objectUris.length} files in output directory`);
      logger.debug(`getDataprocJobResults: All files in output directory:`, objectUris);
    } catch (err) {
      console.error('[DEBUG] getDataprocJobResults: Error listing objects in output directory:', err);
      logger.error('getDataprocJobResults: Error listing objects in output directory:', err);
      throw err;
    }

    // Filter for driveroutput.* files
    const outputFiles = objectUris.filter(uri => /driveroutput\.\d+$/.test(uri));
    console.log(`[DEBUG] getDataprocJobResults: Filtered ${outputFiles.length} driveroutput.* files`);
    logger.debug(`getDataprocJobResults: Filtered driveroutput.* files:`, outputFiles);
    
    if (outputFiles.length === 0) {
      console.log('[DEBUG] getDataprocJobResults: No driveroutput.* files found in output directory');
      logger.debug('getDataprocJobResults: No driveroutput.* files found in output directory');
      return jobDetails as unknown as T;
    }

    // Download and parse all output files
    try {
      const parsedOutput = await outputHandler.getJobOutputs(
        outputFiles,
        format,
        {
          ...outputOptions,
          useCache: true
        }
      );

      console.log('[DEBUG] getDataprocJobResults: Successfully processed job output from directory');
      logger.debug('getDataprocJobResults: Successfully processed job output, parsedOutput:',
        parsedOutput ? 'present' : 'missing');
      
      return {
        ...jobDetails,
        parsedOutput
      } as unknown as T;
    } catch (outputError: any) {
      console.error('[DEBUG] getDataprocJobResults: Error in outputHandler.getJobOutputs:', outputError);
      logger.error('getDataprocJobResults: Error in outputHandler.getJobOutputs:', outputError);
      logger.error('getDataprocJobResults: Error details:', {
        message: outputError.message,
        name: outputError.name,
        code: outputError.code
      });
      throw outputError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('[DEBUG] getDataprocJobResults: Error downloading or processing GCS output:', error);
    logger.error('getDataprocJobResults: Error downloading or processing GCS output:', error);
    logger.error('getDataprocJobResults: Error type:', error.constructor?.name || 'Unknown');
    logger.error('getDataprocJobResults: Returning job details without parsedOutput');
    return jobDetails as unknown as T;
  }
}

/**
 * Process Hive query output from driver output files
 * @deprecated This function is no longer used internally. Use JobOutputHandler.getJobOutput instead.
 * @param outputContents Array of driver output file contents
 * @returns Processed output in a structured format
 */
function processHiveOutput(outputContents: string[]): any {
  // Join all output contents
  const fullOutput = outputContents.join('\n');
  
  // Parse the output to extract the table data
  // Hive output typically has a header row with column names
  // followed by rows of data, separated by | characters
  const lines = fullOutput.split('\n');
  
  // Find the table boundaries (lines with +---+---+ pattern)
  const tableStartIndices: number[] = [];
  const tableEndIndices: number[] = [];
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('+--') && line.trim().endsWith('--+')) {
      // This is a table boundary
      if (tableStartIndices.length === tableEndIndices.length) {
        tableStartIndices.push(index);
      } else {
        tableEndIndices.push(index);
      }
    }
  });
  
  // Make sure we have matching start and end indices
  if (tableStartIndices.length > tableEndIndices.length) {
    tableEndIndices.push(lines.length - 1);
  }
  
  // Process each table
  const tables: any[] = [];
  
  for (let i = 0; i < tableStartIndices.length; i++) {
    const startIdx = tableStartIndices[i];
    const endIdx = tableEndIndices[i];
    
    // Extract the table lines
    const tableLines = lines.slice(startIdx, endIdx + 1);
    
    // Find the header row (usually the second line after the first boundary)
    const headerLine = tableLines[1];
    
    // Extract column names
    const columns = headerLine
      .split('|')
      .filter(col => col.trim().length > 0)
      .map(col => col.trim());
    
    // Extract data rows (skip the header row and boundary lines)
    const dataRows: any[] = [];
    
    for (let j = 3; j < tableLines.length - 1; j += 2) {
      const rowLine = tableLines[j];
      
      // Skip boundary lines
      if (rowLine.trim().startsWith('+--')) {
        continue;
      }
      
      // Extract values
      const values = rowLine
        .split('|')
        .filter(val => val.length > 0)
        .map(val => val.trim());
      
      // Create a row object
      const row: any = {};
      columns.forEach((col, colIdx) => {
        row[col] = values[colIdx];
      });
      
      dataRows.push(row);
    }
    
    // Add the table to our result
    tables.push({
      columns,
      rows: dataRows
    });
  }
  
  // Return the processed output
  return {
    tables,
    rawOutput: fullOutput
  };
}

/**
 * Get Zeppelin notebook URL for a Dataproc cluster (if enabled)
 */
export function getZeppelinUrl(projectId: string, region: string, clusterName: string): string {
  // Standard Dataproc Zeppelin URL pattern
  return `https://${region}.dataproc.cloud.google.com/zeppelin/${projectId}/${region}/${clusterName}`;
}