#!/usr/bin/env node

/**
 * Comprehensive Test Runner for get_query_results Functionality
 * 
 * This script orchestrates all the test suites for the restored get_query_results
 * functionality, providing a single entry point for comprehensive testing.
 * 
 * Usage:
 *   npm run test:query-results
 *   node tests/manual/run-query-results-tests.ts
 *   
 * Environment Variables:
 *   TEST_PROJECT_ID - GCP project ID for testing
 *   TEST_REGION - Dataproc region for testing
 *   TEST_JOB_ID - Completed job ID for testing
 *   TEST_INCOMPLETE_JOB_ID - Incomplete job ID for error testing
 *   TEST_TIMEOUT - Timeout for individual tests (default: 30000ms)
 *   TEST_SEMANTIC_SEARCH - Enable semantic search testing (default: true)
 *   TEST_SUITE - Specific test suite to run (comprehensive|scenarios|basic)
 *   TEST_VERBOSE - Enable verbose output (default: false)
 */

import { QueryResultsTestSuite } from './test-query-results-comprehensive.js';
import { QueryResultsScenariosTestSuite, runScenarioTests } from './test-query-results-scenarios.js';
import { testQueryResults } from './test-query-results.js';
import {
  TestEnvironmentSetup,
  PerformanceUtils,
  TestReporter,
  type TestEnvironment,
} from './test-utils/query-results-test-utils.js';

// Test suite configuration
interface TestSuiteConfig {
  name: string;
  description: string;
  enabled: boolean;
  runner: () => Promise<void>;
  estimatedDuration: number; // in milliseconds
}

// Main test orchestrator class
class QueryResultsTestOrchestrator {
  private environment: TestEnvironment;
  private reporter: TestReporter;
  private verbose: boolean;

  constructor() {
    this.environment = TestEnvironmentSetup.getTestEnvironment();
    this.reporter = new TestReporter();
    this.verbose = process.env.TEST_VERBOSE === 'true';
  }

  /**
   * Run all test suites or a specific suite
   */
  async runTests(): Promise<void> {
    console.log('🧪 Query Results Test Orchestrator');
    console.log('=' .repeat(50));
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🌍 Environment: ${this.environment.projectId}/${this.environment.region}`);
    console.log(`🎯 Job ID: ${this.environment.validJobId}`);
    
    // Validate environment first
    await this.validateEnvironment();
    
    // Determine which test suites to run
    const requestedSuite = process.env.TEST_SUITE?.toLowerCase();
    const testSuites = this.getTestSuites(requestedSuite);
    
    console.log(`\n🏃 Running ${testSuites.length} test suite(s)`);
    
    // Run each test suite
    for (const suite of testSuites) {
      if (suite.enabled) {
        await this.runTestSuite(suite);
      }
    }
    
    // Generate final report
    this.generateFinalReport();
  }

  /**
   * Validate the test environment
   */
  private async validateEnvironment(): Promise<void> {
    console.log('\n🔍 Validating Test Environment');
    console.log('-' .repeat(30));
    
    const validation = await TestEnvironmentSetup.validateEnvironment(this.environment);
    TestEnvironmentSetup.printValidationResults(validation);
    
    if (!validation.isValid) {
      console.log('\n❌ Environment validation failed. Some tests may not work correctly.');
      console.log('   Consider fixing the issues above before proceeding.');
      
      // Ask user if they want to continue
      if (process.env.CI !== 'true') {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question('\nContinue anyway? (y/N): ', resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('Exiting...');
          process.exit(1);
        }
      }
    }
  }

  /**
   * Get test suites configuration
   */
  private getTestSuites(requestedSuite?: string): TestSuiteConfig[] {
    const allSuites: TestSuiteConfig[] = [
      {
        name: 'basic',
        description: 'Basic functionality test (original test)',
        enabled: !requestedSuite || requestedSuite === 'basic' || requestedSuite === 'all',
        runner: () => this.runBasicTests(),
        estimatedDuration: 30000, // 30 seconds
      },
      {
        name: 'comprehensive',
        description: 'Comprehensive test suite with all features',
        enabled: !requestedSuite || requestedSuite === 'comprehensive' || requestedSuite === 'all',
        runner: () => this.runComprehensiveTests(),
        estimatedDuration: 120000, // 2 minutes
      },
      {
        name: 'scenarios',
        description: 'Edge cases and error condition testing',
        enabled: !requestedSuite || requestedSuite === 'scenarios' || requestedSuite === 'all',
        runner: () => this.runScenarioTests(),
        estimatedDuration: 90000, // 1.5 minutes
      },
    ];

    return allSuites.filter(suite => suite.enabled);
  }

  /**
   * Run a specific test suite with error handling and reporting
   */
  private async runTestSuite(suite: TestSuiteConfig): Promise<void> {
    console.log(`\n🎯 Running Test Suite: ${suite.name}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`⏱️  Estimated duration: ${(suite.estimatedDuration / 1000).toFixed(0)}s`);
    console.log('-' .repeat(50));

    try {
      const { metrics } = await PerformanceUtils.measurePerformance(
        suite.runner,
        suite.name
      );

      this.reporter.addResult(
        suite.name,
        true,
        metrics.duration,
        undefined,
        {
          description: suite.description,
          estimatedDuration: suite.estimatedDuration,
          actualDuration: metrics.duration,
        }
      );

      console.log(`✅ Test suite '${suite.name}' completed successfully`);
      
      if (metrics.duration > suite.estimatedDuration * 1.5) {
        console.log(`⚠️  Suite took longer than expected: ${metrics.duration}ms vs ${suite.estimatedDuration}ms`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.reporter.addResult(
        suite.name,
        false,
        0,
        errorMessage,
        {
          description: suite.description,
          estimatedDuration: suite.estimatedDuration,
        }
      );

      console.log(`❌ Test suite '${suite.name}' failed: ${errorMessage}`);
      
      if (this.verbose && error instanceof Error && error.stack) {
        console.log(`Stack trace:\n${error.stack}`);
      }
    }
  }

  /**
   * Run basic functionality tests
   */
  private async runBasicTests(): Promise<void> {
    console.log('Running basic functionality test...');
    await testQueryResults();
  }

  /**
   * Run comprehensive test suite
   */
  private async runComprehensiveTests(): Promise<void> {
    console.log('Running comprehensive test suite...');
    const testSuite = new QueryResultsTestSuite(this.environment);
    await testSuite.runAllTests();
  }

  /**
   * Run scenario tests
   */
  private async runScenarioTests(): Promise<void> {
    console.log('Running scenario tests...');
    await runScenarioTests();
  }

  /**
   * Generate final report
   */
  private generateFinalReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    
    this.reporter.generateSummary();
    
    // Additional insights
    console.log('\n📊 Test Insights:');
    console.log(`   Environment: ${this.environment.projectId}/${this.environment.region}`);
    console.log(`   Job ID: ${this.environment.validJobId}`);
    console.log(`   Semantic Search: ${this.environment.enableSemanticSearch ? 'Enabled' : 'Disabled'}`);
    console.log(`   Timeout: ${this.environment.timeout}ms`);
    
    // Export results if requested
    if (process.env.TEST_EXPORT_RESULTS === 'true') {
      const resultsJson = this.reporter.exportResults();
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `test-results-${timestamp}.json`;
      
      fs.writeFileSync(filename, resultsJson);
      console.log(`\n💾 Results exported to: ${filename}`);
    }
    
    console.log(`\n📅 Completed at: ${new Date().toISOString()}`);
  }
}

// Utility functions for specific test scenarios
class TestScenarioRunner {
  /**
   * Run performance benchmark
   */
  static async runPerformanceBenchmark(environment: TestEnvironment): Promise<void> {
    console.log('\n🏃 Running Performance Benchmark');
    console.log('-' .repeat(30));
    
    const { getQueryResultsWithRest } = await import('../../src/services/query.js');
    
    const benchmarkFn = () => getQueryResultsWithRest(
      environment.projectId,
      environment.region,
      environment.validJobId,
      { maxDisplayRows: 10 }
    );
    
    await PerformanceUtils.runBenchmark(benchmarkFn, 5, 'Query Results Performance');
  }

  /**
   * Run memory usage test
   */
  static async runMemoryTest(environment: TestEnvironment): Promise<void> {
    console.log('\n🧠 Running Memory Usage Test');
    console.log('-' .repeat(30));
    
    const { getQueryResultsWithRest } = await import('../../src/services/query.js');
    
    const initialMemory = process.memoryUsage();
    console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // Run multiple requests to test memory accumulation
    for (let i = 0; i < 10; i++) {
      await getQueryResultsWithRest(
        environment.projectId,
        environment.region,
        environment.validJobId,
        { maxDisplayRows: 50 }
      );
      
      if (i % 3 === 0) {
        const currentMemory = process.memoryUsage();
        console.log(`After ${i + 1} requests: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const finalMemory = process.memoryUsage();
      console.log(`After GC: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  /**
   * Run integration test with other tools
   */
  static async runIntegrationTest(environment: TestEnvironment): Promise<void> {
    console.log('\n🔗 Running Integration Test');
    console.log('-' .repeat(30));
    
    const { getQueryResultsWithRest, getJobStatus } = await import('../../src/services/query.js');
    
    // Test integration with job status
    console.log('1. Getting job status...');
    const jobStatus = await getJobStatus(
      environment.projectId,
      environment.region,
      environment.validJobId
    );
    
    console.log(`   Job state: ${jobStatus.status?.state}`);
    console.log(`   Has driver output: ${!!jobStatus.driverOutputResourceUri}`);
    
    // Test query results
    console.log('2. Getting query results...');
    const queryResults = await getQueryResultsWithRest(
      environment.projectId,
      environment.region,
      environment.validJobId,
      { maxDisplayRows: 5 }
    );
    
    console.log(`   Total rows: ${queryResults.totalRows}`);
    console.log(`   Displayed rows: ${queryResults.rows.length}`);
    console.log(`   Schema fields: ${queryResults.schema?.fields?.length || 0}`);
    
    console.log('✅ Integration test completed successfully');
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    const orchestrator = new QueryResultsTestOrchestrator();
    await orchestrator.runTests();
    
    // Run additional tests if requested
    if (process.env.TEST_PERFORMANCE === 'true') {
      const environment = TestEnvironmentSetup.getTestEnvironment();
      await TestScenarioRunner.runPerformanceBenchmark(environment);
    }
    
    if (process.env.TEST_MEMORY === 'true') {
      const environment = TestEnvironmentSetup.getTestEnvironment();
      await TestScenarioRunner.runMemoryTest(environment);
    }
    
    if (process.env.TEST_INTEGRATION === 'true') {
      const environment = TestEnvironmentSetup.getTestEnvironment();
      await TestScenarioRunner.runIntegrationTest(environment);
    }
    
    console.log('\n🎉 All testing completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  // Print usage information
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Query Results Test Runner

Usage:
  node run-query-results-tests.ts [options]
  npm run test:query-results

Environment Variables:
  TEST_PROJECT_ID          GCP project ID for testing
  TEST_REGION              Dataproc region (default: us-central1)
  TEST_JOB_ID              Completed job ID for testing
  TEST_INCOMPLETE_JOB_ID   Incomplete job ID for error testing
  TEST_TIMEOUT             Timeout for tests in ms (default: 30000)
  TEST_SEMANTIC_SEARCH     Enable semantic search (default: true)
  TEST_SUITE               Specific suite: basic|comprehensive|scenarios|all
  TEST_VERBOSE             Enable verbose output (default: false)
  TEST_PERFORMANCE         Run performance benchmark (default: false)
  TEST_MEMORY              Run memory usage test (default: false)
  TEST_INTEGRATION         Run integration test (default: false)
  TEST_EXPORT_RESULTS      Export results to JSON (default: false)

Examples:
  # Run all tests
  TEST_PROJECT_ID=my-project TEST_JOB_ID=job-123 node run-query-results-tests.ts
  
  # Run only comprehensive tests
  TEST_SUITE=comprehensive node run-query-results-tests.ts
  
  # Run with performance benchmarking
  TEST_PERFORMANCE=true node run-query-results-tests.ts
  
  # Run with verbose output and result export
  TEST_VERBOSE=true TEST_EXPORT_RESULTS=true node run-query-results-tests.ts
`);
    process.exit(0);
  }
  
  main().catch(console.error);
}

export { QueryResultsTestOrchestrator, TestScenarioRunner };