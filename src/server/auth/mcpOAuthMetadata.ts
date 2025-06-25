/**
 * MCP OAuth Metadata Provider
 * Provides OAuth discovery endpoints that MCP Inspector expects
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';

export interface OAuthMetadataOptions {
  baseUrl: string;
  clientId: string;
  httpPort?: number;
  httpsPort?: number;
}

export function createOAuthMetadataRouter(
  options: OAuthMetadataOptions & { clientSecret?: string }
): Router {
  const router = Router();
  const { baseUrl, clientId, clientSecret, httpPort = 8080, httpsPort = 8443 } = options;

  /**
   * Get the appropriate base URL based on the requesting protocol
   */
  function getProtocolAwareBaseUrl(req: Request): string {
    const protocol = req.protocol;
    const port = protocol === 'https' ? httpsPort : httpPort;
    return `${protocol}://localhost:${port}`;
  }

  /**
   * OAuth 2.0 Authorization Server Metadata (RFC 8414)
   * This is what MCP Inspector looks for to discover OAuth endpoints
   */
  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    logger.info('MCP Inspector requesting OAuth metadata');

    const protocolAwareBaseUrl = getProtocolAwareBaseUrl(req);
    logger.info(`Returning OAuth metadata with protocol-aware base URL: ${protocolAwareBaseUrl}`);

    const metadata = {
      issuer: protocolAwareBaseUrl,
      authorization_endpoint: `${protocolAwareBaseUrl}/auth/github`,
      token_endpoint: `${protocolAwareBaseUrl}/auth/github/token`,
      userinfo_endpoint: `${protocolAwareBaseUrl}/auth/github/userinfo`,
      revocation_endpoint: `${protocolAwareBaseUrl}/auth/github/revoke`,
      registration_endpoint: `${protocolAwareBaseUrl}/oauth/register`,
      scopes_supported: ['read:user', 'user:email'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    };

    res.json(metadata);
  });

  /**
   * OpenID Connect Discovery (for compatibility)
   */
  router.get('/.well-known/openid_configuration', (req: Request, res: Response) => {
    logger.info('MCP Inspector requesting OpenID Connect metadata');

    const protocolAwareBaseUrl = getProtocolAwareBaseUrl(req);
    logger.info(
      `Returning OpenID Connect metadata with protocol-aware base URL: ${protocolAwareBaseUrl}`
    );

    const metadata = {
      issuer: protocolAwareBaseUrl,
      authorization_endpoint: `${protocolAwareBaseUrl}/auth/github`,
      token_endpoint: `${protocolAwareBaseUrl}/auth/github/token`,
      userinfo_endpoint: `${protocolAwareBaseUrl}/auth/github/userinfo`,
      end_session_endpoint: `${protocolAwareBaseUrl}/auth/github/logout`,
      scopes_supported: ['openid', 'profile', 'email'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    };

    res.json(metadata);
  });

  /**
   * MCP-specific OAuth client registration endpoint
   */
  router.post('/oauth/register', (req: Request, res: Response) => {
    logger.info('MCP Inspector requesting client registration');

    const protocolAwareBaseUrl = getProtocolAwareBaseUrl(req);
    logger.info(`Using protocol-aware base URL for client registration: ${protocolAwareBaseUrl}`);

    // Extract redirect URIs from request if provided
    const requestedRedirectUris = req.body?.redirect_uris || [];

    // Support both our callback and any MCP Inspector redirect URIs
    const redirectUris = [`${protocolAwareBaseUrl}/auth/github/callback`, ...requestedRedirectUris];

    // Return pre-configured client info
    const clientInfo = {
      client_id: clientId,
      client_secret: 'not_needed_for_public_client',
      redirect_uris: redirectUris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: 'read:user user:email',
      token_endpoint_auth_method: 'none', // Public client
    };

    logger.info('Client registration response:', {
      client_id: clientId,
      redirect_uris: redirectUris,
    });

    res.json(clientInfo);
  });

  /**
   * Token endpoint (proxies to GitHub)
   */
  router.post('/auth/github/token', async (req: Request, res: Response) => {
    try {
      logger.info('Token exchange request from MCP Inspector', req.body);

      // Handle both JSON and form-encoded requests
      const { code, redirect_uri, client_id, code_verifier } = req.body;

      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing authorization code',
        });
      }

      // Exchange code for token with GitHub
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirect_uri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        logger.error('GitHub token exchange failed:', tokenData);
        return res.status(400).json({
          error: tokenData.error,
          error_description: tokenData.error_description,
        });
      }

      logger.info('Successfully exchanged code for GitHub token');

      res.json({
        access_token: tokenData.access_token,
        token_type: 'Bearer',
        scope: tokenData.scope || 'read:user user:email',
        expires_in: 3600,
      });
    } catch (error: any) {
      logger.error('Token exchange failed:', error);
      res.status(400).json({
        error: 'invalid_request',
        error_description: error.message,
      });
    }
  });

  /**
   * User info endpoint
   */
  router.get('/auth/github/userinfo', (req: Request, res: Response) => {
    logger.info('User info request from MCP Inspector');

    // Mock user info for inspector
    res.json({
      sub: 'github_user_123',
      name: 'GitHub User',
      email: 'user@example.com',
      login: 'github_user',
    });
  });

  return router;
}
