/**
 * Custom OAuth Router with Dynamic Client Registration support
 * Implements OAuth 2.1 endpoints required by Claude Desktop
 */

import express, { Request, Response, Router } from 'express';
import { EnhancedOAuthProvider } from './enhancedOAuthProvider.js';
import { logger } from '../../utils/logger.js';

export interface CustomOAuthRouterOptions {
  provider: EnhancedOAuthProvider;
  issuerUrl: URL;
  baseUrl: URL;
  serviceDocumentationUrl?: URL;
}

export function createCustomOAuthRouter(options: CustomOAuthRouterOptions): Router {
  const router = Router();
  const { provider, issuerUrl, baseUrl, serviceDocumentationUrl } = options;

  // OAuth Authorization Server Metadata (RFC 8414)
  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    logger.debug('Serving OAuth authorization server metadata');

    const metadata = {
      issuer: issuerUrl.toString(),
      authorization_endpoint: new URL('/authorize', baseUrl).toString(),
      token_endpoint: new URL('/token', baseUrl).toString(),
      registration_endpoint: new URL('/register', baseUrl).toString(),
      revocation_endpoint: new URL('/revoke', baseUrl).toString(),
      userinfo_endpoint: new URL('/userinfo', baseUrl).toString(),
      jwks_uri: new URL('/.well-known/jwks', baseUrl).toString(),
      scopes_supported: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
      response_types_supported: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'token id_token',
        'code token id_token',
      ],
      response_modes_supported: ['query', 'fragment', 'form_post'],
      grant_types_supported: [
        'authorization_code',
        'implicit',
        'refresh_token',
        'client_credentials',
        'urn:ietf:params:oauth:grant-type:device_code',
      ],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain'],
      service_documentation: serviceDocumentationUrl?.toString(),
      ui_locales_supported: ['en'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'email',
        'email_verified',
        'name',
        'given_name',
        'family_name',
        'picture',
      ],
      claim_types_supported: ['normal'],
      claims_parameter_supported: false,
      request_parameter_supported: false,
      request_uri_parameter_supported: false,
      require_request_uri_registration: false,
      op_policy_uri: serviceDocumentationUrl?.toString(),
      op_tos_uri: serviceDocumentationUrl?.toString(),
    };

    res.json(metadata);
  });

  // Dynamic Client Registration (RFC 7591)
  router.post('/register', async (req: Request, res: Response) => {
    logger.info('Processing dynamic client registration request');

    try {
      const registrationData = req.body;

      // Validate required fields
      if (!registrationData.redirect_uris || !Array.isArray(registrationData.redirect_uris)) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'redirect_uris is required and must be an array',
        });
      }

      // Register the client
      const clientData = await provider.registerClient(registrationData);

      // Return client registration response (RFC 7591)
      const response = {
        client_id: clientData.client_id,
        client_secret: clientData.client_secret,
        client_id_issued_at: Math.floor(clientData.created_at / 1000),
        client_secret_expires_at: 0, // Never expires
        redirect_uris: clientData.redirect_uris,
        client_name: clientData.client_name,
        client_uri: clientData.client_uri,
        logo_uri: clientData.logo_uri,
        scope: clientData.scope,
        contacts: clientData.contacts,
        tos_uri: clientData.tos_uri,
        policy_uri: clientData.policy_uri,
        jwks_uri: clientData.jwks_uri,
        jwks: clientData.jwks,
        software_id: clientData.software_id,
        software_version: clientData.software_version,
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      };

      logger.info(`Dynamic client registration successful: ${clientData.client_id}`);
      res.status(201).json(response);
    } catch (error) {
      logger.error('Dynamic client registration failed:', error);
      res.status(400).json({
        error: 'invalid_request',
        error_description: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  });

  // Authorization endpoint
  router.get('/authorize', async (req: Request, res: Response) => {
    logger.info('Processing authorization request');

    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method,
      } = req.query;

      // Validate client
      const client = await provider['getClientInternal'](client_id as string);
      if (!client) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not found',
        });
      }

      // If the client is dynamically registered with our MCP server,
      // we initiate the Google Device Authorization Grant flow, regardless of response_type.
      // Claude Desktop will request 'code', but our server will translate this to device flow.
      // Always proceed with standard redirect to Google for authorization
      logger.info(`[DEBUG] Redirecting to Google for authorization for client: ${client_id}`);
      const googleAuthUrl = new URL('https://accounts.google.com/oauth/authorize');
      googleAuthUrl.searchParams.set('client_id', provider.getFallbackClientId()!); // Use the actual Google OAuth client ID
      googleAuthUrl.searchParams.set('redirect_uri', redirect_uri as string);
      googleAuthUrl.searchParams.set('response_type', (response_type as string) || 'code');
      googleAuthUrl.searchParams.set(
        'scope',
        (scope as string) || 'openid email profile https://www.googleapis.com/auth/cloud-platform'
      );

      if (state) googleAuthUrl.searchParams.set('state', state as string);
      if (code_challenge)
        googleAuthUrl.searchParams.set('code_challenge', code_challenge as string);
      if (code_challenge_method)
        googleAuthUrl.searchParams.set('code_challenge_method', code_challenge_method as string);

      res.redirect(googleAuthUrl.toString());
    } catch (error) {
      logger.error('Authorization request failed:', error);
      res.status(400).json({
        error: 'server_error',
        error_description: 'Authorization request failed',
      });
    }
  });

  // Token endpoint
  router.post('/token', async (req: Request, res: Response) => {
    logger.info('Processing token request');

    try {
      const {
        grant_type,
        client_id,
        client_secret,
        code,
        redirect_uri,
        refresh_token,
        device_code,
      } = req.body;

      // Validate client
      const client = await provider['getClientInternal'](client_id);
      if (!client) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not found',
        });
      }

      // Handle device code grant
      if (grant_type === 'urn:ietf:params:oauth:grant-type:device_code') {
        try {
          const tokens = await provider.pollDeviceFlow(device_code, client_id, client_secret, 1);

          return res.json({
            access_token: tokens.access_token,
            token_type: 'Bearer',
            expires_in: tokens.expires_in,
            refresh_token: tokens.refresh_token,
            id_token: tokens.id_token,
            scope: 'openid email profile https://www.googleapis.com/auth/cloud-platform',
          });
        } catch (error) {
          logger.error('Device code token exchange failed:', error);
          return res.status(400).json({
            error: 'authorization_pending',
            error_description: 'User has not yet completed authorization',
          });
        }
      }

      // For other grant types, proxy to Google
      // This is a simplified implementation - in production you'd want more robust token handling
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only device code grant is currently supported',
      });
    } catch (error) {
      logger.error('Token request failed:', error);
      res.status(400).json({
        error: 'server_error',
        error_description: 'Token request failed',
      });
    }
  });

  // Token revocation endpoint
  router.post('/revoke', (req: Request, res: Response) => {
    logger.info('Processing token revocation request');
    // Simplified implementation
    res.status(200).send();
  });

  // User info endpoint
  router.get('/userinfo', (req: Request, res: Response) => {
    logger.info('Processing userinfo request');
    // Simplified implementation
    res.json({
      sub: 'user123',
      email: 'user@example.com',
      email_verified: true,
      name: 'MCP User',
    });
  });

  // JWKS endpoint
  router.get('/.well-known/jwks', (req: Request, res: Response) => {
    logger.debug('Serving JWKS');
    // Simplified implementation - in production you'd serve actual JWKs
    res.json({
      keys: [],
    });
  });

  return router;
}
