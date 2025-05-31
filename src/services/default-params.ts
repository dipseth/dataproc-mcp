/**
 * Default Parameter Manager service
 * Handles loading and validating default parameters with environment-specific overrides
 */

import { DefaultParameterManagerConfig, ParameterDefinition } from '../types/default-params.js';

export class DefaultParameterManager {
  private config: DefaultParameterManagerConfig;
  private parameterDefinitions: Map<string, ParameterDefinition>;
  private environmentParams: Map<string, Record<string, unknown>>;

  constructor(config: DefaultParameterManagerConfig) {
    this.config = config;
    this.parameterDefinitions = new Map();
    this.environmentParams = new Map();
    this.initialize();
  }

  /**
   * Initialize the parameter manager
   * Sets up parameter definitions and environment-specific values
   */
  private initialize(): void {
    // Load parameter definitions
    for (const param of this.config.parameters) {
      this.parameterDefinitions.set(param.name, param);
    }

    // Load environment-specific parameters
    for (const env of this.config.environments) {
      this.environmentParams.set(env.environment, env.parameters);
    }
  }

  /**
   * Get a parameter value for a specific environment
   * @param paramName Name of the parameter
   * @param environment Optional environment name (uses default if not specified)
   * @returns Parameter value
   */
  getParameterValue(paramName: string, environment?: string): unknown {
    const paramDef = this.parameterDefinitions.get(paramName);
    if (!paramDef) {
      throw new Error(`Parameter ${paramName} not found`);
    }

    const env = environment || this.config.defaultEnvironment;
    const envParams = this.environmentParams.get(env);

    // Check environment-specific override
    if (envParams && paramName in envParams) {
      const value = envParams[paramName];
      this.validateValue(paramDef, value);
      return value;
    }

    // Fall back to default value
    if ('defaultValue' in paramDef) {
      return paramDef.defaultValue;
    }

    if (paramDef.required) {
      throw new Error(`Required parameter ${paramName} not found for environment ${env}`);
    }

    return undefined;
  }

  /**
   * Get all parameter values for a specific environment
   * @param environment Optional environment name (uses default if not specified)
   * @returns Record of parameter names to values
   */
  getAllParameters(environment?: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const env = environment || this.config.defaultEnvironment;

    for (const [paramName, paramDef] of this.parameterDefinitions) {
      try {
        const value = this.getParameterValue(paramName, env);
        if (value !== undefined) {
          result[paramName] = value;
        }
      } catch (error) {
        if (paramDef.required) {
          throw error;
        }
      }
    }

    return result;
  }

  /**
   * Validate a parameter value against its definition
   * @param paramDef Parameter definition
   * @param value Value to validate
   */
  private validateValue(paramDef: ParameterDefinition, value: unknown): void {
    // Skip validation if value is undefined and parameter is not required
    if (value === undefined) {
      if (paramDef.required) {
        throw new Error(`Required parameter ${paramDef.name} cannot be undefined`);
      }
      return;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== paramDef.type) {
      throw new Error(
        `Invalid type for parameter ${paramDef.name}: expected ${paramDef.type}, got ${actualType}`
      );
    }

    // Additional validation rules if specified
    if (paramDef.validation) {
      const { min, max, pattern, enum: enumValues } = paramDef.validation;

      if (typeof value === 'number') {
        if (min !== undefined && value < min) {
          throw new Error(
            `Value ${value} for parameter ${paramDef.name} is less than minimum ${min}`
          );
        }
        if (max !== undefined && value > max) {
          throw new Error(
            `Value ${value} for parameter ${paramDef.name} is greater than maximum ${max}`
          );
        }
      }

      if (typeof value === 'string' && pattern) {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          throw new Error(
            `Value "${value}" for parameter ${paramDef.name} does not match pattern ${pattern}`
          );
        }
      }

      if (enumValues && !enumValues.includes(value)) {
        throw new Error(
          `Value ${value} for parameter ${paramDef.name} is not one of: ${enumValues.join(', ')}`
        );
      }
    }
  }

  /**
   * Update environment-specific parameter values
   * @param environment Environment name
   * @param parameters Parameter values to update
   */
  updateEnvironmentParameters(environment: string, parameters: Record<string, unknown>): void {
    // Validate all parameters before updating
    for (const [paramName, value] of Object.entries(parameters)) {
      const paramDef = this.parameterDefinitions.get(paramName);
      if (!paramDef) {
        throw new Error(`Unknown parameter: ${paramName}`);
      }
      this.validateValue(paramDef, value);
    }

    // Update or create environment parameters
    const existing = this.environmentParams.get(environment) || {};
    this.environmentParams.set(environment, {
      ...existing,
      ...parameters,
    });
  }

  /**
   * Get parameter definition
   * @param paramName Name of the parameter
   * @returns Parameter definition
   */
  getParameterDefinition(paramName: string): ParameterDefinition | undefined {
    return this.parameterDefinitions.get(paramName);
  }

  /**
   * Get all parameter definitions
   * @returns Array of parameter definitions
   */
  getAllParameterDefinitions(): ParameterDefinition[] {
    return Array.from(this.parameterDefinitions.values());
  }

  /**
   * Add a new parameter definition
   * @param paramDef Parameter definition
   */
  addParameterDefinition(paramDef: ParameterDefinition): void {
    if (this.parameterDefinitions.has(paramDef.name)) {
      throw new Error(`Parameter ${paramDef.name} already exists`);
    }
    this.parameterDefinitions.set(paramDef.name, paramDef);
  }
}
