#!/usr/bin/env node

/**
 * Phase 3: Performance Testing for Dynamic Templating Pipeline
 * Tests performance, concurrency, caching, and resource usage
 */

import { TemplateFunctions } from '../../build/services/template-functions.js';
import { JobTracker } from '../../build/services/job-tracker.js';
import { KnowledgeIndexer } from '../../build/services/knowledge-indexer.js';
import { AsyncQueryPoller } from '../../build/services/async-query-poller.js';
import { DynamicResolver } from '../../build/services/dynamic-resolver.js';

const PERFORMANCE_CONFIG = {
  REAL_JOB_ID: '897ac2fd-d113-4a35-a412-01cc59783042',
  CONCURRENT_CALLS: 10,
  CACHE_ITERATIONS: 20,
  STRESS_TEST_CALLS: 50,
  TIMEOUT_MS: 10000,
  MEMORY_THRESHOLD_MB: 100,
};

async function runPerformanceTests() {
  console.log('⚡ Phase 3: Performance Testing');
  console.log('===============================\n');

  const context = await initializeServices();
  const metrics = {
    concurrency: {},
    caching: {},
    memory: {},
    stress: {},
    errors: []
  };

  try {
    // Test 1: Concurrent Template Function Calls
    await testConcurrentCalls(context, metrics);
    
    // Test 2: Caching Performance
    await testCachingPerformance(context, metrics);
    
    // Test 3: Memory Usage
    await testMemoryUsage(context, metrics);
    
    // Test 4: Stress Testing
    await testStressTesting(context, metrics);
    
    // Test 5: Template Parsing Performance
    await testTemplateParsingPerformance(context, metrics);
    
    // Generate performance report
    generatePerformanceReport(metrics);
    
  } catch (error) {
    console.error('❌ Performance testing failed:', error);
    process.exit(1);
  }
}

async function initializeServices() {
  console.log('🔧 Initializing services for performance testing...');
  
  const jobTracker = new JobTracker();
  const knowledgeIndexer = new KnowledgeIndexer();
  const asyncQueryPoller = new AsyncQueryPoller(jobTracker);
  
  try {
    await knowledgeIndexer.initialize();
    console.log('✅ KnowledgeIndexer initialized');
  } catch (error) {
    console.log('⚠️  KnowledgeIndexer running without Qdrant');
  }
  
  const context = {
    jobTracker,
    knowledgeIndexer,
    asyncQueryPoller,
    templateContext: {
      toolName: 'performance_test',
      environment: 'testing',
      userOverrides: {},
    },
  };
  
  const templateFunctions = new TemplateFunctions(context);
  const dynamicResolver = new DynamicResolver();
  dynamicResolver.setContext(context);
  
  context.templateFunctions = templateFunctions;
  context.dynamicResolver = dynamicResolver;
  
  // Setup test data
  jobTracker.addOrUpdateJob({
    jobId: PERFORMANCE_CONFIG.REAL_JOB_ID,
    status: 'COMPLETED',
    toolName: 'submit_hive_query',
    projectId: 'performance-test',
    region: 'us-central1',
    clusterName: 'performance-cluster',
    submissionTime: new Date().toISOString(),
    results: {
      status: 'SUCCESS',
      executionTime: 1500,
      tables: [
        {
          schema: ['id', 'name', 'value'],
          rows: [
            ['1', 'test1', '100'],
            ['2', 'test2', '200'],
            ['3', 'test3', '300'],
          ],
        },
      ],
      metadata: {
        jobId: PERFORMANCE_CONFIG.REAL_JOB_ID,
        query: 'SELECT * FROM test_table',
        duration: 1500,
        rowsProcessed: 3,
      },
    },
  });
  
  console.log('✅ Services initialized for performance testing\n');
  return context;
}

async function testConcurrentCalls(context, metrics) {
  console.log('🚀 Testing Concurrent Template Function Calls');
  console.log('----------------------------------------------');
  
  const startTime = Date.now();
  const promises = [];
  
  // Create concurrent calls to jobOutput
  for (let i = 0; i < PERFORMANCE_CONFIG.CONCURRENT_CALLS; i++) {
    promises.push(
      context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, 'status')
        .catch(error => ({ error: error.message }))
    );
  }
  
  const results = await Promise.allSettled(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
  const failed = results.length - successful;
  
  metrics.concurrency = {
    totalCalls: PERFORMANCE_CONFIG.CONCURRENT_CALLS,
    successful,
    failed,
    totalTime: endTime - startTime,
    avgTimePerCall: (endTime - startTime) / PERFORMANCE_CONFIG.CONCURRENT_CALLS,
    callsPerSecond: (PERFORMANCE_CONFIG.CONCURRENT_CALLS / (endTime - startTime)) * 1000
  };
  
  console.log(`✅ Concurrent calls completed:`);
  console.log(`   Total calls: ${metrics.concurrency.totalCalls}`);
  console.log(`   Successful: ${metrics.concurrency.successful}`);
  console.log(`   Failed: ${metrics.concurrency.failed}`);
  console.log(`   Total time: ${metrics.concurrency.totalTime}ms`);
  console.log(`   Avg per call: ${metrics.concurrency.avgTimePerCall.toFixed(2)}ms`);
  console.log(`   Calls/second: ${metrics.concurrency.callsPerSecond.toFixed(2)}\n`);
}

async function testCachingPerformance(context, metrics) {
  console.log('💾 Testing Caching Performance');
  console.log('-------------------------------');
  
  // First call (cache miss)
  const firstCallStart = Date.now();
  await context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, 'status');
  const firstCallTime = Date.now() - firstCallStart;
  
  // Subsequent calls (should be cached)
  const cacheCallTimes = [];
  for (let i = 0; i < PERFORMANCE_CONFIG.CACHE_ITERATIONS; i++) {
    const callStart = Date.now();
    await context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, 'status');
    cacheCallTimes.push(Date.now() - callStart);
  }
  
  const avgCacheTime = cacheCallTimes.reduce((a, b) => a + b, 0) / cacheCallTimes.length;
  const minCacheTime = Math.min(...cacheCallTimes);
  const maxCacheTime = Math.max(...cacheCallTimes);
  
  metrics.caching = {
    firstCallTime,
    avgCacheTime,
    minCacheTime,
    maxCacheTime,
    cacheEfficiency: ((firstCallTime / avgCacheTime) * 100).toFixed(1),
    iterations: PERFORMANCE_CONFIG.CACHE_ITERATIONS
  };
  
  console.log(`✅ Caching performance:`);
  console.log(`   First call (cache miss): ${metrics.caching.firstCallTime}ms`);
  console.log(`   Avg cached call: ${metrics.caching.avgCacheTime.toFixed(2)}ms`);
  console.log(`   Min cached call: ${metrics.caching.minCacheTime}ms`);
  console.log(`   Max cached call: ${metrics.caching.maxCacheTime}ms`);
  console.log(`   Cache efficiency: ${metrics.caching.cacheEfficiency}% faster\n`);
}

async function testMemoryUsage(context, metrics) {
  console.log('🧠 Testing Memory Usage');
  console.log('-----------------------');
  
  const initialMemory = process.memoryUsage();
  
  // Perform memory-intensive operations
  const operations = [];
  for (let i = 0; i < 100; i++) {
    operations.push(
      context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, `tables[0].rows[${i % 3}][${i % 3}]`)
    );
  }
  
  await Promise.allSettled(operations);
  
  const finalMemory = process.memoryUsage();
  
  metrics.memory = {
    initialHeapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024),
    finalHeapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
    heapIncrease: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
    initialRSS: Math.round(initialMemory.rss / 1024 / 1024),
    finalRSS: Math.round(finalMemory.rss / 1024 / 1024),
    rssIncrease: Math.round((finalMemory.rss - initialMemory.rss) / 1024 / 1024)
  };
  
  console.log(`✅ Memory usage:`);
  console.log(`   Initial heap: ${metrics.memory.initialHeapUsed}MB`);
  console.log(`   Final heap: ${metrics.memory.finalHeapUsed}MB`);
  console.log(`   Heap increase: ${metrics.memory.heapIncrease}MB`);
  console.log(`   RSS increase: ${metrics.memory.rssIncrease}MB`);
  
  if (metrics.memory.heapIncrease > PERFORMANCE_CONFIG.MEMORY_THRESHOLD_MB) {
    console.log(`   ⚠️  Memory increase (${metrics.memory.heapIncrease}MB) exceeds threshold (${PERFORMANCE_CONFIG.MEMORY_THRESHOLD_MB}MB)`);
  }
  console.log();
}

async function testStressTesting(context, metrics) {
  console.log('💪 Stress Testing');
  console.log('-----------------');
  
  const startTime = Date.now();
  const promises = [];
  const errors = [];
  
  // Create a mix of different template function calls
  for (let i = 0; i < PERFORMANCE_CONFIG.STRESS_TEST_CALLS; i++) {
    const callType = i % 3;
    let promise;
    
    switch (callType) {
      case 0:
        promise = context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, 'status');
        break;
      case 1:
        promise = context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, `tables[0].rows[${i % 3}][0]`);
        break;
      case 2:
        promise = context.templateFunctions.jobOutput(PERFORMANCE_CONFIG.REAL_JOB_ID, 'metadata.duration');
        break;
    }
    
    promises.push(
      promise.catch(error => {
        errors.push(error.message);
        return null;
      })
    );
  }
  
  const results = await Promise.allSettled(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  
  metrics.stress = {
    totalCalls: PERFORMANCE_CONFIG.STRESS_TEST_CALLS,
    successful,
    failed: PERFORMANCE_CONFIG.STRESS_TEST_CALLS - successful,
    totalTime: endTime - startTime,
    avgTimePerCall: (endTime - startTime) / PERFORMANCE_CONFIG.STRESS_TEST_CALLS,
    errors: errors.length
  };
  
  console.log(`✅ Stress test completed:`);
  console.log(`   Total calls: ${metrics.stress.totalCalls}`);
  console.log(`   Successful: ${metrics.stress.successful}`);
  console.log(`   Failed: ${metrics.stress.failed}`);
  console.log(`   Total time: ${metrics.stress.totalTime}ms`);
  console.log(`   Avg per call: ${metrics.stress.avgTimePerCall.toFixed(2)}ms`);
  console.log(`   Error count: ${metrics.stress.errors}\n`);
}

async function testTemplateParsingPerformance(context, metrics) {
  console.log('📝 Testing Template Parsing Performance');
  console.log('---------------------------------------');
  
  const templates = [
    `{{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'status')}}`,
    `dataproc://gcp/{{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'projectId')}}/{{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'region')}}`,
    `{{qdrant_query('test query', 'field')}} and {{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'clusterName')}}`,
    `Complex template with {{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'tables[0].rows[0][0]')}} and {{qdrant_query('complex query with spaces', 'complexField')}} and more {{job_output('${PERFORMANCE_CONFIG.REAL_JOB_ID}', 'metadata.duration')}}`
  ];
  
  const parseResults = [];
  
  for (const template of templates) {
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      context.dynamicResolver.parseFunctionCalls(template);
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    parseResults.push({
      template: template.substring(0, 50) + (template.length > 50 ? '...' : ''),
      avgParseTime: avgTime,
      parsesPerSecond: 1000 / avgTime
    });
  }
  
  metrics.parsing = {
    results: parseResults,
    totalTemplates: templates.length
  };
  
  console.log(`✅ Template parsing performance:`);
  parseResults.forEach((result, index) => {
    console.log(`   Template ${index + 1}: ${result.avgParseTime.toFixed(4)}ms avg (${result.parsesPerSecond.toFixed(0)} parses/sec)`);
  });
  console.log();
}

function generatePerformanceReport(metrics) {
  console.log('📊 Performance Test Report');
  console.log('==========================');
  
  console.log('\n🚀 Concurrency Performance:');
  console.log(`   Throughput: ${metrics.concurrency.callsPerSecond.toFixed(2)} calls/second`);
  console.log(`   Success Rate: ${((metrics.concurrency.successful / metrics.concurrency.totalCalls) * 100).toFixed(1)}%`);
  console.log(`   Avg Response Time: ${metrics.concurrency.avgTimePerCall.toFixed(2)}ms`);
  
  console.log('\n💾 Caching Performance:');
  console.log(`   Cache Efficiency: ${metrics.caching.cacheEfficiency}% faster`);
  console.log(`   Cache Hit Performance: ${metrics.caching.avgCacheTime.toFixed(2)}ms avg`);
  
  console.log('\n🧠 Memory Performance:');
  console.log(`   Memory Increase: ${metrics.memory.heapIncrease}MB heap, ${metrics.memory.rssIncrease}MB RSS`);
  console.log(`   Memory Efficiency: ${metrics.memory.heapIncrease <= PERFORMANCE_CONFIG.MEMORY_THRESHOLD_MB ? '✅ Good' : '⚠️ High'}`);
  
  console.log('\n💪 Stress Test Results:');
  console.log(`   Reliability: ${((metrics.stress.successful / metrics.stress.totalCalls) * 100).toFixed(1)}% success rate`);
  console.log(`   Performance: ${metrics.stress.avgTimePerCall.toFixed(2)}ms avg under load`);
  
  console.log('\n📝 Template Parsing:');
  const avgParseTime = metrics.parsing.results.reduce((sum, r) => sum + r.avgParseTime, 0) / metrics.parsing.results.length;
  console.log(`   Average Parse Time: ${avgParseTime.toFixed(4)}ms`);
  console.log(`   Parse Throughput: ${(1000 / avgParseTime).toFixed(0)} parses/second`);
  
  // Overall assessment
  console.log('\n🎯 Performance Assessment:');
  const issues = [];
  
  if (metrics.concurrency.callsPerSecond < 100) issues.push('Low concurrency throughput');
  if (metrics.caching.cacheEfficiency < 200) issues.push('Poor cache efficiency');
  if (metrics.memory.heapIncrease > PERFORMANCE_CONFIG.MEMORY_THRESHOLD_MB) issues.push('High memory usage');
  if (metrics.stress.successful / metrics.stress.totalCalls < 0.95) issues.push('Low reliability under stress');
  
  if (issues.length === 0) {
    console.log('✅ EXCELLENT: All performance metrics within acceptable ranges');
  } else {
    console.log('⚠️  ISSUES DETECTED:');
    issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  console.log('\n🎉 Performance testing complete!');
}

// Run performance tests
runPerformanceTests().catch(console.error);