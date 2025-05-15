/**
 * Types for Google Cloud Storage operations
 */

/**
 * GCS file metadata
 */
export interface GCSFileMetadata {
  /**
   * Name of the file in the bucket
   */
  name: string;

  /**
   * Size of the file in bytes
   */
  size: number;

  /**
   * Content type if known
   */
  contentType?: string;

  /**
   * Last modified timestamp
   */
  updated: Date;

  /**
   * MD5 hash of the content
   */
  md5Hash?: string;
}

/**
 * Raw GCS metadata response
 */
export interface GCSRawMetadata {
  name?: string;
  size?: string | number;
  contentType?: string;
  updated?: string;
  md5Hash?: string;
}

/**
 * Parsed GCS URI components
 */
export interface GCSUri {
  /**
   * Bucket name
   */
  bucket: string;

  /**
   * Object path within bucket
   */
  path: string;

  /**
   * Full GCS URI (gs://bucket/path)
   */
  uri: string;
}

/**
 * GCS download options
 */
export interface GCSDownloadOptions {
  /**
   * Whether to validate MD5 hash after download
   */
  validateHash?: boolean;

  /**
   * Custom timeout in milliseconds
   */
  timeout?: number;

  /**
   * Number of retry attempts
   */
  retries?: number;
}

/**
 * Supported output formats that can be detected and parsed
 */
export type OutputFormat = 'csv' | 'json' | 'text' | 'unknown';

/**
 * GCS operation error types
 */
export enum GCSErrorType {
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_URI = 'INVALID_URI',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  INVALID_METADATA = 'INVALID_METADATA'
}

/**
 * GCS operation error
 */
export class GCSError extends Error {
  constructor(
    public type: GCSErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'GCSError';
  }
}

/**
 * Default download options
 */
export const DEFAULT_DOWNLOAD_OPTIONS: GCSDownloadOptions = {
  validateHash: true,
  timeout: 30000, // 30 seconds
  retries: 3,
};