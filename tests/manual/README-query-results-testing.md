# Query Results Testing Documentation

This directory contains comprehensive test scripts and documentation for the restored `get_query_results` functionality in the Dataproc MCP server.

## Overview

The `get_query_results` functionality has been restored with significant enhancements including:
- ✅ Async GCS log file downloading
- ✅ Multiple format support (text, JSON, CSV)
- ✅ Semantic search integration
- ✅ Enhanced error handling
- ✅ Performance optimizations

## Test Files Structure

```
tests/manual/
├── README-query-results-testing.md          # This documentation
├── run-query-results-tests.ts               # Main test orchestrator
├── test-query-results-comprehensive.ts      # Full programmatic test suite
├── test-query-results-scenarios.ts          # Edge cases and error conditions
├── test-query-results-dataproc-mode.md      # Manual testing guide for Dataproc mode
├── test-query-results.ts                    # Original basic test (enhanced)
└── test-utils/
    └── query-results-test-utils.ts          # Shared utilities and helpers
```

## Quick Start

### Prerequisites

1. **GCP Setup**:
   - Valid GCP project with Dataproc enabled
   - Service account with appropriate permissions
   - At least one completed Hive job with results

2. **Environment Variables**:
   ```bash
   export TEST_PROJECT_ID="your-gcp-project"
   export TEST_REGION="us-central1"
   export TEST_JOB_ID="your-completed-job-id"
   ```

3. **Optional Configuration**:
   ```bash
   export TEST_INCOMPLETE_JOB_ID="running-job-id"     # For error testing
   export TEST_TIMEOUT="30000"                        # Test timeout in ms
   export TEST_SEMANTIC_SEARCH="true"                 # Enable semantic search tests
   export TEST_VERBOSE="true"                         # Verbose output
   ```

### Running Tests

#### Option 1: Run All Tests (Recommended)
```bash
# Run the comprehensive test orchestrator
node tests/manual/run-query-results-tests.ts

# Or with npm script (if configured)
npm run test:query-results
```

#### Option 2: Run Specific Test Suites
```bash
# Basic functionality only
TEST_SUITE=basic node tests/manual/run-query-results-tests.ts

# Comprehensive tests only
TEST_SUITE=comprehensive node tests/manual/run-query-results-tests.ts

# Edge cases and error conditions only
TEST_SUITE=scenarios node tests/manual/run-query-results-tests.ts
```

#### Option 3: Run Individual Test Files
```bash
# Original basic test
node tests/manual/test-query-results.ts

# Comprehensive programmatic tests
node tests/manual/test-query-results-comprehensive.ts

# Edge case and error condition tests
node tests/manual/test-query-results-scenarios.ts
```

## Test Suites Description

### 1. Basic Functionality Test (`test-query-results.ts`)
**Purpose**: Quick verification that the core functionality works
**Duration**: ~30 seconds
**Coverage**:
- ✅ Basic `getQueryResultsWithRest` functionality
- ✅ Wrapper function compatibility
- ✅ Error handling with invalid job ID
- ✅ Integration with existing authentication

**When to use**: Quick smoke test after changes

### 2. Comprehensive Test Suite (`test-query-results-comprehensive.ts`)
**Purpose**: Thorough testing of all features and functionality
**Duration**: ~2 minutes
**Coverage**:
- ✅ All format options (text, JSON, CSV)
- ✅ GCS authentication and file downloading
- ✅ Semantic search integration
- ✅ Performance testing with multiple iterations
- ✅ Large result set handling
- ✅ Comparison with `get_job_results`
- ✅ Edge cases (zero results, large requests)

**When to use**: Before releases, after major changes

### 3. Scenarios Test Suite (`test-query-results-scenarios.ts`)
**Purpose**: Edge cases, error conditions, and boundary testing
**Duration**: ~1.5 minutes
**Coverage**:
- ✅ Invalid inputs (malformed job IDs, null parameters)
- ✅ Permission and authentication errors
- ✅ Boundary conditions (zero/negative/large maxResults)
- ✅ Stress testing (rapid successive calls)
- ✅ Concurrency testing
- ✅ Memory usage validation

**When to use**: Quality assurance, before production deployment

### 4. Manual Testing Guide (`test-query-results-dataproc-mode.md`)
**Purpose**: Step-by-step manual testing using Dataproc mode
**Duration**: ~15-30 minutes (manual)
**Coverage**:
- ✅ Interactive testing with MCP client
- ✅ Real-world usage scenarios
- ✅ User experience validation
- ✅ Integration with existing workflows

**When to use**: User acceptance testing, workflow validation

## Advanced Testing Options

### Performance Benchmarking
```bash
# Run with performance benchmarking
TEST_PERFORMANCE=true node tests/manual/run-query-results-tests.ts
```

### Memory Usage Testing
```bash
# Run with memory usage monitoring
TEST_MEMORY=true node tests/manual/run-query-results-tests.ts
```

### Integration Testing
```bash
# Test integration with other Dataproc tools
TEST_INTEGRATION=true node tests/manual/run-query-results-tests.ts
```

### Export Test Results
```bash
# Export detailed results to JSON
TEST_EXPORT_RESULTS=true node tests/manual/run-query-results-tests.ts
```

## Understanding Test Results

### Success Indicators
- ✅ **All tests pass**: Core functionality is working correctly
- ✅ **Performance within limits**: Response times < 30 seconds for typical requests
- ✅ **Memory usage stable**: No memory leaks detected
- ✅ **Error handling robust**: Invalid inputs produce clear error messages

### Warning Indicators
- ⚠️ **Some tests skipped**: Missing optional configuration (acceptable)
- ⚠️ **Performance slower than expected**: May indicate network or GCS issues
- ⚠️ **Semantic indexing warnings**: Qdrant unavailable (non-fatal)

### Failure Indicators
- ❌ **Authentication failures**: Check GCP credentials and permissions
- ❌ **Job not found errors**: Verify job ID and project access
- ❌ **GCS access errors**: Check service account permissions for output buckets
- ❌ **Parsing failures**: May indicate changes in Hive output format

## Troubleshooting Guide

### Common Issues

#### 1. "Job not found" errors
**Symptoms**: Tests fail with job not found messages
**Solutions**:
- Verify the job ID exists: `gcloud dataproc jobs describe JOB_ID --region=REGION`
- Check project ID and region are correct
- Ensure the job has completed successfully

#### 2. GCS permission errors
**Symptoms**: Tests fail when downloading job output
**Solutions**:
- Verify service account has `Storage Object Viewer` role
- Check bucket-level permissions for job output bucket
- Test GCS access: `gsutil ls gs://bucket-name/path/`

#### 3. Authentication failures
**Symptoms**: Tests fail with authentication or permission errors
**Solutions**:
- Check `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Verify service account key file exists and is readable
- Test authentication: `gcloud auth application-default print-access-token`

#### 4. Timeout errors
**Symptoms**: Tests fail with timeout messages
**Solutions**:
- Increase timeout: `TEST_TIMEOUT=60000`
- Check network connectivity to GCP
- Try with smaller `maxResults` values

#### 5. Parsing errors
**Symptoms**: Tests fail when processing job output
**Solutions**:
- Try different format options (text, json, csv)
- Check if the job actually produced output
- Verify the job completed successfully (not just finished)

### Debug Mode

Enable detailed logging for troubleshooting:
```bash
export LOG_LEVEL=debug
export TEST_VERBOSE=true
node tests/manual/run-query-results-tests.ts
```

### Getting Help

If you encounter issues not covered here:

1. **Check the logs**: Look for detailed error messages in debug mode
2. **Verify prerequisites**: Ensure all setup requirements are met
3. **Test with known good job**: Use the provided sample job ID first
4. **Check documentation**: Review `docs/QUERY_RESULTS_ENHANCEMENT.md`
5. **File an issue**: Include test output and environment details

## Test Development

### Adding New Tests

To add new test scenarios:

1. **For basic functionality**: Add to `test-query-results.ts`
2. **For comprehensive coverage**: Add to `test-query-results-comprehensive.ts`
3. **For edge cases**: Add to `test-query-results-scenarios.ts`
4. **For utilities**: Add to `test-utils/query-results-test-utils.ts`

### Test Utilities

The `test-utils/query-results-test-utils.ts` file provides:
- Environment setup and validation
- Performance measurement utilities
- Data validation functions
- Mock data generators
- Test result reporting

Example usage:
```typescript
import { TestEnvironmentSetup, PerformanceUtils } from './test-utils/query-results-test-utils.js';

// Validate environment
const env = TestEnvironmentSetup.getTestEnvironment();
const validation = await TestEnvironmentSetup.validateEnvironment(env);

// Measure performance
const { result, metrics } = await PerformanceUtils.measurePerformance(
  () => getQueryResultsWithRest(projectId, region, jobId)
);
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Query Results Tests
on: [push, pull_request]
jobs:
  test-query-results:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: |
          export TEST_PROJECT_ID="${{ secrets.GCP_PROJECT_ID }}"
          export TEST_REGION="us-central1"
          export TEST_JOB_ID="${{ secrets.TEST_JOB_ID }}"
          export GOOGLE_APPLICATION_CREDENTIALS="${{ secrets.GCP_SA_KEY }}"
          node tests/manual/run-query-results-tests.ts
```

### Local Development
```bash
# Quick test during development
TEST_SUITE=basic npm run test:query-results

# Full test before commit
npm run test:query-results

# Performance check
TEST_PERFORMANCE=true npm run test:query-results
```

## Best Practices

### For Test Execution
1. **Use real job IDs**: Tests are more meaningful with actual completed jobs
2. **Test different job types**: Try with various Hive queries (SELECT, DDL, etc.)
3. **Test with different result sizes**: Small, medium, and large result sets
4. **Run tests in different environments**: Development, staging, production

### For Test Maintenance
1. **Keep job IDs updated**: Use recently completed jobs for testing
2. **Monitor test performance**: Watch for degradation over time
3. **Update expected behaviors**: Adjust tests when functionality changes
4. **Document test scenarios**: Explain why specific tests exist

### For Debugging
1. **Enable verbose mode**: Use `TEST_VERBOSE=true` for detailed output
2. **Test incrementally**: Start with basic tests, then add complexity
3. **Isolate issues**: Run individual test files to narrow down problems
4. **Check dependencies**: Ensure all required services are available

## Success Criteria

The testing is considered successful when:

1. **✅ All core functionality tests pass** - Basic operations work without errors
2. **✅ Error handling is robust** - Invalid inputs produce clear, actionable errors
3. **✅ Performance is acceptable** - Response times are reasonable for typical use
4. **✅ Integration works smoothly** - Tool integrates well with existing workflow
5. **✅ Documentation is accurate** - Tests validate documented behavior

## Related Documentation

- [Query Results Enhancement Guide](../../docs/QUERY_RESULTS_ENHANCEMENT.md)
- [GCS Service Documentation](../../docs/GCS_SERVICE.md)
- [Semantic Search Guide](../../docs/KNOWLEDGE_BASE_SEMANTIC_SEARCH.md)
- [Authentication Guide](../../docs/AUTHENTICATION_IMPLEMENTATION_GUIDE.md)
- [Testing Guide](../../docs/TESTING_GUIDE.md)

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintainer**: Dataproc MCP Server Team