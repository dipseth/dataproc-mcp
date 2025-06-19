/**
 * Enhanced OAuth Provider with Dynamic Client Registration and Google Device Flow support
 * Extends ProxyOAuthServerProvider to add dynamic client registration capabilities
 */

import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { JsonFileClientStore, ClientData } from './jsonFileClientStore.js';
import { logger } from '../../utils/logger.js';
import axios from 'axios';
import { randomUUID } from 'node:crypto';

export interface EnhancedOAuthProviderOptions {
  endpoints: {
    authorizationUrl: string;
    tokenUrl: string;
    revocationUrl?: string;
  };
  clientStore: JsonFileClientStore;
  fallbackClientId?: string;
  fallbackClientSecret?: string; // Added for Google Device Flow
  fallbackRedirectUris?: string[];
}

export class EnhancedOAuthProvider extends ProxyOAuthServerProvider {
  private clientStore: JsonFileClientStore;
  private fallbackClientId?: string;
  private fallbackClientSecret?: string; // Stored for Google Device Flow
  private fallbackRedirectUris?: string[];

  constructor(options: EnhancedOAuthProviderOptions) {
    super({
      endpoints: options.endpoints,
      verifyAccessToken: async (token: string) => {
        // Implement token verification logic
        logger.debug('Verifying access token:', token.substring(0, 10) + '...');

        return {
          token,
          clientId: options.fallbackClientId || 'unknown',
          scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/cloud-platform'],
        };
      },
      getClient: async (clientId: string) => {
        return await this.getClientInternal(clientId);
      },
    });

    this.clientStore = options.clientStore;
    this.fallbackClientId = options.fallbackClientId;
    this.fallbackClientSecret = options.fallbackClientSecret; // Store the new secret
    this.fallbackRedirectUris = options.fallbackRedirectUris;
  }

  /**
   * Internal method to get client information
   */
  private async getClientInternal(clientId: string) {
    // First try to get client from dynamic registration store
    const storedClient = await this.clientStore.get(clientId);
    if (storedClient) {
      logger.debug(`Retrieved dynamically registered client: ${clientId}`);
      return {
        client_id: storedClient.client_id,
        redirect_uris: storedClient.redirect_uris,
        client_name: storedClient.client_name,
        client_uri: storedClient.client_uri,
        logo_uri: storedClient.logo_uri,
        scope: storedClient.scope,
        contacts: storedClient.contacts,
        tos_uri: storedClient.tos_uri,
        policy_uri: storedClient.policy_uri,
        jwks_uri: storedClient.jwks_uri,
        jwks: storedClient.jwks,
        software_id: storedClient.software_id,
        software_version: storedClient.software_version,
      };
    }

    // Fallback to configured client (for backwards compatibility)
    if (clientId === this.fallbackClientId) {
      logger.debug(`Using configured OAuth proxy client: ${clientId}`);
      return {
        client_id: clientId,
        redirect_uris: this.fallbackRedirectUris || ['http://localhost:3000/callback'],
      };
    }

    // Client not found
    logger.warn(`Client not found: ${clientId}`);
    return undefined;
  }

  /**
   * Handle dynamic client registration
   */
  async registerClient(registrationData: any): Promise<ClientData> {
    logger.info('Processing dynamic client registration request');

    // Validate required fields
    if (!registrationData.redirect_uris || !Array.isArray(registrationData.redirect_uris)) {
      throw new Error('redirect_uris is required and must be an array');
    }

    // Create new client using the client store
    const clientData = await this.clientStore.create(registrationData);

    logger.info(`Successfully registered new client: ${clientData.client_id}`);

    return clientData;
  }

  /**
   * Initiate Google Device Authorization Grant flow
   */
  async initiateDeviceFlow(
    clientId: string,
    scopes: string[] = ['https://www.googleapis.com/auth/cloud-platform']
  ): Promise<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }> {
    logger.info('Initiating Google Device Authorization Grant flow');

    const deviceAuthUrl = 'https://oauth2.googleapis.com/device/code';

    try {
      const requestParams: any = {
        client_id: clientId,
        scope: scopes.join(' '),
      };

      // Include client_secret for "Other" client types if available
      if (this.fallbackClientSecret) {
        requestParams.client_secret = this.fallbackClientSecret;
        logger.debug(`Including client_secret in device flow initiation request.`);
      }

      logger.debug(
        `Sending device authorization request to ${deviceAuthUrl} with params: ${JSON.stringify(requestParams)}`
      );

      const response = await axios.post(deviceAuthUrl, null, {
        params: requestParams,
      });

      const { device_code, user_code, verification_url, expires_in, interval } = response.data;

      logger.info(
        `Device flow initiated. User code: ${user_code}, Verification URL: ${verification_url}`
      );

      // Display instructions to user
      console.log('\n==============================================');
      console.log('🔐 GOOGLE AUTHENTICATION REQUIRED');
      console.log('==============================================');
      console.log(`Please open the following URL in your browser:`);
      console.log(`${verification_url}`);
      console.log('');
      console.log(`And enter the following code:`);
      console.log(`${user_code}`);
      console.log('==============================================\n');

      return {
        device_code,
        user_code,
        verification_url,
        expires_in,
        interval,
      };
    } catch (error: any) {
      logger.error('Failed to initiate device flow:', error.response?.data || error.message);
      throw new Error(
        `Failed to initiate device flow: ${error.response?.data?.error_description || error.message}`
      );
    }
  }

  /**
   * Poll for device flow completion and get tokens
   */
  async pollDeviceFlow(
    deviceCode: string,
    clientId: string,
    clientSecret?: string,
    interval: number = 5
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  }> {
    logger.info('Polling for device flow completion');

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        attempts++;

        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          reject(new Error('Device flow timed out'));
          return;
        }

        try {
          const params: any = {
            client_id: clientId,
            code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          };

          if (clientSecret) {
            params.client_secret = clientSecret;
          }

          const response = await axios.post(tokenUrl, null, { params });

          const { access_token, refresh_token, id_token, expires_in } = response.data;

          clearInterval(pollInterval);
          logger.info('Device flow completed successfully');

          resolve({
            access_token,
            refresh_token,
            id_token,
            expires_in,
          });
        } catch (error: any) {
          if (
            error.response &&
            error.response.data &&
            error.response.data.error === 'authorization_pending'
          ) {
            // Authorization pending, continue polling
            logger.debug(
              `Device flow polling attempt ${attempts}/${maxAttempts} - authorization pending`
            );
          } else if (
            error.response &&
            error.response.data &&
            error.response.data.error === 'slow_down'
          ) {
            // Slow down polling
            logger.debug('Device flow polling - slow down requested');
          } else {
            clearInterval(pollInterval);
            logger.error('Device flow polling failed:', error.response?.data || error.message);
            reject(
              new Error(
                `Device flow failed: ${error.response?.data?.error_description || error.message}`
              )
            );
          }
        }
      }, interval * 1000);
    });
  }

  /**
   * Complete device flow authentication
   */
  async authenticateWithDeviceFlow(
    clientId: string,
    clientSecret?: string,
    scopes?: string[]
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  }> {
    // Step 1: Initiate device flow
    const deviceFlowData = await this.initiateDeviceFlow(clientId, scopes);

    // Step 2: Poll for completion
    return await this.pollDeviceFlow(
      deviceFlowData.device_code,
      clientId,
      clientSecret,
      deviceFlowData.interval
    );
  }
}
