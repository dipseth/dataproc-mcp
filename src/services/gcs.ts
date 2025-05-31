/**
 * Google Cloud Storage service for handling file operations
 */

import { Storage } from '@google-cloud/storage';
import { createHash } from 'crypto';
import {
  GCSDownloadOptions,
  GCSError,
  GCSErrorTypes,
  GCSFileMetadata,
  GCSRawMetadata,
  GCSUri,
  DEFAULT_DOWNLOAD_OPTIONS,
  OutputFormat,
} from '../types/gcs-types.js';
import { getGcloudAccessTokenWithConfig } from '../config/credentials.js';
export class GCSService {
  private storage: Storage;

  constructor() {
    // Initialize with application default credentials
    // Note: We'll use getGcloudAccessTokenWithConfig before each operation
    // to ensure we're using the right service account
    this.storage = new Storage();
  }

  /**
   * Parse a GCS URI into its components
   */
  parseUri(uri: string): GCSUri {
    const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new GCSError(GCSErrorTypes.INVALID_URI, `Invalid GCS URI format: ${uri}`);
    }

    const [, bucket, path] = match;
    return { bucket, path, uri };
  }

  /**
   * Convert raw metadata to structured format
   */
  private convertMetadata(rawMetadata: GCSRawMetadata): GCSFileMetadata {
    if (!rawMetadata.name || !rawMetadata.size || !rawMetadata.updated) {
      throw new GCSError(GCSErrorTypes.INVALID_METADATA, 'Missing required metadata fields');
    }

    const size =
      typeof rawMetadata.size === 'string' ? parseInt(rawMetadata.size, 10) : rawMetadata.size;

    return {
      name: rawMetadata.name,
      size,
      contentType: rawMetadata.contentType,
      updated: new Date(rawMetadata.updated),
      md5Hash: rawMetadata.md5Hash,
    };
  }

  /**
   * Get file metadata from GCS
   */
  async getFileMetadata(uri: string): Promise<GCSFileMetadata> {
    const { bucket, path } = this.parseUri(uri);

    // Use the service account from the server configuration
    await getGcloudAccessTokenWithConfig();

    try {
      const [metadata] = await this.storage.bucket(bucket).file(path).getMetadata();

      return this.convertMetadata(metadata);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 404
      ) {
        throw new GCSError(
          GCSErrorTypes.NOT_FOUND,
          `File not found: ${uri}`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
      if (error instanceof GCSError) {
        throw error;
      }
      throw new GCSError(
        GCSErrorTypes.PERMISSION_DENIED,
        `Failed to get metadata for ${uri}`,
        error as Error
      );
    }
  }

  /**
   * List objects with a given prefix
   * @param uri Base GCS URI that serves as a prefix
   * @returns Array of complete URIs for all objects with the prefix
   */
  async listObjectsWithPrefix(uri: string): Promise<string[]> {
    const { bucket, path } = this.parseUri(uri);

    console.log(`[DEBUG] GCSService.listObjectsWithPrefix: Listing objects with prefix ${uri}`);

    // Get token for the service account from the server configuration
    let token: string;
    try {
      token = await getGcloudAccessTokenWithConfig();
      console.log(
        `[DEBUG] GCSService.listObjectsWithPrefix: Successfully obtained token for ${uri}`
      );
    } catch (error) {
      console.error(
        `[DEBUG] GCSService.listObjectsWithPrefix: Failed to get token for ${uri}:`,
        error
      );
      throw error;
    }

    // Use fetch API directly with the token
    const fetch = (await import('node-fetch')).default;

    // Format: https://storage.googleapis.com/storage/v1/b/bucket/o?prefix=path
    const encodedPrefix = encodeURIComponent(path);
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodedPrefix}`;

    console.log(`[DEBUG] GCSService.listObjectsWithPrefix: Fetching from URL: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { items?: Array<{ name: string }> };

      if (!data.items || data.items.length === 0) {
        console.log(
          `[DEBUG] GCSService.listObjectsWithPrefix: No objects found with prefix ${uri}`
        );
        return [];
      }

      // Convert object names back to GCS URIs
      const uris = data.items.map((item) => `gs://${bucket}/${item.name}`);
      console.log(
        `[DEBUG] GCSService.listObjectsWithPrefix: Found ${uris.length} objects with prefix ${uri}`
      );

      return uris;
    } catch (error) {
      console.error(
        `[DEBUG] GCSService.listObjectsWithPrefix: Error listing objects with prefix ${uri}:`,
        error
      );
      throw new GCSError(
        GCSErrorTypes.LIST_FAILED,
        `Failed to list objects with prefix ${uri}`,
        error as Error
      );
    }
  }

  /**
   * Download file from GCS
   * If the URI is a prefix for multiple files, all files will be downloaded and concatenated
   */
  async downloadFile(uri: string, options: GCSDownloadOptions = {}): Promise<Buffer> {
    const { bucket, path } = this.parseUri(uri);
    const opts = { ...DEFAULT_DOWNLOAD_OPTIONS, ...options };

    console.log(`[DEBUG] GCSService.downloadFile: Attempting to download ${uri}`);

    // Get token for the service account from the server configuration
    let token: string;
    try {
      token = await getGcloudAccessTokenWithConfig();
      console.log(`[DEBUG] GCSService.downloadFile: Successfully obtained token for ${uri}`);
    } catch (error) {
      console.error(`[DEBUG] GCSService.downloadFile: Failed to get token for ${uri}:`, error);
      throw error;
    }

    // Use fetch API directly with the token
    const fetch = (await import('node-fetch')).default;

    // Convert GCS URI to HTTP URL
    // Format: gs://bucket/path -> https://storage.googleapis.com/storage/v1/b/bucket/o/path?alt=media
    const encodedPath = encodeURIComponent(path);
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedPath}?alt=media`;

    console.log(`[DEBUG] GCSService.downloadFile: Fetching from URL: ${url}`);

    let attempt = 0;
    let lastError: Error | undefined;

    const retries = typeof opts.retries === 'number' ? opts.retries : 3;
    while (attempt < retries) {
      let buffer: Buffer; // Declare buffer here
      try {
        // Create fetch promise with timeout
        const fetchPromise = fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/octet-stream',
          },
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new GCSError(GCSErrorTypes.TIMEOUT, `Download timed out after ${opts.timeout}ms`)
            );
          }, opts.timeout);
        });

        // Race the fetch against the timeout
        const response = (await Promise.race([fetchPromise, timeoutPromise])) as Response;

        if (!response.ok) {
          const errorText = await response.text();

          // If we get a 404 Not Found, it might be a prefix for multiple files
          if (response.status === 404) {
            console.log(
              `[DEBUG] GCSService.downloadFile: File not found at ${uri}, checking if it's a prefix...`
            );

            // Try to list objects with this prefix
            const objectUris = await this.listObjectsWithPrefix(uri);

            if (objectUris.length > 0) {
              console.log(
                `[DEBUG] GCSService.downloadFile: Found ${objectUris.length} objects with prefix ${uri}`
              );

              // Download each file and concatenate the buffers
              const buffers: Buffer[] = [];

              for (const objectUri of objectUris) {
                console.log(`[DEBUG] GCSService.downloadFile: Downloading object ${objectUri}`);

                // Create a new URL for this specific object
                const { bucket: objBucket, path: objPath } = this.parseUri(objectUri);
                const encodedObjPath = encodeURIComponent(objPath);
                const objUrl = `https://storage.googleapis.com/storage/v1/b/${objBucket}/o/${encodedObjPath}?alt=media`;

                const objResponse = await fetch(objUrl, {
                  method: 'GET',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/octet-stream',
                  },
                });

                if (!objResponse.ok) {
                  const objErrorText = await objResponse.text();
                  throw new Error(
                    `HTTP error ${objResponse.status} downloading ${objectUri}: ${objErrorText}`
                  );
                }

                const objArrayBuffer = await objResponse.arrayBuffer();
                buffers.push(Buffer.from(objArrayBuffer));
              }

              // Concatenate all buffers
              buffer = Buffer.concat(buffers);
              console.log(
                `[DEBUG] GCSService.downloadFile: Successfully downloaded and concatenated ${buffers.length} files with total size ${buffer.length}`
              );

              // Skip validation for concatenated files
              return buffer;
            } else {
              // No objects found with this prefix, so it's a genuine 404
              throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }
          } else {
            // Some other error
            throw new Error(`HTTP error ${response.status}: ${errorText}`);
          }
        }

        // Get the response as a buffer
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer); // Assign to the declared buffer

        // Validate MD5 hash if requested
        if (opts.validateHash) {
          const metadataUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedPath}`;
          const metadataResponse = await fetch(metadataUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (metadataResponse.ok) {
            const metadata = (await metadataResponse.json()) as { md5Hash?: string };
            if (metadata.md5Hash) {
              const hash = createHash('md5').update(buffer).digest('base64');

              if (hash !== metadata.md5Hash) {
                throw new GCSError(GCSErrorTypes.VALIDATION_FAILED, 'MD5 hash validation failed');
              }
            }
          } else {
            console.error(
              `[DEBUG] GCSService.downloadFile: Failed to get metadata for hash validation: HTTP error ${metadataResponse.status}`
            );
          }
        }
        return buffer;
      } catch (error: unknown) {
        console.error(`[DEBUG] GCSService.downloadFile: Error downloading ${uri}:`, error);
        if (typeof error === 'object' && error !== null && 'constructor' in error) {
          console.error(
            `[DEBUG] GCSService.downloadFile: Error type: ${(error as { constructor?: { name?: string } }).constructor?.name}`
          );
        }
        if (typeof error === 'object' && error !== null && 'code' in error) {
          console.error(
            `[DEBUG] GCSService.downloadFile: Error code: ${(error as { code?: string | number }).code}`
          );
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < retries) {
          // Exponential backoff before retry
          console.log(
            `[DEBUG] GCSService.downloadFile: Retrying download (attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new GCSError(
      GCSErrorTypes.DOWNLOAD_FAILED,
      `Failed to download after ${opts.retries} attempts`,
      lastError
    );
  }

  /**
   * Detect output format from file metadata/content
   */
  async detectOutputFormat(uri: string): Promise<OutputFormat> {
    // Use the service account from the server configuration
    await getGcloudAccessTokenWithConfig();

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
