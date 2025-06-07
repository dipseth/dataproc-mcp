/**
 * Enhanced Qdrant payload structure types
 * Supports structured data storage with compression and backward compatibility
 */

export interface QdrantPayloadBase {
  // Metadata fields
  toolName: string;
  timestamp: string;
  projectId: string;
  region: string;
  clusterName: string;
  responseType: string;
  type: string;
  storedAt: string;

  // Token optimization fields
  originalTokenCount?: number;
  filteredTokenCount?: number;
  compressionRatio?: number;

  // Index signature for Qdrant compatibility
  [key: string]: unknown;
}

export interface QdrantQueryResultPayload extends QdrantPayloadBase {
  // Query-specific metadata
  jobId: string;
  contentType: string;
  totalRows: number;
  schemaFields: number;
  dataSize: number;

  // Structured data fields (instead of single "data" key)
  schema?: any;
  rows?: any[];
  summary?: string;
  searchableContent?: string;

  // Compression support
  isCompressed?: boolean;
  compressionType?: 'gzip' | 'deflate';
  originalSize?: number;
  compressedSize?: number;

  // Legacy support - will be phased out
  data?: string;
}

export interface QdrantClusterPayload extends QdrantPayloadBase {
  // Cluster-specific data
  clusterConfig?: any;
  machineTypes?: any;
  networkConfig?: any;
  softwareConfig?: any;

  // Compression support
  isCompressed?: boolean;
  compressionType?: 'gzip' | 'deflate';
  originalSize?: number;
  compressedSize?: number;

  // Legacy support
  data?: string;
}

export interface QdrantJobPayload extends QdrantPayloadBase {
  // Job-specific data
  jobId: string;
  jobType: string;
  status: string;
  submissionTime: string;
  duration?: number;
  query?: string;
  results?: any;
  error?: any;

  // Compression support
  isCompressed?: boolean;
  compressionType?: 'gzip' | 'deflate';
  originalSize?: number;
  compressedSize?: number;

  // Legacy support
  data?: string;
}

export type QdrantPayload = QdrantQueryResultPayload | QdrantClusterPayload | QdrantJobPayload;

export interface CompressionConfig {
  threshold: number; // Size threshold in bytes for compression
  type: 'gzip' | 'deflate';
  level?: number; // Compression level (1-9)
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  threshold: 10240, // 10KB threshold
  type: 'gzip',
  level: 6,
};
