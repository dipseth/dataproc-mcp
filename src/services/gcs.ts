/**
 * Google Cloud Storage service for handling file operations
 * Uses REST API with service account impersonation for consistent authentication
 */

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
  constructor() {
    // GCS operations now use REST API with impersonated tokens
    // No need to initialize Storage client with potentially incorrect credentials
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
   * Get file metadata from GCS using REST API with impersonated token
   */
  async getFileMetadata(uri: string): Promise<GCSFileMetadata> {
    const { bucket, path } = this.parseUri(uri);

    console.log(`[DEBUG] GCSService.getFileMetadata: Getting metadata for ${uri}`);

    // Get token for the service account from the server configuration
    let token: string;
    try {
      token = await getGcloudAccessTokenWithConfig();
      console.log(`[DEBUG] GCSService.getFileMetadata: Successfully obtained token for ${uri}`);
    } catch (error) {
      console.error(`[DEBUG] GCSService.getFileMetadata: Failed to get token for ${uri}:`, error);
      throw error;
    }

    // Use fetch API directly with the token
    const fetch = (await import('node-fetch')).default;

    // Convert GCS URI to HTTP URL for metadata
    // Format: gs://bucket/path -> https://storage.googleapis.com/storage/v1/b/bucket/o/path
    const encodedPath = encodeURIComponent(path);
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedPath}`;

    console.log(`[DEBUG] GCSService.getFileMetadata: Fetching metadata from URL: ${url}`);

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

        // If we get a 404 Not Found, it might be a prefix for multiple files
        if (response.status === 404) {
          console.log(
            `[DEBUG] GCSService.getFileMetadata: File not found at ${uri}, checking if it's a prefix...`
          );

          // Try to list objects with this prefix to see if there are multiple files
          const objectUris = await this.listObjectsWithPrefix(uri);

          if (objectUris.length > 0) {
            console.log(
              `[DEBUG] GCSService.getFileMetadata: Found ${objectUris.length} objects with prefix ${uri}, using first object for metadata`
            );

            // Get metadata from the first object
            const firstObjectUri = objectUris[0];
            const { bucket: firstBucket, path: firstPath } = this.parseUri(firstObjectUri);
            const encodedFirstPath = encodeURIComponent(firstPath);
            const firstUrl = `https://storage.googleapis.com/storage/v1/b/${firstBucket}/o/${encodedFirstPath}`;

            const firstResponse = await fetch(firstUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
              },
            });

            if (!firstResponse.ok) {
              const firstErrorText = await firstResponse.text();
              throw new Error(
                `HTTP error ${firstResponse.status} getting metadata for ${firstObjectUri}: ${firstErrorText}`
              );
            }

            const firstMetadata = (await firstResponse.json()) as GCSRawMetadata;

            // Calculate total size from all objects
            let totalSize = 0;
            for (const objectUri of objectUris) {
              const { bucket: objBucket, path: objPath } = this.parseUri(objectUri);
              const encodedObjPath = encodeURIComponent(objPath);
              const objUrl = `https://storage.googleapis.com/storage/v1/b/${objBucket}/o/${encodedObjPath}`;

              const objResponse = await fetch(objUrl, {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/json',
                },
              });

              if (objResponse.ok) {
                const objMetadata = (await objResponse.json()) as GCSRawMetadata;
                const objSize =
                  typeof objMetadata.size === 'string'
                    ? parseInt(objMetadata.size, 10)
                    : objMetadata.size;
                totalSize += objSize || 0;
              }
            }

            // Return metadata with combined size
            return {
              name: firstMetadata.name || path,
              size: totalSize,
              contentType: firstMetadata.contentType,
              updated: new Date(firstMetadata.updated || new Date()),
              md5Hash: firstMetadata.md5Hash,
            };
          } else {
            // No objects found with this prefix, so it's a genuine 404
            throw new GCSError(
              GCSErrorTypes.NOT_FOUND,
              `File not found: ${uri}`,
              new Error(`HTTP error ${response.status}: ${errorText}`)
            );
          }
        } else {
          // Some other error
          throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }
      }

      const metadata = (await response.json()) as GCSRawMetadata;
      console.log(`[DEBUG] GCSService.getFileMetadata: Successfully got metadata for ${uri}`);

      return this.convertMetadata(metadata);
    } catch (error: unknown) {
      console.error(
        `[DEBUG] GCSService.getFileMetadata: Error getting metadata for ${uri}:`,
        error
      );

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
    console.log(`[DEBUG] GCSService.detectOutputFormat: Detecting format for ${uri}`);

    try {
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
    } catch (error) {
      console.warn(
        `[WARN] GCSService.detectOutputFormat: Failed to detect format for ${uri}, defaulting to text:`,
        error
      );
      return 'text';
    }
  }

  /**
   * Upload a local file to GCS
   * @param localPath Path to the local file
   * @param gcsUri Target GCS URI (gs://bucket/path)
   * @returns Promise that resolves when upload is complete
   */
  async uploadFile(localPath: string, gcsUri: string): Promise<void> {
    const { bucket, path } = this.parseUri(gcsUri);

    console.log(`[DEBUG] GCSService.uploadFile: Uploading ${localPath} to ${gcsUri}`);

    // Check if local file exists
    const fs = await import('fs/promises');
    try {
      await fs.access(localPath);
    } catch (error) {
      throw new GCSError(
        GCSErrorTypes.NOT_FOUND,
        `Local file not found: ${localPath}`,
        error as Error
      );
    }

    // Read the local file
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(localPath);
      console.log(
        `[DEBUG] GCSService.uploadFile: Read ${fileBuffer.length} bytes from ${localPath}`
      );
    } catch (error) {
      throw new GCSError(
        GCSErrorTypes.DOWNLOAD_FAILED,
        `Failed to read local file: ${localPath}`,
        error as Error
      );
    }

    // Get token for the service account from the server configuration
    let token: string;
    try {
      token = await getGcloudAccessTokenWithConfig();
      console.log(
        `[DEBUG] GCSService.uploadFile: Successfully obtained token for upload to ${gcsUri}`
      );
    } catch (error) {
      console.error(`[DEBUG] GCSService.uploadFile: Failed to get token for ${gcsUri}:`, error);
      throw error;
    }

    // Use fetch API directly with the token
    const fetch = (await import('node-fetch')).default;

    // Convert GCS URI to HTTP URL for upload
    // Format: gs://bucket/path -> https://storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadType=media&name=path
    const encodedPath = encodeURIComponent(path);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodedPath}`;

    console.log(`[DEBUG] GCSService.uploadFile: Uploading to URL: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString(),
        },
        body: fileBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      console.log(`[DEBUG] GCSService.uploadFile: Successfully uploaded ${localPath} to ${gcsUri}`);
    } catch (error: unknown) {
      console.error(
        `[DEBUG] GCSService.uploadFile: Error uploading ${localPath} to ${gcsUri}:`,
        error
      );
      throw new GCSError(
        GCSErrorTypes.DOWNLOAD_FAILED, // Reusing this error type for upload failures
        `Failed to upload ${localPath} to ${gcsUri}`,
        error as Error
      );
    }
  }

  /**
   * Discover the staging bucket from an existing Dataproc cluster
   * @param projectId GCP Project ID
   * @param region GCP Region
   * @param clusterName Cluster name to get staging bucket from
   * @returns Promise that resolves to the staging bucket name
   */
  async discoverStagingBucketFromCluster(
    projectId: string,
    region: string,
    clusterName: string
  ): Promise<string> {
    console.log(
      `[DEBUG] GCSService.discoverStagingBucketFromCluster: Getting staging bucket from cluster ${clusterName}`
    );

    // Get token for the service account from the server configuration
    let token: string;
    try {
      token = await getGcloudAccessTokenWithConfig();
    } catch (error) {
      console.error(
        `[DEBUG] GCSService.discoverStagingBucketFromCluster: Failed to get token:`,
        error
      );
      throw error;
    }

    const fetch = (await import('node-fetch')).default;

    // Get cluster configuration to extract staging bucket
    try {
      const clusterUrl = `https://${region}-dataproc.googleapis.com/v1/projects/${projectId}/regions/${region}/clusters/${clusterName}`;
      const clusterResponse = await fetch(clusterUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (clusterResponse.ok) {
        const clusterData = (await clusterResponse.json()) as {
          config?: { configBucket?: string };
        };
        if (clusterData.config?.configBucket) {
          console.log(
            `[DEBUG] GCSService.discoverStagingBucketFromCluster: Found staging bucket: ${clusterData.config.configBucket}`
          );
          return clusterData.config.configBucket;
        }
      }
    } catch (error) {
      console.warn(
        `[DEBUG] GCSService.discoverStagingBucketFromCluster: Could not get cluster config:`,
        error
      );
    }

    // Fallback to default naming pattern
    const defaultBucket = `${projectId}-dataproc-staging`;
    console.log(
      `[DEBUG] GCSService.discoverStagingBucketFromCluster: Using fallback staging bucket: ${defaultBucket}`
    );
    return defaultBucket;
  }
}
