/**
 * Generic Qdrant Converter
 * Main conversion engine that orchestrates field analysis, transformation, and compression
 */

import {
  ConversionConfig,
  ConversionResult,
  ValidationResult,
  ConversionMetrics,
  InferQdrantPayload,
  CompressibleField,
} from '../types/generic-converter.js';
import { QdrantPayloadBase } from '../types/qdrant-payload.js';
import { QdrantStorageMetadata } from '../types/response-filter.js';
import { performance } from 'perf_hooks';
import {
  isQueryResultData,
  isExtendedClusterData,
  isDataprocJob,
} from '../types/dataproc-responses.js';
import { FieldAnalyzer } from './field-analyzer.js';
import { TransformationEngine } from './transformation-engine.js';
import { CompressionService } from './compression.js';
import { logger } from '../utils/logger.js';

/**
 * Main generic converter service
 */
export class GenericQdrantConverter {
  private fieldAnalyzer: FieldAnalyzer;
  private transformationEngine: TransformationEngine;
  private compressionService: CompressionService;
  private metrics: ConversionMetrics;

  constructor(compressionService: CompressionService) {
    this.fieldAnalyzer = new FieldAnalyzer();
    this.transformationEngine = new TransformationEngine();
    this.compressionService = compressionService;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Convert any source type to Qdrant-compatible payload with automatic type inference
   */
  async convert<TSource extends Record<string, any>>(
    source: TSource,
    metadata: QdrantStorageMetadata,
    config?: ConversionConfig<TSource>
  ): Promise<ConversionResult<InferQdrantPayload<TSource>>> {
    const startTime = performance.now();

    try {
      logger.info('Starting generic conversion', {
        sourceType: this.detectSourceType(source),
        fieldsCount: Object.keys(source).length,
        hasConfig: !!config,
      });

      // 1. Validate source data
      const validation = await this.validateSource(source);
      if (!validation.isValid) {
        throw new Error(`Source validation failed: ${validation.errors.join(', ')}`);
      }

      // 2. Analyze source fields
      const fieldAnalysis = await this.fieldAnalyzer.analyzeFields(source);

      // 3. Apply default transformations
      const transformedSource = this.transformationEngine.applyDefaultTransformations(source);

      // 4. Apply custom field mappings
      const mappedFields = this.transformationEngine.applyFieldMappings(
        transformedSource,
        config?.fieldMappings
      );

      // 5. Apply custom transformations
      const customTransformed = this.transformationEngine.applyTransformations(
        mappedFields as TSource,
        config?.transformations
      );

      // 6. Handle field-level compression
      const compressedFields = await this.handleFieldCompression(
        customTransformed,
        fieldAnalysis,
        config?.compressionRules
      );

      // 7. Merge compressed fields back into payload
      const payloadWithCompression = this.transformationEngine.mergeCompressedFields(
        customTransformed,
        compressedFields
      );

      // 8. Inject metadata
      const finalPayload = this.transformationEngine.injectMetadata(
        payloadWithCompression,
        metadata,
        config?.metadata
      );

      // 9. Calculate metrics
      const processingTime = performance.now() - startTime;
      const conversionMetadata = this.calculateConversionMetadata(
        source,
        compressedFields,
        processingTime
      );

      // 10. Update global metrics
      this.updateMetrics(conversionMetadata);

      logger.info('Generic conversion completed', {
        processingTime: `${processingTime.toFixed(2)}ms`,
        fieldsProcessed: conversionMetadata.fieldsProcessed,
        fieldsCompressed: conversionMetadata.fieldsCompressed,
        compressionRatio: conversionMetadata.compressionRatio,
      });

      return {
        payload: finalPayload as unknown as InferQdrantPayload<TSource>,
        metadata: conversionMetadata,
      };
    } catch (error) {
      logger.error('Generic conversion failed', {
        error: error instanceof Error ? error.message : String(error),
        sourceType: this.detectSourceType(source),
      });
      throw error;
    }
  }

  /**
   * Convert with explicit type specification for better type safety
   */
  async convertTyped<TSource extends Record<string, any>, TTarget extends QdrantPayloadBase>(
    source: TSource,
    metadata: QdrantStorageMetadata,
    targetType: new () => TTarget,
    config?: ConversionConfig<TSource>
  ): Promise<ConversionResult<TTarget>> {
    const result = await this.convert(source, metadata, config);
    return result as unknown as ConversionResult<TTarget>;
  }

  /**
   * Validate source data for conversion compatibility
   */
  async validateSource<T extends Record<string, any>>(source: T): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!source || typeof source !== 'object') {
      errors.push('Source must be a non-null object');
      return { isValid: false, errors, warnings, suggestions };
    }

    if (Object.keys(source).length === 0) {
      warnings.push('Source object is empty');
    }

    // Use field analyzer for detailed validation
    const compatibility = this.fieldAnalyzer.validateQdrantCompatibility(source);
    errors.push(...compatibility.issues);
    suggestions.push(...compatibility.suggestions);

    // Check for required metadata fields
    const requiredFields = ['toolName', 'timestamp', 'projectId', 'region'];
    for (const field of requiredFields) {
      if (!(field in source)) {
        warnings.push(`Recommended field '${field}' not found in source`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Handle field-level compression based on analysis and configuration
   */
  private async handleFieldCompression<T extends Record<string, any>>(
    source: T,
    fieldAnalysis: any,
    compressionRules?: any
  ): Promise<Record<string, CompressibleField<any>>> {
    const compressedFields: Record<string, CompressibleField<any>> = {};

    // Determine fields to compress
    let fieldsToCompress: (keyof T)[] = [];

    if (compressionRules?.fields) {
      fieldsToCompress = compressionRules.fields;
    } else {
      // Use automatic detection
      const recommendations = this.fieldAnalyzer.generateCompressionRecommendations(fieldAnalysis);
      fieldsToCompress = [...recommendations.recommended, ...recommendations.optional];
    }

    // Compress each field
    for (const fieldName of fieldsToCompress) {
      if (fieldName in source) {
        const fieldValue = source[fieldName];
        const compressed = await this.compressionService.compressIfNeeded(fieldValue);

        compressedFields[String(fieldName)] = {
          data: compressed.data,
          isCompressed: compressed.isCompressed,
          compressionType: compressed.compressionType,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
        };
      }
    }

    return compressedFields;
  }

  /**
   * Detect the source data type for automatic configuration
   */
  private detectSourceType(source: unknown): string {
    if (isQueryResultData(source)) {
      return 'QueryResultData';
    }
    if (isExtendedClusterData(source)) {
      return 'ExtendedClusterData';
    }
    if (isDataprocJob(source)) {
      return 'DataprocJob';
    }
    return 'Unknown';
  }

  /**
   * Calculate conversion metadata for result
   */
  private calculateConversionMetadata(
    source: Record<string, any>,
    compressedFields: Record<string, CompressibleField<any>>,
    processingTime: number
  ) {
    const fieldsProcessed = Object.keys(source).length;
    const fieldsCompressed = Object.values(compressedFields).filter((f) => f.isCompressed).length;

    const totalOriginalSize = Object.values(compressedFields).reduce(
      (sum, field) => sum + (field.originalSize || 0),
      0
    );

    const totalCompressedSize = Object.values(compressedFields).reduce(
      (sum, field) => sum + (field.compressedSize || field.originalSize || 0),
      0
    );

    const compressionRatio = totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1;

    return {
      fieldsProcessed,
      fieldsCompressed,
      totalOriginalSize,
      totalCompressedSize,
      compressionRatio,
      processingTime,
    };
  }

  /**
   * Update global conversion metrics
   */
  private updateMetrics(conversionMetadata: any): void {
    this.metrics.totalConversions++;

    // Update averages
    const totalTime =
      this.metrics.averageProcessingTime * (this.metrics.totalConversions - 1) +
      conversionMetadata.processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalConversions;

    const totalRatio =
      this.metrics.averageCompressionRatio * (this.metrics.totalConversions - 1) +
      conversionMetadata.compressionRatio;
    this.metrics.averageCompressionRatio = totalRatio / this.metrics.totalConversions;
  }

  /**
   * Get current conversion metrics
   */
  getMetrics(): ConversionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset conversion metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics object
   */
  private initializeMetrics(): ConversionMetrics {
    return {
      totalConversions: 0,
      averageProcessingTime: 0,
      averageCompressionRatio: 1,
      fieldCompressionStats: {},
    };
  }

  /**
   * Create conversion configuration for known types
   */
  async createConfigForType<T extends Record<string, any>>(
    source: T,
    type: 'query' | 'cluster' | 'job' | 'auto'
  ): Promise<ConversionConfig<T>> {
    const detectedType = type === 'auto' ? this.detectSourceType(source) : type;

    // Generate automatic field mappings
    const fieldMappings = this.transformationEngine.generateAutoFieldMappings(
      source,
      detectedType as any
    );

    // Generate compression recommendations
    const fieldAnalysis = await this.fieldAnalyzer.analyzeFields(source);
    const compressionRecommendations =
      this.fieldAnalyzer.generateCompressionRecommendations(fieldAnalysis);

    return {
      fieldMappings,
      compressionRules: {
        fields: compressionRecommendations.recommended,
        sizeThreshold: 10240, // 10KB
        compressionType: 'gzip',
      },
      transformations: this.getDefaultTransformationsForType(detectedType),
      metadata: {
        autoTimestamp: true,
        autoUUID: false,
      },
    };
  }

  /**
   * Get default transformations for specific types
   */
  private getDefaultTransformationsForType(type: string): any {
    switch (type) {
      case 'QueryResultData':
        return {
          totalRows: (value: any) => value || 0,
          timestamp: () => new Date().toISOString(),
        };
      case 'ExtendedClusterData':
        return {
          createTime: (value: any) => value || new Date().toISOString(),
          status: (value: any) => value || 'UNKNOWN',
        };
      case 'DataprocJob':
        return {
          submissionTime: (value: any) => value || new Date().toISOString(),
          status: (value: any) => value || 'UNKNOWN',
        };
      default:
        return {};
    }
  }
}

/**
 * Factory function to create a configured generic converter
 */
export function createGenericConverter(
  compressionService: CompressionService
): GenericQdrantConverter {
  return new GenericQdrantConverter(compressionService);
}

/**
 * Utility function for quick conversions with automatic configuration
 */
export async function quickConvert<TSource extends Record<string, any>>(
  source: TSource,
  metadata: QdrantStorageMetadata,
  compressionService: CompressionService
): Promise<ConversionResult<InferQdrantPayload<TSource>>> {
  const converter = createGenericConverter(compressionService);
  const config = await converter.createConfigForType(source, 'auto');
  return converter.convert(source, metadata, config);
}
