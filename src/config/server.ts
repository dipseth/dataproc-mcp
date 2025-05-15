/**
 * Server configuration for the MCP server
 */

import fs from 'fs/promises';
import path from 'path';
import { ProfileManagerConfig, ClusterTrackerConfig } from '../types/profile.js';

/**
 * Server configuration
 */
export interface ServerConfig {
  /**
   * Profile manager configuration
   */
  profileManager: ProfileManagerConfig;
  
  /**
   * Cluster tracker configuration
   */
  clusterTracker: ClusterTrackerConfig;
}

// Default configuration
const DEFAULT_CONFIG: ServerConfig = {
  profileManager: {
    rootConfigPath: './configs',
    profileScanInterval: 300000, // 5 minutes
  },
  clusterTracker: {
    stateFilePath: './state/dataproc-state.json',
    stateSaveInterval: 60000, // 1 minute
  },
};

/**
 * Gets the server configuration
 * Loads from config file if available, otherwise uses default configuration
 * @param configPath Path to the configuration file
 * @returns Server configuration
 */
export async function getServerConfig(configPath?: string): Promise<ServerConfig> {
  // Use default config path if not provided
  const filePath = configPath || './config/server.json';
  
  try {
    // Check if the config file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      // Config file doesn't exist, create it with default config
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      console.log(`[DEBUG] Created default server config at ${filePath}`);
      return DEFAULT_CONFIG;
    }
    
    // Read the config file
    const configJson = await fs.readFile(filePath, 'utf8');
    const config = JSON.parse(configJson) as Partial<ServerConfig>;
    
    // Merge with default config
    return {
      profileManager: {
        ...DEFAULT_CONFIG.profileManager,
        ...config.profileManager,
      },
      clusterTracker: {
        ...DEFAULT_CONFIG.clusterTracker,
        ...config.clusterTracker,
      },
    };
  } catch (error) {
    console.error(`[ERROR] Error loading server config from ${filePath}:`, error);
    console.log('[DEBUG] Using default server config');
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves the server configuration to a file
 * @param config Server configuration
 * @param configPath Path to the configuration file
 */
export async function saveServerConfig(config: ServerConfig, configPath?: string): Promise<void> {
  // Use default config path if not provided
  const filePath = configPath || './config/server.json';
  
  try {
    // Create the config directory if it doesn't exist
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write the config file
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    
    console.log(`[DEBUG] Saved server config to ${filePath}`);
  } catch (error) {
    console.error(`[ERROR] Error saving server config to ${filePath}:`, error);
    throw error;
  }
}