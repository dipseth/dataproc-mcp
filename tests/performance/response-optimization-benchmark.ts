/**
 * Performance Benchmark for Response Optimization
 * Measures token reduction percentages, response times, and memory usage
 */

import { performance } from 'perf_hooks';
import { ResponseFilter } from '../../build/services/response-filter.js';
import type { QdrantStorageMetadata } from '../../build/types/response-filter.js';

// Sample data for benchmarking
const benchmarkData = {
  list_clusters: {
    clusters: Array(20).fill({
      clusterName: 'benchmark-cluster',
      status: { state: 'RUNNING', stateStartTime: '2024-01-15T10:30:00Z' },
      createTime: '2024-01-15T10:25:00Z',
      projectId: 'benchmark-project',
      config: {
        gceClusterConfig: {
          zoneUri: 'projects/benchmark-project/zones/us-central1-a',
          networkUri: 'projects/benchmark-project/global/networks/default'
        },
        masterConfig: {
          numInstances: 1,
          machineTypeUri: 'projects/benchmark-project/zones/us-central1-a/machineTypes/n1-standard-4',
          diskConfig: { bootDiskType: 'pd-ssd', bootDiskSizeGb: 100 }
        },
        workerConfig: {
          numInstances: 4,
          machineTypeUri: 'projects/benchmark-project/zones/us-central1-a/machineTypes/n1-standard-4',
          diskConfig: { bootDiskType: 'pd-standard', bootDiskSizeGb: 100 }
        },
        softwareConfig: {
          imageVersion: '2.1-debian11',
          optionalComponents: ['ZEPPELIN', 'JUPYTER', 'ANACONDA']
        }
      },
      labels: { environment: 'benchmark', team: 'performance-testing' },
      metrics: {
        hdfsMetrics: { 'dfs.namenode.capacity': '1073741824000' },
        yarnMetrics: { 'yarn.nodemanager.resource.memory-mb': '14336' }
      }
    })
  },
  get_cluster: {
    clusterName: 'detailed-benchmark-cluster',
    status: { state: 'RUNNING', stateStartTime: '2024-01-15T10:30:00Z' },
    createTime: '2024-01-15T10:25:00Z',
    projectId: 'benchmark-project',
    config: {
      gceClusterConfig: {
        zoneUri: 'projects/benchmark-project/zones/us-central1-a',
        networkUri: 'projects/benchmark-project/global/networks/default',
        serviceAccount: 'dataproc-service@benchmark-project.iam.gserviceaccount.com',
        tags: ['benchmark', 'performance-test'],
        metadata: { 'enable-oslogin': 'true' }
      },
      masterConfig: {
        numInstances: 1,
        machineTypeUri: 'projects/benchmark-project/zones/us-central1-a/machineTypes/n1-standard-8',
        diskConfig: { bootDiskType: 'pd-ssd', bootDiskSizeGb: 200, numLocalSsds: 2 },
        instanceNames: ['detailed-benchmark-cluster-m']
      },
      workerConfig: {
        numInstances: 8,
        machineTypeUri: 'projects/benchmark-project/zones/us-central1-a/machineTypes/n1-standard-4',
        diskConfig: { bootDiskType: 'pd-standard', bootDiskSizeGb: 100 }
      },
      softwareConfig: {
        imageVersion: '2.1-debian11',
        properties: {
          'core:fs.defaultFS': 'hdfs://detailed-benchmark-cluster-m:8020',
          'spark:spark.executor.memory': '3g'
        },
        optionalComponents: ['ZEPPELIN', 'JUPYTER', 'ANACONDA', 'SPARK_HISTORY_SERVER']
      }
    },
    labels: { environment: 'benchmark', team: 'performance-testing', 'cost-center': 'engineering' },
    metrics: {
      hdfsMetrics: {
        'dfs.namenode.capacity': '2147483648000',
        'dfs.namenode.used': '1073741824000',
        'dfs.namenode.remaining': '1073741824000'
      },
      yarnMetrics: {
        'yarn.nodemanager.resource.memory-mb': '28672',
        'yarn.nodemanager.resource.cpu-vcores': '8'
      }
    },
    statusHistory: [
      { state: 'CREATING', stateStartTime: '2024-01-15T10:25:00Z' },
      { state: 'RUNNING', stateStartTime: '2024-01-15T10:30:00Z' }
    ]
  },
  submit_hive_query: {
    job: {
      reference: { projectId: 'benchmark-project', jobId: 'benchmark-hive-job-123' },
      placement: { clusterName: 'benchmark-cluster' },
      hiveJob: {
        queryList: { queries: ['SELECT * FROM benchmark_table LIMIT 1000'] },
        continueOnFailure: false,
        scriptVariables: { 'table_name': 'benchmark_table' }
      },
      status: {
        state: 'RUNNING',
        stateStartTime: '2024-01-15T11:00:00Z',
        details: 'Query execution in progress'
      },
      statusHistory: [
        { state: 'PENDING', stateStartTime: '2024-01-15T10:59:00Z' },
        { state: 'RUNNING', stateStartTime: '2024-01-15T11:00:00Z' }
      ],
      yarnApplications: [
        {
          name: 'benchmark-hive-query',
          state: 'RUNNING',
          progress: 0.45,
          trackingUrl: 'http://benchmark-cluster-m:8088/proxy/application_123456789'
        }
      ]
    }
  },
  check_active_jobs: {
    jobs: Array(15).fill({
      reference: { projectId: 'benchmark-project', jobId: 'benchmark-job' },
      placement: { clusterName: 'benchmark-cluster' },
      status: { state: 'RUNNING', stateStartTime: '2024-01-15T11:00:00Z' },
      hiveJob: { queryList: { queries: ['SELECT COUNT(*) FROM table'] } }
    }).map((job, index) => ({
      ...job,
      reference: { ...job.reference, jobId: `benchmark-job-${index + 1}` },
      status: {
        ...job.status,
        state: index % 3 === 0 ? 'DONE' : index % 3 === 1 ? 'RUNNING' : 'PENDING'
      }
    }))
  }
};

interface BenchmarkResult {
  toolName: string;
  originalTokens: number;
  filteredTokens: number;
  tokenReduction: number;
  reductionPercentage: number;
  processingTimeMs: number;
  memoryUsageMB: number;
  targetTokens: number;
  meetsTarget: boolean;
}

interface BenchmarkSummary {
  totalTests: number;
  averageReduction: number;
  averageProcessingTime: number;
  averageMemoryUsage: number;
  targetsMetPercentage: number;
  results: BenchmarkResult[];
}

/**
 * Measure memory usage
 */
function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100; // MB
}

/**
 * Run benchmark for a specific tool
 */
async function benchmarkTool(
  responseFilter: ResponseFilter,
  toolName: string,
  data: any,
  targetTokens: number,
  iterations: number = 10
): Promise<BenchmarkResult> {
  console.log(`🔧 Benchmarking ${toolName}...`);
  
  const originalResponse = JSON.stringify(data, null, 2);
  const originalTokens = responseFilter.estimateTokens(originalResponse);
  
  const times: number[] = [];
  const memoryUsages: number[] = [];
  let lastFilteredTokens = 0;
  
  // Warm up
  await responseFilter.filterResponse(toolName, data, { projectId: 'benchmark' });
  
  // Run benchmark iterations
  for (let i = 0; i < iterations; i++) {
    const memoryBefore = getMemoryUsage();
    const startTime = performance.now();
    
    const filtered = await responseFilter.filterResponse(
      toolName,
      data,
      { projectId: 'benchmark', region: 'us-central1' }
    );
    
    const endTime = performance.now();
    const memoryAfter = getMemoryUsage();
    
    times.push(endTime - startTime);
    memoryUsages.push(memoryAfter - memoryBefore);
    lastFilteredTokens = responseFilter.estimateTokens(filtered.content);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
  const tokenReduction = originalTokens - lastFilteredTokens;
  const reductionPercentage = (tokenReduction / originalTokens) * 100;
  
  return {
    toolName,
    originalTokens,
    filteredTokens: lastFilteredTokens,
    tokenReduction,
    reductionPercentage,
    processingTimeMs: Math.round(avgTime * 100) / 100,
    memoryUsageMB: Math.round(avgMemory * 100) / 100,
    targetTokens,
    meetsTarget: lastFilteredTokens <= targetTokens
  };
}

/**
 * Run comprehensive benchmark suite
 */
async function runBenchmarkSuite(): Promise<BenchmarkSummary> {
  console.log('🚀 Starting Response Optimization Benchmark Suite\n');
  console.log('=' .repeat(70));
  
  const responseFilter = await ResponseFilter.getInstance();
  const results: BenchmarkResult[] = [];
  
  // Define target token limits (from config)
  const targets = {
    list_clusters: 500,
    get_cluster: 300,
    submit_hive_query: 400,
    check_active_jobs: 450
  };
  
  // Benchmark each tool
  for (const [toolName, data] of Object.entries(benchmarkData)) {
    const target = targets[toolName as keyof typeof targets];
    const result = await benchmarkTool(responseFilter, toolName, data, target, 20);
    results.push(result);
    
    // Print individual result
    console.log(`\n📊 ${toolName}:`);
    console.log(`   Original: ${result.originalTokens} tokens`);
    console.log(`   Filtered: ${result.filteredTokens} tokens`);
    console.log(`   Reduction: ${result.tokenReduction} tokens (${result.reductionPercentage.toFixed(1)}%)`);
    console.log(`   Target: ${result.targetTokens} tokens ${result.meetsTarget ? '✅' : '❌'}`);
    console.log(`   Processing: ${result.processingTimeMs}ms`);
    console.log(`   Memory: ${result.memoryUsageMB}MB`);
  }
  
  // Calculate summary statistics
  const totalTests = results.length;
  const averageReduction = results.reduce((sum, r) => sum + r.reductionPercentage, 0) / totalTests;
  const averageProcessingTime = results.reduce((sum, r) => sum + r.processingTimeMs, 0) / totalTests;
  const averageMemoryUsage = results.reduce((sum, r) => sum + r.memoryUsageMB, 0) / totalTests;
  const targetsMetCount = results.filter(r => r.meetsTarget).length;
  const targetsMetPercentage = (targetsMetCount / totalTests) * 100;
  
  return {
    totalTests,
    averageReduction,
    averageProcessingTime,
    averageMemoryUsage,
    targetsMetPercentage,
    results
  };
}

/**
 * Test scalability with varying data sizes
 */
async function testScalability(): Promise<void> {
  console.log('\n🔬 Testing Scalability...');
  
  const responseFilter = await ResponseFilter.getInstance();
  const clusterCounts = [1, 5, 10, 20, 50, 100];
  
  console.log('\n| Clusters | Original Tokens | Filtered Tokens | Reduction % | Time (ms) |');
  console.log('|----------|-----------------|-----------------|-------------|-----------|');
  
  for (const count of clusterCounts) {
    const data = {
      clusters: Array(count).fill(benchmarkData.list_clusters.clusters[0])
    };
    
    const originalResponse = JSON.stringify(data, null, 2);
    const originalTokens = responseFilter.estimateTokens(originalResponse);
    
    const startTime = performance.now();
    const filtered = await responseFilter.filterResponse('list_clusters', data);
    const endTime = performance.now();
    
    const filteredTokens = responseFilter.estimateTokens(filtered.content);
    const reductionPercentage = ((originalTokens - filteredTokens) / originalTokens * 100).toFixed(1);
    const processingTime = (endTime - startTime).toFixed(2);
    
    console.log(`| ${count.toString().padStart(8)} | ${originalTokens.toString().padStart(15)} | ${filteredTokens.toString().padStart(15)} | ${reductionPercentage.padStart(11)}% | ${processingTime.padStart(9)} |`);
  }
}

/**
 * Generate performance report
 */
function generateReport(summary: BenchmarkSummary): void {
  console.log('\n' + '='.repeat(70));
  console.log('📈 PERFORMANCE BENCHMARK REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n🎯 Overall Performance:`);
  console.log(`   • Total tests: ${summary.totalTests}`);
  console.log(`   • Average token reduction: ${summary.averageReduction.toFixed(1)}%`);
  console.log(`   • Average processing time: ${summary.averageProcessingTime.toFixed(2)}ms`);
  console.log(`   • Average memory usage: ${summary.averageMemoryUsage.toFixed(2)}MB`);
  console.log(`   • Targets met: ${summary.targetsMetPercentage.toFixed(1)}% (${summary.results.filter(r => r.meetsTarget).length}/${summary.totalTests})`);
  
  console.log(`\n📊 Detailed Results:`);
  summary.results.forEach(result => {
    const status = result.meetsTarget ? '✅' : '❌';
    console.log(`   ${status} ${result.toolName}:`);
    console.log(`      Token reduction: ${result.reductionPercentage.toFixed(1)}% (${result.originalTokens} → ${result.filteredTokens})`);
    console.log(`      Performance: ${result.processingTimeMs}ms, ${result.memoryUsageMB}MB`);
  });
  
  console.log(`\n🎯 Target Achievement:`);
  const achievements = {
    'Excellent (>80% reduction)': summary.results.filter(r => r.reductionPercentage > 80).length,
    'Good (60-80% reduction)': summary.results.filter(r => r.reductionPercentage >= 60 && r.reductionPercentage <= 80).length,
    'Fair (40-60% reduction)': summary.results.filter(r => r.reductionPercentage >= 40 && r.reductionPercentage < 60).length,
    'Poor (<40% reduction)': summary.results.filter(r => r.reductionPercentage < 40).length
  };
  
  Object.entries(achievements).forEach(([category, count]) => {
    if (count > 0) {
      console.log(`   • ${category}: ${count} tools`);
    }
  });
  
  console.log(`\n⚡ Performance Analysis:`);
  const fastTools = summary.results.filter(r => r.processingTimeMs < 10).length;
  const mediumTools = summary.results.filter(r => r.processingTimeMs >= 10 && r.processingTimeMs < 50).length;
  const slowTools = summary.results.filter(r => r.processingTimeMs >= 50).length;
  
  console.log(`   • Fast (<10ms): ${fastTools} tools`);
  console.log(`   • Medium (10-50ms): ${mediumTools} tools`);
  console.log(`   • Slow (>50ms): ${slowTools} tools`);
  
  console.log(`\n💾 Memory Efficiency:`);
  const lowMemory = summary.results.filter(r => r.memoryUsageMB < 1).length;
  const mediumMemory = summary.results.filter(r => r.memoryUsageMB >= 1 && r.memoryUsageMB < 5).length;
  const highMemory = summary.results.filter(r => r.memoryUsageMB >= 5).length;
  
  console.log(`   • Low memory (<1MB): ${lowMemory} tools`);
  console.log(`   • Medium memory (1-5MB): ${mediumMemory} tools`);
  console.log(`   • High memory (>5MB): ${highMemory} tools`);
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  const failedTargets = summary.results.filter(r => !r.meetsTarget);
  if (failedTargets.length > 0) {
    console.log(`   • Consider adjusting token limits for: ${failedTargets.map(r => r.toolName).join(', ')}`);
  }
  
  const slowProcessing = summary.results.filter(r => r.processingTimeMs > 50);
  if (slowProcessing.length > 0) {
    console.log(`   • Optimize processing for: ${slowProcessing.map(r => r.toolName).join(', ')}`);
  }
  
  if (summary.averageReduction < 50) {
    console.log(`   • Consider more aggressive filtering rules to improve token reduction`);
  }
  
  console.log('\n' + '='.repeat(70));
}

/**
 * Main benchmark execution
 */
async function main(): Promise<void> {
  try {
    // Run main benchmark suite
    const summary = await runBenchmarkSuite();
    
    // Test scalability
    await testScalability();
    
    // Generate comprehensive report
    generateReport(summary);
    
    console.log('\n🎉 Benchmark completed successfully!');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Export for use in other tests
export { runBenchmarkSuite, testScalability, benchmarkTool };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}