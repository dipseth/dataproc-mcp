/**
 * Credentials management for Google Cloud authentication
 */

import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { ClusterControllerClient } from '@google-cloud/dataproc';
import { execSync } from 'child_process';

/**
 * Options for creating a Dataproc client
 */
export interface DataprocClientOptions {
  projectId?: string;
  region?: string;
  keyFilename?: string;
  useApplicationDefault?: boolean;
  impersonateServiceAccount?: string; // Service account email to impersonate
}

/**
 * Creates a Dataproc ClusterControllerClient with the specified authentication
 * @param options Client configuration options
 * @returns Configured ClusterControllerClient
 */
import { IAMCredentialsClient } from '@google-cloud/iam-credentials';

/**
 * Helper to get an access token for a target service account using impersonation.
 * @param targetServiceAccount Service account email to impersonate
 * @param scopes OAuth scopes for the token
 * @returns Promise<string> Access token
 */
/**
 * Gets an access token from gcloud CLI, which will use the impersonation
 * settings from gcloud config if present
 * @returns Access token from gcloud CLI
 */
export function getGcloudAccessToken(): string {
  console.log('[DEBUG] getGcloudAccessToken: Getting token from gcloud CLI');
  try {
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    console.log('[DEBUG] getGcloudAccessToken: Successfully obtained token from gcloud CLI');
    return token;
  } catch (err) {
    console.error('[DEBUG] getGcloudAccessToken: Error getting token from gcloud CLI:', err);
    throw new Error(`Failed to get access token from gcloud CLI: ${err}`);
  }
}

/**
 * Creates a Dataproc ClusterControllerClient with the specified authentication,
 * supporting service account impersonation if requested.
 * @param options Client configuration options
 * @returns Configured ClusterControllerClient
 */
export async function createDataprocClient(options: DataprocClientOptions = {}): Promise<ClusterControllerClient> {
  const { region, keyFilename, useApplicationDefault, impersonateServiceAccount } = options;

  // Set up client options
  const clientOptions: Record<string, any> = {};

  // Configure region-specific endpoint if provided
  if (region) {
    clientOptions.apiEndpoint = `${region}-dataproc.googleapis.com:443`;
    // Debug log: print the endpoint being used
    console.log('[DEBUG] createDataprocClient: using apiEndpoint:', clientOptions.apiEndpoint);
  }

  // Service account impersonation using gcloud CLI token
  if (impersonateServiceAccount) {
    console.log('[DEBUG] createDataprocClient: using gcloud CLI token with impersonation');
    // Get token from gcloud CLI (which will use impersonation from gcloud config)
    const token = getGcloudAccessToken();
    
    // Create an OAuth2Client with the token
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: token,
      token_type: 'Bearer'
    });
    
    // Use the OAuth2Client as the auth object
    clientOptions.auth = oauth2Client;
    
    console.log('[DEBUG] createDataprocClient: using OAuth2Client with token from gcloud CLI');
  } else if (useApplicationDefault || !keyFilename) {
    // Do not set auth property; let Dataproc client use ADC by default
    console.log('[DEBUG] createDataprocClient: using application default credentials (no explicit auth property)');
    // Note: Cannot reliably print the active service account email from ADC at runtime
    console.log('[DEBUG] (Note) Could not determine active service account email from ADC at runtime');
  } else if (keyFilename) {
    // Use service account key file
    clientOptions.keyFilename = keyFilename;
    console.log('[DEBUG] createDataprocClient: using keyFilename:', keyFilename);
    // Try to print the service account email from the key file
    try {
      const key = await import('fs').then(fs => fs.readFileSync(keyFilename, 'utf8'));
      const keyObj = JSON.parse(key);
      if (keyObj.client_email) {
        console.log('[DEBUG] Service account from key file:', keyObj.client_email);
      }
    } catch (e) {
      console.log('[DEBUG] Could not read service account email from key file:', (e as any).message);
    }
  }

  // Create and return the client
  return new ClusterControllerClient(clientOptions);
}

/**
 * Creates a Dataproc JobControllerClient for job operations
 * @param options Client configuration options
 * @returns Configured JobControllerClient
 */
export function createJobClient(options: DataprocClientOptions = {}): any {
  const { region, keyFilename, useApplicationDefault, impersonateServiceAccount } = options;
  
  console.log('[DEBUG] createJobClient: Starting with options:', {
    region,
    keyFilename: keyFilename ? 'provided' : 'not provided',
    useApplicationDefault,
    impersonateServiceAccount
  });
  
  // Set up client options
  const clientOptions: Record<string, any> = {};
  
  // Configure region-specific endpoint if provided
  if (region) {
    clientOptions.apiEndpoint = `${region}-dataproc.googleapis.com:443`;
    console.log('[DEBUG] createJobClient: using apiEndpoint:', clientOptions.apiEndpoint);
  }
  
  // Service account impersonation using gcloud CLI token
  if (impersonateServiceAccount) {
    console.log('[DEBUG] createJobClient: using gcloud CLI token with impersonation');
    // Get token from gcloud CLI (which will use impersonation from gcloud config)
    const token = getGcloudAccessToken();
    
    // Create an OAuth2Client with the token
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: token,
      token_type: 'Bearer'
    });
    
    // Create a GoogleAuth instance with the OAuth2Client as the authClient
    // This fixes the "this.auth.getUniverseDomain is not a function" error
    const auth = new GoogleAuth({
      authClient: oauth2Client,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    // Use the GoogleAuth instance as the auth object
    clientOptions.auth = auth;
    
    console.log('[DEBUG] createJobClient: using GoogleAuth with OAuth2Client from gcloud CLI token');
  } else if (useApplicationDefault || !keyFilename) {
    // Use application default credentials
    console.log('[DEBUG] createJobClient: using application default credentials');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    clientOptions.auth = auth;
  } else if (keyFilename) {
    // Use service account key file
    console.log('[DEBUG] createJobClient: using keyFilename:', keyFilename);
    clientOptions.keyFilename = keyFilename;
  }
  
  // Create and return the client
  // We need to dynamically import this to avoid TypeScript errors
  // since we're using the v1 namespace
  console.log('[DEBUG] createJobClient: dynamically importing JobControllerClient');
  
  // Use dynamic import for ES modules compatibility
  return import('@google-cloud/dataproc').then(dataproc => {
    const { JobControllerClient } = dataproc.v1;
    console.log('[DEBUG] createJobClient: creating JobControllerClient');
    return new JobControllerClient(clientOptions);
  });
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
