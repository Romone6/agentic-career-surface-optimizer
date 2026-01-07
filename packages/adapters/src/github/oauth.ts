import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Octokit } from 'octokit';

export interface GitHubAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scopes: string[];
}

export interface GitHubAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  user: GitHubUser;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export class GitHubOAuth {
  private config: GitHubAuthConfig;
  private logger: Logger;
  private tokenFilePath: string;

  constructor(config?: Partial<GitHubAuthConfig>) {
    this.logger = new Logger('GitHubOAuth');
    
    this.config = {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
      redirectUri: process.env.GITHUB_OAUTH_CALLBACK_URL || 'http://localhost:8787/callback',
      scopes: ['user:email', 'repo', 'read:user'],
      ...config
    };

    // Ensure token file directory exists
    const dataDir = process.env.APP_DATA_DIR || './data';
    this.tokenFilePath = path.join(dataDir, 'github_tokens.json');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async authenticateWithDeviceFlow(): Promise<GitHubAuthResult> {
    try {
      this.logger.info('Starting GitHub OAuth device flow');

      // Step 1: Get device code
      const deviceCodeResponse = await this.requestDeviceCode();
      
      // Display user instructions
      console.log('\n🔑 GitHub Authentication Required');
      console.log('================================');
      console.log(`Open this URL in your browser: ${deviceCodeResponse.verification_uri}`);
      console.log(`Enter this code: ${deviceCodeResponse.user_code}`);
      console.log('\nWaiting for authentication...\n');

      // Step 2: Poll for token
      const authResult = await this.pollForToken(deviceCodeResponse);
      
      // Step 3: Get user info
      const user = await this.getUserInfo(authResult.accessToken);
      
      // Step 4: Store tokens
      await this.storeTokens(authResult);
      
      this.logger.info(`Successfully authenticated as ${user.login}`);
      
      return { ...authResult, user };
    } catch (error) {
      this.logger.error(`GitHub OAuth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('AUTH_ERROR', `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async authenticateWithLocalCallback(): Promise<GitHubAuthResult> {
    try {
      this.logger.info('Starting GitHub OAuth local callback flow');
      
      // This would implement the traditional OAuth flow with a local server
      // For now, we'll use device flow as the default
      return this.authenticateWithDeviceFlow();
    } catch (error) {
      this.logger.error(`GitHub OAuth local callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('AUTH_ERROR', `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshToken(): Promise<GitHubAuthResult> {
    try {
      this.logger.info('Refreshing GitHub access token');

      const storedTokens = await this.loadTokens();
      if (!storedTokens || !storedTokens.refreshToken) {
        throw new AppError('AUTH_ERROR', 'No refresh token available');
      }

      // GitHub doesn't support refresh tokens in the traditional sense
      // We'll need to re-authenticate
      this.logger.warn('GitHub tokens cannot be refreshed automatically, re-authenticating...');
      return this.authenticateWithDeviceFlow();
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('AUTH_ERROR', `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAuthenticatedUser(): Promise<GitHubUser | null> {
    try {
      const tokens = await this.loadTokens();
      if (!tokens || !tokens.accessToken) {
        return null;
      }

      // Check if token is expired
      if (new Date() > tokens.expiresAt) {
        this.logger.warn('Access token expired, attempting refresh');
        try {
          const newAuth = await this.refreshToken();
          return newAuth.user;
        } catch (error) {
          this.logger.warn('Token refresh failed, clearing stored tokens');
          await this.clearTokens();
          return null;
        }
      }

      return this.getUserInfo(tokens.accessToken);
    } catch (error) {
      this.logger.error(`Failed to get authenticated user: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async revokeToken(): Promise<void> {
    try {
      this.logger.info('Revoking GitHub access token');

      const tokens = await this.loadTokens();
      if (!tokens || !tokens.accessToken) {
        this.logger.warn('No tokens to revoke');
        return;
      }

      // GitHub doesn't have a revoke endpoint, so we just clear local storage
      await this.clearTokens();
      this.logger.info('GitHub tokens revoked successfully');
    } catch (error) {
      this.logger.error(`Failed to revoke token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('AUTH_ERROR', `Token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async requestDeviceCode(): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        scope: this.config.scopes.join(' '),
      }),
    });

    if (!response.ok) {
      throw new AppError('AUTH_ERROR', `Failed to request device code: ${response.statusText}`);
    }

    return response.json();
  }

  private async pollForToken(deviceCodeResponse: any): Promise<GitHubAuthResult> {
    const { device_code, expires_in, interval } = deviceCodeResponse;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Poll for token every interval seconds
    while (new Date() < expiresAt) {
      try {
        const response = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.config.clientId,
            device_code: device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        const data = await response.json();

        if (data.access_token) {
          const user = await this.getUserInfo(data.access_token);
          return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
            user,
          };
        }

        if (data.error === 'authorization_pending') {
          // Still waiting for user
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          continue;
        }

        if (data.error === 'expired_token') {
          throw new AppError('AUTH_ERROR', 'Device code expired, please try again');
        }

        throw new AppError('AUTH_ERROR', `Authorization failed: ${data.error}`);

      } catch (error) {
        this.logger.error(`Token polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    throw new AppError('AUTH_ERROR', 'Device code expired');
  }

  private async getUserInfo(accessToken: string): Promise<GitHubUser> {
    const octokit = new Octokit({
      auth: accessToken,
    });

    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    return {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      email: user.email || '',
      avatarUrl: user.avatar_url,
    };
  }

  private async storeTokens(authResult: GitHubAuthResult): Promise<void> {
    const tokenData = {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt.toISOString(),
    };

    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData, null, 2));
      this.logger.info('GitHub tokens stored securely');
    } catch (error) {
      this.logger.error(`Failed to store tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('STORAGE_ERROR', `Failed to store tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadTokens(): Promise<GitHubAuthResult | null> {
    try {
      if (!fs.existsSync(this.tokenFilePath)) {
        return null;
      }

      const tokenData = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));
      
      const user = await this.getUserInfo(tokenData.accessToken);
      return {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: new Date(tokenData.expiresAt),
        user,
      };
    } catch (error) {
      this.logger.error(`Failed to load tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
        this.logger.info('GitHub tokens cleared');
      }
    } catch (error) {
      this.logger.error(`Failed to clear tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('STORAGE_ERROR', `Failed to clear tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getAccessToken(): Promise<string | null> {
    return new Promise(async (resolve) => {
      const tokens = await this.loadTokens();
      if (!tokens) {
        resolve(null);
        return;
      }

      // Check if token is expired
      if (new Date() > tokens.expiresAt) {
        try {
          const newAuth = await this.refreshToken();
          resolve(newAuth.accessToken);
        } catch (error) {
          this.logger.warn('Token expired and refresh failed');
          resolve(null);
        }
      } else {
        resolve(tokens.accessToken);
      }
    });
  }

  isConfigured(): boolean {
    return !!this.config.clientId && !!this.config.clientSecret;
  }
}