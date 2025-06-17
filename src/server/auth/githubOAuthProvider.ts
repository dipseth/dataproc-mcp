/**
 * GitHub OAuth Provider for MCP Server
 * Implements GitHub OAuth 2.0 flow for Claude Desktop integration
 */

import { logger } from '../../utils/logger.js';
import axios from 'axios';
import { randomUUID } from 'node:crypto';

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface GitHubTokenInfo {
  token: string;
  clientId: string;
  scopes: string[];
  userId: string;
  username: string;
  email?: string;
}

export class GitHubOAuthProvider {
  private config: GitHubOAuthConfig;

  constructor(config: GitHubOAuthConfig) {
    this.config = config;
  }

  /**
   * Verify GitHub access token by calling GitHub API
   */
  async verifyGitHubToken(token: string): Promise<GitHubTokenInfo> {
    try {
      logger.debug('Verifying GitHub access token:', token.substring(0, 10) + '...');

      // Call GitHub API to verify token and get user info
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Dataproc-MCP-Server',
        },
      });

      const user = response.data;
      logger.info(`GitHub OAuth: Verified token for user ${user.login} (${user.id})`);

      return {
        token,
        clientId: this.config.clientId,
        scopes: this.config.scopes || ['read:user', 'user:email'],
        userId: user.id.toString(),
        username: user.login,
        email: user.email,
      };
    } catch (error: any) {
      logger.error('GitHub token verification failed:', error.response?.data || error.message);
      throw new Error(`Invalid GitHub token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state?: string): Promise<any> {
    try {
      logger.info('Exchanging GitHub authorization code for access token');

      const response = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: this.config.redirectUri,
        },
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Dataproc-MCP-Server',
          },
        }
      );

      const tokenData = response.data;

      if (tokenData.error) {
        throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
      }

      logger.info('Successfully obtained GitHub access token');
      return {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope,
      };
    } catch (error: any) {
      logger.error(
        'Failed to exchange GitHub code for token:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Generate GitHub authorization URL
   */
  generateAuthUrl(state?: string, customRedirectUri?: string): string {
    const redirectUri = customRedirectUri || this.config.redirectUri;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: (this.config.scopes || ['read:user', 'user:email']).join(' '),
      response_type: 'code',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    logger.info('Generated GitHub authorization URL:', authUrl);
    if (customRedirectUri) {
      logger.info('Using custom redirect URI:', customRedirectUri);
    }
    return authUrl;
  }

  /**
   * Revoke GitHub access token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      logger.info('Revoking GitHub access token');

      await axios.delete(`https://api.github.com/applications/${this.config.clientId}/token`, {
        auth: {
          username: this.config.clientId,
          password: this.config.clientSecret,
        },
        data: {
          access_token: token,
        },
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Dataproc-MCP-Server',
        },
      });

      logger.info('Successfully revoked GitHub access token');
    } catch (error: any) {
      logger.error('Failed to revoke GitHub token:', error.response?.data || error.message);
      throw error;
    }
  }
}
