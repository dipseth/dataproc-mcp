/**
 * Integration service for MCP Resource Templating
 * Bridges templating infrastructure with existing MCP resource handlers
 */

import {
  TemplateDefinition,
  TemplateResolutionContext,
  SecurityContext,
} from '../types/templating.js';
import { TemplateManager } from './template-manager.js';
import { TemplateResolver } from './template-resolver.js';
import { ParameterInjector } from './parameter-injector.js';
import { DefaultParameterManager } from './default-params.js';
import { ProfileManager } from './profile.js';
import { TEMPLATE_DEFINITIONS, getTemplatesForTool } from './template-definitions.js';
import { logger } from '../utils/logger.js';

/**
 * Templating integration configuration
 */
interface TemplatingIntegrationConfig {
  enableTemplating: boolean;
  fallbackToLegacy: boolean;
  enablePerformanceMetrics: boolean;
  enableCaching: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TemplatingIntegrationConfig = {
  enableTemplating: true,
  fallbackToLegacy: true,
  enablePerformanceMetrics: true,
  enableCaching: true,
};

/**
 * Resource resolution result
 */
interface ResourceResolutionResult {
  uri: string;
  parameters: Record<string, unknown>;
  templateUsed?: string;
  resolutionTimeMs: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
}

/**
 * Templating Integration service
 * Provides a unified interface for template-based resource resolution
 */
export class TemplatingIntegration {
  private config: TemplatingIntegrationConfig;
  private templateManager: TemplateManager;
  private templateResolver: TemplateResolver;
  private parameterInjector: ParameterInjector;
  private defaultParameterManager?: DefaultParameterManager;
  private profileManager?: ProfileManager;
  private initialized = false;

  constructor(
    config?: Partial<TemplatingIntegrationConfig>,
    defaultParameterManager?: DefaultParameterManager,
    profileManager?: ProfileManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.defaultParameterManager = defaultParameterManager;
    this.profileManager = profileManager;

    // Initialize core services
    this.templateManager = new TemplateManager({
      cache: {
        maxEntries: 1000,
        ttlMs: 300000,
        enableMetrics: this.config.enablePerformanceMetrics,
      },
      validation: {
        enableSecurity: true,
        strictMode: false,
        customValidators: true,
      },
      performance: {
        enableProfiling: this.config.enablePerformanceMetrics,
        maxResolutionTimeMs: 5000,
        enableCaching: this.config.enableCaching,
      },
    });

    this.templateResolver = new TemplateResolver({
      cache: {
        maxEntries: 500,
        ttlMs: 300000,
        enableMetrics: this.config.enablePerformanceMetrics,
      },
      performance: {
        enableProfiling: this.config.enablePerformanceMetrics,
        maxExpansionTimeMs: 2000,
      },
    });

    this.parameterInjector = new ParameterInjector(
      {
        validation: {
          enableStrictMode: false,
          allowUnknownParameters: true,
          validateTypes: true,
        },
        performance: {
          enableCaching: this.config.enableCaching,
          cacheTimeoutMs: 60000,
        },
      },
      this.defaultParameterManager,
      this.profileManager
    );
  }

  /**
   * Initialize the templating integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Register all template definitions
      for (const template of TEMPLATE_DEFINITIONS) {
        this.templateManager.registerTemplate(template);
      }

      this.initialized = true;
      logger.info('Templating integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize templating integration', error);
      throw error;
    }
  }

  /**
   * Resolve a resource URI using templates
   */
  async resolveResourceUri(
    toolName: string,
    parameters: Record<string, unknown>,
    options?: {
      environment?: string;
      profileId?: string;
      templateId?: string;
    }
  ): Promise<ResourceResolutionResult> {
    const startTime = Date.now();

    if (!this.config.enableTemplating) {
      return this.createFallbackResult(parameters, startTime);
    }

    try {
      // Get templates for the tool
      const templates = options?.templateId
        ? ([this.templateManager.getTemplate(options.templateId)].filter(
            Boolean
          ) as TemplateDefinition[])
        : getTemplatesForTool(toolName);

      if (templates.length === 0) {
        if (this.config.fallbackToLegacy) {
          logger.debug(`No templates found for tool ${toolName}, using fallback`);
          return this.createFallbackResult(parameters, startTime);
        }
        throw new Error(`No templates found for tool: ${toolName}`);
      }

      // Use the first template (could be enhanced to select best match)
      const template = templates[0];

      // Create resolution context
      const context: TemplateResolutionContext = {
        templateId: template.id,
        toolName,
        environment: options?.environment,
        profileId: options?.profileId,
        userOverrides: parameters,
        securityContext: this.createSecurityContext(),
      };

      // Inject parameters with inheritance chain
      const parameterSet = await this.parameterInjector.injectParameters(template, context);

      if (!parameterSet.validation.valid) {
        const errors = parameterSet.validation.errors.map((e) => e.message).join(', ');
        throw new Error(`Parameter validation failed: ${errors}`);
      }

      // Parse and expand template
      const parsedTemplate = this.templateResolver.parseTemplate(template.pattern);
      const expansionResult = this.templateResolver.expandTemplate(
        parsedTemplate,
        parameterSet.resolved
      );

      const resolutionTimeMs = Date.now() - startTime;

      return {
        uri: expansionResult.uri,
        parameters: parameterSet.resolved,
        templateUsed: template.id,
        resolutionTimeMs,
        cacheHit: parameterSet.metadata.performance.cacheHit || expansionResult.metadata.cacheHit,
        fallbackUsed: false,
      };
    } catch (error) {
      logger.error(`Template resolution failed for tool ${toolName}`, error);

      if (this.config.fallbackToLegacy) {
        logger.debug(`Falling back to legacy resolution for tool ${toolName}`);
        return this.createFallbackResult(parameters, startTime, true);
      }

      throw error;
    }
  }

  /**
   * Get available templates for a tool
   */
  getTemplatesForTool(toolName: string): TemplateDefinition[] {
    return getTemplatesForTool(toolName);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): TemplateDefinition | undefined {
    return this.templateManager.getTemplate(templateId);
  }

  /**
   * Get all templates by category
   */
  getTemplatesByCategory(category: string): TemplateDefinition[] {
    return this.templateManager.getTemplatesByCategory(category);
  }

  /**
   * Validate parameters against a template
   */
  validateParameters(
    templateId: string,
    parameters: Record<string, unknown>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const template = this.templateManager.getTemplate(templateId);
    if (!template) {
      return {
        valid: false,
        errors: [`Template not found: ${templateId}`],
        warnings: [],
      };
    }

    const validation = this.parameterInjector.validateParameterSet(parameters, template);

    return {
      valid: validation.valid,
      errors: validation.errors.map((e) => e.message),
      warnings: validation.warnings.map((w) => w.message),
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    templateManager: ReturnType<TemplateManager['getCacheStats']>;
    templateResolver: ReturnType<TemplateResolver['getMetrics']>;
    parameterInjector: ReturnType<ParameterInjector['getMetrics']>;
  } {
    return {
      templateManager: this.templateManager.getCacheStats(),
      templateResolver: this.templateResolver.getMetrics(),
      parameterInjector: this.parameterInjector.getMetrics(),
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.templateManager.clearCache();
    this.templateResolver.clearCaches();
    this.parameterInjector.clearCache();
    logger.debug('All templating caches cleared');
  }

  /**
   * Check if templating is enabled and initialized
   */
  isEnabled(): boolean {
    return this.config.enableTemplating && this.initialized;
  }

  /**
   * Create a security context for template resolution
   */
  private createSecurityContext(): SecurityContext {
    return {
      source: 'mcp',
      rateLimiting: {
        requestCount: 0,
        windowStart: new Date(),
      },
    };
  }

  /**
   * Create a fallback result when templating is not available
   */
  private createFallbackResult(
    parameters: Record<string, unknown>,
    startTime: number,
    _errorFallback = false
  ): ResourceResolutionResult {
    const resolutionTimeMs = Date.now() - startTime;

    // Generate a legacy-style URI (simplified)
    const uri = this.generateLegacyUri(parameters);

    return {
      uri,
      parameters,
      resolutionTimeMs,
      cacheHit: false,
      fallbackUsed: true,
    };
  }

  /**
   * Generate a legacy-style URI for fallback
   */
  private generateLegacyUri(parameters: Record<string, unknown>): string {
    // This is a simplified fallback - in practice, this would use the existing
    // resource handler logic from src/index.ts
    const { projectId, region, clusterName, jobId } = parameters;

    if (jobId) {
      return `dataproc://job/${projectId}/${region}/${jobId}`;
    }
    if (clusterName) {
      return `dataproc://cluster/${projectId}/${region}/${clusterName}`;
    }
    if (projectId && region) {
      return `dataproc://gcp/${projectId}/${region}`;
    }

    return 'dataproc://config/defaults';
  }

  /**
   * Enable or disable templating at runtime
   */
  setTemplatingEnabled(enabled: boolean): void {
    this.config.enableTemplating = enabled;
    logger.info(`Templating ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<TemplatingIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug('Templating integration configuration updated', config);
  }
}

/**
 * Global templating integration instance
 */
let templatingIntegration: TemplatingIntegration | undefined;

/**
 * Initialize global templating integration
 */
export async function initializeTemplatingIntegration(
  config?: Partial<TemplatingIntegrationConfig>,
  defaultParameterManager?: DefaultParameterManager,
  profileManager?: ProfileManager
): Promise<TemplatingIntegration> {
  if (!templatingIntegration) {
    templatingIntegration = new TemplatingIntegration(
      config,
      defaultParameterManager,
      profileManager
    );
    await templatingIntegration.initialize();
  }
  return templatingIntegration;
}

/**
 * Get global templating integration instance
 */
export function getTemplatingIntegration(): TemplatingIntegration | undefined {
  return templatingIntegration;
}

/**
 * Helper function for backward compatibility with existing resource handlers
 */
export async function resolveTemplatedResource(
  toolName: string,
  parameters: Record<string, unknown>,
  options?: {
    environment?: string;
    profileId?: string;
    templateId?: string;
  }
): Promise<string> {
  const integration = getTemplatingIntegration();

  if (!integration || !integration.isEnabled()) {
    // Fallback to legacy URI generation
    const fallbackIntegration = new TemplatingIntegration({ enableTemplating: false });
    const result = await fallbackIntegration.resolveResourceUri(toolName, parameters, options);
    return result.uri;
  }

  const result = await integration.resolveResourceUri(toolName, parameters, options);
  return result.uri;
}
