/**
 * Performance Benchmark Tests
 *
 * Measures and tracks performance metrics for critical operations
 * to ensure the server meets performance requirements.
 */

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  throughput: number; // operations per second
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: NodeJS.MemoryUsage;
  };
}

interface PerformanceThresholds {
  maxAverageTime: number; // milliseconds
  minThroughput: number; // operations per second
  maxMemoryIncrease: number; // bytes
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private thresholds: Map<string, PerformanceThresholds> = new Map();

  constructor() {
    // Set performance thresholds for different operations
    this.thresholds.set('schema_validation', {
      maxAverageTime: 5, // 5ms
      minThroughput: 1000, // 1000 ops/sec
      maxMemoryIncrease: 1024 * 1024, // 1MB
    });

    this.thresholds.set('parameter_injection', {
      maxAverageTime: 2, // 2ms
      minThroughput: 2000, // 2000 ops/sec
      maxMemoryIncrease: 512 * 1024, // 512KB
    });

    this.thresholds.set('credential_validation', {
      maxAverageTime: 50, // 50ms
      minThroughput: 100, // 100 ops/sec
      maxMemoryIncrease: 2 * 1024 * 1024, // 2MB
    });

    this.thresholds.set('mcp_tool_call', {
      maxAverageTime: 100, // 100ms
      minThroughput: 50, // 50 ops/sec
      maxMemoryIncrease: 5 * 1024 * 1024, // 5MB
    });
  }

  async benchmark(
    operation: string,
    testFunction: () => Promise<void> | void,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    console.log(`🏃 Benchmarking ${operation} (${iterations} iterations)...`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage();
    const times: number[] = [];

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const iterationStart = process.hrtime.bigint();
      await testFunction();
      const iterationEnd = process.hrtime.bigint();

      const iterationTime = Number(iterationEnd - iterationStart) / 1_000_000; // Convert to milliseconds
      times.push(iterationTime);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = process.memoryUsage();
    const memoryDelta: NodeJS.MemoryUsage = {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      external: memoryAfter.external - memoryBefore.external,
      arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
    };

    const result: BenchmarkResult = {
      operation,
      iterations,
      totalTime,
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      throughput: (iterations / totalTime) * 1000, // ops per second
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        delta: memoryDelta,
      },
    };

    this.results.push(result);
    this.printResult(result);

    return result;
  }

  private printResult(result: BenchmarkResult): void {
    const threshold = this.thresholds.get(result.operation);

    console.log(`\n📊 ${result.operation} Results:`);
    console.log(`   Iterations: ${result.iterations}`);
    console.log(`   Total time: ${result.totalTime}ms`);
    console.log(
      `   Average time: ${result.averageTime.toFixed(2)}ms ${threshold ? (result.averageTime <= threshold.maxAverageTime ? '✅' : '❌') : ''}`
    );
    console.log(`   Min time: ${result.minTime.toFixed(2)}ms`);
    console.log(`   Max time: ${result.maxTime.toFixed(2)}ms`);
    console.log(
      `   Throughput: ${result.throughput.toFixed(0)} ops/sec ${threshold ? (result.throughput >= threshold.minThroughput ? '✅' : '❌') : ''}`
    );
    console.log(
      `   Memory delta: ${(result.memoryUsage.delta.heapUsed / 1024 / 1024).toFixed(2)}MB ${threshold ? (result.memoryUsage.delta.heapUsed <= threshold.maxMemoryIncrease ? '✅' : '❌') : ''}`
    );
  }

  checkThresholds(): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const result of this.results) {
      const threshold = this.thresholds.get(result.operation);
      if (!threshold) continue;

      if (result.averageTime > threshold.maxAverageTime) {
        violations.push(
          `${result.operation}: Average time ${result.averageTime.toFixed(2)}ms exceeds threshold ${threshold.maxAverageTime}ms`
        );
      }

      if (result.throughput < threshold.minThroughput) {
        violations.push(
          `${result.operation}: Throughput ${result.throughput.toFixed(0)} ops/sec below threshold ${threshold.minThroughput} ops/sec`
        );
      }

      if (result.memoryUsage.delta.heapUsed > threshold.maxMemoryIncrease) {
        violations.push(
          `${result.operation}: Memory increase ${(result.memoryUsage.delta.heapUsed / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(threshold.maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB`
        );
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  generateReport(): string {
    const report = [
      '# Performance Benchmark Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      `Total operations benchmarked: ${this.results.length}`,
      '',
    ];

    for (const result of this.results) {
      report.push(`### ${result.operation}`);
      report.push(`- **Iterations**: ${result.iterations}`);
      report.push(`- **Average Time**: ${result.averageTime.toFixed(2)}ms`);
      report.push(`- **Throughput**: ${result.throughput.toFixed(0)} ops/sec`);
      report.push(
        `- **Memory Impact**: ${(result.memoryUsage.delta.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );
      report.push('');
    }

    const thresholdCheck = this.checkThresholds();
    report.push('## Threshold Compliance');
    if (thresholdCheck.passed) {
      report.push('✅ All performance thresholds met');
    } else {
      report.push('❌ Performance threshold violations:');
      thresholdCheck.violations.forEach((violation) => {
        report.push(`- ${violation}`);
      });
    }

    return report.join('\n');
  }
}

// Benchmark test functions
async function runPerformanceBenchmarks(): Promise<void> {
  console.log('🚀 Starting Performance Benchmarks');
  console.log('===================================');

  const benchmark = new PerformanceBenchmark();

  // Import modules for testing
  const { StartDataprocClusterSchema } = await import('../../src/validation/schemas');
  const { validateServiceAccountKey } = await import('../../src/security/credential-manager');

  // Benchmark 1: Schema Validation Performance
  await benchmark.benchmark(
    'schema_validation',
    () => {
      const testData = {
        clusterName: 'test-cluster-123',
        projectId: 'test-project-456',
        region: 'us-central1',
      };

      const result = StartDataprocClusterSchema.safeParse(testData);
      if (!result.success) {
        throw new Error('Validation failed');
      }
    },
    5000
  );

  // Benchmark 2: Parameter Injection Performance
  await benchmark.benchmark(
    'parameter_injection',
    () => {
      const params = {
        clusterName: 'test-cluster',
        customParam: 'value',
      };

      // Simulate parameter injection logic
      const defaultParams = {
        projectId: 'default-project',
        region: 'us-central1',
        zone: 'us-central1-a',
      };

      const merged = { ...defaultParams, ...params };

      // Validate merged parameters
      if (!merged.clusterName || !merged.projectId || !merged.region) {
        throw new Error('Parameter injection failed');
      }
    },
    10000
  );

  // Benchmark 3: Credential Validation Performance
  await benchmark.benchmark(
    'credential_validation',
    async () => {
      // Create a mock credential for testing
      const mockCredential = {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----\n',
        client_email: 'test@test-project.iam.gserviceaccount.com',
        client_id: '123456789',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      };

      // Simulate credential validation without file I/O
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      const hasAllFields = requiredFields.every(
        (field) => mockCredential[field as keyof typeof mockCredential]
      );

      if (!hasAllFields || mockCredential.type !== 'service_account') {
        throw new Error('Credential validation failed');
      }
    },
    1000
  );

  // Benchmark 4: MCP Tool Call Simulation
  await benchmark.benchmark(
    'mcp_tool_call',
    async () => {
      // Simulate a complete MCP tool call workflow
      const toolRequest = {
        method: 'tools/call',
        params: {
          name: 'start_dataproc_cluster',
          arguments: {
            clusterName: 'benchmark-cluster',
            projectId: 'benchmark-project',
            region: 'us-central1',
          },
        },
      };

      // Simulate validation
      const validationResult = StartDataprocClusterSchema.safeParse(toolRequest.params.arguments);
      if (!validationResult.success) {
        throw new Error('Tool call validation failed');
      }

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1));

      // Simulate response generation
      const response = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              clusterName: toolRequest.params.arguments.clusterName,
              status: 'CREATING',
              operationId: 'op-' + Math.random().toString(36).substr(2, 9),
            }),
          },
        ],
      };

      if (!response.content || response.content.length === 0) {
        throw new Error('Tool call response generation failed');
      }
    },
    500
  );

  // Benchmark 5: Concurrent Operations
  await benchmark.benchmark(
    'concurrent_operations',
    async () => {
      const operations = Array.from({ length: 10 }, () =>
        Promise.resolve().then(() => {
          const testData = {
            clusterName: `cluster-${Math.random().toString(36).substr(2, 5)}`,
            projectId: 'test-project',
            region: 'us-central1',
          };
          return StartDataprocClusterSchema.safeParse(testData);
        })
      );

      const results = await Promise.all(operations);
      if (results.some((r) => !r.success)) {
        throw new Error('Concurrent operations failed');
      }
    },
    100
  );

  // Generate and save report
  const report = benchmark.generateReport();
  console.log('\n' + report);

  // Check thresholds
  const thresholdCheck = benchmark.checkThresholds();
  if (!thresholdCheck.passed) {
    console.log('\n❌ Performance benchmarks failed:');
    thresholdCheck.violations.forEach((violation) => {
      console.log(`   ${violation}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All performance benchmarks passed!');
  }
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceBenchmarks().catch((error) => {
    console.error('Performance benchmarks failed:', error);
    process.exit(1);
  });
}

export { PerformanceBenchmark, runPerformanceBenchmarks };
