/**
 * Generic Type-to-Qdrant Conversion System
 * Core interfaces and TypeScript utility types for automatic field detection and mapping
 */

import {
  QdrantPayloadBase,
  QdrantQueryResultPayload,
  QdrantClusterPayload,
  QdrantJobPayload,
} from './qdrant-payload.js';
import { QdrantStorageMetadata } from './response-filter.js';
import { QueryResultData, ExtendedClusterData, DataprocJob } from './dataproc-responses.js';

/**
 * Generic converter interface for type-safe conversions
 */
export interface GenericConverter<TSource, TTarget extends QdrantPayloadBase> {
  convert(source: TSource, metadata: QdrantStorageMetadata): Promise<TTarget>;
  validate(source: TSource): boolean;
  getCompressionFields(): (keyof TSource)[];
}

/**
 * Configuration for field-level compression with security considerations
 */
export interface CompressionFieldConfig<T> {
  fields: (keyof T)[];
  sizeThreshold?: number;
  compressionType?: 'gzip' | 'deflate';
  securityLevel?: 'none' | 'basic' | 'encrypted'; // Future security consideration
}

/**
 * Field transformation functions for custom data processing
 */
export type FieldTransformations<T> = {
  [K in keyof T]?: (value: T[K]) => any;
};

/**
 * Metadata injection rules for automatic field generation
 */
export interface MetadataInjectionRules {
  autoTimestamp?: boolean;
  autoUUID?: boolean;
  customFields?: Record<string, () => any>;
}

/**
 * Comprehensive conversion configuration
 */
export interface ConversionConfig<TSource> {
  fieldMappings?: Partial<Record<keyof TSource, string>>;
  compressionRules?: CompressionFieldConfig<TSource>;
  transformations?: FieldTransformations<TSource>;
  metadata?: MetadataInjectionRules;
}

/**
 * Compressible field wrapper for large data
 */
export type CompressibleField<T> = {
  data: T;
  isCompressed?: boolean;
  compressionType?: 'gzip' | 'deflate';
  originalSize?: number;
  compressedSize?: number;
};

/**
 * Advanced mapped type for automatic field detection
 * Determines which fields should be compressed based on their types
 */
export type ExtractQdrantFields<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | null | undefined
    ? T[K]
    : T[K] extends Array<any>
      ? CompressibleField<T[K]>
      : T[K] extends object
        ? CompressibleField<T[K]>
        : T[K];
};

/**
 * Conditional type for automatic payload type selection
 * Infers the correct Qdrant payload type based on source data type
 */
export type InferQdrantPayload<T> = T extends QueryResultData
  ? QdrantQueryResultPayload
  : T extends ExtendedClusterData
    ? QdrantClusterPayload
    : T extends DataprocJob
      ? QdrantJobPayload
      : QdrantPayloadBase;

/**
 * Utility type to extract keys that should be compressed
 */
export type CompressibleKeys<T> = {
  [K in keyof T]: T[K] extends Array<any> ? K : T[K] extends object ? K : never;
}[keyof T];

/**
 * Type-safe field mapping utility
 */
export type FieldMapping<TSource, TTarget> = {
  [K in keyof TSource]?: keyof TTarget;
};

/**
 * Result of field analysis for automatic detection
 */
export interface FieldAnalysisResult<T> {
  compressibleFields: (keyof T)[];
  primitiveFields: (keyof T)[];
  objectFields: (keyof T)[];
  arrayFields: (keyof T)[];
  estimatedSizes: Record<keyof T, number>;
}

/**
 * Conversion result with metadata
 */
export interface ConversionResult<T extends QdrantPayloadBase> {
  payload: T;
  metadata: {
    fieldsProcessed: number;
    fieldsCompressed: number;
    totalOriginalSize: number;
    totalCompressedSize: number;
    compressionRatio: number;
    processingTime: number;
  };
}

/**
 * Type guard utilities for runtime type checking
 */
export interface TypeGuards {
  isQueryResultData(obj: unknown): obj is QueryResultData;
  isExtendedClusterData(obj: unknown): obj is ExtendedClusterData;
  isDataprocJob(obj: unknown): obj is DataprocJob;
}

/**
 * Configuration registry for type-specific conversion rules
 */
export interface ConversionRegistry {
  register<T>(
    typeName: string,
    config: ConversionConfig<T>,
    typeGuard: (obj: unknown) => obj is T
  ): void;

  getConfig<T>(typeName: string): ConversionConfig<T> | undefined;

  detectType(obj: unknown): string | undefined;
}

/**
 * Advanced utility type for deep field extraction
 */
export type DeepExtractFields<T, Depth extends number = 3> = Depth extends 0
  ? never
  : T extends object
    ? {
        [K in keyof T]: T[K] extends object ? DeepExtractFields<T[K], Prev<Depth>> : K;
      }[keyof T]
    : never;

/**
 * Helper type for depth counting in recursive types
 */
type Prev<T extends number> = T extends 0
  ? never
  : T extends 1
    ? 0
    : T extends 2
      ? 1
      : T extends 3
        ? 2
        : T extends 4
          ? 3
          : T extends 5
            ? 4
            : never;

/**
 * Type-safe conversion function signature
 */
export type ConvertFunction<TSource, TTarget extends QdrantPayloadBase> = (
  source: TSource,
  metadata: QdrantStorageMetadata,
  config?: ConversionConfig<TSource>
) => Promise<ConversionResult<TTarget>>;

/**
 * Validation result for source data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Performance metrics for conversion operations
 */
export interface ConversionMetrics {
  totalConversions: number;
  averageProcessingTime: number;
  averageCompressionRatio: number;
  fieldCompressionStats: Record<
    string,
    {
      timesCompressed: number;
      averageCompressionRatio: number;
      totalSizeSaved: number;
    }
  >;
}
