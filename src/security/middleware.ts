/**
 * Security middleware for Dataproc MCP Server
 * Phase 2: Security Hardening - Input Validation & Rate Limiting
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { SecurityHeaders, RateLimitConfig, SanitizationConfig } from '../validation/schemas.js';

// Rate limiting store (in-memory for now, could be Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(config: typeof RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
  }

  isAllowed(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window or expired entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(identifier, newEntry);

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    this.store.set(identifier, entry);

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter(RateLimitConfig);

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    rateLimiter.cleanup();
  },
  5 * 60 * 1000
);

export class SecurityMiddleware {
  /**
   * Validate input using Zod schema
   */
  static validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');

        logger.warn('Input validation failed', {
          errors: error.errors,
          input: this.sanitizeForLogging(input),
        });

        throw new Error(`Input validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Check rate limits for a request
   */
  static checkRateLimit(identifier: string): void {
    const result = rateLimiter.isAllowed(identifier);

    if (!result.allowed) {
      const resetDate = new Date(result.resetTime);
      logger.warn('Rate limit exceeded', {
        identifier: this.sanitizeForLogging(identifier),
        resetTime: resetDate.toISOString(),
      });

      throw new Error(`Rate limit exceeded. Try again after ${resetDate.toISOString()}`);
    }

    logger.debug('Rate limit check passed', {
      identifier: this.sanitizeForLogging(identifier),
      remaining: result.remaining,
    });
  }

  /**
   * Sanitize string input to prevent injection attacks
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove HTML/XML tags if configured
    if (SanitizationConfig.removeHtmlTags) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove script tags specifically
    if (SanitizationConfig.removeScriptTags) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    // Limit string length
    if (sanitized.length > SanitizationConfig.maxStringLength) {
      sanitized = sanitized.substring(0, SanitizationConfig.maxStringLength);
    }

    // Check allowed characters
    if (!SanitizationConfig.allowedCharacters.test(sanitized)) {
      logger.warn('String contains disallowed characters', {
        originalLength: input.length,
        sanitizedLength: sanitized.length,
      });
      // Remove disallowed characters
      sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_.,!?@#$%^&*()+={}[\]:;"'<>/\\|`~]/g, '');
    }

    return sanitized.trim();
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Remove sensitive information from data for logging
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      // Mask potential credentials
      return data
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[API_KEY]')
        .replace(/ya29\.[0-9A-Za-z\-_]+/g, '[ACCESS_TOKEN]')
        .replace(/"private_key":\s*"[^"]+"/g, '"private_key": "[REDACTED]"')
        .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[PRIVATE_KEY]');
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeForLogging(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields entirely
        if (
          ['password', 'secret', 'key', 'token', 'credential'].some((sensitive) =>
            key.toLowerCase().includes(sensitive)
          )
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeForLogging(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Validate GCP resource constraints
   */
  static validateGCPConstraints(params: {
    projectId?: string;
    region?: string;
    zone?: string;
    clusterName?: string;
  }): void {
    const { projectId, region, zone, clusterName } = params;

    // Validate project ID format and constraints
    if (projectId) {
      if (projectId.length < 6 || projectId.length > 30) {
        throw new Error('Project ID must be between 6 and 30 characters');
      }
      if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(projectId)) {
        throw new Error(
          'Project ID must start with lowercase letter and contain only lowercase letters, numbers, and hyphens'
        );
      }
    }

    // Validate region format
    if (region && !/^[a-z]+-[a-z]+\d+$/.test(region)) {
      throw new Error('Invalid region format. Expected format: us-central1');
    }

    // Validate zone format and region consistency
    if (zone) {
      if (!/^[a-z]+-[a-z]+\d+-[a-z]$/.test(zone)) {
        throw new Error('Invalid zone format. Expected format: us-central1-a');
      }
      if (region && !zone.startsWith(region)) {
        throw new Error('Zone must be in the specified region');
      }
    }

    // Validate cluster name constraints
    if (clusterName) {
      if (clusterName.length > 54) {
        throw new Error('Cluster name must be at most 54 characters');
      }
      if (!/^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(clusterName)) {
        throw new Error(
          'Cluster name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens'
        );
      }
    }
  }

  /**
   * Validate service account email format
   */
  static validateServiceAccount(email: string): void {
    const serviceAccountRegex = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
    if (!serviceAccountRegex.test(email)) {
      throw new Error('Invalid service account email format');
    }
  }

  /**
   * Generate security headers for responses
   */
  static getSecurityHeaders(): Record<string, string> {
    return { ...SecurityHeaders };
  }

  /**
   * Audit log security events
   */
  static auditLog(event: string, details: any, severity: 'info' | 'warn' | 'error' = 'info'): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeForLogging(details),
      severity,
    };

    logger[severity]('Security audit', auditEntry);

    // In production, you might want to send this to a separate audit log system
    // or security information and event management (SIEM) system
  }

  /**
   * Check for suspicious patterns in input
   */
  static detectSuspiciousPatterns(input: string): string[] {
    const suspiciousPatterns = [
      {
        pattern: /\b(union|select|insert|update|delete|drop|create|alter)\b/i,
        name: 'SQL Injection',
      },
      { pattern: /<script|javascript:|vbscript:|onload=|onerror=/i, name: 'XSS Attempt' },
      { pattern: /\.\.\//g, name: 'Path Traversal' },
      { pattern: /\$\{.*\}/g, name: 'Template Injection' },
      { pattern: /eval\(|exec\(|system\(/i, name: 'Code Injection' },
      { pattern: /\b(rm|del|format|shutdown|reboot)\b/i, name: 'System Command' },
    ];

    const detected: string[] = [];
    for (const { pattern, name } of suspiciousPatterns) {
      if (pattern.test(input)) {
        detected.push(name);
      }
    }

    if (detected.length > 0) {
      this.auditLog(
        'Suspicious pattern detected',
        {
          patterns: detected,
          inputLength: input.length,
        },
        'warn'
      );
    }

    return detected;
  }
}

export default SecurityMiddleware;
