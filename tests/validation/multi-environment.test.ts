/**
 * Multi-Environment Validation Tests
 *
 * Tests the server across different environments, projects, and configurations
 * to ensure it works correctly in various deployment scenarios.
 */

interface EnvironmentConfig {
  name: string;
  projectId: string;
  region: string;
  zone?: string;
  serviceAccount?: string;
  clusterConfigs: ClusterTestConfig[];
}

interface ClusterTestConfig {
  name: string;
  profile?: string;
  expectedNodes: {
    master: number;
    worker: number;
  };
  machineTypes: {
    master: string;
    worker: string;
  };
}

interface ValidationResult {
  environment: string;
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
  metadata?: any;
}

class MultiEnvironmentValidator {
  private results: ValidationResult[] = [];
  private originalEnv: NodeJS.ProcessEnv;

  constructor() {
    this.originalEnv = { ...process.env };
  }

  async validateEnvironment(config: EnvironmentConfig): Promise<ValidationResult[]> {
    console.log(`🌍 Validating environment: ${config.name}`);
    console.log(`   Project: ${config.projectId}`);
    console.log(`   Region: ${config.region}`);

    const envResults: ValidationResult[] = [];

    // Set environment variables
    process.env.DATAPROC_PROJECT_ID = config.projectId;
    process.env.DATAPROC_REGION = config.region;
    if (config.zone) {
      process.env.DATAPROC_ZONE = config.zone;
    }
    if (config.serviceAccount) {
      process.env.DATAPROC_SERVICE_ACCOUNT = config.serviceAccount;
    }

    // Test 1: Environment Configuration Validation
    envResults.push(
      await this.runTest(config.name, 'Environment Configuration', async () => {
        const { validateEnvironmentAuth } = await import(
          '../../build/security/credential-manager.js'
        );

        const result = await validateEnvironmentAuth();
        if (result.environment !== config.name) {
          throw new Error(
            `Environment mismatch: expected ${config.name}, got ${result.environment}`
          );
        }
        if (result.projectId !== config.projectId) {
          throw new Error(
            `Project ID mismatch: expected ${config.projectId}, got ${result.projectId}`
          );
        }

        return { environment: result.environment, projectId: result.projectId };
      })
    );

    // Test 2: Schema Validation with Environment Parameters
    envResults.push(
      await this.runTest(config.name, 'Schema Validation', async () => {
        const { StartDataprocClusterSchema } = await import('../../build/validation/schemas.js');

        const testData = {
          clusterName: `${config.name}-test-cluster`,
          projectId: config.projectId,
          region: config.region,
        };

        const result = StartDataprocClusterSchema.safeParse(testData);
        if (!result.success) {
          throw new Error(`Schema validation failed: ${result.error.message}`);
        }

        return { validatedData: result.data };
      })
    );

    // Test 3: Default Parameter Injection
    envResults.push(
      await this.runTest(config.name, 'Default Parameter Injection', async () => {
        // Simulate default parameter injection
        const inputParams = {
          clusterName: `${config.name}-cluster`,
        };

        const defaultParams = {
          projectId: config.projectId,
          region: config.region,
          zone: config.zone || `${config.region}-a`,
        };

        const mergedParams = { ...defaultParams, ...inputParams };

        if (!mergedParams.projectId || !mergedParams.region || !mergedParams.clusterName) {
          throw new Error('Parameter injection failed');
        }

        return { mergedParams };
      })
    );

    // Test 4: Cluster Configuration Validation
    for (const clusterConfig of config.clusterConfigs) {
      envResults.push(
        await this.runTest(config.name, `Cluster Config: ${clusterConfig.name}`, async () => {
          // Validate cluster configuration
          const clusterData = {
            clusterName: clusterConfig.name,
            projectId: config.projectId,
            region: config.region,
            config: {
              masterConfig: {
                numInstances: clusterConfig.expectedNodes.master,
                machineTypeUri: clusterConfig.machineTypes.master,
              },
              workerConfig: {
                numInstances: clusterConfig.expectedNodes.worker,
                machineTypeUri: clusterConfig.machineTypes.worker,
              },
            },
          };

          // Validate machine types are appropriate for environment
          const validMachineTypes = this.getValidMachineTypesForEnvironment(config.name);
          if (!validMachineTypes.includes(clusterConfig.machineTypes.master)) {
            throw new Error(
              `Invalid master machine type for ${config.name}: ${clusterConfig.machineTypes.master}`
            );
          }
          if (!validMachineTypes.includes(clusterConfig.machineTypes.worker)) {
            throw new Error(
              `Invalid worker machine type for ${config.name}: ${clusterConfig.machineTypes.worker}`
            );
          }

          return { clusterData };
        })
      );
    }

    // Test 5: Service Account Configuration
    if (config.serviceAccount) {
      envResults.push(
        await this.runTest(config.name, 'Service Account Configuration', async () => {
          // Validate service account format
          const emailRegex = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
          if (!emailRegex.test(config.serviceAccount!)) {
            throw new Error(`Invalid service account format: ${config.serviceAccount}`);
          }

          // Check if service account belongs to the correct project
          const accountProject = config.serviceAccount!.split('@')[1].split('.')[0];
          if (accountProject !== config.projectId) {
            throw new Error(
              `Service account project mismatch: expected ${config.projectId}, got ${accountProject}`
            );
          }

          return { serviceAccount: config.serviceAccount };
        })
      );
    }

    this.results.push(...envResults);
    return envResults;
  }

  private async runTest(
    environment: string,
    testName: string,
    testFn: () => Promise<any>
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    try {
      const metadata = await testFn();
      const result: ValidationResult = {
        environment,
        test: testName,
        passed: true,
        duration: Date.now() - startTime,
        metadata,
      };
      console.log(`   ✅ ${testName}`);
      return result;
    } catch (error) {
      const result: ValidationResult = {
        environment,
        test: testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
      console.log(`   ❌ ${testName}: ${result.error}`);
      return result;
    }
  }

  private getValidMachineTypesForEnvironment(environment: string): string[] {
    switch (environment) {
      case 'development':
        return ['e2-medium', 'e2-standard-2', 'n1-standard-1', 'n1-standard-2'];
      case 'staging':
        return ['n1-standard-2', 'n1-standard-4', 'n2-standard-2', 'n2-standard-4'];
      case 'production':
        return [
          'n1-standard-4',
          'n1-standard-8',
          'n2-standard-4',
          'n2-standard-8',
          'n1-highmem-4',
          'n1-highmem-8',
        ];
      default:
        return ['e2-medium', 'n1-standard-1', 'n1-standard-2'];
    }
  }

  restoreEnvironment(): void {
    process.env = this.originalEnv;
  }

  printSummary(): void {
    const environments = [...new Set(this.results.map((r) => r.environment))];

    console.log('\n📊 Multi-Environment Validation Summary');
    console.log('=======================================');

    for (const env of environments) {
      const envResults = this.results.filter((r) => r.environment === env);
      const passed = envResults.filter((r) => r.passed).length;
      const total = envResults.length;
      const avgDuration = envResults.reduce((sum, r) => sum + r.duration, 0) / total;

      console.log(`\n🌍 ${env}:`);
      console.log(`   ✅ Passed: ${passed}/${total}`);
      console.log(`   ⏱️  Average time: ${avgDuration.toFixed(0)}ms`);

      if (passed < total) {
        console.log(`   ❌ Failed tests:`);
        envResults
          .filter((r) => !r.passed)
          .forEach((r) => {
            console.log(`      ${r.test}: ${r.error}`);
          });
      }
    }

    const totalPassed = this.results.filter((r) => r.passed).length;
    const totalTests = this.results.length;

    console.log(`\n📈 Overall: ${totalPassed}/${totalTests} tests passed`);
  }

  get allPassed(): boolean {
    return this.results.every((r) => r.passed);
  }
}

// Test configurations for different environments
const testEnvironments: EnvironmentConfig[] = [
  {
    name: 'development',
    projectId: 'dev-dataproc-project',
    region: 'us-central1',
    zone: 'us-central1-a',
    serviceAccount: 'dataproc-dev@dev-dataproc-project.iam.gserviceaccount.com',
    clusterConfigs: [
      {
        name: 'dev-small-cluster',
        expectedNodes: { master: 1, worker: 2 },
        machineTypes: { master: 'e2-medium', worker: 'e2-medium' },
      },
      {
        name: 'dev-test-cluster',
        expectedNodes: { master: 1, worker: 3 },
        machineTypes: { master: 'n1-standard-1', worker: 'n1-standard-1' },
      },
    ],
  },
  {
    name: 'staging',
    projectId: 'staging-dataproc-project',
    region: 'us-east1',
    zone: 'us-east1-b',
    serviceAccount: 'dataproc-staging@staging-dataproc-project.iam.gserviceaccount.com',
    clusterConfigs: [
      {
        name: 'staging-cluster',
        expectedNodes: { master: 1, worker: 4 },
        machineTypes: { master: 'n1-standard-2', worker: 'n1-standard-2' },
      },
    ],
  },
  {
    name: 'production',
    projectId: 'prod-dataproc-project',
    region: 'us-west1',
    zone: 'us-west1-c',
    serviceAccount: 'dataproc-prod@prod-dataproc-project.iam.gserviceaccount.com',
    clusterConfigs: [
      {
        name: 'prod-main-cluster',
        expectedNodes: { master: 3, worker: 10 },
        machineTypes: { master: 'n1-standard-4', worker: 'n1-standard-4' },
      },
      {
        name: 'prod-analytics-cluster',
        expectedNodes: { master: 1, worker: 20 },
        machineTypes: { master: 'n1-highmem-4', worker: 'n1-highmem-4' },
      },
    ],
  },
];

// Main test runner
async function runMultiEnvironmentValidation(): Promise<void> {
  console.log('🌐 Running Multi-Environment Validation Tests');
  console.log('==============================================');

  const validator = new MultiEnvironmentValidator();

  try {
    for (const envConfig of testEnvironments) {
      await validator.validateEnvironment(envConfig);
      console.log(''); // Add spacing between environments
    }

    validator.printSummary();

    if (!validator.allPassed) {
      console.log('\n❌ Multi-environment validation failed');
      process.exit(1);
    } else {
      console.log('\n✅ All multi-environment validations passed!');
    }
  } finally {
    validator.restoreEnvironment();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiEnvironmentValidation().catch((error) => {
    console.error('Multi-environment validation failed:', error);
    process.exit(1);
  });
}

export { runMultiEnvironmentValidation, MultiEnvironmentValidator };
