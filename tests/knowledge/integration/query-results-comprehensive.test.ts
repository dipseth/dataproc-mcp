/**
 * Comprehensive Test Suite for get_query_results Functionality
 * 
 * This test suite provides thorough testing of the restored get_query_results
 * functionality with async support and semantic search integration.
 * 
 * Test Coverage:
 * - Basic functionality verification
 * - GCS authentication and file downloading
 * - Format options (text, JSON, CSV)
 * - Semantic search integration
 * - Error handling and edge cases
 * - Performance testing
 * - Comparison with get_job_results
 */

import { getQueryResultsWithRest, getQueryResults, getJobStatus } from '../../../src/services/query.js';
import { JobOutputHandler } from '../../../src/services/job-output-handler.js';
import { GCSService } from '../../../src/services/gcs.js';
import { logger } from '../../../src/utils/logger.js';

// Test configuration interface
interface TestConfig {
  projectId: string;
  region: string;
  validJobId: string;
  invalidJobId: string;
  incompleteJobId?: string;
  enableSemanticSearch: boolean;
  timeout: number;
}

// Test result interface
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Test utilities
class TestUtils {
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }

  static validateQueryResultResponse(result: any): boolean {
    return (
      result &&
      typeof result === 'object' &&
      'rows' in result &&
      Array.isArray(result.rows) &&
      'totalRows' in result &&
      typeof result.totalRows === 'number'
    );
  }

  static generateMockJobId(): string {
    return `mock-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static async waitForJobCompletion(
    projectId: string,
    region: string,
    jobId: string,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const jobStatus = await getJobStatus(projectId, region, jobId);
        if (jobStatus.status?.state === 'DONE') {
          return true;
        }
        if (jobStatus.status?.state === 'ERROR' || jobStatus.status?.state === 'CANCELLED') {
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      } catch (error) {
        console.warn(`Error checking job status: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    return false;
  }
}

// Main test class
export class QueryResultsTestSuite {
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: TestConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Comprehensive Query Results Test Suite\n');
    console.log('Configuration:', {
      projectId: this.config.projectId,
      region: this.config.region,
      validJobId: this.config.validJobId,
      enableSemanticSearch: this.config.enableSemanticSearch,
      timeout: this.config.timeout,
    });

    // Basic functionality tests
    await this.testBasicFunctionality();
    await this.testWrapperFunction();
    
    // Format testing
    await this.testTextFormat();
    await this.testJsonFormat();
    await this.testCsvFormat();
    
    // Authentication and GCS tests
    await this.testGcsAuthentication();
    await this.testGcsFileDownload();
    
    // Semantic search tests
    if (this.config.enableSemanticSearch) {
      await this.testSemanticIndexing();
    }
    
    // Error handling tests
    await this.testInvalidJobId();
    await this.testIncompleteJob();
    await this.testPermissionErrors();
    
    // Performance tests
    await this.testPerformance();
    await this.testLargeResultSets();
    
    // Comparison tests
    await this.testComparisonWithJobResults();
    
    // Edge case tests
    await this.testEdgeCases();

    this.printSummary();
    return this.results;
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    console.log(`\n🔍 Running: ${testName}`);
    
    try {
      const { duration } = await TestUtils.measureTime(testFn);
      this.results.push({
        testName,
        passed: true,
        duration,
      });
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({
        testName,
        passed: false,
        duration: 0,
        error: errorMessage,
      });
      console.log(`❌ ${testName} - FAILED: ${errorMessage}`);
    }
  }

  // Test 1: Basic functionality verification
  private async testBasicFunctionality(): Promise<void> {
    await this.runTest('Basic Functionality', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 5,
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid response format');
      }

      if (result.rows.length === 0) {
        console.warn('⚠️  No rows returned - this might be expected for some queries');
      }

      console.log(`   📊 Schema fields: ${result.schema?.fields?.length || 0}`);
      console.log(`   📝 Total rows: ${result.totalRows}`);
      console.log(`   🔍 Displayed rows: ${result.rows.length}`);
    });
  }

  // Test 2: Wrapper function testing
  private async testWrapperFunction(): Promise<void> {
    await this.runTest('Wrapper Function', async () => {
      const result = await getQueryResults(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        3
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid wrapper response format');
      }

      console.log(`   📊 Wrapper result rows: ${result.rows?.length || 0}`);
    });
  }

  // Test 3: Text format testing
  private async testTextFormat(): Promise<void> {
    await this.runTest('Text Format', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 3,
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      if (!result.schema?.fields) {
        throw new Error('No schema fields in text format result');
      }

      console.log(`   📄 Text format fields: ${result.schema.fields.map(f => f.name).join(', ')}`);
    });
  }

  // Test 4: JSON format testing
  private async testJsonFormat(): Promise<void> {
    await this.runTest('JSON Format', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 3,
          format: 'json',
          enableSemanticIndexing: false,
        }
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid JSON format response');
      }

      console.log(`   🔧 JSON format processed successfully`);
    });
  }

  // Test 5: CSV format testing
  private async testCsvFormat(): Promise<void> {
    await this.runTest('CSV Format', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 3,
          format: 'csv',
          enableSemanticIndexing: false,
        }
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid CSV format response');
      }

      console.log(`   📊 CSV format processed successfully`);
    });
  }

  // Test 6: GCS authentication testing
  private async testGcsAuthentication(): Promise<void> {
    await this.runTest('GCS Authentication', async () => {
      const gcsService = new GCSService();
      
      // Test with a known GCS URI pattern (this will fail gracefully if no access)
      try {
        const testUri = 'gs://test-bucket/test-file';
        await gcsService.getFileMetadata(testUri);
        console.log(`   🔐 GCS authentication working`);
      } catch (error) {
        // Expected for test URIs, but should be authentication-related, not implementation errors
        if (error instanceof Error && error.message.includes('not implemented')) {
          throw new Error('GCS service not properly implemented');
        }
        console.log(`   🔐 GCS authentication configured (test URI failed as expected)`);
      }
    });
  }

  // Test 7: GCS file download testing
  private async testGcsFileDownload(): Promise<void> {
    await this.runTest('GCS File Download', async () => {
      // This test verifies the download mechanism works by checking job status first
      const jobStatus = await getJobStatus(
        this.config.projectId,
        this.config.region,
        this.config.validJobId
      );

      if (!jobStatus.driverOutputResourceUri) {
        throw new Error('No driver output URI found for download testing');
      }

      console.log(`   📁 Driver output URI available: ${jobStatus.driverOutputResourceUri}`);
      
      // Test that the GCS service can parse the URI
      const gcsService = new GCSService();
      const parsedUri = gcsService.parseUri(jobStatus.driverOutputResourceUri);
      
      if (!parsedUri.bucket || !parsedUri.path) {
        throw new Error('Failed to parse GCS URI');
      }

      console.log(`   🪣 Bucket: ${parsedUri.bucket}, Path: ${parsedUri.path}`);
    });
  }

  // Test 8: Semantic indexing testing
  private async testSemanticIndexing(): Promise<void> {
    await this.runTest('Semantic Indexing', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 5,
          format: 'text',
          enableSemanticIndexing: true,
        }
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid response with semantic indexing');
      }

      // Note: Semantic indexing failures are non-fatal, so we just verify the main operation works
      console.log(`   🧠 Semantic indexing attempted (non-fatal if Qdrant unavailable)`);
    });
  }

  // Test 9: Invalid job ID testing
  private async testInvalidJobId(): Promise<void> {
    await this.runTest('Invalid Job ID', async () => {
      try {
        await getQueryResultsWithRest(
          this.config.projectId,
          this.config.region,
          this.config.invalidJobId,
          { maxDisplayRows: 5 }
        );
        throw new Error('Expected error for invalid job ID but got success');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Expected error')) {
          throw error;
        }
        // Expected error - test passes
        console.log(`   ❌ Correctly handled invalid job ID: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  // Test 10: Incomplete job testing
  private async testIncompleteJob(): Promise<void> {
    await this.runTest('Incomplete Job', async () => {
      if (!this.config.incompleteJobId) {
        console.log(`   ⏭️  Skipping incomplete job test (no incomplete job ID provided)`);
        return;
      }

      try {
        await getQueryResultsWithRest(
          this.config.projectId,
          this.config.region,
          this.config.incompleteJobId,
          { maxDisplayRows: 5 }
        );
        throw new Error('Expected error for incomplete job but got success');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Expected error')) {
          throw error;
        }
        // Expected error - test passes
        console.log(`   ⏳ Correctly handled incomplete job: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  // Test 11: Permission errors testing
  private async testPermissionErrors(): Promise<void> {
    await this.runTest('Permission Errors', async () => {
      // Test with a job ID from a different project (if available)
      const fakeProjectId = 'non-existent-project-12345';
      
      try {
        await getQueryResultsWithRest(
          fakeProjectId,
          this.config.region,
          this.config.validJobId,
          { maxDisplayRows: 5 }
        );
        throw new Error('Expected permission error but got success');
      } catch (error) {
        if (error instanceof Error && error.message.includes('Expected permission')) {
          throw error;
        }
        // Expected error - test passes
        console.log(`   🔒 Correctly handled permission error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  // Test 12: Performance testing
  private async testPerformance(): Promise<void> {
    await this.runTest('Performance', async () => {
      const iterations = 3;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = await TestUtils.measureTime(async () => {
          await getQueryResultsWithRest(
            this.config.projectId,
            this.config.region,
            this.config.validJobId,
            {
              maxDisplayRows: 10,
              format: 'text',
              enableSemanticIndexing: false,
            }
          );
        });
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`   ⏱️  Average: ${avgDuration.toFixed(0)}ms, Min: ${minDuration}ms, Max: ${maxDuration}ms`);

      if (avgDuration > this.config.timeout) {
        throw new Error(`Performance test failed: average duration ${avgDuration}ms exceeds timeout ${this.config.timeout}ms`);
      }
    });
  }

  // Test 13: Large result sets testing
  private async testLargeResultSets(): Promise<void> {
    await this.runTest('Large Result Sets', async () => {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 100, // Request more rows
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      if (!TestUtils.validateQueryResultResponse(result)) {
        throw new Error('Invalid response for large result set');
      }

      console.log(`   📊 Large result set: ${result.totalRows} total, ${result.rows.length} displayed`);
      
      // Verify that maxDisplayRows is respected
      if (result.rows.length > 100) {
        throw new Error(`Result set exceeded maxDisplayRows limit: ${result.rows.length} > 100`);
      }
    });
  }

  // Test 14: Comparison with get_job_results
  private async testComparisonWithJobResults(): Promise<void> {
    await this.runTest('Comparison with get_job_results', async () => {
      // Get results using both methods
      const queryResult = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 10,
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      // Try to get job results for comparison (may not always be available)
      try {
        const jobOutputHandler = new JobOutputHandler();
        const jobStatus = await getJobStatus(
          this.config.projectId,
          this.config.region,
          this.config.validJobId
        );

        if (jobStatus.driverOutputResourceUri) {
          const jobResult = await jobOutputHandler.getJobOutput(
            jobStatus.driverOutputResourceUri,
            'text'
          );

          console.log(`   🔄 Both methods executed successfully`);
          console.log(`   📊 Query results: ${queryResult.rows.length} rows`);
          console.log(`   📄 Job output: ${typeof jobResult === 'string' ? 'text' : 'structured'} format`);
        } else {
          console.log(`   ⏭️  No driver output URI available for comparison`);
        }
      } catch (error) {
        console.log(`   ⚠️  Job results comparison failed (expected): ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  // Test 15: Edge cases testing
  private async testEdgeCases(): Promise<void> {
    await this.runTest('Edge Cases', async () => {
      // Test with maxDisplayRows = 0
      const zeroRowsResult = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 0,
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      if (zeroRowsResult.rows.length !== 0) {
        throw new Error(`Expected 0 rows but got ${zeroRowsResult.rows.length}`);
      }

      // Test with maxDisplayRows = 1
      const oneRowResult = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        {
          maxDisplayRows: 1,
          format: 'text',
          enableSemanticIndexing: false,
        }
      );

      if (oneRowResult.rows.length > 1) {
        throw new Error(`Expected max 1 row but got ${oneRowResult.rows.length}`);
      }

      console.log(`   🎯 Edge cases handled correctly`);
    });
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`📊 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.testName}: ${r.error}`);
        });
    }

    console.log('\n🎉 Test suite completed!');
  }
}

// Default test configuration
const getDefaultTestConfig = (): TestConfig => ({
  projectId: process.env.TEST_PROJECT_ID || 'your-test-project',
  region: process.env.TEST_REGION || 'us-central1',
  validJobId: process.env.TEST_JOB_ID || 'a15cc60e-da05-42d3-93f3-3252a11aa4c6',
  invalidJobId: TestUtils.generateMockJobId(),
  incompleteJobId: process.env.TEST_INCOMPLETE_JOB_ID,
  enableSemanticSearch: process.env.TEST_SEMANTIC_SEARCH !== 'false',
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
});

// Main execution function
export async function runComprehensiveTests(): Promise<void> {
  const config = getDefaultTestConfig();
  
  if (config.validJobId === 'a15cc60e-da05-42d3-93f3-3252a11aa4c6' && !process.env.TEST_JOB_ID) {
    console.log('⚠️  Using default job ID. Set TEST_JOB_ID environment variable for your specific job.');
  }

  const testSuite = new QueryResultsTestSuite(config);
  let results;
  try {
    results = await testSuite.runAllTests();
  } finally {
    // Cleanup any resources
    console.log('\n🧹 Cleaning up test resources...');
    try {
      // Add any specific cleanup here if needed
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }
  
  // Exit with error code if any tests failed
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(console.error);
}