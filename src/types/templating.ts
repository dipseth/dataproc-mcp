/**
 * Core types for MCP Resource Templating Infrastructure
 * Implements RFC 6570 URI templating with parameter inheritance chains
 */

/**
 * Template definition interface for URI templates
 */
export interface TemplateDefinition {
  /** Unique identifier for the template */
  id: string;

  /** RFC 6570 URI template pattern */
  pattern: string;

  /** Human-readable description */
  description: string;

  /** Template category for organization */
  category: 'gcp' | 'cluster' | 'job' | 'knowledge' | 'profile';

  /** Parent template ID for inheritance */
  parentTemplate?: string;

  /** Template-specific parameters */
  parameters: TemplateParameter[];

  /** Query parameters with RFC 6570 expansion */
  queryParameters?: QueryParameter[];

  /** Template validation rules */
  validation?: TemplateValidation;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  /** Parameter name */
  name: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean';

  /** Whether parameter is required */
  required: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Parameter source in inheritance chain */
  source: 'gcp' | 'profile' | 'template' | 'tool';

  /** Parameter validation rules */
  validation?: ParameterValidation;

  /** Human-readable description */
  description?: string;
}

/**
 * Query parameter definition for RFC 6570 expansion
 */
export interface QueryParameter {
  /** Parameter name */
  name: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'array';

  /** RFC 6570 expansion type */
  expansion: 'simple' | 'form' | 'reserved';

  /** Whether parameter is required */
  required: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Human-readable description */
  description?: string;
}

/**
 * Template validation rules
 */
export interface TemplateValidation {
  /** Required parameters that must be present */
  requiredParameters?: string[];

  /** Parameter constraints */
  parameterConstraints?: Record<string, ParameterValidation>;

  /** Security validation rules */
  securityRules?: SecurityValidation[];

  /** Custom validation function */
  customValidator?: (context: TemplateResolutionContext) => ValidationResult;
}

/**
 * Parameter validation rules
 */
export interface ParameterValidation {
  /** Minimum value (for numbers) or length (for strings) */
  min?: number;

  /** Maximum value (for numbers) or length (for strings) */
  max?: number;

  /** Regular expression pattern (for strings) */
  pattern?: string;

  /** Allowed values (enum) */
  enum?: unknown[];

  /** Custom validation function */
  customValidator?: (value: unknown) => boolean;
}

/**
 * Security validation rules
 */
export interface SecurityValidation {
  /** Rule type */
  type: 'pattern' | 'blacklist' | 'whitelist' | 'custom';

  /** Rule pattern or values */
  rule: string | string[] | ((value: string) => boolean);

  /** Error message if validation fails */
  message: string;
}

/**
 * Template resolution context
 */
export interface TemplateResolutionContext {
  /** Template being resolved */
  templateId: string;

  /** Tool requesting the resolution */
  toolName: string;

  /** Current environment */
  environment?: string;

  /** Profile ID if applicable */
  profileId?: string;

  /** User-provided parameter overrides */
  userOverrides: Record<string, unknown>;

  /** Security context for validation */
  securityContext: SecurityContext;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Security context for template resolution
 */
export interface SecurityContext {
  /** User or service account identifier */
  userId?: string;

  /** Request source information */
  source: 'mcp' | 'api' | 'internal';

  /** Rate limiting information */
  rateLimiting?: {
    requestCount: number;
    windowStart: Date;
  };

  /** Additional security metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameter inheritance chain definition
 */
export interface ParameterInheritanceChain {
  /** GCP default parameters (lowest priority) */
  gcpDefaults: Record<string, unknown>;

  /** Profile parameters */
  profileParameters: Record<string, unknown>;

  /** Template parameters */
  templateParameters: Record<string, unknown>;

  /** Tool override parameters (highest priority) */
  toolOverrides: Record<string, unknown>;

  /** Final resolved parameters */
  resolved: Record<string, unknown>;

  /** Parameter source mapping */
  sources: Record<string, ParameterSource>;

  /** Resolution metadata */
  metadata: ResolutionMetadata;
}

/**
 * Parameter source information
 */
export interface ParameterSource {
  /** Source type */
  type: 'gcp' | 'profile' | 'template' | 'tool';

  /** Source identifier */
  sourceId: string;

  /** Original value before any transformations */
  originalValue: unknown;

  /** Whether value was transformed */
  transformed: boolean;

  /** Transformation applied if any */
  transformation?: string;
}

/**
 * Resolution metadata
 */
export interface ResolutionMetadata {
  /** Resolution timestamp */
  timestamp: Date;

  /** Template used for resolution */
  templateId: string;

  /** Tool that requested resolution */
  toolName: string;

  /** Environment used */
  environment?: string;

  /** Profile used */
  profileId?: string;

  /** Resolution performance metrics */
  performance: {
    resolutionTimeMs: number;
    cacheHit: boolean;
    parameterCount: number;
  };

  /** Validation results */
  validation: ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors if any */
  errors: ValidationError[];

  /** Validation warnings if any */
  warnings: ValidationWarning[];

  /** Validation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Parameter that caused the error */
  parameter?: string;

  /** Error severity */
  severity: 'error' | 'critical';

  /** Additional error context */
  context?: Record<string, unknown>;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Parameter that caused the warning */
  parameter?: string;

  /** Additional warning context */
  context?: Record<string, unknown>;
}

/**
 * Parsed template structure
 */
export interface ParsedTemplate {
  /** Original template pattern */
  pattern: string;

  /** Extracted variables */
  variables: TemplateVariable[];

  /** Query parameters */
  queryParameters: TemplateVariable[];

  /** Template compilation result */
  compiled: unknown; // Will be the compiled template from uri-templates library

  /** Parsing metadata */
  metadata: {
    parseTimeMs: number;
    variableCount: number;
    queryParameterCount: number;
    rfc6570Level: 1 | 2 | 3 | 4;
  };
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;

  /** Variable type based on RFC 6570 expansion */
  type: 'simple' | 'reserved' | 'fragment' | 'label' | 'path' | 'query' | 'form';

  /** Whether variable is required */
  required: boolean;

  /** Variable modifiers (explode, prefix) */
  modifiers?: {
    explode?: boolean;
    prefix?: number;
  };

  /** Variable position in template */
  position: number;
}

/**
 * Template expansion result
 */
export interface TemplateExpansionResult {
  /** Expanded URI */
  uri: string;

  /** Parameters used in expansion */
  parameters: Record<string, unknown>;

  /** Unused parameters */
  unusedParameters: Record<string, unknown>;

  /** Expansion metadata */
  metadata: {
    expansionTimeMs: number;
    templateId: string;
    cacheHit: boolean;
  };
}

/**
 * Template cache entry
 */
export interface TemplateCacheEntry {
  /** Cached parsed template */
  parsedTemplate: ParsedTemplate;

  /** Cache timestamp */
  timestamp: Date;

  /** Cache hit count */
  hitCount: number;

  /** Last access time */
  lastAccess: Date;

  /** Cache entry TTL */
  ttl: number;
}

/**
 * Template manager configuration
 */
export interface TemplateManagerConfig {
  /** Cache configuration */
  cache: {
    maxEntries: number;
    ttlMs: number;
    enableMetrics: boolean;
  };

  /** Validation configuration */
  validation: {
    enableSecurity: boolean;
    strictMode: boolean;
    customValidators: boolean;
  };

  /** Performance configuration */
  performance: {
    enableProfiling: boolean;
    maxResolutionTimeMs: number;
    enableCaching: boolean;
  };
}
