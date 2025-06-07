/**
 * Template Resolver service for MCP Resource Templating
 * Implements RFC 6570 Level 4 URI template expansion with caching
 */

import UriTemplate from 'uri-templates';
import {
  ParsedTemplate,
  TemplateVariable,
  TemplateExpansionResult,
  TemplateCacheEntry,
  ValidationResult,
  ValidationError,
} from '../types/templating.js';
import { logger } from '../utils/logger.js';

/**
 * Template Resolver configuration
 */
interface TemplateResolverConfig {
  cache: {
    maxEntries: number;
    ttlMs: number;
    enableMetrics: boolean;
  };
  performance: {
    enableProfiling: boolean;
    maxExpansionTimeMs: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TemplateResolverConfig = {
  cache: {
    maxEntries: 500,
    ttlMs: 300000, // 5 minutes
    enableMetrics: true,
  },
  performance: {
    enableProfiling: true,
    maxExpansionTimeMs: 2000,
  },
};

/**
 * Template Resolver class for RFC 6570 URI template processing
 */
export class TemplateResolver {
  private config: TemplateResolverConfig;
  private parseCache: Map<string, TemplateCacheEntry> = new Map();
  private expansionCache: Map<string, { result: TemplateExpansionResult; timestamp: Date }> =
    new Map();
  private metrics: {
    parseHits: number;
    parseMisses: number;
    expansionHits: number;
    expansionMisses: number;
    totalParses: number;
    totalExpansions: number;
  } = {
    parseHits: 0,
    parseMisses: 0,
    expansionHits: 0,
    expansionMisses: 0,
    totalParses: 0,
    totalExpansions: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<TemplateResolverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start cache cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupCaches(), 60000); // Every minute
  }

  /**
   * Parse a URI template string into a structured format
   */
  parseTemplate(templateUri: string): ParsedTemplate {
    const startTime = Date.now();
    this.metrics.totalParses++;

    // Check cache first
    const cacheKey = templateUri;
    const cached = this.parseCache.get(cacheKey);

    if (cached && this.isCacheEntryValid(cached)) {
      this.metrics.parseHits++;
      cached.hitCount++;
      cached.lastAccess = new Date();
      return cached.parsedTemplate;
    }

    this.metrics.parseMisses++;

    try {
      // Parse using uri-templates library
      const compiled = UriTemplate(templateUri);

      // Extract variables from the template
      const variables = this.extractVariables(templateUri);
      const queryParameters = this.extractQueryParameters(templateUri);

      // Determine RFC 6570 level
      const rfc6570Level = this.determineRFC6570Level(templateUri);

      const parseTimeMs = Date.now() - startTime;

      const parsedTemplate: ParsedTemplate = {
        pattern: templateUri,
        variables,
        queryParameters,
        compiled,
        metadata: {
          parseTimeMs,
          variableCount: variables.length,
          queryParameterCount: queryParameters.length,
          rfc6570Level,
        },
      };

      // Cache the result
      if (this.config.cache.enableMetrics) {
        this.parseCache.set(cacheKey, {
          parsedTemplate,
          timestamp: new Date(),
          hitCount: 0,
          lastAccess: new Date(),
          ttl: this.config.cache.ttlMs,
        });
      }

      logger.debug(`Parsed template: ${templateUri} (${parseTimeMs}ms)`);
      return parsedTemplate;
    } catch (error) {
      logger.error(`Failed to parse template: ${templateUri}`, error);
      throw new Error(
        `Template parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Expand a parsed template with parameter values
   */
  expandTemplate(
    template: ParsedTemplate,
    parameters: Record<string, unknown>
  ): TemplateExpansionResult {
    const startTime = Date.now();
    this.metrics.totalExpansions++;

    // Create cache key from template and parameters
    const cacheKey = this.createExpansionCacheKey(template.pattern, parameters);
    const cached = this.expansionCache.get(cacheKey);

    if (cached && this.isExpansionCacheValid(cached)) {
      this.metrics.expansionHits++;
      return {
        ...cached.result,
        metadata: {
          ...cached.result.metadata,
          cacheHit: true,
        },
      };
    }

    this.metrics.expansionMisses++;

    try {
      // Validate parameters against template variables
      const validationResult = this.validateParameters(template, parameters);
      if (!validationResult.valid) {
        throw new Error(
          `Parameter validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
        );
      }

      // Expand the template
      const uri = (template.compiled as any).fill(parameters);

      // Identify unused parameters
      const usedParameters: Record<string, unknown> = {};
      const unusedParameters: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(parameters)) {
        const isUsed =
          template.variables.some((v) => v.name === key) ||
          template.queryParameters.some((q) => q.name === key);

        if (isUsed) {
          usedParameters[key] = value;
        } else {
          unusedParameters[key] = value;
        }
      }

      const expansionTimeMs = Date.now() - startTime;

      const result: TemplateExpansionResult = {
        uri,
        parameters: usedParameters,
        unusedParameters,
        metadata: {
          expansionTimeMs,
          templateId: template.pattern,
          cacheHit: false,
        },
      };

      // Cache the result
      this.expansionCache.set(cacheKey, {
        result,
        timestamp: new Date(),
      });

      logger.debug(`Expanded template: ${template.pattern} -> ${uri} (${expansionTimeMs}ms)`);
      return result;
    } catch (error) {
      logger.error(`Failed to expand template: ${template.pattern}`, error);
      throw new Error(
        `Template expansion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract variables from a URI template
   */
  extractVariables(templateUri: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const variableRegex =
      /\{([+#./;?&]?)([a-zA-Z_][a-zA-Z0-9_]*(?::[1-9][0-9]*)?(?:\*)?(?:,[a-zA-Z_][a-zA-Z0-9_]*(?::[1-9][0-9]*)?(?:\*)?)*)\}/g;

    let match;
    let position = 0;

    while ((match = variableRegex.exec(templateUri)) !== null) {
      const [, operator, variableSpec] = match;
      const variableNames = variableSpec.split(',');

      for (const varName of variableNames) {
        const [name, modifier] = varName.split(':');
        const hasExplode = name.endsWith('*');
        const cleanName = hasExplode ? name.slice(0, -1) : name;

        variables.push({
          name: cleanName,
          type: this.getVariableType(operator),
          required: true, // Default to required, can be overridden by template definition
          modifiers: {
            explode: hasExplode,
            prefix: modifier ? parseInt(modifier) : undefined,
          },
          position: position++,
        });
      }
    }

    return variables;
  }

  /**
   * Extract query parameters from a URI template
   */
  extractQueryParameters(templateUri: string): TemplateVariable[] {
    const queryParams: TemplateVariable[] = [];
    const queryRegex = /\{[?&]([^}]+)\}/g;

    let match;
    let position = 0;

    while ((match = queryRegex.exec(templateUri)) !== null) {
      const [, paramSpec] = match;
      const paramNames = paramSpec.split(',');

      for (const paramName of paramNames) {
        const hasExplode = paramName.endsWith('*');
        const cleanName = hasExplode ? paramName.slice(0, -1) : paramName;

        queryParams.push({
          name: cleanName,
          type: 'query',
          required: false, // Query parameters are typically optional
          modifiers: {
            explode: hasExplode,
          },
          position: position++,
        });
      }
    }

    return queryParams;
  }

  /**
   * Validate parameters against template requirements
   */
  validateParameterExpansion(expanded: string, _template: ParsedTemplate): boolean {
    try {
      // Basic validation - check if the expanded URI is valid
      new URL(expanded);
      return true;
    } catch {
      // If it's not a valid URL, check if it's a valid URI pattern
      return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(expanded);
    }
  }

  /**
   * Get resolver performance metrics
   */
  getMetrics(): typeof this.metrics & {
    cacheStats: { parseCache: number; expansionCache: number };
  } {
    return {
      ...this.metrics,
      cacheStats: {
        parseCache: this.parseCache.size,
        expansionCache: this.expansionCache.size,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.parseCache.clear();
    this.expansionCache.clear();
    logger.debug('Template resolver caches cleared');
  }

  /**
   * Validate parameters against template variables
   */
  private validateParameters(
    template: ParsedTemplate,
    parameters: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required variables
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in parameters)) {
        errors.push({
          code: 'MISSING_REQUIRED_PARAMETER',
          message: `Required parameter '${variable.name}' is missing`,
          parameter: variable.name,
          severity: 'error',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Determine RFC 6570 level based on template syntax
   */
  private determineRFC6570Level(templateUri: string): 1 | 2 | 3 | 4 {
    if (templateUri.includes('{?') || templateUri.includes('{&')) {
      return 4; // Form-style query expansion
    }
    if (templateUri.includes('{+') || templateUri.includes('{#')) {
      return 2; // Reserved string expansion
    }
    if (templateUri.includes(',')) {
      return 3; // Multiple variable expansion
    }
    return 1; // Simple string expansion
  }

  /**
   * Get variable type based on RFC 6570 operator
   */
  private getVariableType(operator: string): TemplateVariable['type'] {
    switch (operator) {
      case '+':
        return 'reserved';
      case '#':
        return 'fragment';
      case '.':
        return 'label';
      case '/':
        return 'path';
      case ';':
        return 'path';
      case '?':
        return 'query';
      case '&':
        return 'form';
      default:
        return 'simple';
    }
  }

  /**
   * Create cache key for expansion results
   */
  private createExpansionCacheKey(pattern: string, parameters: Record<string, unknown>): string {
    const sortedParams = Object.keys(parameters)
      .sort()
      .map((key) => `${key}=${JSON.stringify(parameters[key])}`)
      .join('&');

    return `${pattern}?${sortedParams}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheEntryValid(entry: TemplateCacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < entry.ttl;
  }

  /**
   * Check if expansion cache entry is still valid
   */
  private isExpansionCacheValid(entry: {
    result: TemplateExpansionResult;
    timestamp: Date;
  }): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < this.config.cache.ttlMs;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCaches(): void {
    // Clean parse cache
    for (const [key, entry] of this.parseCache.entries()) {
      if (!this.isCacheEntryValid(entry)) {
        this.parseCache.delete(key);
      }
    }

    // Clean expansion cache
    for (const [key, entry] of this.expansionCache.entries()) {
      if (!this.isExpansionCacheValid(entry)) {
        this.expansionCache.delete(key);
      }
    }
  }

  /**
   * Graceful shutdown - cleanup intervals and resources
   */
  async shutdown(): Promise<void> {
    logger.info('TemplateResolver: Initiating graceful shutdown');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug('TemplateResolver: Cleanup interval stopped');
    }

    // Clear caches
    this.parseCache.clear();
    this.expansionCache.clear();

    logger.info('TemplateResolver: Shutdown complete');
  }
}
