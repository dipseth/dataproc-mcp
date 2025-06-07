/**
 * Template Functions Implementation
 * Implements job_output and qdrant_query dynamic functions
 */

import {
  DynamicResolutionContext,
  JobOutputOptions,
  QdrantQueryOptions,
  JobOutputError,
  QdrantQueryError,
} from '../types/dynamic-templating.js';
import { logger } from '../utils/logger.js';

/**
 * Template Functions class implementing dynamic function execution
 */
export class TemplateFunctions {
  private context: DynamicResolutionContext;

  constructor(context: DynamicResolutionContext) {
    this.context = context;
  }

  /**
   * Job Output Function: {{job_output('job-id', 'field.path')}}
   * Retrieves output from a completed job using field path notation
   */
  async jobOutput(jobId: string, fieldPath: string): Promise<unknown> {
    const startTime = Date.now();

    try {
      logger.debug(`TemplateFunctions: Executing job_output('${jobId}', '${fieldPath}')`);

      // Get job from tracker
      const job = this.context.jobTracker.getJob(jobId);
      if (!job) {
        throw new JobOutputError(
          `Job not found: ${jobId}`,
          {
            name: 'job_output',
            args: [jobId, fieldPath],
            original: '',
            position: { start: 0, end: 0 },
          },
          jobId
        );
      }

      // Check job status
      if (!['COMPLETED', 'DONE'].includes(job.status)) {
        if (['RUNNING', 'PENDING'].includes(job.status)) {
          throw new JobOutputError(
            `Job ${jobId} is still ${job.status}. Cannot retrieve output from incomplete job.`,
            {
              name: 'job_output',
              args: [jobId, fieldPath],
              original: '',
              position: { start: 0, end: 0 },
            },
            jobId
          );
        } else {
          throw new JobOutputError(
            `Job ${jobId} failed with status ${job.status}. Cannot retrieve output.`,
            {
              name: 'job_output',
              args: [jobId, fieldPath],
              original: '',
              position: { start: 0, end: 0 },
            },
            jobId
          );
        }
      }

      // Get job results
      const jobResults = await this.getJobResults(jobId, job.projectId, job.region);
      if (!jobResults) {
        throw new JobOutputError(
          `No results found for job ${jobId}`,
          {
            name: 'job_output',
            args: [jobId, fieldPath],
            original: '',
            position: { start: 0, end: 0 },
          },
          jobId
        );
      }

      // Extract field using path notation
      const value = this.extractFieldValue(jobResults, fieldPath);

      const executionTime = Date.now() - startTime;
      logger.debug(
        `TemplateFunctions: job_output resolved in ${executionTime}ms: ${JSON.stringify(value)}`
      );

      return value;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`TemplateFunctions: job_output failed after ${executionTime}ms:`, error);

      if (error instanceof JobOutputError) {
        throw error;
      }

      throw new JobOutputError(
        `Failed to retrieve job output: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'job_output',
          args: [jobId, fieldPath],
          original: '',
          position: { start: 0, end: 0 },
        },
        jobId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Qdrant Query Function: {{qdrant_query('semantic-query', 'field')}}
   * Queries the knowledge base and extracts a specific field from results
   */
  async qdrantQuery(query: string, field: string): Promise<unknown> {
    const startTime = Date.now();

    try {
      logger.debug(`TemplateFunctions: Executing qdrant_query('${query}', '${field}')`);

      // Check if KnowledgeIndexer is available
      if (!this.context.knowledgeIndexer) {
        throw new QdrantQueryError(
          'KnowledgeIndexer not available. Qdrant queries require the knowledge indexer service.',
          {
            name: 'qdrant_query',
            args: [query, field],
            original: '',
            position: { start: 0, end: 0 },
          },
          query
        );
      }

      // Execute semantic query
      const queryResults = await this.context.knowledgeIndexer.queryKnowledge(query, {
        type: 'all',
        limit: 5,
      });

      if (!queryResults || queryResults.length === 0) {
        logger.warn(`TemplateFunctions: No results found for Qdrant query: "${query}"`);
        return null; // Return null for no results rather than throwing
      }

      // Get the best result (first one, highest confidence)
      const bestResult = queryResults[0];

      // Extract the requested field
      const value = this.extractFieldValue(bestResult.data, field);

      const executionTime = Date.now() - startTime;
      logger.debug(
        `TemplateFunctions: qdrant_query resolved in ${executionTime}ms with confidence ${bestResult.confidence}: ${JSON.stringify(value)}`
      );

      return value;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`TemplateFunctions: qdrant_query failed after ${executionTime}ms:`, error);

      if (error instanceof QdrantQueryError) {
        throw error;
      }

      throw new QdrantQueryError(
        `Failed to execute Qdrant query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          name: 'qdrant_query',
          args: [query, field],
          original: '',
          position: { start: 0, end: 0 },
        },
        query,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get job results using the existing query service
   */
  private async getJobResults(jobId: string, projectId: string, region: string): Promise<unknown> {
    try {
      // Use the existing query service to get job results
      const { getQueryResults } = await import('./query.js');
      const results = await getQueryResults(projectId, region, jobId);
      return results;
    } catch (error) {
      logger.warn(`TemplateFunctions: Failed to get results for job ${jobId}:`, error);

      // Try alternative method - check if job has cached results
      const job = this.context.jobTracker.getJob(jobId);
      if (job && (job as any).results) {
        return (job as any).results;
      }

      return null;
    }
  }

  /**
   * Extract field value using dot notation path
   * Supports: 'field', 'nested.field', 'array[0]', 'nested.array[0].field'
   */
  private extractFieldValue(data: any, fieldPath: string): unknown {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const parts = this.parseFieldPath(fieldPath);
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      if (part.type === 'property') {
        if (part.name === undefined) {
          return null;
        }
        current = current[part.name];
      } else if (part.type === 'array') {
        if (!Array.isArray(current) || part.index === undefined) {
          return null;
        }
        current = current[part.index];
      }
    }

    return current;
  }

  /**
   * Parse field path into components
   */
  private parseFieldPath(
    fieldPath: string
  ): Array<{ type: 'property' | 'array'; name?: string; index?: number }> {
    const parts: Array<{ type: 'property' | 'array'; name?: string; index?: number }> = [];
    const segments = fieldPath.split('.');

    for (const segment of segments) {
      // Check for array notation: field[0] or just [0]
      const arrayMatch = segment.match(/^([^[]*)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, propertyName, indexStr] = arrayMatch;

        // Add property part if there's a name before the bracket
        if (propertyName) {
          parts.push({ type: 'property', name: propertyName });
        }

        // Add array access part
        parts.push({ type: 'array', index: parseInt(indexStr, 10) });
      } else {
        // Regular property access
        parts.push({ type: 'property', name: segment });
      }
    }

    return parts;
  }

  /**
   * Validate job output options
   */
  private validateJobOutputOptions(options: JobOutputOptions): void {
    if (!options.jobId || typeof options.jobId !== 'string') {
      throw new Error('jobId is required and must be a string');
    }

    if (!options.fieldPath || typeof options.fieldPath !== 'string') {
      throw new Error('fieldPath is required and must be a string');
    }

    if (
      options.timeoutMs !== undefined &&
      (typeof options.timeoutMs !== 'number' || options.timeoutMs <= 0)
    ) {
      throw new Error('timeoutMs must be a positive number');
    }
  }

  /**
   * Validate Qdrant query options
   */
  private validateQdrantQueryOptions(options: QdrantQueryOptions): void {
    if (!options.query || typeof options.query !== 'string') {
      throw new Error('query is required and must be a string');
    }

    if (!options.field || typeof options.field !== 'string') {
      throw new Error('field is required and must be a string');
    }

    if (
      options.minConfidence !== undefined &&
      (typeof options.minConfidence !== 'number' ||
        options.minConfidence < 0 ||
        options.minConfidence > 1)
    ) {
      throw new Error('minConfidence must be a number between 0 and 1');
    }

    if (
      options.maxResults !== undefined &&
      (typeof options.maxResults !== 'number' || options.maxResults <= 0)
    ) {
      throw new Error('maxResults must be a positive number');
    }
  }

  /**
   * Get function execution context information
   */
  getContextInfo(): {
    hasJobTracker: boolean;
    hasKnowledgeIndexer: boolean;
    hasAsyncQueryPoller: boolean;
    jobTrackerStats?: any;
    knowledgeIndexerAvailable?: boolean;
  } {
    return {
      hasJobTracker: !!this.context.jobTracker,
      hasKnowledgeIndexer: !!this.context.knowledgeIndexer,
      hasAsyncQueryPoller: !!this.context.asyncQueryPoller,
      jobTrackerStats: this.context.jobTracker
        ? {
            totalJobs: this.context.jobTracker.listJobs().length,
            autoUpdateJobs: this.context.jobTracker.getAutoUpdateJobs().length,
          }
        : undefined,
      knowledgeIndexerAvailable: this.context.knowledgeIndexer ? true : false,
    };
  }
}

/**
 * Utility functions for field path parsing and validation
 */
export class FieldPathUtils {
  /**
   * Validate field path syntax
   */
  static validateFieldPath(fieldPath: string): boolean {
    if (!fieldPath || typeof fieldPath !== 'string') {
      return false;
    }

    // Check for valid field path pattern
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*$/;
    return validPattern.test(fieldPath);
  }

  /**
   * Get all possible field paths from an object
   */
  static getAvailableFieldPaths(obj: any, prefix = '', maxDepth = 3): string[] {
    const paths: string[] = [];

    if (maxDepth <= 0 || obj === null || obj === undefined) {
      return paths;
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        // Array - show first few indices
        for (let i = 0; i < Math.min(obj.length, 3); i++) {
          const arrayPath = prefix ? `${prefix}[${i}]` : `[${i}]`;
          paths.push(arrayPath);

          if (typeof obj[i] === 'object' && obj[i] !== null) {
            paths.push(...this.getAvailableFieldPaths(obj[i], arrayPath, maxDepth - 1));
          }
        }
      } else {
        // Object - iterate properties
        for (const [key, value] of Object.entries(obj)) {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          paths.push(fieldPath);

          if (typeof value === 'object' && value !== null) {
            paths.push(...this.getAvailableFieldPaths(value, fieldPath, maxDepth - 1));
          }
        }
      }
    }

    return paths;
  }

  /**
   * Suggest field paths based on partial input
   */
  static suggestFieldPaths(obj: any, partial: string): string[] {
    const allPaths = this.getAvailableFieldPaths(obj);
    return allPaths.filter((path) => path.toLowerCase().includes(partial.toLowerCase()));
  }
}
