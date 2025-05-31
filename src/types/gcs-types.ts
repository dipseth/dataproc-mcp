/**
 * Types for Google Cloud Storage operations
 */

/**
 * GCS file metadata
 */
export interface GCSFileMetadata {
  name: string;
  size: number;
  contentType?: string;
  updated: Date;
  md5Hash?: string;
}

export interface GCSRawMetadata {
  name?: string;
  size?: string | number;
  contentType?: string;
  updated?: string;
  md5Hash?: string;
}

export interface GCSUri {
  bucket: string;
  path: string;
  uri: string;
}

export interface GCSDownloadOptions {
  validateHash?: boolean;
  timeout?: number;
  retries?: number;
}

export type OutputFormat = 'csv' | 'json' | 'text' | 'unknown';

/**
 * GCS operation error types (plain object, not enum)
 */
export const GCSErrorTypes = {
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_URI: 'INVALID_URI',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT',
  INVALID_METADATA: 'INVALID_METADATA',
  LIST_FAILED: 'LIST_FAILED',
} as const;
export type GCSErrorType = (typeof GCSErrorTypes)[keyof typeof GCSErrorTypes];

/**
 * GCS operation error
 */
export class GCSError extends Error {
  type: GCSErrorType;
  details?: unknown;
  constructor(type: GCSErrorType, message: string, details?: unknown) {
    super(message);
    this.type = type;
    this.details = details;
    this.name = 'GCSError';
  }
}

export const DEFAULT_DOWNLOAD_OPTIONS: GCSDownloadOptions = {
  validateHash: true,
  timeout: 30000,
  retries: 3,
};
