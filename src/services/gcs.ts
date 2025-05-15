/**
 * Google Cloud Storage service for handling file operations
 */

import { Storage } from '@google-cloud/storage';
import { createHash } from 'crypto';
import {
  GCSDownloadOptions,
  GCSError,
  GCSErrorType,
  GCSFileMetadata,
  GCSRawMetadata,
  GCSUri,
  DEFAULT_DOWNLOAD_OPTIONS,
  OutputFormat
} from '../types/gcs-types.js';
import { getGcloudAccessToken } from '../config/credentials.js';

export class GCSService {
  private storage: Storage;

  constructor() {
    // Initialize with application default credentials
    this.storage = new Storage();
  }

  /**
   * Parse a GCS URI into its components
   */
  parseUri(uri: string): GCSUri {
    const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new GCSError(
        GCSErrorType.INVALID_URI,
        `Invalid GCS URI format: ${uri}`
      );
    }

    const [, bucket, path] = match;
    return { bucket, path, uri };
  }

  /**
   * Convert raw metadata to structured format
   */
  private convertMetadata(rawMetadata: GCSRawMetadata): GCSFileMetadata {
    if (!rawMetadata.name || !rawMetadata.size || !rawMetadata.updated) {
      throw new GCSError(
        GCSErrorType.INVALID_METADATA,
        'Missing required metadata fields'
      );
    }

    const size = typeof rawMetadata.size === 'string' 
      ? parseInt(rawMetadata.size, 10)
      : rawMetadata.size;

    return {
      name: rawMetadata.name,
      size,
      contentType: rawMetadata.contentType,
      updated: new Date(rawMetadata.updated),
      md5Hash: rawMetadata.md5Hash
    };
  }

  /**
   * Get file metadata from GCS
   */
  async getFileMetadata(uri: string): Promise<GCSFileMetadata> {
    const { bucket, path } = this.parseUri(uri);

    try {
      const [metadata] = await this.storage
        .bucket(bucket)
        .file(path)
        .getMetadata();

      return this.convertMetadata(metadata);
    } catch (error: any) {
      if (error.code === 404) {
        throw new GCSError(
          GCSErrorType.NOT_FOUND,
          `File not found: ${uri}`,
          error
        );
      }
      if (error instanceof GCSError) {
        throw error;
      }
      throw new GCSError(
        GCSErrorType.PERMISSION_DENIED,
        `Failed to get metadata for ${uri}`,
        error
      );
    }
  }

  /**
   * Download file from GCS
   */
  async downloadFile(uri: string, options: GCSDownloadOptions = {}): Promise<Buffer> {
    const { bucket, path } = this.parseUri(uri);
    const opts = { ...DEFAULT_DOWNLOAD_OPTIONS, ...options };
    
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < opts.retries!) {
      try {
        // Download with timeout
        const downloadPromise = this.storage
          .bucket(bucket)
          .file(path)
          .download();

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new GCSError(
              GCSErrorType.TIMEOUT,
              `Download timed out after ${opts.timeout}ms`
            ));
          }, opts.timeout);
        });

        const [buffer] = await Promise.race([
          downloadPromise,
          timeoutPromise
        ]) as [Buffer];

        // Validate MD5 hash if requested
        if (opts.validateHash) {
          const metadata = await this.getFileMetadata(uri);
          if (metadata.md5Hash) {
            const hash = createHash('md5')
              .update(buffer)
              .digest('base64');
            
            if (hash !== metadata.md5Hash) {
              throw new GCSError(
                GCSErrorType.VALIDATION_FAILED,
                'MD5 hash validation failed'
              );
            }
          }
        }

        return buffer;
      } catch (error: any) {
        lastError = error;
        attempt++;
        
        if (attempt < opts.retries!) {
          // Exponential backoff before retry
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw new GCSError(
      GCSErrorType.DOWNLOAD_FAILED,
      `Failed to download after ${opts.retries} attempts`,
      lastError
    );
  }

  /**
   * Detect output format from file metadata/content
   */
  async detectOutputFormat(uri: string): Promise<OutputFormat> {
    const metadata = await this.getFileMetadata(uri);
    
    // Check content type first
    if (metadata.contentType) {
      if (metadata.contentType.includes('csv')) return 'csv';
      if (metadata.contentType.includes('json')) return 'json';
      if (metadata.contentType.includes('text')) return 'text';
    }

    // Check file extension
    if (metadata.name.endsWith('.csv')) return 'csv';
    if (metadata.name.endsWith('.json')) return 'json';
    if (metadata.name.endsWith('.txt')) return 'text';

    // If small enough, peek at content
    if (metadata.size < 1024) {
      const content = await this.downloadFile(uri);
      const text = content.toString().trim();

      // Check for JSON structure
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          JSON.parse(text);
          return 'json';
        } catch {
          // Not valid JSON
        }
      }

      // Check for CSV structure (contains commas and newlines)
      if (text.includes(',') && text.includes('\n')) {
        return 'csv';
      }
    }

    return 'text';
  }
}