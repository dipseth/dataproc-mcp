/**
 * YAML configuration parser for Dataproc cluster configurations
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { z } from 'zod';
import { ClusterConfig } from '../types/cluster-config.js';
import path from 'path';

/**
 * Zod schema for validating the traditional YAML cluster configuration
 */
const TraditionalClusterConfigSchema = z.object({
  cluster: z.object({
    name: z.string(),
    region: z.string().optional(),
    config: z.record(z.any()).optional(),
  }),
});

/**
 * Zod schema for validating the enhanced YAML cluster configuration
 */
const EnhancedClusterConfigSchema = z.record(z.object({
  region: z.string(),
  tags: z.array(z.string()).optional(),
  labels: z.record(z.string()).optional(),
  cluster_config: z.record(z.any()).optional(),
  clusterConfig: z.record(z.any()).optional(),
}));

export type TraditionalYamlClusterConfig = {
  cluster: {
    name: string;
    region?: string;
    config?: Record<string, any>;
  };
};

export type EnhancedYamlClusterConfig = {
  [projectId: string]: {
    region: string;
    tags?: string[];
    labels?: Record<string, string>;
    cluster_config?: Record<string, any>;
    clusterConfig?: Record<string, any>;
  };
};

export type YamlClusterConfig = TraditionalYamlClusterConfig | EnhancedYamlClusterConfig;

/**
 * Converts snake_case to camelCase
 * @param obj Object with snake_case keys
 * @returns Object with camelCase keys
 */
function convertSnakeToCamel(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertSnakeToCamel(item));
  }

  const camelCaseObj: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = convertSnakeToCamel(obj[key]);
    }
  }
  
  return camelCaseObj;
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
      if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] YAML: Using traditional cluster config format');
      return validatedConfig;
    } catch (traditionalError) {
      try {
        // Then try enhanced format
        const validatedConfig = EnhancedClusterConfigSchema.parse(parsedConfig);
        if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] YAML: Using enhanced cluster config format');
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
export function convertYamlToDataprocConfig(yamlConfig: YamlClusterConfig, filePath?: string): {
  clusterName: string;
  region?: string;
  config: ClusterConfig;
  labels?: Record<string, string>;
} {
  // Check if it's the traditional format
  if ('cluster' in yamlConfig) {
    const traditionalConfig = yamlConfig as TraditionalYamlClusterConfig;
    const { name, region, config = {} } = traditionalConfig.cluster;
    
    return {
      clusterName: name,
      region,
      config: config as ClusterConfig,
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
    
    // Convert snake_case to camelCase for the entire config
    const camelCaseConfig = convertSnakeToCamel(clusterConfig);
    
    return {
      clusterName,
      region: projectConfig.region,
      config: camelCaseConfig as ClusterConfig,
      labels: projectConfig.labels,
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
}> {
  const yamlConfig = await readYamlConfig(filePath);
  return convertYamlToDataprocConfig(yamlConfig, filePath);
}