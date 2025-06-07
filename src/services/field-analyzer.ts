/**
 * Field Analyzer Service
 * Automatic field detection and analysis for generic type conversion
 */

import { FieldAnalysisResult } from '../types/generic-converter.js';
import { logger } from '../utils/logger.js';

/**
 * Service for analyzing object fields and determining conversion strategies
 */
export class FieldAnalyzer {
  private readonly DEFAULT_SIZE_THRESHOLD = 10240; // 10KB
  private readonly ARRAY_SIZE_MULTIPLIER = 100; // Estimate array overhead

  /**
   * Analyze fields in a source object to determine conversion strategy
   */
  async analyzeFields<T extends Record<string, any>>(source: T): Promise<FieldAnalysisResult<T>> {
    const result: FieldAnalysisResult<T> = {
      compressibleFields: [],
      primitiveFields: [],
      objectFields: [],
      arrayFields: [],
      estimatedSizes: {} as Record<keyof T, number>,
    };

    for (const [key, value] of Object.entries(source)) {
      const typedKey = key as keyof T;
      const fieldType = this.getFieldType(value);
      const estimatedSize = this.estimateFieldSize(value);

      result.estimatedSizes[typedKey] = estimatedSize;

      switch (fieldType) {
        case 'primitive':
          result.primitiveFields.push(typedKey);
          break;
        case 'array':
          result.arrayFields.push(typedKey);
          if (estimatedSize > this.DEFAULT_SIZE_THRESHOLD) {
            result.compressibleFields.push(typedKey);
          }
          break;
        case 'object':
          result.objectFields.push(typedKey);
          if (estimatedSize > this.DEFAULT_SIZE_THRESHOLD) {
            result.compressibleFields.push(typedKey);
          }
          break;
      }
    }

    logger.debug(`Field analysis completed for object with ${Object.keys(source).length} fields`, {
      compressibleFields: result.compressibleFields.length,
      primitiveFields: result.primitiveFields.length,
      objectFields: result.objectFields.length,
      arrayFields: result.arrayFields.length,
    });

    return result;
  }

  /**
   * Determine the type category of a field value
   */
  private getFieldType(value: unknown): 'primitive' | 'array' | 'object' {
    if (value === null || value === undefined) {
      return 'primitive';
    }

    if (Array.isArray(value)) {
      return 'array';
    }

    if (typeof value === 'object') {
      return 'object';
    }

    return 'primitive';
  }

  /**
   * Estimate the serialized size of a field value
   */
  private estimateFieldSize(value: unknown): number {
    try {
      if (value === null || value === undefined) {
        return 4; // "null" or "undefined"
      }

      if (typeof value === 'string') {
        return value.length * 2; // UTF-16 encoding estimate
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return 8; // Rough estimate for JSON representation
      }

      if (Array.isArray(value)) {
        // Estimate array size with overhead
        const elementSizes = value.map((item) => this.estimateFieldSize(item));
        const totalElementSize = elementSizes.reduce((sum, size) => sum + size, 0);
        return totalElementSize + value.length * this.ARRAY_SIZE_MULTIPLIER;
      }

      if (typeof value === 'object') {
        // Estimate object size by JSON stringification
        const jsonString = JSON.stringify(value);
        return jsonString.length * 2; // UTF-16 encoding estimate
      }

      return 0;
    } catch (error) {
      logger.warn('Failed to estimate field size, using default', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.DEFAULT_SIZE_THRESHOLD; // Conservative estimate
    }
  }

  /**
   * Analyze nested object structure for deep field mapping
   */
  async analyzeNestedStructure<T extends Record<string, any>>(
    source: T,
    maxDepth: number = 3
  ): Promise<Map<string, FieldAnalysisResult<any>>> {
    const results = new Map<string, FieldAnalysisResult<any>>();

    await this.analyzeNestedRecursive(source, '', maxDepth, results);

    return results;
  }

  /**
   * Recursive helper for nested structure analysis
   */
  private async analyzeNestedRecursive(
    obj: any,
    path: string,
    depth: number,
    results: Map<string, FieldAnalysisResult<any>>
  ): Promise<void> {
    if (depth <= 0 || obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return;
    }

    const analysis = await this.analyzeFields(obj);
    results.set(path || 'root', analysis);

    // Analyze nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedPath = path ? `${path}.${key}` : key;
        await this.analyzeNestedRecursive(value, nestedPath, depth - 1, results);
      }
    }
  }

  /**
   * Generate compression recommendations based on field analysis
   */
  generateCompressionRecommendations<T extends Record<string, any>>(
    analysis: FieldAnalysisResult<T>,
    customThreshold?: number
  ): {
    recommended: (keyof T)[];
    optional: (keyof T)[];
    reasons: Record<keyof T, string>;
  } {
    const threshold = customThreshold || this.DEFAULT_SIZE_THRESHOLD;
    const recommended: (keyof T)[] = [];
    const optional: (keyof T)[] = [];
    const reasons: Record<keyof T, string> = {} as Record<keyof T, string>;

    for (const field of analysis.compressibleFields) {
      const size = analysis.estimatedSizes[field];

      if (size > threshold * 2) {
        recommended.push(field);
        reasons[field] =
          `Large field (${this.formatSize(size)}) - high compression benefit expected`;
      } else if (size > threshold) {
        optional.push(field);
        reasons[field] = `Medium field (${this.formatSize(size)}) - moderate compression benefit`;
      }
    }

    // Additional recommendations based on field types
    for (const field of analysis.arrayFields) {
      if (!recommended.includes(field) && !optional.includes(field)) {
        const size = analysis.estimatedSizes[field];
        if (size > threshold * 0.5) {
          optional.push(field);
          reasons[field] = `Array field (${this.formatSize(size)}) - arrays often compress well`;
        }
      }
    }

    return { recommended, optional, reasons };
  }

  /**
   * Detect field patterns for automatic mapping
   */
  detectFieldPatterns<T extends Record<string, any>>(
    source: T
  ): {
    idFields: (keyof T)[];
    timestampFields: (keyof T)[];
    configFields: (keyof T)[];
    dataFields: (keyof T)[];
  } {
    const patterns = {
      idFields: [] as (keyof T)[],
      timestampFields: [] as (keyof T)[],
      configFields: [] as (keyof T)[],
      dataFields: [] as (keyof T)[],
    };

    for (const [key, value] of Object.entries(source)) {
      const typedKey = key as keyof T;
      const keyLower = key.toLowerCase();

      // ID field patterns
      if (keyLower.includes('id') || keyLower.includes('uuid') || keyLower.includes('guid')) {
        patterns.idFields.push(typedKey);
      }

      // Timestamp field patterns
      if (
        keyLower.includes('time') ||
        keyLower.includes('date') ||
        keyLower.includes('timestamp')
      ) {
        patterns.timestampFields.push(typedKey);
      }

      // Configuration field patterns
      if (
        keyLower.includes('config') ||
        keyLower.includes('setting') ||
        keyLower.includes('option')
      ) {
        patterns.configFields.push(typedKey);
      }

      // Data field patterns (large objects/arrays)
      if (typeof value === 'object' && value !== null) {
        if (
          keyLower.includes('data') ||
          keyLower.includes('result') ||
          keyLower.includes('content')
        ) {
          patterns.dataFields.push(typedKey);
        }
      }
    }

    return patterns;
  }

  /**
   * Validate field compatibility with Qdrant payload structure
   */
  validateQdrantCompatibility<T extends Record<string, any>>(
    source: T
  ): {
    compatible: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for reserved Qdrant field names
    const reservedFields = ['id', 'vector', 'payload'];
    for (const field of reservedFields) {
      if (field in source) {
        issues.push(`Field '${field}' conflicts with Qdrant reserved field`);
        suggestions.push(`Consider renaming '${field}' to '${field}_data' or similar`);
      }
    }

    // Check for circular references
    try {
      JSON.stringify(source);
    } catch (error) {
      if (error instanceof Error && error.message.includes('circular')) {
        issues.push('Object contains circular references');
        suggestions.push('Remove circular references or implement custom serialization');
      }
    }

    // Check for unsupported data types
    this.checkUnsupportedTypes(source, '', issues, suggestions);

    return {
      compatible: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Recursively check for unsupported data types
   */
  private checkUnsupportedTypes(
    obj: any,
    path: string,
    issues: string[],
    suggestions: string[]
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'function') {
      issues.push(`Function found at ${path || 'root'} - functions cannot be serialized`);
      suggestions.push(`Remove function at ${path || 'root'} or convert to string representation`);
      return;
    }

    if (typeof obj === 'symbol') {
      issues.push(`Symbol found at ${path || 'root'} - symbols cannot be serialized`);
      suggestions.push(`Convert symbol at ${path || 'root'} to string representation`);
      return;
    }

    if (obj instanceof Date) {
      suggestions.push(`Date object at ${path || 'root'} - consider converting to ISO string`);
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const nestedPath = path ? `${path}.${key}` : key;
        this.checkUnsupportedTypes(value, nestedPath, issues, suggestions);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const nestedPath = path ? `${path}[${index}]` : `[${index}]`;
        this.checkUnsupportedTypes(item, nestedPath, issues, suggestions);
      });
    }
  }

  /**
   * Format byte size for human readability
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}
