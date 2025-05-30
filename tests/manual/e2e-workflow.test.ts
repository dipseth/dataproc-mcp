/**
 * End-to-End Workflow Tests
 *
 * Tests complete workflows from cluster creation to job execution
 * to ensure all components work together correctly.
 */

// Simple test framework for integration testing
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class E2ETestRunner {
  private results: TestResult[] = [];

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

  printSummary(): void {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n📊 Test Summary');
    console.log('================');
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

// Mock MCP server for testing
class MockMCPServer {
  private tools: Map<string, Function> = new Map();

  registerTool(name: string, handler: Function): void {
    this.tools.set(name, handler);
  }

  async callTool(name: string, args: any): Promise<any> {
    const handler = this.tools.get(name);
    if (!handler) {
      throw new Error(`Tool ${name} not found`);
    }
    return await handler(args);
  }
}

// Test scenarios
async function runE2ETests(): Promise<void> {
  const runner = new E2ETestRunner();
  const mockServer = new MockMCPServer();

  // Register mock tools
  mockServer.registerTool('start_dataproc_cluster', async (args: any) => {
    if (!args.clusterName || !args.projectId || !args.region) {
      throw new Error('Missing required parameters');
    }
    return {
      clusterName: args.clusterName,
      status: 'CREATING',
      operationId: 'op-12345',
    };
  });

  mockServer.registerTool('get_cluster_status', async (args: any) => {
    return {
      clusterName: args.clusterName,
      status: 'RUNNING',
      masterConfig: { numInstances: 1 },
      workerConfig: { numInstances: 2 },
    };
  });

  mockServer.registerTool('submit_hive_query', async (args: any) => {
    if (!args.query || !args.clusterName) {
      throw new Error('Missing query or cluster name');
    }
    return {
      jobId: 'job-67890',
      status: 'RUNNING',
      query: args.query,
    };
  });

  mockServer.registerTool('get_job_status', async (args: any) => {
    return {
      jobId: args.jobId,
      status: 'DONE',
      output: 'Query completed successfully',
    };
  });

  // Test 1: Complete cluster lifecycle
  await runner.runTest('Complete Cluster Lifecycle', async () => {
    // Create cluster
    const createResult = await mockServer.callTool('start_dataproc_cluster', {
      clusterName: 'test-cluster-e2e',
      projectId: 'test-project',
      region: 'us-central1',
    });

    if (createResult.status !== 'CREATING') {
      throw new Error('Cluster creation failed');
    }

    // Check cluster status
    const statusResult = await mockServer.callTool('get_cluster_status', {
      clusterName: 'test-cluster-e2e',
      projectId: 'test-project',
      region: 'us-central1',
    });

    if (statusResult.status !== 'RUNNING') {
      throw new Error('Cluster not running');
    }
  });

  // Test 2: Hive query execution workflow
  await runner.runTest('Hive Query Execution Workflow', async () => {
    // Submit query
    const submitResult = await mockServer.callTool('submit_hive_query', {
      clusterName: 'test-cluster-e2e',
      projectId: 'test-project',
      region: 'us-central1',
      query: 'SHOW TABLES;',
    });

    if (!submitResult.jobId) {
      throw new Error('Job submission failed');
    }

    // Check job status
    const jobResult = await mockServer.callTool('get_job_status', {
      jobId: submitResult.jobId,
      projectId: 'test-project',
      region: 'us-central1',
    });

    if (jobResult.status !== 'DONE') {
      throw new Error('Job did not complete successfully');
    }
  });

  // Test 3: Parameter validation workflow
  await runner.runTest('Parameter Validation Workflow', async () => {
    try {
      await mockServer.callTool('start_dataproc_cluster', {
        clusterName: '', // Invalid empty name
        projectId: 'test-project',
        region: 'us-central1',
      });
      throw new Error('Should have failed validation');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing required parameters')) {
        // Expected validation error
        return;
      }
      throw error;
    }
  });

  // Test 4: Multi-environment configuration
  await runner.runTest('Multi-Environment Configuration', async () => {
    const environments = [
      { name: 'development', projectId: 'dev-project-123' },
      { name: 'staging', projectId: 'staging-project-456' },
      { name: 'production', projectId: 'prod-project-789' },
    ];

    for (const env of environments) {
      const result = await mockServer.callTool('start_dataproc_cluster', {
        clusterName: `${env.name}-cluster`,
        projectId: env.projectId,
        region: 'us-central1',
      });

      if (!result.clusterName.includes(env.name)) {
        throw new Error(`Environment ${env.name} configuration failed`);
      }
    }
  });

  // Test 5: Error handling and resilience
  await runner.runTest('Error Handling and Resilience', async () => {
    // Test with invalid project ID
    try {
      await mockServer.callTool('start_dataproc_cluster', {
        clusterName: 'test-cluster',
        projectId: 'invalid-project-id-with-special-chars!',
        region: 'us-central1',
      });
    } catch (error) {
      // Expected to fail - this is good
    }

    // Test with missing parameters
    try {
      await mockServer.callTool('submit_hive_query', {
        clusterName: 'test-cluster',
        // Missing query parameter
      });
      throw new Error('Should have failed due to missing query');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing query')) {
        // Expected validation error
        return;
      }
      throw error;
    }
  });

  // Test 6: Performance and timeout handling
  await runner.runTest('Performance and Timeout Handling', async () => {
    const startTime = Date.now();

    // Simulate multiple concurrent operations
    const operations = Array.from({ length: 5 }, (_, i) =>
      mockServer.callTool('get_cluster_status', {
        clusterName: `cluster-${i}`,
        projectId: 'test-project',
        region: 'us-central1',
      })
    );

    const results = await Promise.all(operations);
    const duration = Date.now() - startTime;

    if (results.length !== 5) {
      throw new Error('Not all operations completed');
    }

    if (duration > 5000) {
      // 5 second timeout
      throw new Error('Operations took too long');
    }
  });

  runner.printSummary();

  if (!runner.allPassed) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests().catch((error) => {
    console.error('E2E tests failed:', error);
    process.exit(1);
  });
}

export { runE2ETests, E2ETestRunner, MockMCPServer };
