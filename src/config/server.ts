/**
 * Server configuration for the MCP server
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { ProfileManagerConfig, ClusterTrackerConfig } from '../types/profile.js';
import {
  getAppRoot,
  getConfigDirectory,
  getStateFilePath,
  logConfigPathDiagnostics,
} from '../utils/config-path-resolver.js';

// Global type declaration for config directory
declare global {
  // eslint-disable-next-line no-var
  var DATAPROC_CONFIG_DIR: string;
}

// Get application root from centralized resolver
const APP_ROOT = getAppRoot();
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
   * Google service account key file path for server-side operations
   * Optional - if not provided, server will rely on user-driven authentication
   */
  googleServiceAccountKeyPath?: string;

  /**
   * Fallback service account for elevated permissions (e.g., cluster deletion)
   * Used when the primary service account lacks sufficient permissions
   */
  fallbackServiceAccount?: string;

  /**
   * Default project ID for operations (can be overridden by tools)
   */
  projectId?: string;

  /**
   * Default region for operations (can be overridden by tools)
   */
  region?: string;

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

  /**
   * Whether to enable OAuth proxy integration for enterprise SSO
   * @default false
   */
  useOAuthProxy?: boolean;

  /**
   * Path to a JSON file containing the OAuth 2.0 Client ID and Client Secret
   * for the "Web application" type client used by the OAuth proxy.
   * If provided, `oauthProxyClientId` and `oauthProxyClientSecret` will be loaded from this file.
   */
  oauthClientKeyPath?: string;

  /**
   * OAuth proxy endpoints configuration
   */
  oauthProxyEndpoints?: {
    authorizationUrl: string;
    tokenUrl: string;
    revocationUrl?: string;
  };

  /**
   * OAuth proxy client ID
   * Can be explicitly set or loaded from `oauthClientKeyPath`.
   */
  oauthProxyClientId?: string;

  /**
   * OAuth proxy client secret
   * Can be explicitly set or loaded from `oauthClientKeyPath`.
   */
  oauthProxyClientSecret?: string;

  /**
   * OAuth proxy redirect URIs
   */
  oauthProxyRedirectUris?: string[];

  /**
   * OAuth provider type
   * @default 'google'
   */
  oauthProvider?: 'google' | 'github';

  /**
   * GitHub OAuth configuration
   */
  githubOAuth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes?: string[];
  };
}

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  /**
   * Port for HTTP server
   * @default 8080
   */
  port?: number;

  /**
   * Port for HTTPS server
   * @default 8443
   */
  httpsPort?: number;

  /**
   * Whether to enable HTTPS
   * @default true
   */
  enableHttps?: boolean;

  /**
   * Whether to enable OAuth proxy
   * @default false
   */
  enableOAuthProxy?: boolean;

  /**
   * Host to bind to
   * @default "localhost"
   */
  host?: string;
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

  /**
   * HTTP server configuration
   */
  httpServer?: HttpServerConfig;
}

// Default configuration with absolute paths
const DEFAULT_CONFIG: ServerConfig = {
  profileManager: {
    rootConfigPath: path.join(APP_ROOT, 'profiles'),
    profileScanInterval: 300000, // 5 minutes
  },
  clusterTracker: {
    stateFilePath: getStateFilePath('dataproc-state.json'),
    stateSaveInterval: 60000, // 1 minute
  },
  authentication: {
    impersonateServiceAccount: undefined,
    useOAuthProxy: false, // Default to false
  },
  httpServer: {
    port: 8080, // Default to 8080 to match VS Code expectation
    httpsPort: 8443, // Default HTTPS port
    enableHttps: true, // Enable HTTPS by default for OAuth compliance
    enableOAuthProxy: false,
    host: 'localhost',
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
        console.error(
          '[DEBUG] Server Config: Using MCP configuration from environment:',
          mcpConfig
        );
      }
    } catch (error) {
      console.error('[ERROR] Server Config: Failed to parse MCP_CONFIG:', error);
    }
  }

  // Add comprehensive diagnostic logging for configuration path resolution
  if (process.env.LOG_LEVEL === 'debug') {
    logConfigPathDiagnostics('ServerConfig');
  }

  console.error(`[DIAGNOSTIC] ===== Configuration Path Resolution =====`);
  console.error(
    `[DIAGNOSTIC] configPath parameter: ${configPath ? `"${configPath}"` : 'undefined'}`
  );
  console.error(
    `[DIAGNOSTIC] DATAPROC_CONFIG_PATH env var: ${process.env.DATAPROC_CONFIG_PATH ? `"${process.env.DATAPROC_CONFIG_PATH}"` : 'undefined'}`
  );
  console.error(
    `[DEBUG] Value of process.env.DATAPROC_CONFIG_PATH: ${process.env.DATAPROC_CONFIG_PATH}`
  );
  console.error(`[DIAGNOSTIC] Default config path: "${path.join(APP_ROOT, 'config/server.json')}"`);

  // Use config path from environment variable, parameter, or default (now absolute)
  const filePath =
    configPath || process.env.DATAPROC_CONFIG_PATH || path.join(APP_ROOT, 'config/server.json');

  // Determine which configuration source is being used
  let configSource: string;
  if (configPath) {
    configSource = 'direct parameter';
  } else if (process.env.DATAPROC_CONFIG_PATH) {
    configSource = 'DATAPROC_CONFIG_PATH environment variable';
  } else {
    configSource = 'default path';
  }

  console.error(`[DIAGNOSTIC] Configuration source: ${configSource}`);
  console.error(`[DIAGNOSTIC] Final config file path: "${filePath}"`);
  console.error(`[DIAGNOSTIC] Current working directory: ${process.cwd()}`);
  console.error(`[DIAGNOSTIC] Config path is absolute: ${path.isAbsolute(filePath)}`);

  // Store the config directory for other modules to use (for backward compatibility)
  // eslint-disable-next-line no-undef
  global.DATAPROC_CONFIG_DIR = getConfigDirectory();
  // eslint-disable-next-line no-undef
  console.error(`[DIAGNOSTIC] Server Config: Config directory: ${global.DATAPROC_CONFIG_DIR}`);

  try {
    // Check if the config file exists and is readable
    console.error(`[DIAGNOSTIC] ===== Config File Accessibility Check =====`);
    try {
      await fs.access(filePath, fs.constants.F_OK);
      console.error(`[DIAGNOSTIC] Config file exists: YES`);

      try {
        await fs.access(filePath, fs.constants.R_OK);
        console.error(`[DIAGNOSTIC] Config file is readable: YES`);
      } catch (readError) {
        const errorMessage = readError instanceof Error ? readError.message : String(readError);
        console.error(`[DIAGNOSTIC] Config file is readable: NO - ${errorMessage}`);
        throw readError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DIAGNOSTIC] Config file exists: NO - ${errorMessage}`);
      console.error(`[DIAGNOSTIC] Will use default configuration with MCP overrides`);
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
        httpServer: {
          ...DEFAULT_CONFIG.httpServer,
          ...mcpConfig.httpServer,
        },
      };
      if (process.env.LOG_LEVEL === 'debug')
        console.error(`[DEBUG] Using default config (no file found at ${filePath})`);
      return defaultWithMcp;
    }

    // Read the config file
    console.error(`[DIAGNOSTIC] ===== Loading Config File =====`);
    console.error(`[DIAGNOSTIC] Reading config from: "${filePath}"`);
    const configJson = await fs.readFile(filePath, 'utf8');
    console.error(`[DIAGNOSTIC] Config file size: ${configJson.length} bytes`);

    const config = JSON.parse(configJson) as Partial<ServerConfig>;
    console.error(`[DIAGNOSTIC] Successfully parsed config file`);
    console.error(`[DIAGNOSTIC] Config contains keys: [${Object.keys(config).join(', ')}]`);

    // Merge with default config, then MCP config, then file config (priority order)
    const mergedConfig: ServerConfig = {
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
      httpServer: {
        ...DEFAULT_CONFIG.httpServer,
        ...mcpConfig.httpServer,
        ...config.httpServer,
      },
    };

    // Load OAuth client ID and secret from file if oauthClientKeyPath is provided
    if (mergedConfig.authentication?.oauthClientKeyPath) {
      try {
        const oauthClientKeyPath = path.resolve(
          APP_ROOT,
          mergedConfig.authentication.oauthClientKeyPath
        );
        console.error(
          `[DIAGNOSTIC] Loading OAuth client credentials from: "${oauthClientKeyPath}"`
        );
        const oauthClientJson = await fs.readFile(oauthClientKeyPath, 'utf8');
        const oauthClientData = JSON.parse(oauthClientJson);

        // Check for the "installed" property (for "Other" client type)
        if (
          oauthClientData.installed &&
          oauthClientData.installed.client_id &&
          oauthClientData.installed.client_secret
        ) {
          mergedConfig.authentication.oauthProxyClientId = oauthClientData.installed.client_id;
          mergedConfig.authentication.oauthProxyClientSecret =
            oauthClientData.installed.client_secret;
          console.error(
            `[DIAGNOSTIC] Successfully loaded OAuth client ID and secret from file (nested under "installed").`
          );
        }
        // Check for the "web" property (for "Web application" client type)
        else if (
          oauthClientData.web &&
          oauthClientData.web.client_id &&
          oauthClientData.web.client_secret
        ) {
          mergedConfig.authentication.oauthProxyClientId = oauthClientData.web.client_id;
          mergedConfig.authentication.oauthProxyClientSecret = oauthClientData.web.client_secret;
          console.error(
            `[DIAGNOSTIC] Successfully loaded OAuth client ID and secret from file (nested under "web").`
          );
        }
        // Fallback for non-nested structure (e.g., if user provides a simplified JSON)
        else if (oauthClientData.client_id && oauthClientData.client_secret) {
          mergedConfig.authentication.oauthProxyClientId = oauthClientData.client_id;
          mergedConfig.authentication.oauthProxyClientSecret = oauthClientData.client_secret;
          console.error(
            `[DIAGNOSTIC] Successfully loaded OAuth client ID and secret from file (at root).`
          );
        } else {
          console.warn(
            `[WARN] OAuth client key file "${oauthClientKeyPath}" does not contain client_id and client_secret (neither at root, nor nested under "web" or "installed").`
          );
        }
      } catch (error) {
        console.error(`[ERROR] Failed to load OAuth client credentials from file: ${error}`);
        console.warn(`[WARN] OAuth proxy might not function correctly without client credentials.`);
      }
    }

    console.error(`[DIAGNOSTIC] ===== Configuration Resolution Summary =====`);
    console.error(`[DIAGNOSTIC] Configuration loaded successfully from: ${configSource}`);
    console.error(`[DIAGNOSTIC] Final config file used: "${filePath}"`);
    console.error(
      `[DIAGNOSTIC] Profile manager root: "${mergedConfig.profileManager.rootConfigPath}"`
    );
    console.error(
      `[DIAGNOSTIC] Cluster tracker state file: "${mergedConfig.clusterTracker.stateFilePath}"`
    );
    if (mergedConfig.authentication?.impersonateServiceAccount) {
      console.error(
        `[DIAGNOSTIC] Service account impersonation: "${mergedConfig.authentication.impersonateServiceAccount}"`
      );
    }
    if (mergedConfig.authentication?.projectId) {
      console.error(`[DIAGNOSTIC] Default project ID: "${mergedConfig.authentication.projectId}"`);
    }
    if (mergedConfig.authentication?.region) {
      console.error(`[DIAGNOSTIC] Default region: "${mergedConfig.authentication.region}"`);
    }
    if (mergedConfig.authentication?.useOAuthProxy) {
      console.error(`[DIAGNOSTIC] OAuth Proxy Enabled: YES`);
      if (mergedConfig.authentication.oauthProxyEndpoints?.authorizationUrl) {
        console.error(
          `[DIAGNOSTIC] OAuth Proxy Auth URL: "${mergedConfig.authentication.oauthProxyEndpoints.authorizationUrl}"`
        );
      }
      if (mergedConfig.authentication.oauthProxyClientId) {
        console.error(
          `[DIAGNOSTIC] OAuth Proxy Client ID: "${mergedConfig.authentication.oauthProxyClientId}"`
        );
      }
      if (mergedConfig.authentication.oauthClientKeyPath) {
        console.error(
          `[DIAGNOSTIC] OAuth Client Key Path: "${mergedConfig.authentication.oauthClientKeyPath}"`
        );
      }
    }
    console.error(`[DIAGNOSTIC] ================================================`);

    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        '[DEBUG] Server Config: Final merged configuration:',
        JSON.stringify(mergedConfig, null, 2)
      );
    }

    return mergedConfig;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Error loading server config from ${filePath}: ${errorMessage}`);
    console.error(`[DIAGNOSTIC] ===== Configuration Error Fallback =====`);
    console.error(`[DIAGNOSTIC] Failed to load config from: "${filePath}"`);
    console.error(`[DIAGNOSTIC] Falling back to default configuration with MCP overrides`);
    console.error(`[DIAGNOSTIC] ================================================`);

    if (process.env.LOG_LEVEL === 'debug')
      console.error('[DEBUG] Using default server config with MCP overrides');
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
      httpServer: {
        ...DEFAULT_CONFIG.httpServer,
        ...mcpConfig.httpServer,
      },
    };
  }
}

/**
 * Saves the server configuration to a file
 * @param config Server configuration
 * @param configPath Path to the configuration file
 */
export async function saveServerConfig(
  config: ServerConfig,
  configPath?: string,
  createDirs: boolean = false
): Promise<void> {
  // Use default config path if not provided (now absolute)
  const filePath = configPath || path.join(APP_ROOT, 'config/server.json');

  try {
    // Only create the config directory if explicitly requested
    if (createDirs) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
    }

    // Write the config file
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');

    if (process.env.LOG_LEVEL === 'debug')
      console.error(`[DEBUG] Saved server config to ${filePath}`);
  } catch (error) {
    console.error(`[ERROR] Error saving server config to ${filePath}:`, error);
    throw error;
  }
}
