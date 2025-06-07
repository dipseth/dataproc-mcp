/**
 * Template Manager service for MCP Resource Templating
 * Handles template registration, discovery, validation, and caching
 */

import {
  TemplateDefinition,
  TemplateCacheEntry,
  TemplateManagerConfig,
  ValidationResult,
  ValidationError,
} from '../types/templating.js';
import { logger } from '../utils/logger.js';

/**
 * Default configuration for Template Manager
 */
const DEFAULT_CONFIG: TemplateManagerConfig = {
  cache: {
    maxEntries: 1000,
    ttlMs: 300000, // 5 minutes
    enableMetrics: true,
  },
  validation: {
    enableSecurity: true,
    strictMode: false,
    customValidators: true,
  },
  performance: {
    enableProfiling: true,
    maxResolutionTimeMs: 5000,
    enableCaching: true,
  },
};

/**
 * Template Manager class for managing URI templates
 */
export class TemplateManager {
  private config: TemplateManagerConfig;
  private templates: Map<string, TemplateDefinition> = new Map();
  private templateCache: Map<string, TemplateCacheEntry> = new Map();
  private templateHierarchy: Map<string, string[]> = new Map(); // templateId -> parent chain
  private metrics: {
    cacheHits: number;
    cacheMisses: number;
    registrations: number;
    validations: number;
  } = {
    cacheHits: 0,
    cacheMisses: 0,
    registrations: 0,
    validations: 0,
  };

  constructor(config?: Partial<TemplateManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates based on the architecture design
   */
  private initializeDefaultTemplates(): void {
    // Core GCP templates
    this.registerTemplate({
      id: 'gcp-base',
      pattern: 'dataproc://gcp/{projectId}/{region}',
      description: 'Base GCP resource template with project and region',
      category: 'gcp',
      parameters: [
        {
          name: 'projectId',
          type: 'string',
          required: true,
          source: 'gcp',
          description: 'GCP project identifier',
          validation: {
            pattern: '^[a-z][a-z0-9-]{4,28}[a-z0-9]$',
          },
        },
        {
          name: 'region',
          type: 'string',
          required: true,
          source: 'gcp',
          description: 'GCP region identifier',
          validation: {
            pattern: '^[a-z]+-[a-z]+[0-9]+$',
          },
        },
      ],
      queryParameters: [
        {
          name: 'verbose',
          type: 'boolean',
          expansion: 'form',
          required: false,
          defaultValue: false,
          description: 'Enable verbose output',
        },
      ],
    });

    // Cluster operation templates
    this.registerTemplate({
      id: 'gcp-cluster',
      pattern: 'dataproc://gcp/{projectId}/{region}/cluster/{clusterName}',
      description: 'GCP cluster resource template',
      category: 'cluster',
      parentTemplate: 'gcp-base',
      parameters: [
        {
          name: 'clusterName',
          type: 'string',
          required: true,
          source: 'tool',
          description: 'Dataproc cluster name',
          validation: {
            pattern: '^[a-z]([a-z0-9-]*[a-z0-9])?$',
            min: 1,
            max: 54,
          },
        },
      ],
      queryParameters: [
        {
          name: 'semanticQuery',
          type: 'string',
          expansion: 'form',
          required: false,
          description: 'Semantic query for cluster data',
        },
      ],
    });

    // Job operation templates
    this.registerTemplate({
      id: 'gcp-job',
      pattern: 'dataproc://gcp/{projectId}/{region}/job/{jobId}',
      description: 'GCP job resource template',
      category: 'job',
      parentTemplate: 'gcp-base',
      parameters: [
        {
          name: 'jobId',
          type: 'string',
          required: true,
          source: 'tool',
          description: 'Dataproc job identifier',
          validation: {
            pattern: '^[a-zA-Z0-9_-]+$',
          },
        },
      ],
      queryParameters: [
        {
          name: 'maxResults',
          type: 'number',
          expansion: 'form',
          required: false,
          defaultValue: 10,
          description: 'Maximum number of results to return',
        },
        {
          name: 'pageToken',
          type: 'string',
          expansion: 'form',
          required: false,
          description: 'Page token for pagination',
        },
      ],
    });

    // Knowledge base templates
    this.registerTemplate({
      id: 'knowledge-base',
      pattern: 'dataproc://knowledge/{type}',
      description: 'Knowledge base resource template',
      category: 'knowledge',
      parameters: [
        {
          name: 'type',
          type: 'string',
          required: true,
          source: 'tool',
          description: 'Knowledge base type',
          validation: {
            enum: ['clusters', 'jobs', 'errors', 'all'],
          },
        },
      ],
      queryParameters: [
        {
          name: 'query',
          type: 'string',
          expansion: 'form',
          required: true,
          description: 'Search query',
        },
        {
          name: 'limit',
          type: 'number',
          expansion: 'form',
          required: false,
          defaultValue: 10,
          description: 'Maximum number of results',
        },
        {
          name: 'includeRawDocument',
          type: 'boolean',
          expansion: 'form',
          required: false,
          defaultValue: false,
          description: 'Include raw document in response',
        },
      ],
    });

    // Profile templates
    this.registerTemplate({
      id: 'profile',
      pattern: 'dataproc://profile/{category}/{profileName}',
      description: 'Profile resource template',
      category: 'profile',
      parameters: [
        {
          name: 'category',
          type: 'string',
          required: true,
          source: 'profile',
          description: 'Profile category',
          validation: {
            enum: ['development', 'production', 'staging'],
          },
        },
        {
          name: 'profileName',
          type: 'string',
          required: true,
          source: 'profile',
          description: 'Profile name',
          validation: {
            pattern: '^[a-z][a-z0-9-]*[a-z0-9]$',
          },
        },
      ],
    });

    logger.info('Template Manager initialized with default templates');
  }

  /**
   * Register a new template
   */
  registerTemplate(template: TemplateDefinition): void {
    const validationResult = this.validateTemplate(template);
    if (!validationResult.valid) {
      throw new Error(
        `Template validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`
      );
    }

    this.templates.set(template.id, template);
    this.updateTemplateHierarchy(template);
    this.metrics.registrations++;

    logger.debug(`Registered template: ${template.id}`);
  }

  /**
   * Get a template by ID
   */
  getTemplate(templateId: string): TemplateDefinition | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): TemplateDefinition[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category);
  }

  /**
   * Resolve template by URI pattern matching
   */
  resolveTemplate(uri: string): TemplateDefinition | undefined {
    // Simple pattern matching - in production, this would use more sophisticated matching
    for (const template of this.templates.values()) {
      if (this.uriMatchesTemplate(uri, template.pattern)) {
        return template;
      }
    }
    return undefined;
  }

  /**
   * Get template hierarchy (parent chain)
   */
  getTemplateHierarchy(templateId: string): TemplateDefinition[] {
    const hierarchy: TemplateDefinition[] = [];
    const visited = new Set<string>();

    let currentId: string | undefined = templateId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const template = this.templates.get(currentId);

      if (template) {
        hierarchy.push(template);
        currentId = template.parentTemplate;
      } else {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Validate a template definition
   */
  validateTemplate(template: TemplateDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: any[] = [];

    this.metrics.validations++;

    // Basic validation
    if (!template.id) {
      errors.push({
        code: 'MISSING_ID',
        message: 'Template ID is required',
        severity: 'error',
      });
    }

    if (!template.pattern) {
      errors.push({
        code: 'MISSING_PATTERN',
        message: 'Template pattern is required',
        severity: 'error',
      });
    }

    // Pattern validation (basic RFC 6570 check)
    if (template.pattern && !this.isValidRFC6570Pattern(template.pattern)) {
      errors.push({
        code: 'INVALID_PATTERN',
        message: 'Template pattern is not valid RFC 6570 syntax',
        parameter: 'pattern',
        severity: 'error',
      });
    }

    // Parent template validation
    if (template.parentTemplate && !this.templates.has(template.parentTemplate)) {
      errors.push({
        code: 'INVALID_PARENT',
        message: `Parent template '${template.parentTemplate}' not found`,
        parameter: 'parentTemplate',
        severity: 'error',
      });
    }

    // Parameter validation
    for (const param of template.parameters) {
      if (!param.name) {
        errors.push({
          code: 'MISSING_PARAM_NAME',
          message: 'Parameter name is required',
          severity: 'error',
        });
      }

      if (!['string', 'number', 'boolean'].includes(param.type)) {
        errors.push({
          code: 'INVALID_PARAM_TYPE',
          message: `Invalid parameter type: ${param.type}`,
          parameter: param.name,
          severity: 'error',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get template cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    metrics: {
      cacheHits: number;
      cacheMisses: number;
      registrations: number;
      validations: number;
    };
  } {
    const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0;

    return {
      size: this.templateCache.size,
      hitRate,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
    logger.debug('Template cache cleared');
  }

  /**
   * Update template hierarchy mapping
   */
  private updateTemplateHierarchy(template: TemplateDefinition): void {
    const hierarchy = this.getTemplateHierarchy(template.id);
    this.templateHierarchy.set(
      template.id,
      hierarchy.map((t) => t.id)
    );
  }

  /**
   * Check if URI matches template pattern (simplified)
   */
  private uriMatchesTemplate(uri: string, pattern: string): boolean {
    // This is a simplified implementation
    // In production, this would use proper RFC 6570 matching
    const templateRegex = pattern.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${templateRegex}$`);
    return regex.test(uri);
  }

  /**
   * Basic RFC 6570 pattern validation
   */
  private isValidRFC6570Pattern(pattern: string): boolean {
    // Basic validation for RFC 6570 syntax
    const variableRegex =
      /\{([+#./;?&]?)([a-zA-Z_][a-zA-Z0-9_]*(?::[1-9][0-9]*)?(?:\*)?(?:,[a-zA-Z_][a-zA-Z0-9_]*(?::[1-9][0-9]*)?(?:\*)?)*)\}/g;

    // Remove all valid variables and check if any invalid syntax remains
    const withoutVariables = pattern.replace(variableRegex, '');

    // Check for unmatched braces
    const openBraces = (withoutVariables.match(/\{/g) || []).length;
    const closeBraces = (withoutVariables.match(/\}/g) || []).length;

    return openBraces === 0 && closeBraces === 0;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.templateCache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      if (age > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.templateCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}
