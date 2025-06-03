/**
 * YAML configuration parser for Dataproc cluster configurations
 */

import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { ClusterConfig } from '../types/cluster-config.js';
import * as path from 'path';

/**
 * Zod schema for validating the traditional YAML cluster configuration
 */
const TraditionalClusterConfigSchema = z.object({
  cluster: z.object({
    name: z.string(),
    region: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    parameters: z.record(z.unknown()).optional(),
  }),
});

/**
 * Zod schema for validating the enhanced YAML cluster configuration
 */
const EnhancedClusterConfigSchema = z.record(
  z.object({
    region: z.string(),
    tags: z.array(z.string()).optional(),
    labels: z.record(z.string()).optional(),
    cluster_config: z.record(z.unknown()).optional(),
    clusterConfig: z.record(z.unknown()).optional(),
    parameters: z.record(z.unknown()).optional(),
  })
);

export type TraditionalYamlClusterConfig = {
  cluster: {
    name: string;
    region?: string;
    config?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
};

export type EnhancedYamlClusterConfig = {
  [projectId: string]: {
    region: string;
    tags?: string[];
    labels?: Record<string, string>;
    cluster_config?: Record<string, unknown>;
    clusterConfig?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
};

export type YamlClusterConfig = TraditionalYamlClusterConfig | EnhancedYamlClusterConfig;

/**
 * Converts snake_case to camelCase, but preserves metadata keys in their original format
 * @param obj Object with snake_case keys
 * @param isMetadata Whether this object is metadata (should preserve original keys)
 * @returns Object with camelCase keys (except metadata)
 */
function convertSnakeToCamel(obj: unknown, isMetadata = false): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertSnakeToCamel(item, isMetadata));
  }

  const resultObj: Record<string, unknown> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key];
      
      // Check if this is the metadata section
      const isMetadataSection = key === 'metadata';
      
      if (isMetadata || isMetadataSection) {
        // Preserve original key format for metadata
        resultObj[key] = convertSnakeToCamel(value, true);
      } else {
        // Convert snake_case to camelCase for non-metadata keys
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        resultObj[camelKey] = convertSnakeToCamel(value, false);
      }
    }
  }

  return resultObj;
}

/**
 * Reads and parses a YAML configuration file
 * @param filePath Path to the YAML configuration file
 * @returns Parsed and validated cluster configuration
 */
export async function readYamlConfig(filePath: string): Promise<YamlClusterConfig> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsedConfig = yaml.load(fileContent) as unknown;

    // Try to validate against both schemas
    try {
      // First try traditional format
      const validatedConfig = TraditionalClusterConfigSchema.parse(parsedConfig);
      if (process.env.LOG_LEVEL === 'debug')
        console.error('[DEBUG] YAML: Using traditional cluster config format');
      return validatedConfig;
    } catch (traditionalError) {
      try {
        // Then try enhanced format
        const validatedConfig = EnhancedClusterConfigSchema.parse(parsedConfig);
        if (process.env.LOG_LEVEL === 'debug')
          console.error('[DEBUG] YAML: Using enhanced cluster config format');
        return validatedConfig;
      } catch (enhancedError) {
        // If both fail, throw the traditional error for backward compatibility
        throw traditionalError;
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid YAML configuration: ${error.message}`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read YAML configuration: ${error.message}`);
    }

    throw new Error('Unknown error reading YAML configuration');
  }
}

/**
 * Converts a YAML cluster configuration to the Dataproc API format
 * @param yamlConfig YAML cluster configuration
 * @param filePath Path to the YAML file (used for generating cluster name if needed)
 * @returns Dataproc API compatible cluster configuration
 */
export function convertYamlToDataprocConfig(
  yamlConfig: YamlClusterConfig,
  filePath?: string
): {
  clusterName: string;
  region?: string;
  config: ClusterConfig;
  labels?: Record<string, string>;
  parameters?: Record<string, unknown>;
} {
  // Check if it's the traditional format
  if ('cluster' in yamlConfig) {
    const traditionalConfig = yamlConfig as TraditionalYamlClusterConfig;
    const { name, region, config = {}, parameters } = traditionalConfig.cluster;

    return {
      clusterName: name,
      region,
      config: config as ClusterConfig,
      parameters,
    };
  }
  // Enhanced format
  else {
    const enhancedConfig = yamlConfig as EnhancedYamlClusterConfig;

    // Get the project ID (first key in the object)
    const projectId = Object.keys(enhancedConfig)[0];
    const projectConfig = enhancedConfig[projectId];

    // Generate a cluster name if not provided
    let clusterName = '';
    if (filePath) {
      // Use the filename without extension as the cluster name
      const baseName = path.basename(filePath, path.extname(filePath));
      clusterName = `${baseName}-cluster`;
    } else {
      // Generate a random name
      clusterName = `cluster-${Math.random().toString(36).substring(2, 7)}`;
    }

    // Get the cluster config (support both snake_case and camelCase)
    const clusterConfig = projectConfig.cluster_config || projectConfig.clusterConfig || {};

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        '[DEBUG] YAML: Original cluster config:',
        JSON.stringify(clusterConfig, null, 2)
      );
    }

    // Convert snake_case to camelCase for the entire config
    const camelCaseConfig = convertSnakeToCamel(clusterConfig) as ClusterConfig;

    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] YAML: Transformed config:', JSON.stringify(camelCaseConfig, null, 2));
    }

    // Ensure proper nesting of service account in gceClusterConfig
    if (camelCaseConfig.gceClusterConfig?.serviceAccount) {
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(
          '[DEBUG] YAML: Service account found:',
          camelCaseConfig.gceClusterConfig.serviceAccount
        );
      }
    }

    return {
      clusterName,
      region: projectConfig.region,
      config: camelCaseConfig,
      labels: projectConfig.labels,
      parameters: projectConfig.parameters,
    };
  }
}

/**
 * Reads a YAML file and converts it to Dataproc API format
 * @param filePath Path to the YAML configuration file
 * @returns Dataproc API compatible cluster configuration
 */
export async function getDataprocConfigFromYaml(filePath: string): Promise<{
  clusterName: string;
  region?: string;
  config: ClusterConfig;
  labels?: Record<string, string>;
  parameters?: Record<string, unknown>;
}> {
  const yamlConfig = await readYamlConfig(filePath);
  return convertYamlToDataprocConfig(yamlConfig, filePath);
}
