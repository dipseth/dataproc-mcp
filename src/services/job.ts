/**
 * Generic Dataproc job submission and management service
 * Supports Hive, Spark, PySpark, Presto, and other job types
 */

import fetch from 'node-fetch';
import { getGcloudAccessTokenWithConfig } from '../config/credentials.js';
import { JobOutputHandler, JobOutputOptions } from './job-output-handler.js';
import { OutputFormat } from '../types/gcs-types.js';
import { GCSService } from './gcs.js';
import { logger } from '../utils/logger.js';

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

export type DataprocJobType =
  | 'hive'
  | 'spark'
  | 'pyspark'
  | 'presto'
  | 'pig'
  | 'hadoop'
  | 'sparkR'
  | 'sparkSql';

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

  /**
   * Maximum number of rows to display in the response
   * @default 10
   */
  maxDisplayRows?: number;
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
  const job: any = {
    placement: { clusterName },
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dataproc job submission failed: ${response.status} - ${errorText}`);
  }

  const result: any = await response.json();

  // If async, return immediately with job reference
  if (async) {
    return {
      jobReference: result.reference || result.jobReference || { jobId: result.id },
      operation: result,
    };
  }

  // Otherwise, poll for job completion
  const jobId = result.reference?.jobId || result.jobReference?.jobId || result.id;
  if (!jobId) throw new Error('No jobId found in Dataproc job submission response');

  let jobStatus;
  do {
    await new Promise((res) => setTimeout(res, 2000));
    jobStatus = await getDataprocJobStatus({ projectId, region, jobId });
  } while (
    jobStatus.status?.state !== 'DONE' &&
    jobStatus.status?.state !== 'ERROR' &&
    jobStatus.status?.state !== 'CANCELLED'
  );

  return {
    jobId,
    status: jobStatus.status?.state,
    details: jobStatus,
  };
}

/**
 * Get Dataproc job status with enhanced authentication fallback
 */
export async function getDataprocJobStatus(options: {
  projectId: string;
  region: string;
  jobId: string;
}): Promise<any> {
  const startTime = Date.now();
  console.error(`[TIMING] getDataprocJobStatus: Starting MCP tool execution`);
  const { projectId, region, jobId } = options;

  try {
    // Use REST API approach (like working list_clusters)
    console.error(`[TIMING] getDataprocJobStatus: Using REST API approach`);
    const authStartTime = Date.now();
    const token = await getGcloudAccessTokenWithConfig();
    const authDuration = Date.now() - authStartTime;

    console.error(`[TIMING] getDataprocJobStatus: Auth completed in ${authDuration}ms`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(`[DEBUG] getDataprocJobStatus: Using configured authentication`);
    }

    const url = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/jobs/${jobId}`;

    const fetchStartTime = Date.now();
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
    const fetchDuration = Date.now() - fetchStartTime;

    if (!response.ok) {
      const totalDuration = Date.now() - startTime;
      console.error(
        `[TIMING] getDataprocJobStatus: FAILED after ${totalDuration}ms (auth: ${authDuration}ms, fetch: ${fetchDuration}ms)`
      );
      const errorText = await response.text();
      throw new Error(`Failed to get Dataproc job status: ${response.status} - ${errorText}`);
    }

    const parseStartTime = Date.now();
    const result = await response.json();
    const parseDuration = Date.now() - parseStartTime;
    const totalDuration = Date.now() - startTime;

    console.error(
      `[TIMING] getDataprocJobStatus: SUCCESS - auth: ${authDuration}ms, fetch: ${fetchDuration}ms, parse: ${parseDuration}ms, total: ${totalDuration}ms`
    );
    return result;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getDataprocJobStatus: FAILED after ${totalDuration}ms`);
    console.error('[ERROR] getDataprocJobStatus: REST API failed:', error);
    throw new Error(`Failed to get Dataproc job status: ${error}`);
  }
}

// Output handler instance with default cache config
const outputHandler = new JobOutputHandler();

/**
 * Get Dataproc job results (for jobs that produce output)
 */
/**
 * Save job results as a TSV file
 * @param jobId Job ID
 * @param tables Table data to save
 * @returns Path to the saved file
 */
async function saveResultsAsTsv(jobId: string, tables: any[]): Promise<string> {
  // Ensure the output directory exists
  const fs = await import('fs/promises');
  const path = await import('path');
  const outputDir = 'output';

  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err) {
    console.error(`Error creating output directory: ${err}`);
  }

  const outputPath = path.join(outputDir, `job-${jobId}-results.tsv`);

  // If there are no tables or no rows, create an empty file
  if (!tables || tables.length === 0 || !tables[0].rows || tables[0].rows.length === 0) {
    await fs.writeFile(outputPath, 'No data available', 'utf8');
    return outputPath;
  }

  // Get the first table (most common case)
  const table = tables[0];
  const { columns, rows } = table;

  // Create TSV content
  let tsvContent = columns.join('\t') + '\n';

  // Add all rows
  for (const row of rows) {
    const rowValues = columns.map((col: string) => {
      const value = row[col];
      // Handle null/undefined values and escape tabs in values
      return value !== undefined && value !== null
        ? String(value).replace(/\t/g, ' ') // Replace tabs with spaces
        : '';
    });
    tsvContent += rowValues.join('\t') + '\n';
  }

  // Write to file
  await fs.writeFile(outputPath, tsvContent, 'utf8');
  return outputPath;
}

export async function getDataprocJobResults<T>(
  options: {
    projectId: string;
    region: string;
    jobId: string;
  } & GetJobResultsOptions
): Promise<T> {
  const {
    projectId,
    region,
    jobId,
    wait,
    waitTimeout,
    format = 'text',
    maxDisplayRows = 10,
    ...outputOptions
  } = options;

  console.log(
    `[DEBUG] getDataprocJobResults: Starting with jobId=${jobId}, format=${format}, wait=${wait}, maxDisplayRows=${maxDisplayRows}`
  );

  // Wait for job completion if requested
  if (wait) {
    const startTime = Date.now();
    let jobStatus;

    do {
      jobStatus = await getDataprocJobStatus({ projectId, region, jobId });
      console.log(
        `[DEBUG] getDataprocJobResults: Job status while waiting: ${jobStatus.status?.state}`
      );

      if (waitTimeout && Date.now() - startTime > waitTimeout) {
        throw new Error(`Timeout waiting for job completion after ${waitTimeout}ms`);
      }

      if (jobStatus.status?.state === 'ERROR' || jobStatus.status?.state === 'CANCELLED') {
        throw new Error(`Job failed with state: ${jobStatus.status?.state}`);
      }

      if (jobStatus.status?.state !== 'DONE') {
        await new Promise((res) => setTimeout(res, 2000));
      }
    } while (jobStatus.status?.state !== 'DONE');
  }

  // Get job details to find output location
  const jobDetails = await getDataprocJobStatus({ projectId, region, jobId });
  console.log('[DEBUG] getDataprocJobResults: Job details retrieved:', {
    jobId,
    status: jobDetails.status?.state,
    hasDriverControlFilesUri: !!jobDetails.driverControlFilesUri,
    hasDriverOutputResourceUri: !!jobDetails.driverOutputResourceUri,
  });

  logger.debug('getDataprocJobResults: Got job details:', {
    jobId,
    status: jobDetails.status?.state,
    hasDriverOutputUri: !!jobDetails.driverOutputResourceUri,
  });

  try {
    // APPROACH 1: Try to use driverOutputResourceUri directly first
    if (jobDetails.driverOutputResourceUri) {
      console.log(
        `[DEBUG] getDataprocJobResults: Found driverOutputResourceUri: ${jobDetails.driverOutputResourceUri}`
      );

      try {
        // Try to get output directly from driverOutputResourceUri
        const parsedOutput = await outputHandler.getJobOutput(
          jobDetails.driverOutputResourceUri,
          format,
          {
            ...outputOptions,
            useCache: true,
          }
        );

        console.log(
          '[DEBUG] getDataprocJobResults: Successfully processed output from driverOutputResourceUri'
        );

        // Check if we got a valid result
        if (parsedOutput) {
          // Check if parsedOutput has formatted output and add it if missing
          if (
            parsedOutput &&
            typeof parsedOutput === 'object' &&
            !('formattedOutput' in parsedOutput)
          ) {
            // If the output contains tables but no formatted representation,
            // generate the formatted output using the OutputParser
            try {
              const outputParser = new (await import('./output-parser.js')).OutputParser();
              const typedOutput = parsedOutput as any;

              // Only attempt to format if tables data is available
              if (typedOutput.tables) {
                // Generate a formatted ASCII table representation of the data
                // This enhances readability for users viewing the results
                typedOutput.formattedOutput = outputParser.formatTablesOutput(typedOutput.tables);
              }
            } catch (formatError) {
              console.error('[DEBUG] getDataprocJobResults: Error formatting output:', formatError);
            }
          }

          // Save results as TSV if tables data is available
          let tsvFilePath = '';
          if (parsedOutput && typeof parsedOutput === 'object' && 'tables' in parsedOutput) {
            try {
              tsvFilePath = await saveResultsAsTsv(jobId, (parsedOutput as any).tables);
              console.log(
                `[DEBUG] getDataprocJobResults: Saved results to TSV file: ${tsvFilePath}`
              );
            } catch (saveError) {
              console.error('[DEBUG] getDataprocJobResults: Error saving TSV file:', saveError);
            }
          }

          return {
            ...jobDetails,
            parsedOutput,
            tsvFilePath,
          } as unknown as T;
        }
      } catch (directOutputError) {
        console.error(
          '[DEBUG] getDataprocJobResults: Error processing driverOutputResourceUri:',
          directOutputError
        );
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
        const parsedOutput = await outputParser.parse(content, format, {
          ...outputOptions,
          trim: true,
        });

        console.log('[DEBUG] getDataprocJobResults: Successfully processed local output file');

        // Add formatted output to local file parsing results if needed
        if (
          parsedOutput &&
          typeof parsedOutput === 'object' &&
          !('formattedOutput' in parsedOutput)
        ) {
          // For local file parsing, we also want to ensure formatted output is available
          // This provides consistent behavior regardless of where the data comes from
          try {
            const outputParser = new (await import('./output-parser.js')).OutputParser();
            const typedOutput = parsedOutput as any;

            if (typedOutput.tables) {
              // Generate formatted table output for better readability
              // This uses the same formatting logic as the direct output approach
              typedOutput.formattedOutput = outputParser.formatTablesOutput(typedOutput.tables);
            }
          } catch (formatError) {
            console.error(
              '[DEBUG] getDataprocJobResults: Error formatting local output:',
              formatError
            );
          }
        }

        // Save results as TSV if tables data is available
        let tsvFilePath = '';
        if (parsedOutput && typeof parsedOutput === 'object' && 'tables' in parsedOutput) {
          try {
            tsvFilePath = await saveResultsAsTsv(jobId, (parsedOutput as any).tables);
            console.log(`[DEBUG] getDataprocJobResults: Saved results to TSV file: ${tsvFilePath}`);
          } catch (saveError) {
            console.error('[DEBUG] getDataprocJobResults: Error saving TSV file:', saveError);
          }
        }

        return {
          ...jobDetails,
          parsedOutput,
          tsvFilePath,
        } as unknown as T;
      } catch (localFileError: any) {
        console.log(
          `[DEBUG] getDataprocJobResults: Local file not found or error: ${localFileError.message || 'Unknown error'}`
        );
        // Continue to next approach
      }
    } catch (localError) {
      console.error('[DEBUG] getDataprocJobResults: Error processing local files:', localError);
      // Continue to next approach
    }

    // APPROACH 3: Fall back to driverControlFilesUri directory
    const { driverControlFilesUri } = jobDetails;

    if (!driverControlFilesUri) {
      console.log(
        '[DEBUG] getDataprocJobResults: No driverControlFilesUri found, returning job details only'
      );
      logger.debug(
        'getDataprocJobResults: No driverControlFilesUri found, returning job details only'
      );
      return jobDetails as unknown as T;
    }

    console.log(
      `[DEBUG] getDataprocJobResults: Attempting to process job output from directory: ${driverControlFilesUri}`
    );
    logger.debug(
      `getDataprocJobResults: Attempting to process job output from directory: ${driverControlFilesUri}`
    );

    // List all files in the driverControlFilesUri directory
    const gcsService = new GCSService();
    let objectUris: string[] = [];
    try {
      objectUris = await gcsService.listObjectsWithPrefix(driverControlFilesUri);
      console.log(
        `[DEBUG] getDataprocJobResults: Found ${objectUris.length} files in output directory`
      );
      logger.debug(`getDataprocJobResults: All files in output directory:`, objectUris);
    } catch (err) {
      console.error(
        '[DEBUG] getDataprocJobResults: Error listing objects in output directory:',
        err
      );
      logger.error('getDataprocJobResults: Error listing objects in output directory:', err);
      throw err;
    }

    // Filter for driveroutput.* files
    const outputFiles = objectUris.filter((uri) => /driveroutput\.\d+$/.test(uri));
    console.log(
      `[DEBUG] getDataprocJobResults: Filtered ${outputFiles.length} driveroutput.* files`
    );
    logger.debug(`getDataprocJobResults: Filtered driveroutput.* files:`, outputFiles);

    if (outputFiles.length === 0) {
      console.log(
        '[DEBUG] getDataprocJobResults: No driveroutput.* files found in output directory'
      );
      logger.debug('getDataprocJobResults: No driveroutput.* files found in output directory');
      return jobDetails as unknown as T;
    }

    // Download and parse all output files
    try {
      const parsedOutput = await outputHandler.getJobOutputs(outputFiles, format, {
        ...outputOptions,
        useCache: true,
      });

      console.log(
        '[DEBUG] getDataprocJobResults: Successfully processed job output from directory'
      );
      logger.debug(
        'getDataprocJobResults: Successfully processed job output, parsedOutput:',
        parsedOutput ? 'present' : 'missing'
      );

      // Add diagnostic log to check if parsedOutput contains rawOutput
      if (parsedOutput && typeof parsedOutput === 'object') {
        logger.debug('getDataprocJobResults: parsedOutput structure:', {
          hasRawOutput: 'rawOutput' in parsedOutput,
          keys: Object.keys(parsedOutput),
        });
      }

      // Ensure directory-based output also has formatted output
      if (
        parsedOutput &&
        typeof parsedOutput === 'object' &&
        !('formattedOutput' in parsedOutput)
      ) {
        // This is the third approach where we process files from the driverControlFilesUri directory
        // We still want to provide formatted output for consistency across all approaches
        try {
          const outputParser = new (await import('./output-parser.js')).OutputParser();
          const typedOutput = parsedOutput as any;

          if (typedOutput.tables) {
            // Generate formatted output for directory-based results
            // This ensures all three approaches provide the same enhanced output format
            typedOutput.formattedOutput = outputParser.formatTablesOutput(typedOutput.tables);
          }
        } catch (formatError) {
          console.error(
            '[DEBUG] getDataprocJobResults: Error formatting directory output:',
            formatError
          );
        }
      }

      // Save results as TSV if tables data is available
      let tsvFilePath = '';
      if (parsedOutput && typeof parsedOutput === 'object' && 'tables' in parsedOutput) {
        try {
          tsvFilePath = await saveResultsAsTsv(jobId, (parsedOutput as any).tables);
          console.log(`[DEBUG] getDataprocJobResults: Saved results to TSV file: ${tsvFilePath}`);
        } catch (saveError) {
          console.error('[DEBUG] getDataprocJobResults: Error saving TSV file:', saveError);
        }
      }

      return {
        ...jobDetails,
        parsedOutput,
        tsvFilePath,
      } as unknown as T;
    } catch (outputError: any) {
      console.error(
        '[DEBUG] getDataprocJobResults: Error in outputHandler.getJobOutputs:',
        outputError
      );
      logger.error('getDataprocJobResults: Error in outputHandler.getJobOutputs:', outputError);
      logger.error('getDataprocJobResults: Error details:', {
        message: outputError.message,
        name: outputError.name,
        code: outputError.code,
      });
      throw outputError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error(
      '[DEBUG] getDataprocJobResults: Error downloading or processing GCS output:',
      error
    );
    logger.error('getDataprocJobResults: Error downloading or processing GCS output:', error);
    logger.error('getDataprocJobResults: Error type:', error.constructor?.name || 'Unknown');
    logger.error('getDataprocJobResults: Returning job details without parsedOutput');
    return jobDetails as unknown as T;
  }
}

// Removed deprecated processHiveOutput function - use JobOutputHandler.getJobOutput instead

/**
 * Get Zeppelin notebook URL for a Dataproc cluster (if enabled)
 */
export function getZeppelinUrl(projectId: string, region: string, clusterName: string): string {
  // Standard Dataproc Zeppelin URL pattern
  return `https://${region}.dataproc.cloud.google.com/zeppelin/${projectId}/${region}/${clusterName}`;
}
