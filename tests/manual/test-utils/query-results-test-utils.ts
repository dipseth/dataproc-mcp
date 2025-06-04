/**
 * Test Utilities for Query Results Testing
 * 
 * This module provides helper functions, mock data generators, and validation
 * utilities specifically for testing the get_query_results functionality.
 */

import { getJobStatus } from '../../../src/services/query.js';
import { GCSService } from '../../../src/services/gcs.js';

// Type definitions for test utilities
export interface TestEnvironment {
  projectId: string;
  region: string;
  validJobId: string;
  invalidJobId: string;
  incompleteJobId?: string;
  timeout: number;
  enableSemanticSearch: boolean;
}

export interface TestMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  success: boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, any>;
}

// Environment setup utilities
export class TestEnvironmentSetup {
  /**
   * Get test environment configuration from environment variables
   */
  static getTestEnvironment(): TestEnvironment {
    return {
      projectId: process.env.TEST_PROJECT_ID || 'your-test-project',
      region: process.env.TEST_REGION || 'us-central1',
      validJobId: process.env.TEST_JOB_ID || 'a15cc60e-da05-42d3-93f3-3252a11aa4c6',
      invalidJobId: this.generateMockJobId(),
      incompleteJobId: process.env.TEST_INCOMPLETE_JOB_ID,
      timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
      enableSemanticSearch: process.env.TEST_SEMANTIC_SEARCH !== 'false',
    };
  }

  /**
   * Generate a mock job ID for testing invalid scenarios
   */
  static generateMockJobId(): string {
    return `mock-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate test environment prerequisites
   */
  static async validateEnvironment(env: TestEnvironment): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {},
    };

    // Check required environment variables
    if (env.projectId === 'your-test-project') {
      result.warnings.push('Using default project ID. Set TEST_PROJECT_ID for actual testing.');
    }

    if (env.validJobId === 'a15cc60e-da05-42d3-93f3-3252a11aa4c6') {
      result.warnings.push('Using default job ID. Set TEST_JOB_ID for your specific job.');
    }

    // Test GCP authentication
    try {
      const gcsService = new GCSService();
      const testUri = 'gs://test-bucket/test-file';
      gcsService.parseUri(testUri); // This should not throw for valid URI format
      result.details.gcsServiceAvailable = true;
    } catch (error) {
      result.errors.push(`GCS service initialization failed: ${error}`);
      result.isValid = false;
    }

    // Test job accessibility (if using real job ID)
    if (env.validJobId !== 'a15cc60e-da05-42d3-93f3-3252a11aa4c6') {
      try {
        await getJobStatus(env.projectId, env.region, env.validJobId);
        result.details.jobAccessible = true;
      } catch (error) {
        result.warnings.push(`Cannot access test job: ${error}`);
        result.details.jobAccessible = false;
      }
    }

    return result;
  }

  /**
   * Print environment validation results
   */
  static printValidationResults(result: ValidationResult): void {
    console.log('\n🔍 Environment Validation Results');
    console.log('=' .repeat(40));
    
    if (result.isValid) {
      console.log('✅ Environment is valid for testing');
    } else {
      console.log('❌ Environment has issues that may affect testing');
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (Object.keys(result.details).length > 0) {
      console.log('\n📋 Details:');
      Object.entries(result.details).forEach(([key, value]) => {
        console.log(`   • ${key}: ${value}`);
      });
    }
  }
}

// Performance measurement utilities
export class PerformanceUtils {
  /**
   * Measure execution time and memory usage of an async function
   */
  static async measurePerformance<T>(
    fn: () => Promise<T>,
    label?: string
  ): Promise<{ result: T; metrics: TestMetrics }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    let result: T;
    let success = true;
    let errorMessage: string | undefined;

    try {
      result = await fn();
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      const metrics: TestMetrics = {
        startTime,
        endTime,
        duration: endTime - startTime,
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        success,
        errorMessage,
      };

      if (label) {
        console.log(`📊 Performance [${label}]: ${metrics.duration}ms`);
      }

      return { result: result!, metrics };
    }
  }

  /**
   * Run performance benchmark with multiple iterations
   */
  static async runBenchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 5,
    label?: string
  ): Promise<{
    results: T[];
    metrics: {
      totalDuration: number;
      averageDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
      iterations: number;
    };
  }> {
    console.log(`\n🏃 Running benchmark${label ? ` [${label}]` : ''} with ${iterations} iterations`);
    
    const results: T[] = [];
    const durations: number[] = [];
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const { result, metrics } = await PerformanceUtils.measurePerformance(fn);
        results.push(result);
        durations.push(metrics.duration);
        if (metrics.success) successCount++;
        
        // Small delay between iterations to avoid overwhelming the system
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.log(`   Iteration ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        durations.push(0); // Record as 0 for failed attempts
      }
    }

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const validDurations = durations.filter(d => d > 0);
    
    const metrics = {
      totalDuration,
      averageDuration: validDurations.length > 0 ? totalDuration / validDurations.length : 0,
      minDuration: validDurations.length > 0 ? Math.min(...validDurations) : 0,
      maxDuration: validDurations.length > 0 ? Math.max(...validDurations) : 0,
      successRate: (successCount / iterations) * 100,
      iterations,
    };

    console.log(`   Average: ${metrics.averageDuration.toFixed(0)}ms`);
    console.log(`   Range: ${metrics.minDuration}ms - ${metrics.maxDuration}ms`);
    console.log(`   Success rate: ${metrics.successRate.toFixed(1)}%`);

    return { results, metrics };
  }
}

// Data validation utilities
export class DataValidationUtils {
  /**
   * Validate QueryResultResponse structure
   */
  static validateQueryResultResponse(result: any): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {},
    };

    // Check basic structure
    if (!result || typeof result !== 'object') {
      validation.errors.push('Result is not an object');
      validation.isValid = false;
      return validation;
    }

    // Check required fields
    if (!('rows' in result)) {
      validation.errors.push('Missing rows field');
      validation.isValid = false;
    } else if (!Array.isArray(result.rows)) {
      validation.errors.push('Rows field is not an array');
      validation.isValid = false;
    }

    if (!('totalRows' in result)) {
      validation.errors.push('Missing totalRows field');
      validation.isValid = false;
    } else if (typeof result.totalRows !== 'number') {
      validation.errors.push('totalRows is not a number');
      validation.isValid = false;
    }

    // Check schema if present
    if ('schema' in result) {
      if (!result.schema || typeof result.schema !== 'object') {
        validation.warnings.push('Schema is present but not an object');
      } else if ('fields' in result.schema) {
        if (!Array.isArray(result.schema.fields)) {
          validation.warnings.push('Schema fields is not an array');
        } else {
          // Validate field structure
          const invalidFields = result.schema.fields.filter((field: any) => 
            !field || typeof field !== 'object' || !field.name || !field.type
          );
          if (invalidFields.length > 0) {
            validation.warnings.push(`${invalidFields.length} invalid schema fields`);
          }
        }
      }
    }

    // Check data consistency
    if (validation.isValid) {
      validation.details.rowCount = result.rows.length;
      validation.details.totalRows = result.totalRows;
      validation.details.hasSchema = 'schema' in result;
      validation.details.schemaFieldCount = result.schema?.fields?.length || 0;

      // Check if rows count is consistent
      if (result.rows.length > result.totalRows) {
        validation.warnings.push('Rows count exceeds totalRows');
      }

      // Check row structure consistency
      if (result.rows.length > 0 && result.schema?.fields) {
        const expectedColumns = result.schema.fields.length;
        const inconsistentRows = result.rows.filter((row: any) => 
          !Array.isArray(row) || row.length !== expectedColumns
        );
        if (inconsistentRows.length > 0) {
          validation.warnings.push(`${inconsistentRows.length} rows have inconsistent column count`);
        }
      }
    }

    return validation;
  }

  /**
   * Validate that maxResults parameter is respected
   */
  static validateMaxResults(result: any, maxResults: number): boolean {
    if (!result || !Array.isArray(result.rows)) {
      return false;
    }
    return result.rows.length <= maxResults;
  }

  /**
   * Compare two query results for consistency
   */
  static compareResults(result1: any, result2: any): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {},
    };

    // Basic structure comparison
    const validation1 = this.validateQueryResultResponse(result1);
    const validation2 = this.validateQueryResultResponse(result2);

    if (!validation1.isValid || !validation2.isValid) {
      validation.errors.push('One or both results are invalid');
      validation.isValid = false;
      return validation;
    }

    // Compare total rows
    if (result1.totalRows !== result2.totalRows) {
      validation.warnings.push(`Total rows differ: ${result1.totalRows} vs ${result2.totalRows}`);
    }

    // Compare schema if both have it
    if (result1.schema && result2.schema) {
      const fields1 = result1.schema.fields || [];
      const fields2 = result2.schema.fields || [];
      
      if (fields1.length !== fields2.length) {
        validation.warnings.push(`Schema field count differs: ${fields1.length} vs ${fields2.length}`);
      } else {
        // Compare field names
        const names1 = fields1.map((f: any) => f.name).sort();
        const names2 = fields2.map((f: any) => f.name).sort();
        const namesDiffer = names1.some((name: string, i: number) => name !== names2[i]);
        
        if (namesDiffer) {
          validation.warnings.push('Schema field names differ');
        }
      }
    }

    validation.details.result1RowCount = result1.rows.length;
    validation.details.result2RowCount = result2.rows.length;
    validation.details.totalRowsMatch = result1.totalRows === result2.totalRows;

    return validation;
  }
}

// Mock data generators for testing parsing logic
export class MockDataGenerator {
  /**
   * Generate mock Hive table output
   */
  static generateHiveTableOutput(rows: number = 5, columns: string[] = ['id', 'name', 'value']): string {
    const colWidths = columns.map(col => Math.max(col.length, 15));
    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    
    let output = separator + '\n';
    
    // Header
    const headerRow = '| ' + columns.map((col, i) => col.padEnd(colWidths[i])).join(' | ') + ' |';
    output += headerRow + '\n';
    output += separator + '\n';
    
    // Data rows
    for (let i = 1; i <= rows; i++) {
      const rowData = columns.map((col, colIndex) => {
        switch (col) {
          case 'id': return i.toString().padEnd(colWidths[colIndex]);
          case 'name': return `item_${i}`.padEnd(colWidths[colIndex]);
          case 'value': return (Math.random() * 1000).toFixed(2).padEnd(colWidths[colIndex]);
          case 'timestamp': return new Date().toISOString().padEnd(colWidths[colIndex]);
          default: return `data_${i}_${colIndex}`.padEnd(colWidths[colIndex]);
        }
      });
      output += '| ' + rowData.join(' | ') + ' |\n';
    }
    
    output += separator + '\n';
    return output;
  }

  /**
   * Generate mock CSV output
   */
  static generateCsvOutput(rows: number = 4, columns: string[] = ['id', 'name', 'value']): string {
    let csv = columns.join(',') + '\n';
    
    for (let i = 1; i <= rows; i++) {
      const rowData = columns.map(col => {
        switch (col) {
          case 'id': return i.toString();
          case 'name': return `item_${i}`;
          case 'value': return (Math.random() * 1000).toFixed(2);
          case 'timestamp': return new Date().toISOString();
          default: return `data_${i}`;
        }
      });
      csv += rowData.join(',') + '\n';
    }
    
    return csv;
  }

  /**
   * Generate mock JSON output
   */
  static generateJsonOutput(rows: number = 3, columns: string[] = ['id', 'name', 'value']): string {
    const data: Record<string, any>[] = [];
    
    for (let i = 1; i <= rows; i++) {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        switch (col) {
          case 'id': row[col] = i; break;
          case 'name': row[col] = `item_${i}`; break;
          case 'value': row[col] = Math.random() * 1000; break;
          case 'timestamp': row[col] = new Date().toISOString(); break;
          default: row[col] = `data_${i}`;
        }
      });
      data.push(row);
    }
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate malformed output for error testing
   */
  static generateMalformedOutput(): string {
    return 'This is not a valid table format\nRandom text here\nNo structure at all\n';
  }

  /**
   * Generate empty output
   */
  static generateEmptyOutput(): string {
    return '';
  }
}

// Test result reporting utilities
export class TestReporter {
  private results: Array<{
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
    details?: Record<string, any>;
  }> = [];

  /**
   * Add a test result
   */
  addResult(testName: string, passed: boolean, duration: number, error?: string, details?: Record<string, any>): void {
    this.results.push({
      testName,
      passed,
      duration,
      error,
      details,
    });
  }

  /**
   * Generate summary report
   */
  generateSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY REPORT');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total Tests: ${this.results.length}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.testName}: ${r.error || 'Unknown error'}`);
        });
    }

    // Performance insights
    const avgDuration = totalDuration / this.results.length;
    const slowTests = this.results.filter(r => r.duration > avgDuration * 2);
    
    if (slowTests.length > 0) {
      console.log('\n⏳ SLOW TESTS (>2x average):');
      slowTests.forEach(r => {
        console.log(`   • ${r.testName}: ${r.duration}ms`);
      });
    }
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
        timestamp: new Date().toISOString(),
      },
      results: this.results,
    }, null, 2);
  }
}

// Async utilities for job management
export class JobTestUtils {
  /**
   * Wait for a job to reach a specific state
   */
  static async waitForJobState(
    projectId: string,
    region: string,
    jobId: string,
    targetState: string,
    maxWaitTime: number = 300000, // 5 minutes
    pollInterval: number = 5000 // 5 seconds
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const jobStatus = await getJobStatus(projectId, region, jobId);
        
        if (jobStatus.status?.state === targetState) {
          return true;
        }
        
        // If job is in a terminal state but not the target, return false
        const terminalStates = ['DONE', 'ERROR', 'CANCELLED'];
        if (terminalStates.includes(jobStatus.status?.state || '') && jobStatus.status?.state !== targetState) {
          return false;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn(`Error checking job status: ${error}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    return false; // Timeout
  }

  /**
   * Check if a job has driver output available
   */
  static async hasDriverOutput(projectId: string, region: string, jobId: string): Promise<boolean> {
    try {
      const jobStatus = await getJobStatus(projectId, region, jobId);
      return !!(jobStatus.driverOutputResourceUri);
    } catch (error) {
      return false;
    }
  }
}