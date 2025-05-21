/**
 * Types for default parameter management
 */

/**
 * Environment-specific parameter configuration
 */
export interface EnvironmentParams {
  /**
   * Environment name (e.g., 'production', 'stable')
   */
  environment: string;

  /**
   * Parameter values specific to this environment
   */
  parameters: Record<string, any>;
}

/**
 * Parameter definition with validation rules
 */
export interface ParameterDefinition {
  /**
   * Parameter name
   */
  name: string;

  /**
   * Parameter description
   */
  description?: string;

  /**
   * Whether the parameter is required
   */
  required: boolean;

  /**
   * Default value for the parameter
   */
  defaultValue?: any;

  /**
   * Type of the parameter value
   */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  /**
   * Validation rules for the parameter
   */
  validation?: {
    /**
     * Minimum value for numbers
     */
    min?: number;

    /**
     * Maximum value for numbers
     */
    max?: number;

    /**
     * Regex pattern for strings
     */
    pattern?: string;

    /**
     * Allowed values for any type
     */
    enum?: any[];
  };
}

/**
 * Configuration for the default parameter manager
 */
export interface DefaultParameterManagerConfig {
  /**
   * Base parameter definitions
   */
  parameters: ParameterDefinition[];

  /**
   * Environment-specific parameter values
   */
  environments: EnvironmentParams[];

  /**
   * Default environment to use when none specified
   */
  defaultEnvironment: string;
}