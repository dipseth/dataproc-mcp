# Testing Guide 🧪

This guide covers the comprehensive testing infrastructure implemented in Phase 5: Testing & Validation, including enhanced integration tests, performance benchmarks, chaos testing, and multi-environment validation.

## Overview

The testing suite provides multiple layers of validation:

- **Unit Tests** - Individual component testing with Jest
- **Integration Tests** - Authentication and workflow testing
- **End-to-End Tests** - Complete workflow validation
- **Performance Tests** - Benchmarking and performance monitoring
- **Chaos Tests** - Resilience and error handling validation
- **Multi-Environment Tests** - Cross-project and configuration validation

## Test Structure

```
tests/
├── unit/                    # Unit tests with Jest
│   ├── validation.test.ts   # Schema validation tests
│   └── *.test.ts           # Component-specific tests
├── integration/             # Integration tests
│   ├── auth-methods.test.ts # Authentication method testing
│   └── e2e-workflow.test.ts # End-to-end workflow tests
├── performance/             # Performance benchmarks
│   └── benchmark.test.ts    # Performance testing suite
├── chaos/                   # Chaos testing
│   └── resilience.test.ts   # Resilience and error handling
├── validation/              # Multi-environment validation
│   └── multi-environment.test.ts
├── fixtures/                # Test fixtures and mock data
└── setup.ts                # Global test setup
```

## Running Tests

### Quick Test Commands

```bash
# Run all enhanced tests
npm run test:all-enhanced

# Run specific test suites
npm run test:auth          # Authentication tests
npm run test:e2e           # End-to-end workflow tests
npm run test:performance   # Performance benchmarks
npm run test:chaos         # Chaos/resilience tests

# Traditional Jest tests
npm test                   # All Jest tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests (Mocha)
npm run test:coverage      # With coverage reporting
npm run test:watch         # Watch mode
```

### Advanced Test Commands

```bash
# Coverage with thresholds
npm run test:coverage:check

# Type checking
npm run type-check

# Validation tests
npm run validate:examples
npm run docs:test-links
```

## Test Categories

### 1. Authentication Tests (`test:auth`)

Tests all supported authentication methods:

**Service Account Key File Authentication**
- Valid key file validation
- Invalid key file rejection
- Key file format verification

**Service Account Impersonation**
- Valid impersonation configuration
- Invalid configuration rejection
- Target service account validation

**Application Default Credentials (ADC)**
- ADC availability detection
- Source identification
- Fallback behavior

**Credential Expiration**
- Expired credential detection
- Fresh credential validation
- Expiration timeline calculation

**Cross-Environment Authentication**
- Development environment validation
- Staging environment validation
- Production environment validation

**Security Compliance**
- Compliant credential validation
- Security violation detection
- Policy enforcement testing

### 2. End-to-End Workflow Tests (`test:e2e`)

Tests complete operational workflows:

**Complete Cluster Lifecycle**
- Cluster creation workflow
- Status monitoring
- Lifecycle management

**Hive Query Execution Workflow**
- Query submission
- Job monitoring
- Result retrieval

**Parameter Validation Workflow**
- Input validation
- Error handling
- Validation feedback

**Multi-Environment Configuration**
- Environment-specific configurations
- Cross-environment compatibility
- Configuration validation

**Error Handling and Resilience**
- Invalid input handling
- Network error simulation
- Recovery mechanisms

**Performance and Timeout Handling**
- Concurrent operation testing
- Timeout validation
- Performance thresholds

### 3. Performance Benchmarks (`test:performance`)

Measures and validates performance metrics:

**Schema Validation Performance**
- Target: <5ms average, >1000 ops/sec
- Memory impact: <1MB
- Validation accuracy

**Parameter Injection Performance**
- Target: <2ms average, >2000 ops/sec
- Memory impact: <512KB
- Injection accuracy

**Credential Validation Performance**
- Target: <50ms average, >100 ops/sec
- Memory impact: <2MB
- Validation thoroughness

**MCP Tool Call Performance**
- Target: <100ms average, >50 ops/sec
- Memory impact: <5MB
- End-to-end latency

**Concurrent Operations Performance**
- Parallel processing capability
- Resource utilization
- Scalability metrics

### 4. Chaos Testing (`test:chaos`)

Tests system resilience under adverse conditions:

**Network Failures**
- Connection timeouts
- Intermittent connectivity
- DNS resolution failures

**Authentication Failures**
- Invalid credentials
- Expired tokens
- Permission denials

**Resource Exhaustion**
- Memory pressure
- CPU saturation
- Disk space limitations

**Configuration Errors**
- Invalid configurations
- Missing parameters
- Malformed data

**External Service Failures**
- Google Cloud API failures
- Service unavailability
- Rate limiting

### 5. Multi-Environment Validation

Tests across different deployment scenarios:

**Environment Configurations**
- Development environment
- Staging environment
- Production environment

**Cross-Project Testing**
- Different GCP projects
- Project-specific configurations
- Resource isolation

**Service Account Validation**
- Environment-specific service accounts
- Permission validation
- Security compliance

**Cluster Configuration Testing**
- Environment-appropriate machine types
- Resource allocation validation
- Cost optimization verification

## Performance Thresholds

### Response Time Targets

| Operation | Target (ms) | Threshold (ms) |
|-----------|-------------|----------------|
| Schema Validation | 2 | 5 |
| Parameter Injection | 1 | 2 |
| Credential Validation | 25 | 50 |
| MCP Tool Call | 50 | 100 |
| Concurrent Operations | 75 | 150 |

### Throughput Targets

| Operation | Target (ops/sec) | Minimum (ops/sec) |
|-----------|------------------|-------------------|
| Schema Validation | 2000 | 1000 |
| Parameter Injection | 5000 | 2000 |
| Credential Validation | 200 | 100 |
| MCP Tool Call | 100 | 50 |

### Memory Usage Limits

| Operation | Target (MB) | Maximum (MB) |
|-----------|-------------|--------------|
| Schema Validation | 0.5 | 1 |
| Parameter Injection | 0.25 | 0.5 |
| Credential Validation | 1 | 2 |
| MCP Tool Call | 2.5 | 5 |

## Test Configuration

### Environment Variables

```bash
# Test environment configuration
NODE_ENV=test
GOOGLE_APPLICATION_CREDENTIALS=test-credentials.json
DATAPROC_PROJECT_ID=test-project
DATAPROC_REGION=us-central1

# Performance testing
PERFORMANCE_ITERATIONS=1000
PERFORMANCE_TIMEOUT=30000

# Chaos testing
CHAOS_FAILURE_RATE=0.1
CHAOS_RECOVERY_TIMEOUT=5000
```

### Test Data and Fixtures

**Mock Service Accounts**
```json
{
  "type": "service_account",
  "project_id": "test-project",
  "private_key_id": "test-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "test@test-project.iam.gserviceaccount.com",
  "client_id": "123456789"
}
```

**Test Cluster Configurations**
```yaml
development:
  masterConfig:
    numInstances: 1
    machineTypeUri: e2-medium
  workerConfig:
    numInstances: 2
    machineTypeUri: e2-medium

production:
  masterConfig:
    numInstances: 3
    machineTypeUri: n1-standard-4
  workerConfig:
    numInstances: 10
    machineTypeUri: n1-standard-4
```

## Continuous Integration Integration

### GitHub Actions Integration

The test suite integrates with the CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
- name: Run Enhanced Tests
  run: |
    npm run test:auth
    npm run test:e2e
    npm run test:performance
    
- name: Performance Regression Check
  run: npm run test:performance
  continue-on-error: false
  
- name: Multi-Environment Validation
  run: npm run test:multi-env
  env:
    TEST_ENVIRONMENTS: "dev,staging"
```

### Coverage Requirements

- **Unit Tests**: 90% coverage minimum
- **Integration Tests**: Critical path coverage
- **Performance Tests**: Baseline establishment
- **Chaos Tests**: Error path coverage

## Troubleshooting

### Common Issues

**Test Timeouts**
```bash
# Increase timeout for slow operations
npm run test:integration -- --timeout 60000
```

**Memory Issues**
```bash
# Run with increased memory
node --max-old-space-size=4096 tests/performance/benchmark.test.ts
```

**Authentication Failures**
```bash
# Check credentials
npm run validate
export GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
```

**Performance Degradation**
```bash
# Run performance tests in isolation
npm run test:performance
# Check system resources
top -p $(pgrep node)
```

### Debugging Tests

**Verbose Output**
```bash
# Enable debug logging
DEBUG=* npm run test:auth

# Performance debugging
NODE_ENV=development npm run test:performance
```

**Test Isolation**
```bash
# Run single test file
node tests/integration/auth-methods.test.ts

# Run specific test category
npm run test:auth
```

## Best Practices

### Writing Tests

1. **Use Descriptive Names**
   ```typescript
   await runner.runTest('Service Account Key File Authentication - Valid', async () => {
     // Test implementation
   });
   ```

2. **Proper Setup and Cleanup**
   ```typescript
   beforeEach(() => {
     // Save original state
   });
   
   afterEach(() => {
     // Restore original state
   });
   ```

3. **Meaningful Assertions**
   ```typescript
   assert(result.isValid, 'Service account key should be valid');
   assertEqual(result.projectId, 'expected-project', 'Project ID should match');
   ```

4. **Error Testing**
   ```typescript
   try {
     await functionThatShouldFail();
     throw new Error('Should have failed');
   } catch (error) {
     assert(error.message.includes('expected error'));
   }
   ```

### Performance Testing

1. **Establish Baselines**
   - Run performance tests on clean system
   - Document baseline metrics
   - Set realistic thresholds

2. **Monitor Trends**
   - Track performance over time
   - Identify regressions early
   - Optimize critical paths

3. **Resource Monitoring**
   - Monitor memory usage
   - Track CPU utilization
   - Watch for memory leaks

### Chaos Testing

1. **Gradual Failure Introduction**
   - Start with simple failures
   - Increase complexity gradually
   - Test recovery mechanisms

2. **Real-World Scenarios**
   - Simulate actual failure modes
   - Test with realistic data volumes
   - Include network conditions

3. **Recovery Validation**
   - Verify graceful degradation
   - Test automatic recovery
   - Validate error reporting

## Reporting and Metrics

### Test Reports

Tests generate comprehensive reports:

- **Authentication Test Summary**: Pass/fail rates, error details
- **Performance Benchmark Report**: Metrics, thresholds, trends
- **Chaos Test Results**: Failure scenarios, recovery times
- **Multi-Environment Validation**: Cross-environment compatibility

### Metrics Collection

Key metrics tracked:

- **Test Execution Time**: Individual and suite timing
- **Performance Metrics**: Response times, throughput, memory usage
- **Error Rates**: Failure frequencies, error types
- **Coverage Metrics**: Code coverage, test coverage

### Integration with Monitoring

Test results integrate with:

- **CI/CD Pipelines**: Automated test execution
- **Performance Monitoring**: Baseline establishment
- **Error Tracking**: Failure pattern analysis
- **Quality Gates**: Release criteria validation

This comprehensive testing infrastructure ensures the Dataproc MCP Server maintains high quality, performance, and reliability across all deployment scenarios.