/**
 * Consolidated credentials management for Google Cloud authentication
 * Uses configuration-driven approach with proven MWAA service account pattern
 */

import { GoogleAuth, OAuth2Client } from 'google-auth-library';
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
  APPLICATION_DEFAULT = 'application_default'
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
    
    console.error(`[TIMING] getGcloudAccessToken: SUCCESS - gcloud exec: ${execDuration}ms, total: ${totalDuration}ms, token length: ${token.length}`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] getGcloudAccessToken: Successfully obtained token using configured key file');
    }
    
    return token;
  } catch (err) {
    const totalDuration = Date.now() - startTime;
    console.error(`[TIMING] getGcloudAccessToken: FAILED after ${totalDuration}ms`);
    console.error('[ERROR] getGcloudAccessToken: Failed to get token using configured key file:', err);
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
    expiresAt: Date.now() + CACHE_DURATION_MS
  };
  
  const totalDuration = Date.now() - startTime;
  console.error(`[TIMING] getGcloudAccessTokenWithConfig: NEW TOKEN CACHED - ${totalDuration}ms`);
  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] getGcloudAccessTokenWithConfig: Token cached for 5 minutes');
  }
  
  return token;
}

/**
 * Create GoogleAuth instance using the configured key file approach
 * @param options Authentication options
 * @returns GoogleAuth instance and strategy used
 */
export async function createAuth(options: DataprocClientOptions = {}): Promise<AuthResult> {
  const startTime = Date.now();
  console.error(`[TIMING] createAuth: Starting authentication process`);
  const { keyFilename, useApplicationDefault } = options;
  
  // Log environment configuration for debugging
  console.error(`[DEBUG] createAuth: Environment configuration:`, {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET',
    USE_APPLICATION_DEFAULT: process.env.USE_APPLICATION_DEFAULT || 'NOT SET',
    LOG_LEVEL: process.env.LOG_LEVEL || 'NOT SET',
    keyFilename: keyFilename ? 'provided' : 'not provided',
    useApplicationDefault: useApplicationDefault
  });
  
  // Strategy 1: Use configured key file (preferred per MWAA guide)
  const keyPath = keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS;
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
      
      console.error(`[TIMING] createAuth: Key file auth SUCCESS - token test: ${tokenTestDuration}ms, total: ${keyFileTotal}ms`);
      if (process.env.LOG_LEVEL === 'debug') {
        console.error('[DEBUG] createAuth: Key file authentication successful');
      }
      
      return {
        strategy: AuthStrategy.KEY_FILE,
        success: true,
        auth
      };
    } catch (error) {
      const keyFileFailDuration = Date.now() - startTime;
      console.error(`[TIMING] createAuth: Key file strategy FAILED after ${keyFileFailDuration}ms`);
      console.warn(`[WARN] createAuth: Key file strategy failed: ${error}`);
    }
  }
  
  // Strategy 2: Application Default Credentials (fallback)
  try {
    const adcStartTime = Date.now();
    console.error(`[TIMING] createAuth: Attempting application default credentials`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] createAuth: Using application default credentials');
    }
    
    const authCreateStartTime = Date.now();
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const authCreateDuration = Date.now() - authCreateStartTime;
    console.error(`[TIMING] createAuth: ADC GoogleAuth instance created in ${authCreateDuration}ms`);
    
    // Test the auth by getting a token
    const tokenTestStartTime = Date.now();
    console.error(`[TIMING] createAuth: Testing ADC token acquisition...`);
    await auth.getAccessToken();
    const tokenTestDuration = Date.now() - tokenTestStartTime;
    const adcTotal = Date.now() - adcStartTime;
    const totalDuration = Date.now() - startTime;
    
    console.error(`[TIMING] createAuth: ADC auth SUCCESS - token test: ${tokenTestDuration}ms, adc total: ${adcTotal}ms, overall total: ${totalDuration}ms`);
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[DEBUG] createAuth: Application default credentials successful');
    }
    
    return {
      strategy: AuthStrategy.APPLICATION_DEFAULT,
      success: true,
      auth
    };
  } catch (error) {
    const totalFailDuration = Date.now() - startTime;
    console.error(`[TIMING] createAuth: ADC strategy FAILED after ${totalFailDuration}ms`);
    console.warn(`[WARN] createAuth: Application default credentials failed: ${error}`);
  }
  
  const totalDuration = Date.now() - startTime;
  console.error(`[TIMING] createAuth: ALL STRATEGIES FAILED after ${totalDuration}ms`);
  return {
    strategy: AuthStrategy.APPLICATION_DEFAULT,
    success: false,
    error: 'All authentication strategies failed'
  };
}

/**
 * Creates a Dataproc ClusterControllerClient with simplified authentication
 * @param options Client configuration options
 * @returns Configured ClusterControllerClient
 */
export async function createDataprocClient(options: DataprocClientOptions = {}): Promise<ClusterControllerClient> {
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
    console.error(`[DEBUG] createDataprocClient: Using authentication strategy: ${authResult.strategy}`);
  }

  return new ClusterControllerClient(clientOptions);
}

/**
 * Creates a Dataproc JobControllerClient with simplified authentication
 * @param options Client configuration options
 * @returns Configured JobControllerClient
 */
export async function createJobClient(options: DataprocClientOptions = {}): Promise<JobControllerClient> {
  const startTime = Date.now();
  console.error(`[TIMING] createJobClient: Starting job client creation`);
  const { region } = options;
  
  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] createJobClient: Starting with options:', {
      region,
      keyFilename: options.keyFilename ? 'provided' : 'not provided',
      useApplicationDefault: options.useApplicationDefault
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
  
  console.error(`[TIMING] createJobClient: SUCCESS - auth: ${authDuration}ms, client creation: ${clientCreateDuration}ms, total: ${totalDuration}ms`);
  
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

