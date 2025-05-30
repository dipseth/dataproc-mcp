/**
 * Integration Tests for Authentication Methods
 *
 * Tests all supported authentication methods to ensure they work correctly
 * across different configurations and environments.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test framework for authentication testing
interface AuthTestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class AuthTestRunner {
  private results: AuthTestResult[] = [];
  private originalEnv: NodeJS.ProcessEnv;

  constructor() {
    // Save original environment
    this.originalEnv = { ...process.env };
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - startTime,
      });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  restoreEnvironment(): void {
    // Restore original environment
    process.env = this.originalEnv;
  }

  printSummary(): void {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 Authentication Test Summary');
    console.log('==============================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`⏱️  Total time: ${totalTime}ms`);

    if (passed < total) {
      console.log('\n❌ Failed tests:');
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   ${r.name}: ${r.error}`);
        });
    }
  }

  get allPassed(): boolean {
    return this.results.every((r) => r.passed);
  }
}

// Helper function to create test fixtures
function createTestFixture(filename: string, content: any): string {
  const fixturesDir = path.join(__dirname, '../fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const filePath = path.join(fixturesDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

function cleanupTestFixture(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Test assertion helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertContains(array: any[], item: any, message?: string): void {
  if (!array.includes(item)) {
    throw new Error(message || `Array does not contain ${item}`);
  }
}

// Main test suite
async function runAuthenticationTests(): Promise<void> {
  console.log('🔐 Running Authentication Method Tests');
  console.log('=====================================');

  const runner = new AuthTestRunner();

  try {
    // Test 1: Service Account Key File Authentication
    await runner.runTest('Service Account Key File Authentication - Valid', async () => {
      const mockServiceAccount = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: '123456789',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      };

      const testKeyPath = createTestFixture('test-service-account.json', mockServiceAccount);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = testKeyPath;

      const { validateServiceAccountKey } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = await validateServiceAccountKey(testKeyPath);
      assert(result.isValid, 'Service account key should be valid');
      assertEqual(result.projectId, 'test-project', 'Project ID should match');
      assertEqual(
        result.clientEmail,
        'test@test-project.iam.gserviceaccount.com',
        'Client email should match'
      );

      cleanupTestFixture(testKeyPath);
    });

    await runner.runTest('Service Account Key File Authentication - Invalid', async () => {
      const invalidServiceAccount = {
        type: 'invalid_type',
        project_id: 'test-project',
        // Missing required fields
      };

      const invalidKeyPath = createTestFixture(
        'invalid-service-account.json',
        invalidServiceAccount
      );

      const { validateServiceAccountKey } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = await validateServiceAccountKey(invalidKeyPath);
      assert(!result.isValid, 'Invalid service account key should be rejected');
      assert(result.errors !== undefined, 'Should have validation errors');
      assert(result.errors!.length > 0, 'Should have validation errors');
      assertContains(
        result.errors!,
        'Invalid service account type',
        'Should contain specific error message'
      );

      cleanupTestFixture(invalidKeyPath);
    });

    // Test 2: Service Account Impersonation
    await runner.runTest('Service Account Impersonation - Valid Config', async () => {
      const impersonationConfig = {
        sourceCredentials: {
          type: 'service_account',
          project_id: 'source-project',
          client_email: 'source@source-project.iam.gserviceaccount.com',
        },
        targetServiceAccount: 'target@target-project.iam.gserviceaccount.com',
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/dataproc',
        ],
      };

      const { validateImpersonationConfig } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = validateImpersonationConfig(impersonationConfig);
      assert(result.isValid, 'Valid impersonation config should pass');
      assertEqual(
        result.targetServiceAccount,
        'target@target-project.iam.gserviceaccount.com',
        'Target service account should match'
      );
    });

    await runner.runTest('Service Account Impersonation - Invalid Config', async () => {
      const invalidConfig = {
        sourceCredentials: {
          type: 'invalid_type',
        },
        targetServiceAccount: 'invalid-email',
        scopes: [],
      };

      const { validateImpersonationConfig } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = validateImpersonationConfig(invalidConfig);
      assert(!result.isValid, 'Invalid impersonation config should fail');
      assert(result.errors !== undefined, 'Should have validation errors');
      assert(result.errors!.length > 0, 'Should have validation errors');
    });

    // Test 3: Application Default Credentials (ADC)
    await runner.runTest('Application Default Credentials Detection', async () => {
      // Clear ADC environment
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const { checkADCAvailability } = await import('../../build/security/credential-manager.js');

      const result = await checkADCAvailability();
      assert(typeof result.available === 'boolean', 'ADC availability should be boolean');
      assert(typeof result.source === 'string', 'ADC source should be string');
    });

    // Test 4: Credential Expiration Checking
    await runner.runTest('Credential Expiration - Expired', async () => {
      const expiredCredential = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'expired-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        created_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // 400 days ago (more than 1 year)
      };

      const { checkCredentialExpiration } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = checkCredentialExpiration(expiredCredential);
      assert(result.isExpired, 'Old credential should be expired');
      assert(result.daysUntilExpiration <= 0, 'Days until expiration should be zero or negative');
    });

    await runner.runTest('Credential Expiration - Fresh', async () => {
      const freshCredential = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'fresh-key',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        created_at: new Date().toISOString(),
      };

      const { checkCredentialExpiration } = await import(
        '../../build/security/credential-manager.js'
      );

      const result = checkCredentialExpiration(freshCredential);
      assert(!result.isExpired, 'Fresh credential should not be expired');
      assert(result.daysUntilExpiration > 300, 'Should be valid for ~1 year');
    });

    // Test 5: Cross-Environment Authentication
    const testEnvironments = [
      { name: 'development', projectId: 'dev-project-123' },
      { name: 'staging', projectId: 'staging-project-456' },
      { name: 'production', projectId: 'prod-project-789' },
    ];

    for (const env of testEnvironments) {
      await runner.runTest(`Environment Authentication - ${env.name}`, async () => {
        process.env.DATAPROC_PROJECT_ID = env.projectId;
        process.env.NODE_ENV = env.name;

        const { validateEnvironmentAuth } = await import(
          '../../build/security/credential-manager.js'
        );

        const result = await validateEnvironmentAuth();
        assertEqual(result.environment, env.name, 'Environment should match');
        assertEqual(result.projectId, env.projectId, 'Project ID should match');
        assert(typeof result.isValid === 'boolean', 'Validation result should be boolean');
      });
    }

    // Test 6: Security Compliance
    await runner.runTest('Security Compliance - Compliant', async () => {
      const securityConfig = {
        requireServiceAccountImpersonation: true,
        allowedServiceAccountDomains: ['@company.iam.gserviceaccount.com'],
        maxCredentialAge: 90, // days
        requireMFA: true,
      };

      const { validateSecurityCompliance } = await import(
        '../../build/security/credential-manager.js'
      );

      const testCredential = {
        client_email: 'service@company.iam.gserviceaccount.com',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      };

      const result = validateSecurityCompliance(testCredential, securityConfig);
      assert(result.compliant, 'Compliant credential should pass');
      assertEqual(result.violations.length, 0, 'Should have no violations');
    });

    await runner.runTest('Security Compliance - Violations', async () => {
      const securityConfig = {
        requireServiceAccountImpersonation: true,
        allowedServiceAccountDomains: ['@company.iam.gserviceaccount.com'],
        maxCredentialAge: 90,
        requireMFA: true,
      };

      const { validateSecurityCompliance } = await import(
        '../../build/security/credential-manager.js'
      );

      const violatingCredential = {
        client_email: 'service@external.iam.gserviceaccount.com', // Wrong domain
        created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), // 120 days ago (too old)
      };

      const result = validateSecurityCompliance(violatingCredential, securityConfig);
      assert(!result.compliant, 'Non-compliant credential should fail');
      assert(result.violations.length > 0, 'Should have violations');
    });
  } finally {
    runner.restoreEnvironment();
  }

  runner.printSummary();

  if (!runner.allPassed) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAuthenticationTests().catch((error) => {
    console.error('Authentication tests failed:', error);
    process.exit(1);
  });
}

export { runAuthenticationTests, AuthTestRunner };
