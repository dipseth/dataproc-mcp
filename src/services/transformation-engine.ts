/**
 * Transformation Engine
 * Handles field mapping, transformations, and metadata injection for generic conversions
 */

import {
  FieldTransformations,
  MetadataInjectionRules,
  CompressibleField,
} from '../types/generic-converter.js';
import { QdrantStorageMetadata } from '../types/response-filter.js';
import { QdrantPayloadBase } from '../types/qdrant-payload.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Engine for applying field transformations and mappings
 */
export class TransformationEngine {
  /**
   * Apply field mappings to transform source fields to target structure
   */
  applyFieldMappings<TSource extends Record<string, any>, TTarget extends Record<string, any>>(
    source: TSource,
    fieldMappings?: Partial<Record<keyof TSource, string>>
  ): Partial<TTarget> {
    const result: any = {};

    for (const [sourceKey, sourceValue] of Object.entries(source)) {
      const typedSourceKey = sourceKey as keyof TSource;

      // Use mapped field name if provided, otherwise use original key
      const targetKey = fieldMappings?.[typedSourceKey] || sourceKey;

      result[targetKey] = sourceValue;
    }

    logger.debug('Applied field mappings', {
      sourceFields: Object.keys(source).length,
      mappedFields: fieldMappings ? Object.keys(fieldMappings).length : 0,
      resultFields: Object.keys(result).length,
    });

    return result;
  }

  /**
   * Apply field transformations to modify field values
   */
  applyTransformations<TSource extends Record<string, any>>(
    source: TSource,
    transformations?: FieldTransformations<TSource>
  ): TSource {
    if (!transformations) {
      return source;
    }

    const result = { ...source };
    let transformedCount = 0;

    for (const [fieldName, transformer] of Object.entries(transformations)) {
      const typedFieldName = fieldName as keyof TSource;

      if (typedFieldName in result && typeof transformer === 'function') {
        try {
          const originalValue = result[typedFieldName];
          const transformedValue = transformer(originalValue);
          result[typedFieldName] = transformedValue;
          transformedCount++;

          logger.debug(`Transformed field '${String(fieldName)}'`, {
            originalType: typeof originalValue,
            transformedType: typeof transformedValue,
          });
        } catch (error) {
          logger.warn(`Failed to transform field '${String(fieldName)}'`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.debug('Applied field transformations', {
      totalFields: Object.keys(source).length,
      transformedFields: transformedCount,
    });

    return result;
  }

  /**
   * Inject metadata fields into the payload
   */
  injectMetadata<T extends Record<string, any>>(
    payload: T,
    baseMetadata: QdrantStorageMetadata,
    metadataRules?: MetadataInjectionRules
  ): T & QdrantPayloadBase {
    const result = {
      ...payload,
      ...baseMetadata,
      storedAt: new Date().toISOString(),
    } as T & QdrantPayloadBase;

    // Apply metadata injection rules
    if (metadataRules) {
      if (metadataRules.autoTimestamp) {
        result.timestamp = new Date().toISOString();
      }

      if (metadataRules.autoUUID && !result.id) {
        (result as any).id = uuidv4();
      }

      if (metadataRules.customFields) {
        for (const [fieldName, generator] of Object.entries(metadataRules.customFields)) {
          try {
            (result as any)[fieldName] = generator();
          } catch (error) {
            logger.warn(`Failed to generate custom field '${fieldName}'`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    logger.debug('Injected metadata', {
      baseFields: Object.keys(baseMetadata).length,
      customFields: metadataRules?.customFields
        ? Object.keys(metadataRules.customFields).length
        : 0,
      autoTimestamp: metadataRules?.autoTimestamp || false,
      autoUUID: metadataRules?.autoUUID || false,
    });

    return result;
  }

  /**
   * Merge compressed fields back into the payload structure
   */
  mergeCompressedFields<T extends Record<string, any>>(
    basePayload: T,
    compressedFields: Record<string, CompressibleField<any>>
  ): T {
    const result = { ...basePayload };

    for (const [fieldName, compressedField] of Object.entries(compressedFields)) {
      (result as any)[fieldName] = compressedField.data;

      // Add compression metadata if field was compressed
      if (compressedField.isCompressed) {
        (result as any)[`${fieldName}_isCompressed`] = compressedField.isCompressed;
        (result as any)[`${fieldName}_compressionType`] = compressedField.compressionType;
        (result as any)[`${fieldName}_originalSize`] = compressedField.originalSize;
        (result as any)[`${fieldName}_compressedSize`] = compressedField.compressedSize;
      }
    }

    logger.debug('Merged compressed fields', {
      totalFields: Object.keys(compressedFields).length,
      compressedFields: Object.values(compressedFields).filter((f) => f.isCompressed).length,
    });

    return result;
  }

  /**
   * Apply default value transformations for common field patterns
   */
  applyDefaultTransformations<T extends Record<string, any>>(source: T): T {
    const result = { ...source };

    // Apply common transformations
    for (const [key, value] of Object.entries(result)) {
      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        (result as any)[key] = value.toISOString();
      }

      // Ensure numeric fields are properly typed
      else if (typeof value === 'string' && this.isNumericString(value)) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          (result as any)[key] = numValue;
        }
      }

      // Convert undefined to null for JSON compatibility
      else if (value === undefined) {
        (result as any)[key] = null;
      }

      // Handle empty arrays and objects
      else if (Array.isArray(value) && value.length === 0) {
        // Keep empty arrays as-is, but log for potential optimization
        logger.debug(`Empty array found for field '${key}'`);
      } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
        // Keep empty objects as-is, but log for potential optimization
        logger.debug(`Empty object found for field '${key}'`);
      }
    }

    return result;
  }

  /**
   * Validate field mappings for type safety
   */
  validateFieldMappings<TSource extends Record<string, any>>(
    source: TSource,
    fieldMappings: Partial<Record<keyof TSource, string>>
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [sourceField, targetField] of Object.entries(fieldMappings)) {
      // Check if source field exists
      if (!(sourceField in source)) {
        warnings.push(`Source field '${sourceField}' not found in source object`);
      }

      // Check for valid target field names
      if (typeof targetField !== 'string' || targetField.trim() === '') {
        errors.push(`Invalid target field name for '${sourceField}': '${targetField}'`);
      }

      // Check for reserved field names
      const reservedFields = ['id', 'vector', 'payload'];
      if (typeof targetField === 'string' && reservedFields.includes(targetField)) {
        warnings.push(`Target field '${targetField}' is a reserved Qdrant field name`);
      }
    }

    // Check for duplicate target field names
    const targetFields = Object.values(fieldMappings).filter(Boolean);
    const uniqueTargetFields = new Set(targetFields);
    if (targetFields.length !== uniqueTargetFields.size) {
      errors.push('Duplicate target field names detected in field mappings');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate automatic field mappings based on common patterns
   */
  generateAutoFieldMappings<T extends Record<string, any>>(
    source: T,
    targetType: 'query' | 'cluster' | 'job' | 'generic'
  ): Partial<Record<keyof T, string>> {
    const mappings: Partial<Record<keyof T, string>> = {};

    for (const key of Object.keys(source)) {
      const typedKey = key as keyof T;
      const keyLower = key.toLowerCase();

      switch (targetType) {
        case 'query':
          if (keyLower.includes('total') && keyLower.includes('row')) {
            mappings[typedKey] = 'totalRows';
          } else if (keyLower.includes('result') || keyLower.includes('row')) {
            mappings[typedKey] = 'rows';
          } else if (keyLower.includes('schema') || keyLower.includes('field')) {
            mappings[typedKey] = 'schema';
          }
          break;

        case 'cluster':
          if (keyLower.includes('config')) {
            mappings[typedKey] = 'clusterConfig';
          } else if (keyLower.includes('machine') || keyLower.includes('instance')) {
            mappings[typedKey] = 'machineTypes';
          } else if (keyLower.includes('network')) {
            mappings[typedKey] = 'networkConfig';
          } else if (keyLower.includes('software')) {
            mappings[typedKey] = 'softwareConfig';
          }
          break;

        case 'job':
          if (keyLower.includes('result')) {
            mappings[typedKey] = 'results';
          } else if (keyLower.includes('type')) {
            mappings[typedKey] = 'jobType';
          } else if (keyLower.includes('status') || keyLower.includes('state')) {
            mappings[typedKey] = 'status';
          } else if (keyLower.includes('time') && keyLower.includes('submit')) {
            mappings[typedKey] = 'submissionTime';
          }
          break;

        case 'generic':
        default:
          // For generic mappings, use snake_case to camelCase conversion
          if (key.includes('_')) {
            mappings[typedKey] = this.toCamelCase(key);
          }
          break;
      }
    }

    logger.debug('Generated automatic field mappings', {
      targetType,
      sourceFields: Object.keys(source).length,
      generatedMappings: Object.keys(mappings).length,
    });

    return mappings;
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Check if a string represents a numeric value
   */
  private isNumericString(str: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(str.trim());
  }

  /**
   * Deep clone an object to avoid mutation
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }
}
