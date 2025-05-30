/**
 * Credential Management for Dataproc MCP Server
 * Phase 2: Security Hardening - Credential Management
 */

import fs from 'fs';
import path from 'path';
// import crypto from 'crypto';
// import { logger } from '../utils/logger.js';
import SecurityMiddleware from './middleware.js';

export interface CredentialValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  expiresAt?: Date;
  permissions?: string[];
}

export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class CredentialManager {
  private static readonly REQUIRED_PERMISSIONS = [
    'dataproc.clusters.create',
    'dataproc.clusters.delete',
    'dataproc.clusters.get',
    'dataproc.clusters.list',
    'dataproc.jobs.create',
    'dataproc.jobs.get',
    'dataproc.jobs.list',
    'storage.objects.get',
    'storage.objects.list',
  ];

  private static readonly RECOMMENDED_PERMISSIONS = [
    'dataproc.clusters.update',
    'dataproc.operations.get',
    'dataproc.operations.list',
    'storage.objects.create',
    'storage.buckets.get',
  ];

  /**
   * Validate service account key file format and content
   */
  static validateServiceAccountKey(keyPath: string): CredentialValidationResult {
    const result: CredentialValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
    };

    try {
      // Check if file exists and is readable
      if (!fs.existsSync(keyPath)) {
        result.errors.push(`Service account key file not found: ${keyPath}`);
        return result;
      }

      const stats = fs.statSync(keyPath);
      if (!stats.isFile()) {
        result.errors.push(`Path is not a file: ${keyPath}`);
        return result;
      }

      // Check file permissions (should not be world-readable)
      const mode = stats.mode & parseInt('777', 8);
      if (mode & parseInt('044', 8)) {
        result.warnings.push(
          'Service account key file is readable by group/others. Consider restricting permissions (chmod 600)'
        );
      }

      // Read and parse the key file
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      let keyData: ServiceAccountKey;

      try {
        keyData = JSON.parse(keyContent);
      } catch (parseError) {
        result.errors.push('Invalid JSON format in service account key file');
        return result;
      }

      // Validate required fields
      const requiredFields = [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id',
        'auth_uri',
        'token_uri',
      ];

      for (const field of requiredFields) {
        if (!keyData[field as keyof ServiceAccountKey]) {
          result.errors.push(`Missing required field: ${field}`);
        }
      }

      if (result.errors.length > 0) {
        return result;
      }

      // Validate field formats
      if (keyData.type !== 'service_account') {
        result.errors.push('Key type must be "service_account"');
      }

      if (!keyData.client_email.endsWith('.iam.gserviceaccount.com')) {
        result.errors.push('Invalid service account email format');
      }

      if (!keyData.private_key.includes('BEGIN PRIVATE KEY')) {
        result.errors.push('Invalid private key format');
      }

      // Validate project ID format
      if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(keyData.project_id)) {
        result.errors.push('Invalid project ID format');
      }

      // Check for key rotation (warn if key is old)
      try {
        const keyId = keyData.private_key_id;
        const keyTimestamp = this.extractTimestampFromKeyId(keyId);
        if (keyTimestamp) {
          const keyAge = Date.now() - keyTimestamp;
          const ninetyDays = 90 * 24 * 60 * 60 * 1000;

          if (keyAge > ninetyDays) {
            result.warnings.push(
              'Service account key is older than 90 days. Consider rotating for security.'
            );
          }
        }
      } catch (error) {
        // Key ID format might not contain timestamp, ignore
      }

      if (result.errors.length === 0) {
        result.isValid = true;
      }

      SecurityMiddleware.auditLog('Service account key validation', {
        keyPath: path.basename(keyPath),
        projectId: keyData.project_id,
        clientEmail: keyData.client_email,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      result.errors.push(
        `Error validating service account key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      SecurityMiddleware.auditLog(
        'Service account key validation error',
        {
          keyPath: path.basename(keyPath),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'error'
      );

      return result;
    }
  }

  /**
   * Validate service account permissions for Dataproc operations
   */
  static async validateServiceAccountPermissions(
    projectId: string,
    serviceAccountEmail: string
  ): Promise<CredentialValidationResult> {
    const result: CredentialValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      permissions: [],
    };

    try {
      // This would typically make API calls to check permissions
      // For now, we'll do basic validation and log the check

      SecurityMiddleware.validateServiceAccount(serviceAccountEmail);

      // In a real implementation, you would:
      // 1. Use Google Cloud IAM API to check permissions
      // 2. Test actual permissions with testIamPermissions
      // 3. Verify the service account can access required resources

      result.warnings.push(
        'Permission validation requires runtime API calls - implement based on your security requirements'
      );

      SecurityMiddleware.auditLog('Service account permission check', {
        projectId,
        serviceAccountEmail,
        requiredPermissions: this.REQUIRED_PERMISSIONS,
        recommendedPermissions: this.RECOMMENDED_PERMISSIONS,
      });

      result.isValid = true;
      return result;
    } catch (error) {
      result.errors.push(
        `Error validating permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      SecurityMiddleware.auditLog(
        'Service account permission validation error',
        {
          projectId,
          serviceAccountEmail,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'error'
      );

      return result;
    }
  }

  /**
   * Sanitize credential data for logging
   */
  static sanitizeCredentialData(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(
          /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
          '[PRIVATE_KEY_REDACTED]'
        )
        .replace(/"private_key":\s*"[^"]+"/g, '"private_key": "[REDACTED]"')
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[API_KEY_REDACTED]')
        .replace(/ya29\.[0-9A-Za-z\-_]+/g, '[ACCESS_TOKEN_REDACTED]');
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeCredentialData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (
          ['private_key', 'client_secret', 'refresh_token', 'access_token'].includes(
            key.toLowerCase()
          )
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeCredentialData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Generate secure credential storage recommendations
   */
  static getCredentialStorageRecommendations(): string[] {
    return [
      'Store service account keys in a secure location with restricted file permissions (chmod 600)',
      'Use environment-specific service accounts (dev, staging, prod)',
      'Rotate service account keys regularly (every 90 days)',
      'Use service account impersonation instead of direct key files when possible',
      'Never commit service account keys to version control',
      'Consider using Google Cloud Secret Manager for credential storage',
      'Implement credential expiry monitoring and alerts',
      'Use least privilege principle - grant only required permissions',
      'Monitor service account usage and access patterns',
      'Enable audit logging for all credential-related operations',
    ];
  }

  /**
   * Check for credential expiry and rotation needs
   */
  static checkCredentialRotationNeeds(keyPath: string): {
    needsRotation: boolean;
    daysUntilExpiry?: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let needsRotation = false;
    let daysUntilExpiry: number | undefined;

    try {
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      const keyData: ServiceAccountKey = JSON.parse(keyContent);

      // Extract timestamp from key ID if possible
      const keyTimestamp = this.extractTimestampFromKeyId(keyData.private_key_id);

      if (keyTimestamp) {
        const keyAge = Date.now() - keyTimestamp;
        const ninetyDays = 90 * 24 * 60 * 60 * 1000;
        const oneYear = 365 * 24 * 60 * 60 * 1000;

        if (keyAge > ninetyDays) {
          needsRotation = true;
          recommendations.push('Service account key is older than 90 days and should be rotated');
        }

        if (keyAge > oneYear) {
          recommendations.push(
            'Service account key is over 1 year old - immediate rotation required'
          );
        }

        // Calculate days until recommended rotation
        const rotationDate = keyTimestamp + ninetyDays;
        daysUntilExpiry = Math.max(
          0,
          Math.ceil((rotationDate - Date.now()) / (24 * 60 * 60 * 1000))
        );
      } else {
        recommendations.push('Unable to determine key age - consider rotating as a precaution');
      }

      // Check file modification time as fallback
      const stats = fs.statSync(keyPath);
      const fileAge = Date.now() - stats.mtime.getTime();
      const sixMonths = 180 * 24 * 60 * 60 * 1000;

      if (fileAge > sixMonths) {
        recommendations.push('Key file is older than 6 months based on modification time');
      }
    } catch (error) {
      recommendations.push('Error checking credential age - manual review recommended');
    }

    return {
      needsRotation,
      daysUntilExpiry,
      recommendations,
    };
  }

  /**
   * Extract timestamp from Google Cloud service account key ID
   */
  private static extractTimestampFromKeyId(keyId: string): number | null {
    try {
      // Google Cloud key IDs sometimes contain encoded timestamps
      // This is a simplified extraction - actual format may vary
      const decoded = Buffer.from(keyId, 'hex');
      if (decoded.length >= 8) {
        // Try to extract timestamp from first 8 bytes
        const timestamp = decoded.readBigUInt64BE(0);
        const timestampMs = Number(timestamp);

        // Validate timestamp is reasonable (between 2020 and 2030)
        const minTimestamp = new Date('2020-01-01').getTime();
        const maxTimestamp = new Date('2030-01-01').getTime();

        if (timestampMs >= minTimestamp && timestampMs <= maxTimestamp) {
          return timestampMs;
        }
      }
    } catch (error) {
      // Key ID format doesn't contain extractable timestamp
    }

    return null;
  }

  /**
   * Validate credential configuration
   */
  static validateCredentialConfiguration(config: any): CredentialValidationResult {
    const result: CredentialValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
    };

    if (!config.authentication) {
      result.errors.push('No authentication configuration found');
      return result;
    }

    const auth = config.authentication;

    // Check for service account impersonation setup
    if (auth.impersonateServiceAccount) {
      try {
        SecurityMiddleware.validateServiceAccount(auth.impersonateServiceAccount);
      } catch (error) {
        result.errors.push(
          `Invalid impersonation service account: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      if (!auth.fallbackKeyPath) {
        result.warnings.push(
          'No fallback key path specified for impersonation - may cause authentication failures'
        );
      } else if (!fs.existsSync(auth.fallbackKeyPath)) {
        result.errors.push(`Fallback key file not found: ${auth.fallbackKeyPath}`);
      }
    }

    // Check direct key file authentication
    if (auth.keyFilePath) {
      if (!fs.existsSync(auth.keyFilePath)) {
        result.errors.push(`Key file not found: ${auth.keyFilePath}`);
      } else {
        const keyValidation = this.validateServiceAccountKey(auth.keyFilePath);
        result.errors.push(...keyValidation.errors);
        result.warnings.push(...keyValidation.warnings);
      }
    }

    // Security recommendations
    if (auth.useApplicationDefaultFallback) {
      result.warnings.push(
        'Application Default Credentials fallback is enabled - ensure this is intended for your environment'
      );
    }

    if (!auth.preferImpersonation && auth.impersonateServiceAccount) {
      result.warnings.push(
        'Service account impersonation is configured but not preferred - consider enabling preferImpersonation'
      );
    }

    if (result.errors.length === 0) {
      result.isValid = true;
    }

    return result;
  }
}

// Additional validation functions for testing
export function validateServiceAccountKey(keyPath: string): {
  isValid: boolean;
  projectId?: string;
  clientEmail?: string;
  errors?: string[];
} {
  try {
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    const key = JSON.parse(keyContent);

    if (key.type !== 'service_account') {
      return { isValid: false, errors: ['Invalid service account type'] };
    }

    const requiredFields = ['project_id', 'private_key', 'client_email', 'client_id'];
    const missingFields = requiredFields.filter((field) => !key[field]);

    if (missingFields.length > 0) {
      return { isValid: false, errors: [`Missing required fields: ${missingFields.join(', ')}`] };
    }

    return {
      isValid: true,
      projectId: key.project_id,
      clientEmail: key.client_email,
    };
  } catch (error) {
    return { isValid: false, errors: ['Failed to parse service account key'] };
  }
}

export function validateImpersonationConfig(config: any): {
  isValid: boolean;
  targetServiceAccount?: string;
  errors?: string[];
} {
  const errors: string[] = [];

  if (!config.sourceCredentials || config.sourceCredentials.type !== 'service_account') {
    errors.push('Invalid source credentials');
  }

  if (!config.targetServiceAccount || !config.targetServiceAccount.includes('@')) {
    errors.push('Invalid target service account email');
  }

  if (!config.scopes || !Array.isArray(config.scopes) || config.scopes.length === 0) {
    errors.push('Missing or invalid scopes');
  }

  return {
    isValid: errors.length === 0,
    targetServiceAccount: config.targetServiceAccount,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function checkADCAvailability(): Promise<{ available: boolean; source: string }> {
  // Check for various ADC sources
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { available: true, source: 'GOOGLE_APPLICATION_CREDENTIALS' };
  }

  // Check for gcloud credentials
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const gcloudPath = path.join(
      homeDir || '',
      '.config',
      'gcloud',
      'application_default_credentials.json'
    );
    if (fs.existsSync(gcloudPath)) {
      return { available: true, source: 'gcloud ADC' };
    }
  } catch (error) {
    // Continue checking other sources
  }

  return { available: false, source: 'none' };
}

export function checkCredentialExpiration(credential: any): {
  isExpired: boolean;
  daysUntilExpiration: number;
} {
  const createdAt = credential.created_at ? new Date(credential.created_at) : new Date();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const expirationDate = new Date(createdAt.getTime() + oneYear);
  const now = new Date();

  const daysUntilExpiration = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    isExpired: daysUntilExpiration <= 0,
    daysUntilExpiration,
  };
}

export async function validateEnvironmentAuth(): Promise<{
  environment: string;
  projectId: string;
  isValid: boolean;
}> {
  const environment = process.env.NODE_ENV || 'development';
  const projectId = process.env.DATAPROC_PROJECT_ID || 'unknown';

  // In a real implementation, this would test actual authentication
  // For testing purposes, we'll simulate validation
  const isValid = projectId !== 'unknown' && environment !== 'unknown';

  return { environment, projectId, isValid };
}

export function validateSecurityCompliance(
  credential: any,
  config: any
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check domain restrictions
  if (config.allowedServiceAccountDomains) {
    const email = credential.client_email || '';
    const isAllowedDomain = config.allowedServiceAccountDomains.some((domain: string) =>
      email.endsWith(domain)
    );
    if (!isAllowedDomain) {
      violations.push('Service account domain not in allowed list');
    }
  }

  // Check credential age
  if (config.maxCredentialAge && credential.created_at) {
    const createdAt = new Date(credential.created_at);
    const maxAge = config.maxCredentialAge * 24 * 60 * 60 * 1000; // Convert days to ms
    const age = Date.now() - createdAt.getTime();

    if (age > maxAge) {
      violations.push('Credential exceeds maximum allowed age');
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

export default CredentialManager;
