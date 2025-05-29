/**
 * Server configuration for the MCP server
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ProfileManagerConfig, ClusterTrackerConfig } from '../types/profile.js';

// Determine the application root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '../..');
console.error(`[DEBUG] Application root directory: ${APP_ROOT}`);

/**
 * Authentication configuration with enhanced fallback support
 */
export interface AuthenticationConfig {
  /**
   * Service account to impersonate (preferred method)
   */
  impersonateServiceAccount?: string;
  
  /**
   * Fallback service account key file path
   */
  fallbackKeyPath?: string;
  
  /**
   * Whether to prefer impersonation over direct key file usage
   * @default true
   */
  preferImpersonation?: boolean;
  
  /**
   * Whether to use application default credentials as final fallback
   * @default true
   */
  useApplicationDefaultFallback?: boolean;
}

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

  /**
   * Authentication configuration
   */
  authentication?: AuthenticationConfig;
}

// Default configuration with absolute paths
const DEFAULT_CONFIG: ServerConfig = {
  profileManager: {
    rootConfigPath: path.join(APP_ROOT, 'profiles'),
    profileScanInterval: 300000, // 5 minutes
  },
  clusterTracker: {
    stateFilePath: path.join(APP_ROOT, 'state/dataproc-state.json'),
    stateSaveInterval: 60000, // 1 minute
  },
  authentication: {
    impersonateServiceAccount: undefined,
  },
};

/**
 * Gets the server configuration
 * Loads from config file if available, otherwise uses default configuration
 * @param configPath Path to the configuration file
 * @returns Server configuration
 */
export async function getServerConfig(configPath?: string): Promise<ServerConfig> {
  // Check for MCP configuration from environment variables first
  let mcpConfig: Partial<ServerConfig> = {};
  
  // Check if we have MCP configuration passed via environment
  if (process.env.MCP_CONFIG) {
    try {
      mcpConfig = JSON.parse(process.env.MCP_CONFIG);
      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] Server Config: Using MCP configuration from environment:', mcpConfig);
      }
    } catch (error) {
      console.error('[ERROR] Server Config: Failed to parse MCP_CONFIG:', error);
    }
  }
  
  // Use default config path if not provided (now absolute)
  const filePath = configPath || path.join(APP_ROOT, 'config/server.json');
  
  // Log the current working directory and absolute config path for debugging
  console.error(`[DIAGNOSTIC] Server Config: Current working directory: ${process.cwd()}`);
  console.error(`[DIAGNOSTIC] Server Config: Absolute config path: ${filePath}`);
  
  try {
    // Check if the config file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      // Config file doesn't exist, use defaults with MCP overrides (don't auto-create)
      const defaultWithMcp = {
        profileManager: {
          ...DEFAULT_CONFIG.profileManager,
          ...mcpConfig.profileManager,
        },
        clusterTracker: {
          ...DEFAULT_CONFIG.clusterTracker,
          ...mcpConfig.clusterTracker,
        },
        authentication: {
          ...DEFAULT_CONFIG.authentication,
          ...mcpConfig.authentication,
        },
      };
      if (process.env.LOG_LEVEL === 'debug') console.error(`[DEBUG] Using default config (no file found at ${filePath})`);
      return defaultWithMcp;
    }
    
    // Read the config file
    const configJson = await fs.readFile(filePath, 'utf8');
    const config = JSON.parse(configJson) as Partial<ServerConfig>;
    
    // Merge with default config, then MCP config, then file config (priority order)
    const mergedConfig = {
      profileManager: {
        ...DEFAULT_CONFIG.profileManager,
        ...mcpConfig.profileManager,
        ...config.profileManager,
      },
      clusterTracker: {
        ...DEFAULT_CONFIG.clusterTracker,
        ...mcpConfig.clusterTracker,
        ...config.clusterTracker,
      },
      authentication: {
        ...DEFAULT_CONFIG.authentication,
        ...mcpConfig.authentication,
        ...config.authentication,
      },
    };
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] Server Config: Final merged configuration:', JSON.stringify(mergedConfig, null, 2));
    }
    
    return mergedConfig;
  } catch (error) {
    console.error(`[ERROR] Error loading server config from ${filePath}:`, error);
    if (process.env.LOG_LEVEL === 'debug') console.error('[DEBUG] Using default server config with MCP overrides');
    return {
      profileManager: {
        ...DEFAULT_CONFIG.profileManager,
        ...mcpConfig.profileManager,
      },
      clusterTracker: {
        ...DEFAULT_CONFIG.clusterTracker,
        ...mcpConfig.clusterTracker,
      },
      authentication: {
        ...DEFAULT_CONFIG.authentication,
        ...mcpConfig.authentication,
      },
    };
  }
}

/**
 * Saves the server configuration to a file
 * @param config Server configuration
 * @param configPath Path to the configuration file
 */
export async function saveServerConfig(config: ServerConfig, configPath?: string, createDirs: boolean = false): Promise<void> {
  // Use default config path if not provided (now absolute)
  const filePath = configPath || path.join(APP_ROOT, 'config/server.json');
  
  try {
    // Only create the config directory if explicitly requested
    if (createDirs) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }
    
    // Write the config file
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
    
    if (process.env.LOG_LEVEL === 'debug') console.error(`[DEBUG] Saved server config to ${filePath}`);
  } catch (error) {
    console.error(`[ERROR] Error saving server config to ${filePath}:`, error);
    throw error;
  }
}