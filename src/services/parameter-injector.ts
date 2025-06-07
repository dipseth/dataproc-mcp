/**
 * Parameter Injector service for MCP Resource Templating
 * Implements parameter inheritance chain: GCP defaults → Profile → Template → Tool overrides
 * Enhanced with dynamic function resolution support
 */

import {
  ParameterInheritanceChain,
  ParameterSource,
  TemplateResolutionContext,
  ResolutionMetadata,
  ValidationResult,
  ValidationError,
  TemplateDefinition,
} from '../types/templating.js';
import { DynamicResolver } from './dynamic-resolver.js';
import { DynamicResolutionContext } from '../types/dynamic-templating.js';
import { DefaultParameterManager } from './default-params.js';
import { ProfileManager } from './profile.js';
import { logger } from '../utils/logger.js';

/**
 * Parameter Injector configuration
 */
interface ParameterInjectorConfig {
  validation: {
    enableStrictMode: boolean;
    allowUnknownParameters: boolean;
    validateTypes: boolean;
  };
  performance: {
    enableCaching: boolean;
    cacheTimeoutMs: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ParameterInjectorConfig = {
  validation: {
    enableStrictMode: false,
    allowUnknownParameters: true,
    validateTypes: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeoutMs: 60000, // 1 minute
  },
};

/**
 * Parameter set with metadata
 */
interface ParameterSet {
  resolved: Record<string, unknown>;
  sources: Record<string, ParameterSource>;
  validation: ValidationResult;
  metadata: ResolutionMetadata;
}

/**
 * Parameter Injector class for managing parameter inheritance
 */
export class ParameterInjector {
  private config: ParameterInjectorConfig;
  private defaultParameterManager?: DefaultParameterManager;
  private profileManager?: ProfileManager;
  private dynamicResolver?: DynamicResolver;
  private dynamicContext?: DynamicResolutionContext;
  private resolutionCache: Map<string, { result: ParameterSet; timestamp: Date }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    config?: Partial<ParameterInjectorConfig>,
    defaultParameterManager?: DefaultParameterManager,
    profileManager?: ProfileManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.defaultParameterManager = defaultParameterManager;
    this.profileManager = profileManager;

    // Initialize dynamic resolver
    this.dynamicResolver = new DynamicResolver({
      enableCaching: this.config.performance.enableCaching,
      defaultTtlMs: this.config.performance.cacheTimeoutMs,
    });

    // Start cache cleanup interval
    if (this.config.performance.enableCaching) {
      this.cleanupInterval = setInterval(() => this.cleanupCache(), 30000); // Every 30 seconds
    }
  }

  /**
   * Set dynamic resolution context (services needed for dynamic functions)
   */
  setDynamicContext(context: DynamicResolutionContext): void {
    this.dynamicContext = context;
    if (this.dynamicResolver) {
      this.dynamicResolver.setContext(context);
    }
    logger.debug('ParameterInjector: Dynamic context set');
  }

  /**
   * Inject parameters for a template with full inheritance chain
   * Enhanced with async dynamic function resolution
   */
  async injectParameters(
    template: TemplateDefinition,
    context: TemplateResolutionContext
  ): Promise<ParameterSet> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.createCacheKey(template.id, context);
    if (this.config.performance.enableCaching) {
      const cached = this.resolutionCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return {
          ...cached.result,
          metadata: {
            ...cached.result.metadata,
            performance: {
              ...cached.result.metadata.performance,
              cacheHit: true,
            },
          },
        };
      }
    }

    try {
      // Build inheritance chain
      const inheritanceChain = await this.resolveInheritanceChain(template.id, context);

      // Validate the final parameter set
      const validation = this.validateParameterSet(inheritanceChain.resolved, template);

      // Create resolution metadata
      const resolutionTimeMs = Date.now() - startTime;
      const metadata: ResolutionMetadata = {
        timestamp: new Date(),
        templateId: template.id,
        toolName: context.toolName,
        environment: context.environment,
        profileId: context.profileId,
        performance: {
          resolutionTimeMs,
          cacheHit: false,
          parameterCount: Object.keys(inheritanceChain.resolved).length,
        },
        validation,
      };

      const result: ParameterSet = {
        resolved: inheritanceChain.resolved,
        sources: inheritanceChain.sources,
        validation,
        metadata,
      };

      // Cache the result
      if (this.config.performance.enableCaching) {
        this.resolutionCache.set(cacheKey, {
          result,
          timestamp: new Date(),
        });
      }

      logger.debug(
        `Parameter injection completed for template ${template.id} (${resolutionTimeMs}ms)`
      );
      return result;
    } catch (error) {
      logger.error(`Parameter injection failed for template ${template.id}`, error);
      throw new Error(
        `Parameter injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolve the complete parameter inheritance chain
   */
  resolveInheritanceChain(
    templateId: string,
    context: TemplateResolutionContext
  ): ParameterInheritanceChain {
    // 1. Get GCP default parameters (lowest priority)
    const gcpDefaults = this.getGcpDefaultParameters(context.environment);

    // 2. Get profile parameters
    const profileParameters = this.getProfileParameters(context.profileId, context.environment);

    // 3. Get template parameters (from template definition)
    const templateParameters = this.getTemplateParameters(templateId);

    // 4. Apply tool overrides (highest priority)
    const toolOverrides = context.userOverrides;

    // Merge parameters with proper precedence
    const mergedSources = [
      { type: 'gcp' as const, params: gcpDefaults },
      { type: 'profile' as const, params: profileParameters },
      { type: 'template' as const, params: templateParameters },
      { type: 'tool' as const, params: toolOverrides },
    ];

    const resolved = this.mergeParameterSources(mergedSources);
    const sources = this.createSourceMapping(mergedSources, resolved);

    return {
      gcpDefaults,
      profileParameters,
      templateParameters,
      toolOverrides,
      resolved,
      sources,
      metadata: {
        timestamp: new Date(),
        templateId,
        toolName: context.toolName,
        environment: context.environment,
        profileId: context.profileId,
        performance: {
          resolutionTimeMs: 0, // Will be set by caller
          cacheHit: false,
          parameterCount: Object.keys(resolved).length,
        },
        validation: { valid: true, errors: [], warnings: [] }, // Will be set by caller
      },
    };
  }

  /**
   * Merge parameter sources with proper precedence
   */
  mergeParameterSources(
    sources: Array<{ type: string; params: Record<string, unknown> }>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Apply parameters in order of precedence (later sources override earlier ones)
    for (const source of sources) {
      Object.assign(merged, source.params);
    }

    return merged;
  }

  /**
   * Validate parameter set against template requirements
   */
  validateParameterSet(
    parameters: Record<string, unknown>,
    template: TemplateDefinition
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    // Check required parameters
    for (const paramDef of template.parameters) {
      if (paramDef.required && !(paramDef.name in parameters)) {
        errors.push({
          code: 'MISSING_REQUIRED_PARAMETER',
          message: `Required parameter '${paramDef.name}' is missing`,
          parameter: paramDef.name,
          severity: 'error',
        });
      }

      // Type validation
      if (this.config.validation.validateTypes && paramDef.name in parameters) {
        const value = parameters[paramDef.name];
        if (!this.validateParameterType(value, paramDef.type)) {
          errors.push({
            code: 'INVALID_PARAMETER_TYPE',
            message: `Parameter '${paramDef.name}' has invalid type. Expected ${paramDef.type}, got ${typeof value}`,
            parameter: paramDef.name,
            severity: 'error',
          });
        }
      }

      // Custom validation
      if (paramDef.validation && paramDef.name in parameters) {
        const value = parameters[paramDef.name];
        const validationErrors = this.validateParameterValue(
          value,
          paramDef.validation,
          paramDef.name
        );
        errors.push(...validationErrors);
      }
    }

    // Check for unknown parameters in strict mode
    if (this.config.validation.enableStrictMode && !this.config.validation.allowUnknownParameters) {
      const knownParams = new Set(template.parameters.map((p) => p.name));
      for (const paramName of Object.keys(parameters)) {
        if (!knownParams.has(paramName)) {
          warnings.push({
            code: 'UNKNOWN_PARAMETER',
            message: `Unknown parameter '${paramName}' provided`,
            parameter: paramName,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get GCP default parameters
   */
  private getGcpDefaultParameters(environment?: string): Record<string, unknown> {
    if (!this.defaultParameterManager) {
      return {};
    }

    try {
      return this.defaultParameterManager.getAllParameters(environment);
    } catch (error) {
      logger.warn('Failed to get GCP default parameters', error);
      return {};
    }
  }

  /**
   * Get profile parameters
   */
  private getProfileParameters(profileId?: string, _environment?: string): Record<string, unknown> {
    if (!this.profileManager || !profileId) {
      return {};
    }

    try {
      return this.profileManager.getProfileParameters(profileId);
    } catch (error) {
      logger.warn(`Failed to get profile parameters for ${profileId}`, error);
      return {};
    }
  }

  /**
   * Get template-specific parameters
   */
  private getTemplateParameters(_templateId: string): Record<string, unknown> {
    // Template parameters are typically default values defined in the template
    // This would be extended to load from template definitions
    return {};
  }

  /**
   * Create source mapping for parameters
   */
  private createSourceMapping(
    sources: Array<{ type: string; params: Record<string, unknown> }>,
    resolved: Record<string, unknown>
  ): Record<string, ParameterSource> {
    const sourceMapping: Record<string, ParameterSource> = {};

    // Track which source provided each parameter (last one wins)
    for (const source of sources) {
      for (const [paramName, value] of Object.entries(source.params)) {
        if (paramName in resolved) {
          sourceMapping[paramName] = {
            type: source.type as any,
            sourceId: source.type,
            originalValue: value,
            transformed: false,
          };
        }
      }
    }

    return sourceMapping;
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true; // Unknown types pass validation
    }
  }

  /**
   * Validate parameter value against validation rules
   */
  private validateParameterValue(
    value: unknown,
    validation: any,
    paramName: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value === 'string') {
      if (validation.min !== undefined && value.length < validation.min) {
        errors.push({
          code: 'VALUE_TOO_SHORT',
          message: `Parameter '${paramName}' is too short. Minimum length: ${validation.min}`,
          parameter: paramName,
          severity: 'error',
        });
      }

      if (validation.max !== undefined && value.length > validation.max) {
        errors.push({
          code: 'VALUE_TOO_LONG',
          message: `Parameter '${paramName}' is too long. Maximum length: ${validation.max}`,
          parameter: paramName,
          severity: 'error',
        });
      }

      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        errors.push({
          code: 'PATTERN_MISMATCH',
          message: `Parameter '${paramName}' does not match required pattern: ${validation.pattern}`,
          parameter: paramName,
          severity: 'error',
        });
      }
    }

    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          code: 'VALUE_TOO_SMALL',
          message: `Parameter '${paramName}' is too small. Minimum value: ${validation.min}`,
          parameter: paramName,
          severity: 'error',
        });
      }

      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          code: 'VALUE_TOO_LARGE',
          message: `Parameter '${paramName}' is too large. Maximum value: ${validation.max}`,
          parameter: paramName,
          severity: 'error',
        });
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        message: `Parameter '${paramName}' has invalid value. Allowed values: ${validation.enum.join(', ')}`,
        parameter: paramName,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Create cache key for parameter resolution
   */
  private createCacheKey(templateId: string, context: TemplateResolutionContext): string {
    const keyParts = [
      templateId,
      context.toolName,
      context.environment || 'default',
      context.profileId || 'none',
      JSON.stringify(context.userOverrides),
    ];
    return keyParts.join('|');
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: { result: ParameterSet; timestamp: Date }): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age < this.config.performance.cacheTimeoutMs;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    for (const [key, entry] of this.resolutionCache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.resolutionCache.delete(key);
      }
    }
  }

  /**
   * Graceful shutdown - cleanup intervals and resources
   */
  async shutdown(): Promise<void> {
    logger.info('ParameterInjector: Initiating graceful shutdown');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug('ParameterInjector: Cleanup interval stopped');
    }

    // Clear cache
    this.resolutionCache.clear();

    logger.info('ParameterInjector: Shutdown complete');
  }
  /**
   * Get injector metrics
   */
  getMetrics(): {
    cacheSize: number;
    cacheHitRate: number;
  } {
    return {
      cacheSize: this.resolutionCache.size,
      cacheHitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }

  /**
   * Clear parameter resolution cache
   */
  clearCache(): void {
    this.resolutionCache.clear();
    logger.debug('Parameter injector cache cleared');
  }
}
