/**
 * Consolidated credentials management for Google Cloud authentication
 * Uses configuration-driven approach with proven MWAA service account pattern
 * Enhanced with service account impersonation support
 */

import { GoogleAuth, OAuth2Client, Impersonated } from 'google-auth-library';
import { ClusterControllerClient, JobControllerClient } from '@google-cloud/dataproc';
import { execSync } from 'child_process';
import { getServerConfig } from './server.js';

/**
 * Authentication cache to reduce overhead
 */
interface AuthCache {
  token: string;
  expiresAt: number;
}

let authCache: AuthCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Options for creating a Dataproc client
 */
export interface DataprocClientOptions {
  projectId?: string;
  region?: string;
  keyFilename?: string;
  useApplicationDefault?: boolean;
}

/**
 * Authentication strategy enum
 */
export enum AuthStrategy {
  KEY_FILE = 'key_file',
  APPLICATION_DEFAULT = 'application_default',
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  strategy: AuthStrategy;
  success: boolean;
  error?: string;
  auth?: any;
}

/**
 * Gets an access token using the configured key file (no impersonation)
 * This follows the proven working MWAA pattern from the guide
 * @returns Access token from gcloud CLI using configured key file
 */
export function getGcloudAccessToken(): string {
  const startTime = Date.now();
  console.error(`[TIMING] getGcloudAccessToken: Starting gcloud token acquisition`);

  try {
    // Use the key file from environment variable (GOOGLE_APPLICATION_CREDENTIALS)
    // This is the proven working approach from the MWAA service account guide
    console.error(`[TIMING] getGcloudAccessToken: Executing 'gcloud auth print-access-token'...`);
    const execStartTime = Date.now();
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    const execDuration = Date.now() - execStartTime;
    const totalDuration = Date.now() - startTime;

    console.error(
      `[TIMING] getGcloudAccessToken: SUCCESS - gcloud exec: ${execDuration}ms, total: ${totalDuration}ms, token length: ${token.length}`
    );
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(
        '[DEBUG] getGcloudAccessToken: Successfully obtained token using configured key file'
      );
    }

    return token;
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getGcloudAccessToken: FAILED after ${totalDuration}ms`);
    console.error(
      '[ERROR] getGcloudAccessToken: Failed to get token using configured key file:',
      err
    );
    throw new Error(`Failed to get access token using configured key file: ${err}`);
  }
}

/**
 * Gets an access token using server configuration with caching
 * @returns Access token from gcloud CLI
 */
export async function getGcloudAccessTokenWithConfig(): Promise<string> {
  const startTime = Date.now();
  console.error(`[TIMING] getGcloudAccessTokenWithConfig: Starting with caching`);

  // Check cache first
  if (authCache && authCache.expiresAt > Date.now()) {
    const cacheDuration = Date.now() - startTime;
    console.error(`[TIMING] getGcloudAccessTokenWithConfig: CACHE HIT - ${cacheDuration}ms`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] getGcloudAccessTokenWithConfig: Using cached token');
    }
    return authCache.token;
  }

  // Cache miss or expired, get new token
  console.error(`[TIMING] getGcloudAccessTokenWithConfig: Cache miss, getting new token`);
  const token = getGcloudAccessToken();

  // Cache the token
  authCache = {
    token,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  };

  const totalDuration = Date.now() - startTime;
  console.error(`[TIMING] getGcloudAccessTokenWithConfig: NEW TOKEN CACHED - ${totalDuration}ms`);
  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] getGcloudAccessTokenWithConfig: Token cached for 5 minutes');
  }

  return token;
}

/**
 * Creates an impersonated service account credential
 * @param targetServiceAccount The service account to impersonate
 * @param sourceCredentials Optional source credentials (defaults to ADC)
 * @returns Impersonated auth client
 */
export async function createImpersonatedAuth(
  targetServiceAccount: string,
  sourceCredentials?: GoogleAuth
): Promise<Impersonated> {
  const startTime = Date.now();
  console.error(
    `[TIMING] createImpersonatedAuth: Starting impersonation for ${targetServiceAccount}`
  );

  try {
    // Use provided source credentials or fail if none provided
    if (!sourceCredentials) {
      throw new Error(
        'Source credentials are required for impersonation. No fallback to ADC to avoid environment dependencies.'
      );
    }
    const sourceAuth = sourceCredentials;

    // Get source credentials
    const sourceAuthClient = await sourceAuth.getClient();

    // Create impersonated credentials
    const impersonatedClient = new Impersonated({
      sourceClient: sourceAuthClient as OAuth2Client,
      targetPrincipal: targetServiceAccount,
      targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
      delegates: [],
    });

    // Test the impersonated credentials
    const testStartTime = Date.now();
    await impersonatedClient.getAccessToken();
    const testDuration = Date.now() - testStartTime;
    const totalDuration = Date.now() - startTime;

    console.error(
      `[TIMING] createImpersonatedAuth: SUCCESS - test: ${testDuration}ms, total: ${totalDuration}ms`
    );
    console.error(
      `[DEBUG] createImpersonatedAuth: Successfully created impersonated credentials for ${targetServiceAccount}`
    );

    return impersonatedClient;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] createImpersonatedAuth: FAILED after ${totalDuration}ms`);
    console.error(
      `[ERROR] createImpersonatedAuth: Failed to create impersonated credentials for ${targetServiceAccount}:`,
      error
    );
    throw new Error(
      `Failed to create impersonated credentials for ${targetServiceAccount}: ${error}`
    );
  }
}

/**
 * Create GoogleAuth instance using the configured key file approach with impersonation support
 * @param options Authentication options
 * @returns GoogleAuth instance and strategy used
 */
export async function createAuth(options: DataprocClientOptions = {}): Promise<AuthResult> {
  const startTime = Date.now();
  console.error(`[TIMING] createAuth: Starting authentication process`);
  const { keyFilename, useApplicationDefault } = options;

  // Get server configuration to check for impersonation settings
  let serverConfig;
  try {
    serverConfig = await getServerConfig();
  } catch (error) {
    console.warn(`[WARN] createAuth: Failed to load server config: ${error}`);
  }

  // Log environment configuration for debugging
  console.error(`[DEBUG] createAuth: Environment configuration:`, {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET',
    USE_APPLICATION_DEFAULT: process.env.USE_APPLICATION_DEFAULT || 'NOT SET',
    LOG_LEVEL: process.env.LOG_LEVEL || 'NOT SET',
    keyFilename: keyFilename ? 'provided' : 'not provided',
    useApplicationDefault: useApplicationDefault,
    impersonateServiceAccount: serverConfig?.authentication?.impersonateServiceAccount || 'NOT SET',
    fallbackKeyPath: serverConfig?.authentication?.fallbackKeyPath || 'NOT SET',
    preferImpersonation: serverConfig?.authentication?.preferImpersonation ?? 'NOT SET',
  });

  // Strategy 0: Service Account Impersonation (highest priority if preferred)
  if (
    serverConfig?.authentication?.impersonateServiceAccount &&
    serverConfig?.authentication?.preferImpersonation !== false
  ) {
    try {
      const impersonationStartTime = Date.now();
      const targetServiceAccount = serverConfig.authentication.impersonateServiceAccount;
      console.error(
        `[TIMING] createAuth: Attempting service account impersonation: ${targetServiceAccount}`
      );

      // Create source credentials for impersonation - REQUIRE fallback key path
      if (!serverConfig.authentication.fallbackKeyPath) {
        throw new Error(
          `Service account impersonation requires fallbackKeyPath in server configuration. No environment fallback to ensure independence.`
        );
      }

      console.error(
        `[DEBUG] createAuth: Using fallback key path for impersonation source: ${serverConfig.authentication.fallbackKeyPath}`
      );
      const sourceAuth = new GoogleAuth({
        keyFilename: serverConfig.authentication.fallbackKeyPath,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });

      // Test the source auth
      await sourceAuth.getAccessToken();
      console.error(
        `[DEBUG] createAuth: Fallback key path authentication successful for impersonation`
      );

      const impersonatedClient = await createImpersonatedAuth(targetServiceAccount, sourceAuth);
      const impersonationDuration = Date.now() - impersonationStartTime;
      const totalDuration = Date.now() - startTime;

      console.error(
        `[TIMING] createAuth: Impersonation SUCCESS - impersonation: ${impersonationDuration}ms, total: ${totalDuration}ms`
      );
      console.error(
        `[DEBUG] createAuth: Service account impersonation successful for ${targetServiceAccount}`
      );

      // Return the impersonated client directly wrapped in GoogleAuth interface
      // The Impersonated client can be used directly with Google Cloud client libraries
      const auth = {
        getClient: () => impersonatedClient,
        getAccessToken: () => impersonatedClient.getAccessToken(),
        getProjectId: async () => {
          // Try to get project ID from server config or environment
          return (
            serverConfig?.authentication?.projectId ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            process.env.GCLOUD_PROJECT
          );
        },
      };

      return {
        strategy: AuthStrategy.KEY_FILE, // Use KEY_FILE as closest match for impersonation
        success: true,
        auth: auth as any, // Cast to match expected interface
      };
    } catch (error) {
      const impersonationFailDuration = Date.now() - startTime;
      console.error(
        `[TIMING] createAuth: Impersonation strategy FAILED after ${impersonationFailDuration}ms`
      );
      console.warn(`[WARN] createAuth: Service account impersonation failed: ${error}`);
      // Continue to fallback strategies
    }
  }

  // Strategy 1: Use configured key file (explicit configuration only - no environment fallback)
  const keyPath = keyFilename || serverConfig?.authentication?.fallbackKeyPath;
  if (keyPath && !useApplicationDefault) {
    try {
      const keyFileStartTime = Date.now();
      console.error(`[TIMING] createAuth: Attempting key file authentication: ${keyPath}`);
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(`[DEBUG] createAuth: Using key file authentication: ${keyPath}`);
      }

      const authCreateStartTime = Date.now();
      const auth = new GoogleAuth({
        keyFilename: keyPath,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authCreateDuration = Date.now() - authCreateStartTime;
      console.error(`[TIMING] createAuth: GoogleAuth instance created in ${authCreateDuration}ms`);

      // Test the auth by getting a token
      const tokenTestStartTime = Date.now();
      console.error(`[TIMING] createAuth: Testing token acquisition...`);
      await auth.getAccessToken();
      const tokenTestDuration = Date.now() - tokenTestStartTime;
      const keyFileTotal = Date.now() - keyFileStartTime;

      console.error(
        `[TIMING] createAuth: Key file auth SUCCESS - token test: ${tokenTestDuration}ms, total: ${keyFileTotal}ms`
      );
      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] createAuth: Key file authentication successful');
      }

      return {
        strategy: AuthStrategy.KEY_FILE,
        success: true,
        auth,
      };
    } catch (error) {
      const keyFileFailDuration = Date.now() - startTime;
      console.error(`[TIMING] createAuth: Key file strategy FAILED after ${keyFileFailDuration}ms`);
      console.warn(`[WARN] createAuth: Key file strategy failed: ${error}`);
    }
  }

  // Strategy 2: Application Default Credentials (only if explicitly enabled)
  if (serverConfig?.authentication?.useApplicationDefaultFallback) {
    try {
      const adcStartTime = Date.now();
      console.error(
        `[TIMING] createAuth: Attempting application default credentials (explicitly enabled)`
      );
      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] createAuth: Using application default credentials');
      }

      const authCreateStartTime = Date.now();
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authCreateDuration = Date.now() - authCreateStartTime;
      console.error(
        `[TIMING] createAuth: ADC GoogleAuth instance created in ${authCreateDuration}ms`
      );

      // Test the auth by getting a token
      const tokenTestStartTime = Date.now();
      console.error(`[TIMING] createAuth: Testing ADC token acquisition...`);
      await auth.getAccessToken();
      const tokenTestDuration = Date.now() - tokenTestStartTime;
      const adcTotal = Date.now() - adcStartTime;
      const totalDuration = Date.now() - startTime;

      console.error(
        `[TIMING] createAuth: ADC auth SUCCESS - token test: ${tokenTestDuration}ms, adc total: ${adcTotal}ms, overall total: ${totalDuration}ms`
      );
      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] createAuth: Application default credentials successful');
      }

      return {
        strategy: AuthStrategy.APPLICATION_DEFAULT,
        success: true,
        auth,
      };
    } catch (error) {
      const totalFailDuration = Date.now() - startTime;
      console.error(`[TIMING] createAuth: ADC strategy FAILED after ${totalFailDuration}ms`);
      console.warn(`[WARN] createAuth: Application default credentials failed: ${error}`);
    }
  } else {
    console.error(`[DEBUG] createAuth: Application Default Credentials disabled in configuration`);
  }

  const totalDuration = Date.now() - startTime;
  console.error(`[TIMING] createAuth: ALL STRATEGIES FAILED after ${totalDuration}ms`);
  return {
    strategy: AuthStrategy.APPLICATION_DEFAULT,
    success: false,
    error: 'All authentication strategies failed',
  };
}

/**
 * Creates a Dataproc ClusterControllerClient with simplified authentication
 * @param options Client configuration options
 * @returns Configured ClusterControllerClient
 */
export async function createDataprocClient(
  options: DataprocClientOptions = {}
): Promise<ClusterControllerClient> {
  const { region } = options;

  // Set up client options
  const clientOptions: Record<string, any> = {};

  // Configure region-specific endpoint if provided
  if (region) {
    clientOptions.apiEndpoint = `${region}-dataproc.googleapis.com:443`;
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] createDataprocClient: using apiEndpoint:', clientOptions.apiEndpoint);
    }
  }

  // Get authentication using the simplified approach
  const authResult = await createAuth(options);

  if (!authResult.success) {
    throw new Error(`Failed to create authentication: ${authResult.error}`);
  }

  clientOptions.auth = authResult.auth;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(
      `[DEBUG] createDataprocClient: Using authentication strategy: ${authResult.strategy}`
    );
  }

  return new ClusterControllerClient(clientOptions);
}

/**
 * Creates a Dataproc JobControllerClient with simplified authentication
 * @param options Client configuration options
 * @returns Configured JobControllerClient
 */
export async function createJobClient(
  options: DataprocClientOptions = {}
): Promise<JobControllerClient> {
  const startTime = Date.now();
  console.error(`[TIMING] createJobClient: Starting job client creation`);
  const { region } = options;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] createJobClient: Starting with options:', {
      region,
      keyFilename: options.keyFilename ? 'provided' : 'not provided',
      useApplicationDefault: options.useApplicationDefault,
    });
  }

  // Set up client options
  const optionsStartTime = Date.now();
  const clientOptions: Record<string, any> = {};

  // Configure region-specific endpoint if provided
  if (region) {
    clientOptions.apiEndpoint = `${region}-dataproc.googleapis.com:443`;
    console.error(`[TIMING] createJobClient: Configured endpoint: ${clientOptions.apiEndpoint}`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] createJobClient: using apiEndpoint:', clientOptions.apiEndpoint);
    }
  }
  const optionsDuration = Date.now() - optionsStartTime;
  console.error(`[TIMING] createJobClient: Client options configured in ${optionsDuration}ms`);

  // Get authentication using the simplified approach
  console.error(`[TIMING] createJobClient: Starting authentication...`);
  const authStartTime = Date.now();
  const authResult = await createAuth(options);
  const authDuration = Date.now() - authStartTime;
  console.error(`[TIMING] createJobClient: Authentication completed in ${authDuration}ms`);

  if (!authResult.success) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] createJobClient: FAILED during auth after ${totalDuration}ms`);
    throw new Error(`Failed to create authentication: ${authResult.error}`);
  }

  clientOptions.auth = authResult.auth;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] createJobClient: Using authentication strategy: ${authResult.strategy}`);
  }

  // Create the JobControllerClient
  console.error(`[TIMING] createJobClient: Creating JobControllerClient instance...`);
  const clientCreateStartTime = Date.now();
  const client = new JobControllerClient(clientOptions);
  const clientCreateDuration = Date.now() - clientCreateStartTime;
  const totalDuration = Date.now() - startTime;

  console.error(
    `[TIMING] createJobClient: SUCCESS - auth: ${authDuration}ms, client creation: ${clientCreateDuration}ms, total: ${totalDuration}ms`
  );

  return client;
}

/**
 * Gets the credentials configuration from environment variables
 * @returns Credentials configuration
 */
export function getCredentialsConfig(): {
  keyFilename?: string;
  useApplicationDefault: boolean;
} {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const useApplicationDefault = process.env.USE_APPLICATION_DEFAULT === 'true';

  return {
    keyFilename,
    useApplicationDefault: useApplicationDefault || !keyFilename,
  };
}

/**
 * Gets an access token using the fallback service account for operations requiring elevated permissions
 * This is specifically for operations that require elevated permissions (e.g., cluster deletion)
 * @returns Access token from fallback service account
 */
export async function getFallbackAccessToken(): Promise<string> {
  const startTime = Date.now();
  console.error(
    `[TIMING] getFallbackAccessToken: Starting fallback service account token acquisition`
  );

  try {
    // Get server configuration to get the fallback service account
    const serverConfig = await getServerConfig();
    const fallbackAccount = serverConfig?.authentication?.fallbackServiceAccount;

    if (!fallbackAccount) {
      throw new Error('No fallback service account configured in server configuration');
    }

    // Store current account
    const currentAccount = execSync('gcloud config get-value account', { encoding: 'utf8' }).trim();
    console.error(`[DEBUG] getFallbackAccessToken: Current account: ${currentAccount}`);

    // Switch to fallback service account
    console.error(
      `[DEBUG] getFallbackAccessToken: Switching to fallback account: ${fallbackAccount}`
    );
    execSync(`gcloud config set account ${fallbackAccount}`, { encoding: 'utf8' });

    // Get token with fallback account
    console.error(`[TIMING] getFallbackAccessToken: Getting token with fallback account...`);
    const execStartTime = Date.now();
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    const execDuration = Date.now() - execStartTime;

    // Restore original account
    console.error(`[DEBUG] getFallbackAccessToken: Restoring original account: ${currentAccount}`);
    execSync(`gcloud config set account ${currentAccount}`, { encoding: 'utf8' });

    const totalDuration = Date.now() - startTime;
    console.error(
      `[TIMING] getFallbackAccessToken: SUCCESS - token acquisition: ${execDuration}ms, total: ${totalDuration}ms`
    );

    return token;
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getFallbackAccessToken: FAILED after ${totalDuration}ms`);
    console.error('[ERROR] getFallbackAccessToken: Failed to get fallback token:', err);
    throw new Error(`Failed to get fallback access token: ${err}`);
  }
}
