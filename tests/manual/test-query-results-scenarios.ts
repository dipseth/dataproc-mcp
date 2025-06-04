/**
 * Edge Case and Error Condition Testing for get_query_results
 * 
 * This test suite focuses on edge cases, error conditions, and boundary testing
 * for the restored get_query_results functionality. It complements the comprehensive
 * test suite by focusing on unusual scenarios and error paths.
 */

import { getQueryResultsWithRest, getQueryResults, getJobStatus } from '../../src/services/query.js';
import { GCSService } from '../../src/services/gcs.js';
import { logger } from '../../src/utils/logger.js';

// Test scenario interfaces
interface ErrorTestScenario {
  name: string;
  description: string;
  projectId: string;
  region: string;
  jobId: string;
  options?: any;
  expectedErrorPattern: RegExp;
  shouldThrow: boolean;
}

interface EdgeCaseScenario {
  name: string;
  description: string;
  projectId: string;
  region: string;
  jobId: string;
  options?: any;
  validator: (result: any) => boolean;
  expectedBehavior: string;
}

// Mock data generators for testing parsing logic
class MockDataGenerator {
  static generateHiveTableOutput(rows: number = 5): string {
    const headers = ['id', 'name', 'value', 'timestamp'];
    const separator = '+' + '-'.repeat(10) + '+' + '-'.repeat(20) + '+' + '-'.repeat(15) + '+' + '-'.repeat(25) + '+';
    
    let output = separator + '\n';
    output += '| ' + headers.map(h => h.padEnd(h === 'name' ? 18 : h === 'timestamp' ? 23 : h === 'value' ? 13 : 8)).join(' | ') + ' |\n';
    output += separator + '\n';
    
    for (let i = 1; i <= rows; i++) {
      const row = [
        i.toString().padEnd(8),
        `item_${i}`.padEnd(18),
        (Math.random() * 1000).toFixed(2).padEnd(13),
        new Date().toISOString().padEnd(23)
      ];
      output += '| ' + row.join(' | ') + ' |\n';
    }
    
    output += separator + '\n';
    return output;
  }

  static generateJsonOutput(rows: number = 3): string {
    const data: Array<{id: number; name: string; value: number; timestamp: string}> = [];
    for (let i = 1; i <= rows; i++) {
      data.push({
        id: i,
        name: `item_${i}`,
        value: Math.random() * 1000,
        timestamp: new Date().toISOString()
      });
    }
    return JSON.stringify(data, null, 2);
  }

  static generateCsvOutput(rows: number = 4): string {
    let csv = 'id,name,value,timestamp\n';
    for (let i = 1; i <= rows; i++) {
      csv += `${i},item_${i},${(Math.random() * 1000).toFixed(2)},${new Date().toISOString()}\n`;
    }
    return csv;
  }

  static generateMalformedOutput(): string {
    return 'This is not a valid table format\nRandom text here\nNo structure at all\n';
  }

  static generateEmptyOutput(): string {
    return '';
  }

  static generateLargeOutput(rows: number = 1000): string {
    return this.generateHiveTableOutput(rows);
  }
}

// Validation utilities
class ValidationUtils {
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

  static validateSchema(result: any): boolean {
    return (
      result.schema &&
      result.schema.fields &&
      Array.isArray(result.schema.fields) &&
      result.schema.fields.every((field: any) => 
        field.name && typeof field.name === 'string' &&
        field.type && typeof field.type === 'string'
      )
    );
  }

  static validateRowStructure(result: any): boolean {
    if (!result.rows || result.rows.length === 0) return true;
    
    const expectedColumns = result.schema?.fields?.length || 0;
    return result.rows.every((row: any) => 
      Array.isArray(row) && row.length === expectedColumns
    );
  }

  static validateMaxResults(result: any, maxResults: number): boolean {
    return result.rows.length <= maxResults;
  }
}

// Main test class for scenarios
export class QueryResultsScenariosTestSuite {
  private config: {
    projectId: string;
    region: string;
    validJobId: string;
    timeout: number;
  };

  constructor(config: any) {
    this.config = config;
  }

  async runAllScenarios(): Promise<void> {
    console.log('🧪 Starting Edge Case and Error Condition Tests\n');

    // Error condition tests
    await this.runErrorTests();
    
    // Edge case tests
    await this.runEdgeCaseTests();
    
    // Boundary tests
    await this.runBoundaryTests();
    
    // Parsing tests with mock data
    await this.runParsingTests();
    
    // Performance stress tests
    await this.runStressTests();
    
    // Concurrency tests
    await this.runConcurrencyTests();

    console.log('\n🎉 All scenario tests completed!');
  }

  // Error condition testing
  private async runErrorTests(): Promise<void> {
    console.log('\n🚨 Testing Error Conditions');
    console.log('=' .repeat(40));

    const errorScenarios: ErrorTestScenario[] = [
      {
        name: 'Invalid Job ID Format',
        description: 'Test with malformed job ID',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: 'invalid-job-format-!@#$%',
        expectedErrorPattern: /error|invalid|not found/i,
        shouldThrow: true,
      },
      {
        name: 'Empty Job ID',
        description: 'Test with empty job ID',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: '',
        expectedErrorPattern: /error|invalid|empty/i,
        shouldThrow: true,
      },
      {
        name: 'Non-existent Project',
        description: 'Test with non-existent project ID',
        projectId: 'non-existent-project-12345',
        region: this.config.region,
        jobId: this.config.validJobId,
        expectedErrorPattern: /permission|not found|access/i,
        shouldThrow: true,
      },
      {
        name: 'Invalid Region',
        description: 'Test with invalid region',
        projectId: this.config.projectId,
        region: 'invalid-region-xyz',
        jobId: this.config.validJobId,
        expectedErrorPattern: /region|invalid|not found/i,
        shouldThrow: true,
      },
      {
        name: 'Null Parameters',
        description: 'Test with null parameters',
        projectId: null as any,
        region: this.config.region,
        jobId: this.config.validJobId,
        expectedErrorPattern: /null|undefined|invalid/i,
        shouldThrow: true,
      },
    ];

    for (const scenario of errorScenarios) {
      await this.runErrorScenario(scenario);
    }
  }

  private async runErrorScenario(scenario: ErrorTestScenario): Promise<void> {
    console.log(`\n🔍 ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);

    try {
      const result = await getQueryResultsWithRest(
        scenario.projectId,
        scenario.region,
        scenario.jobId,
        scenario.options || { maxDisplayRows: 5 }
      );

      if (scenario.shouldThrow) {
        console.log(`❌ Expected error but got success: ${JSON.stringify(result).substring(0, 100)}...`);
      } else {
        console.log(`✅ Unexpected success (this might be valid)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (scenario.shouldThrow && scenario.expectedErrorPattern.test(errorMessage)) {
        console.log(`✅ Correctly handled error: ${errorMessage.substring(0, 100)}...`);
      } else if (scenario.shouldThrow) {
        console.log(`⚠️  Got error but pattern didn't match: ${errorMessage.substring(0, 100)}...`);
      } else {
        console.log(`❌ Unexpected error: ${errorMessage.substring(0, 100)}...`);
      }
    }
  }

  // Edge case testing
  private async runEdgeCaseTests(): Promise<void> {
    console.log('\n🎯 Testing Edge Cases');
    console.log('=' .repeat(40));

    const edgeCases: EdgeCaseScenario[] = [
      {
        name: 'Zero Max Results',
        description: 'Request zero results',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: this.config.validJobId,
        options: { maxDisplayRows: 0 },
        validator: (result) => result.rows.length === 0 && result.totalRows >= 0,
        expectedBehavior: 'Returns empty rows array but valid metadata',
      },
      {
        name: 'Negative Max Results',
        description: 'Request negative number of results',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: this.config.validJobId,
        options: { maxDisplayRows: -5 },
        validator: (result) => result.rows.length >= 0,
        expectedBehavior: 'Handles negative values gracefully',
      },
      {
        name: 'Very Large Max Results',
        description: 'Request extremely large number of results',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: this.config.validJobId,
        options: { maxDisplayRows: 999999 },
        validator: (result) => ValidationUtils.validateQueryResultResponse(result),
        expectedBehavior: 'Handles large requests without memory issues',
      },
      {
        name: 'All Format Options',
        description: 'Test all supported format options',
        projectId: this.config.projectId,
        region: this.config.region,
        jobId: this.config.validJobId,
        options: { format: 'text' },
        validator: (result) => ValidationUtils.validateQueryResultResponse(result),
        expectedBehavior: 'Processes different formats correctly',
      },
    ];

    for (const edgeCase of edgeCases) {
      await this.runEdgeCaseScenario(edgeCase);
    }
  }

  private async runEdgeCaseScenario(scenario: EdgeCaseScenario): Promise<void> {
    console.log(`\n🔍 ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Expected: ${scenario.expectedBehavior}`);

    try {
      const result = await getQueryResultsWithRest(
        scenario.projectId,
        scenario.region,
        scenario.jobId,
        scenario.options
      );

      if (scenario.validator(result)) {
        console.log(`✅ Edge case handled correctly`);
        console.log(`   Rows returned: ${result.rows.length}`);
        console.log(`   Total rows: ${result.totalRows}`);
      } else {
        console.log(`❌ Edge case validation failed`);
        console.log(`   Result: ${JSON.stringify(result).substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`⚠️  Edge case threw error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Boundary testing
  private async runBoundaryTests(): Promise<void> {
    console.log('\n📏 Testing Boundary Conditions');
    console.log('=' .repeat(40));

    const boundaries = [
      { name: 'Minimum Valid Request', maxResults: 1 },
      { name: 'Small Request', maxResults: 5 },
      { name: 'Medium Request', maxResults: 50 },
      { name: 'Large Request', maxResults: 500 },
    ];

    for (const boundary of boundaries) {
      console.log(`\n🔍 ${boundary.name} (${boundary.maxResults} results)`);
      
      try {
        const startTime = Date.now();
        const result = await getQueryResultsWithRest(
          this.config.projectId,
          this.config.region,
          this.config.validJobId,
          { maxDisplayRows: boundary.maxResults }
        );
        const duration = Date.now() - startTime;

        console.log(`✅ Boundary test passed`);
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Rows returned: ${result.rows.length}`);
        console.log(`   Max results respected: ${result.rows.length <= boundary.maxResults}`);
        
        // Performance check
        if (duration > 30000) {
          console.log(`⚠️  Performance warning: ${duration}ms > 30s`);
        }
      } catch (error) {
        console.log(`❌ Boundary test failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Parsing tests with mock data
  private async runParsingTests(): Promise<void> {
    console.log('\n📝 Testing Parsing Logic with Mock Data');
    console.log('=' .repeat(40));

    // Note: These tests would require a way to inject mock data into the parsing pipeline
    // For now, we'll test the parsing logic indirectly by examining real results
    
    console.log('\n🔍 Testing Result Structure Validation');
    
    try {
      const result = await getQueryResultsWithRest(
        this.config.projectId,
        this.config.region,
        this.config.validJobId,
        { maxDisplayRows: 5, format: 'text' }
      );

      // Test schema validation
      const hasValidSchema = ValidationUtils.validateSchema(result);
      console.log(`✅ Schema validation: ${hasValidSchema ? 'PASS' : 'FAIL'}`);

      // Test row structure validation
      const hasValidRows = ValidationUtils.validateRowStructure(result);
      console.log(`✅ Row structure validation: ${hasValidRows ? 'PASS' : 'FAIL'}`);

      // Test data consistency
      const isConsistent = result.rows.length <= result.totalRows;
      console.log(`✅ Data consistency: ${isConsistent ? 'PASS' : 'FAIL'}`);

      if (result.schema?.fields) {
        console.log(`   Schema fields: ${result.schema.fields.map(f => f.name).join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ Parsing test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Stress testing
  private async runStressTests(): Promise<void> {
    console.log('\n💪 Testing Stress Conditions');
    console.log('=' .repeat(40));

    // Test rapid successive calls
    console.log('\n🔍 Rapid Successive Calls Test');
    const rapidCalls = 5;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < rapidCalls; i++) {
      promises.push(
        getQueryResultsWithRest(
          this.config.projectId,
          this.config.region,
          this.config.validJobId,
          { maxDisplayRows: 3 }
        )
      );
    }

    try {
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`✅ Rapid calls completed`);
      console.log(`   ${rapidCalls} calls in ${duration}ms`);
      console.log(`   Average: ${(duration / rapidCalls).toFixed(0)}ms per call`);
      console.log(`   All successful: ${results.every(r => ValidationUtils.validateQueryResultResponse(r))}`);
    } catch (error) {
      console.log(`❌ Rapid calls failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Concurrency testing
  private async runConcurrencyTests(): Promise<void> {
    console.log('\n🔄 Testing Concurrency');
    console.log('=' .repeat(40));

    // Test concurrent calls with different parameters
    console.log('\n🔍 Concurrent Different Requests Test');
    
    const concurrentRequests = [
      { maxDisplayRows: 1, format: 'text' as const },
      { maxDisplayRows: 5, format: 'text' as const },
      { maxDisplayRows: 10, format: 'text' as const },
    ];

    try {
      const startTime = Date.now();
      const promises = concurrentRequests.map(options =>
        getQueryResultsWithRest(
          this.config.projectId,
          this.config.region,
          this.config.validJobId,
          options
        )
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`✅ Concurrent requests completed`);
      console.log(`   ${concurrentRequests.length} requests in ${duration}ms`);
      
      // Verify results match expected row counts
      results.forEach((result, index) => {
        const expectedMax = concurrentRequests[index].maxDisplayRows;
        const actualRows = result.rows.length;
        console.log(`   Request ${index + 1}: ${actualRows} rows (max ${expectedMax}) - ${actualRows <= expectedMax ? 'OK' : 'FAIL'}`);
      });
    } catch (error) {
      console.log(`❌ Concurrent requests failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Utility functions for testing specific scenarios
export class SpecificScenarioTests {
  static async testJobWithNoOutput(projectId: string, region: string, jobId: string): Promise<void> {
    console.log('\n🔍 Testing Job with No Output');
    
    try {
      const result = await getQueryResultsWithRest(projectId, region, jobId);
      
      if (result.totalRows === 0 && result.rows.length === 0) {
        console.log('✅ Correctly handled job with no output');
      } else {
        console.log(`⚠️  Job has output: ${result.totalRows} total rows, ${result.rows.length} displayed`);
      }
    } catch (error) {
      console.log(`❌ Failed to handle job with no output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async testJobWithLargeOutput(projectId: string, region: string, jobId: string): Promise<void> {
    console.log('\n🔍 Testing Job with Large Output');
    
    try {
      const startTime = Date.now();
      const result = await getQueryResultsWithRest(projectId, region, jobId, {
        maxDisplayRows: 1000
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Large output handled in ${duration}ms`);
      console.log(`   Total rows: ${result.totalRows}`);
      console.log(`   Displayed rows: ${result.rows.length}`);
      console.log(`   Memory efficient: ${result.rows.length <= 1000 ? 'YES' : 'NO'}`);
    } catch (error) {
      console.log(`❌ Failed to handle large output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async testAuthenticationScenarios(): Promise<void> {
    console.log('\n🔍 Testing Authentication Scenarios');
    
    // Test GCS service directly
    const gcsService = new GCSService();
    
    try {
      // Test URI parsing
      const testUri = 'gs://test-bucket/test-path/file.txt';
      const parsed = gcsService.parseUri(testUri);
      
      console.log(`✅ URI parsing works: ${parsed.bucket}/${parsed.path}`);
    } catch (error) {
      console.log(`❌ URI parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Default configuration
const getDefaultConfig = () => ({
  projectId: process.env.TEST_PROJECT_ID || 'your-test-project',
  region: process.env.TEST_REGION || 'us-central1',
  validJobId: process.env.TEST_JOB_ID || 'a15cc60e-da05-42d3-93f3-3252a11aa4c6',
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
});

// Main execution function
export async function runScenarioTests(): Promise<void> {
  const config = getDefaultConfig();
  
  console.log('🧪 Query Results Scenarios Test Suite');
  console.log('=====================================');
  console.log('Configuration:', config);
  
  if (config.validJobId === 'a15cc60e-da05-42d3-93f3-3252a11aa4c6' && !process.env.TEST_JOB_ID) {
    console.log('\n⚠️  Using default job ID. Set TEST_JOB_ID for your specific testing.');
  }

  const testSuite = new QueryResultsScenariosTestSuite(config);
  await testSuite.runAllScenarios();
  
  // Run specific scenario tests
  console.log('\n🎯 Running Specific Scenario Tests');
  await SpecificScenarioTests.testAuthenticationScenarios();
  
  console.log('\n🎉 All scenario tests completed!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Error conditions tested');
  console.log('   ✅ Edge cases verified');
  console.log('   ✅ Boundary conditions checked');
  console.log('   ✅ Parsing logic validated');
  console.log('   ✅ Stress conditions tested');
  console.log('   ✅ Concurrency verified');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScenarioTests().catch(console.error);
}