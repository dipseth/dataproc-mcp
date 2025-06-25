/**
 * GitHub OAuth Router for Express
 * Handles GitHub OAuth 2.0 flow endpoints
 */

import { Router, Request, Response } from 'express';
import { GitHubOAuthProvider, GitHubOAuthConfig } from './githubOAuthProvider.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'node:crypto';

export interface GitHubOAuthRouterOptions {
  provider: GitHubOAuthProvider;
  sessionStore?: Map<string, any>;
  successRedirect?: string;
  errorRedirect?: string;
}

export function createGitHubOAuthRouter(options: GitHubOAuthRouterOptions): Router {
  const router = Router();
  const {
    provider,
    sessionStore = new Map(),
    successRedirect = '/success',
    errorRedirect = '/error',
  } = options;

  // Store active OAuth states to prevent CSRF
  const oauthStates = new Map<
    string,
    { timestamp: number; sessionId?: string; redirectUri?: string }
  >();

  // Clean up expired states every 10 minutes
  setInterval(
    () => {
      const now = Date.now();
      for (const [state, data] of oauthStates.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) {
          // 10 minutes
          oauthStates.delete(state);
        }
      }
    },
    10 * 60 * 1000
  );

  /**
   * GET /auth/github - Initiate GitHub OAuth flow
   */
  router.get('/auth/github', (req: Request, res: Response) => {
    try {
      const state = randomUUID();
      const sessionId = req.headers['mcp-session-id'] as string;

      // Get redirect URI from query parameters (for MCP Inspector)
      const redirectUri = req.query.redirect_uri as string;

      // Store state for CSRF protection, including the redirect URI
      oauthStates.set(state, {
        timestamp: Date.now(),
        sessionId,
        redirectUri,
      });

      // Use custom redirect URI if provided, otherwise use default
      const authUrl = redirectUri
        ? provider.generateAuthUrl(state, redirectUri)
        : provider.generateAuthUrl(state);

      logger.info(`Generated GitHub authorization URL: "${authUrl}"`);
      logger.info(`GitHub OAuth: Redirecting to authorization URL for session ${sessionId}`);
      if (redirectUri) {
        logger.info(`Using custom redirect URI: ${redirectUri}`);
      }

      // For MCP clients, return JSON with the auth URL
      if (req.headers.accept?.includes('application/json')) {
        res.json({
          authUrl,
          state,
          message: 'Please visit the authorization URL to complete GitHub OAuth',
        });
      } else {
        // For browser clients, redirect directly
        res.redirect(authUrl);
      }
    } catch (error: any) {
      logger.error('GitHub OAuth initiation failed:', error);
      res.status(500).json({
        error: 'OAuth initiation failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /auth/github/callback - Handle GitHub OAuth callback
   */
  router.get('/auth/github/callback', async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        logger.error('GitHub OAuth error:', error);
        return res.redirect(`${errorRedirect}?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        logger.error('GitHub OAuth: Missing code or state parameter');
        return res.redirect(`${errorRedirect}?error=missing_parameters`);
      }

      // Verify state to prevent CSRF
      const stateData = oauthStates.get(state as string);
      if (!stateData) {
        logger.error('GitHub OAuth: Invalid or expired state parameter');
        return res.redirect(`${errorRedirect}?error=invalid_state`);
      }

      // Clean up used state
      oauthStates.delete(state as string);

      // If this was initiated by MCP Inspector, redirect the code back to its callback
      if (stateData.redirectUri && stateData.redirectUri.includes('oauth/callback/debug')) {
        logger.info(
          `Redirecting authorization code back to MCP Inspector: ${stateData.redirectUri}`
        );
        const redirectUrl = new URL(stateData.redirectUri);
        redirectUrl.searchParams.set('code', code as string);
        redirectUrl.searchParams.set('state', state as string);
        return res.redirect(redirectUrl.toString());
      }

      // Exchange code for token (for regular web flow)
      const tokenData = await provider.exchangeCodeForToken(code as string, state as string);

      // Verify the token and get user info
      const userInfo = await provider.verifyGitHubToken(tokenData.access_token);

      // Store token in session
      if (stateData.sessionId) {
        sessionStore.set(stateData.sessionId, {
          accessToken: tokenData.access_token,
          tokenType: tokenData.token_type,
          scope: tokenData.scope,
          userInfo,
          timestamp: Date.now(),
        });

        logger.info(
          `GitHub OAuth: Successfully authenticated user ${userInfo.username} for session ${stateData.sessionId}`
        );
      }

      // Redirect to success page
      res.redirect(`${successRedirect}?user=${encodeURIComponent(userInfo.username)}`);
    } catch (error: any) {
      logger.error('GitHub OAuth callback failed:', error);
      res.redirect(`${errorRedirect}?error=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * GET /auth/github/status - Check authentication status
   */
  router.get('/auth/github/status', (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string;

      if (!sessionId) {
        return res.status(400).json({
          authenticated: false,
          error: 'Missing session ID',
        });
      }

      const sessionData = sessionStore.get(sessionId);

      if (!sessionData || !sessionData.accessToken) {
        return res.json({
          authenticated: false,
          message: 'Not authenticated',
        });
      }

      // Check if token is still valid (basic check)
      const tokenAge = Date.now() - sessionData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (tokenAge > maxAge) {
        sessionStore.delete(sessionId);
        return res.json({
          authenticated: false,
          message: 'Token expired',
        });
      }

      res.json({
        authenticated: true,
        user: sessionData.userInfo,
        tokenType: sessionData.tokenType,
        scope: sessionData.scope,
      });
    } catch (error: any) {
      logger.error('GitHub OAuth status check failed:', error);
      res.status(500).json({
        authenticated: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /auth/github/logout - Logout and revoke token
   */
  router.post('/auth/github/logout', async (req: Request, res: Response) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing session ID',
        });
      }

      const sessionData = sessionStore.get(sessionId);

      if (sessionData && sessionData.accessToken) {
        try {
          // Revoke the GitHub token
          await provider.revokeToken(sessionData.accessToken);
          logger.info(`GitHub OAuth: Revoked token for session ${sessionId}`);
        } catch (error: any) {
          logger.warn('Failed to revoke GitHub token:', error.message);
          // Continue with logout even if revocation fails
        }
      }

      // Remove session data
      sessionStore.delete(sessionId);

      res.json({
        success: true,
        message: 'Successfully logged out',
      });
    } catch (error: any) {
      logger.error('GitHub OAuth logout failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
