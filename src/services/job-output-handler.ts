/**
 * Job Output Handler service to manage Dataproc job outputs
 */

import { GCSService } from './gcs.js';
import { CacheManager } from './cache-manager.js';
import { OutputParser, ParseOptions } from './output-parser.js';
import { GCSError, GCSErrorType, OutputFormat } from '../types/gcs-types.js';
import { CacheConfig } from '../types/cache-types.js';

export interface JobOutputOptions extends ParseOptions {
  /**
   * Whether to use cache
   */
  useCache?: boolean;

  /**
   * Whether to validate file hashes
   */
  validateHash?: boolean;

  /**
   * Custom cache config overrides
   */
  cacheConfig?: Partial<CacheConfig>;
}

export class JobOutputHandler {
  private gcsService: GCSService;
  private cacheManager: CacheManager;
  private outputParser: OutputParser;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.gcsService = new GCSService();
    this.cacheManager = new CacheManager(cacheConfig);
    this.outputParser = new OutputParser();
  }

  /**
   * Get and parse job output from a GCS URI
   */
  async getJobOutput<T>(
    uri: string,
    format: OutputFormat = 'text',
    options: JobOutputOptions = {}
  ): Promise<T> {
    const opts = {
      useCache: true,
      validateHash: true,
      ...options
    };

    // Try cache first if enabled
    if (opts.useCache) {
      const cached = this.cacheManager.get<T>(uri);
      if (cached) {
        return cached;
      }
    }

    try {
      // Check file size before downloading
      const metadata = await this.gcsService.getFileMetadata(uri);
      const eligibleForCache = this.cacheManager.isEligibleForCache(metadata.size);

      // Download and parse content
      const content = await this.gcsService.downloadFile(uri, {
        validateHash: opts.validateHash
      });

      // Auto-detect format if needed
      const detectedFormat = format === 'unknown' 
        ? await this.gcsService.detectOutputFormat(uri)
        : format;

      // Parse the content
      const parseOpts: ParseOptions = {
        trim: opts.trim,
        delimiter: opts.delimiter,
        parseNumbers: opts.parseNumbers,
        skipEmpty: opts.skipEmpty
      };

      const result = await this.outputParser.parse(content, detectedFormat, parseOpts);

      // Cache result if eligible
      if (opts.useCache && eligibleForCache) {
        this.cacheManager.set(uri, result, metadata.size);
      }

      return result as T;
    } catch (error) {
      if (error instanceof GCSError) {
        throw error;
      }
      throw new GCSError(
        GCSErrorType.DOWNLOAD_FAILED,
        `Failed to get job output from ${uri}`,
        error as Error
      );
    }
  }

  /**
   * Get multiple job outputs and combine results
   */
  async getJobOutputs<T>(
    uris: string[],
    format: OutputFormat = 'text',
    options: JobOutputOptions = {}
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (const uri of uris) {
      const result = await this.getJobOutput<T>(uri, format, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Get current cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getStats();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.cacheManager.destroy();
  }
}