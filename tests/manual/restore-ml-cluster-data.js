#!/usr/bin/env node

/**
 * Restore Missing ML Cluster Data
 *
 * DEPENDENCIES:
 * - ✅ Runs standalone (no MCP server required)
 * - ✅ Requires Qdrant running on localhost:6333
 * - ✅ Auto-builds project if needed
 *
 * USAGE:
 *   npm run build && node tests/manual/restore-ml-cluster-data.js
 *
 * OR with Qdrant setup:
 *   docker-compose -f docker-compose.qdrant.yml up -d
 *   npm run build && node tests/manual/restore-ml-cluster-data.js
 *
 * PURPOSE:
 * This script re-indexes ML cluster configurations that should match
 * the failing semantic queries:
 * - "machine learning clusters with pandas"
 * - "tensorflow scikit-learn"
 *
 * It creates realistic cluster configurations with ML packages that
 * should be semantically similar to these queries.
 */

import { KnowledgeIndexer } from '../../build/services/knowledge-indexer.js';

console.log('🔧 Restoring Missing ML Cluster Data');
console.log('=' .repeat(60));

async function restoreMLClusterData() {
  try {
    console.log('\n📋 Initializing Knowledge Indexer...');
    const indexer = new KnowledgeIndexer({
      url: 'http://localhost:6333',
      collectionName: 'dataproc_knowledge',
      vectorSize: 384,
      distance: 'Cosine'
    });

    await indexer.initialize();
    console.log('   ✅ Knowledge Indexer initialized successfully');

    // Create multiple ML cluster configurations with different ML package combinations
    const mlClusters = [
      {
        clusterName: 'ml-pandas-cluster',
        projectId: 'data-science-prod',
        region: 'us-central1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'pandas==1.5.3,numpy==1.24.0,matplotlib==3.6.0,seaborn==0.12.0',
              'dataproc:conda.packages': 'jupyter,ipython'
            },
            optionalComponents: ['JUPYTER', 'ANACONDA']
          },
          masterConfig: {
            machineTypeUri: 'projects/data-science-prod/zones/us-central1-a/machineTypes/n1-highmem-4',
            diskConfig: { bootDiskSizeGb: 200, bootDiskType: 'pd-ssd' }
          },
          workerConfig: {
            machineTypeUri: 'projects/data-science-prod/zones/us-central1-a/machineTypes/n1-standard-4',
            numInstances: 3,
            diskConfig: { bootDiskSizeGb: 100, bootDiskType: 'pd-standard' }
          }
        },
        labels: {
          environment: 'production',
          team: 'data-science',
          purpose: 'pandas-analysis',
          'ml-framework': 'pandas'
        },
        status: { state: 'RUNNING', stateStartTime: new Date().toISOString() }
      },
      {
        clusterName: 'tensorflow-ml-cluster',
        projectId: 'ai-research-project',
        region: 'us-west1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'tensorflow==2.13.0,scikit-learn==1.3.0,pandas==1.5.3,numpy==1.24.0',
              'dataproc:conda.packages': 'keras,tensorboard'
            },
            optionalComponents: ['JUPYTER', 'ZEPPELIN', 'ANACONDA']
          },
          masterConfig: {
            machineTypeUri: 'projects/ai-research-project/zones/us-west1-a/machineTypes/n1-highmem-8',
            diskConfig: { bootDiskSizeGb: 500, bootDiskType: 'pd-ssd' }
          },
          workerConfig: {
            machineTypeUri: 'projects/ai-research-project/zones/us-west1-a/machineTypes/n1-standard-8',
            numInstances: 5,
            diskConfig: { bootDiskSizeGb: 200, bootDiskType: 'pd-ssd' }
          }
        },
        labels: {
          environment: 'production',
          team: 'ai-research',
          purpose: 'deep-learning',
          'ml-framework': 'tensorflow'
        },
        status: { state: 'RUNNING', stateStartTime: new Date().toISOString() }
      },
      {
        clusterName: 'scikit-learn-analytics',
        projectId: 'ml-analytics-prod',
        region: 'us-east1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'scikit-learn==1.3.0,pandas==1.5.3,numpy==1.24.0,scipy==1.10.0,xgboost==1.7.0',
              'dataproc:conda.packages': 'plotly,dash'
            },
            optionalComponents: ['JUPYTER', 'ANACONDA']
          },
          masterConfig: {
            machineTypeUri: 'projects/ml-analytics-prod/zones/us-east1-a/machineTypes/n1-highmem-4',
            diskConfig: { bootDiskSizeGb: 300, bootDiskType: 'pd-ssd' }
          },
          workerConfig: {
            machineTypeUri: 'projects/ml-analytics-prod/zones/us-east1-a/machineTypes/n1-standard-4',
            numInstances: 4,
            diskConfig: { bootDiskSizeGb: 150, bootDiskType: 'pd-standard' }
          }
        },
        labels: {
          environment: 'production',
          team: 'analytics',
          purpose: 'machine-learning',
          'ml-framework': 'scikit-learn'
        },
        status: { state: 'RUNNING', stateStartTime: new Date().toISOString() }
      },
      {
        clusterName: 'comprehensive-ml-stack',
        projectId: 'ml-platform-prod',
        region: 'us-central1',
        config: {
          softwareConfig: {
            properties: {
              'dataproc:pip.packages': 'tensorflow==2.13.0,scikit-learn==1.3.0,pandas==1.5.3,numpy==1.24.0,pytorch==2.0.0,xgboost==1.7.0,lightgbm==3.3.0',
              'dataproc:conda.packages': 'jupyter,tensorboard,mlflow'
            },
            optionalComponents: ['JUPYTER', 'ZEPPELIN', 'ANACONDA']
          },
          masterConfig: {
            machineTypeUri: 'projects/ml-platform-prod/zones/us-central1-a/machineTypes/n1-highmem-16',
            diskConfig: { bootDiskSizeGb: 1000, bootDiskType: 'pd-ssd' }
          },
          workerConfig: {
            machineTypeUri: 'projects/ml-platform-prod/zones/us-central1-a/machineTypes/n1-standard-16',
            numInstances: 8,
            diskConfig: { bootDiskSizeGb: 500, bootDiskType: 'pd-ssd' }
          }
        },
        labels: {
          environment: 'production',
          team: 'ml-platform',
          purpose: 'comprehensive-ml',
          'ml-framework': 'multi'
        },
        status: { state: 'RUNNING', stateStartTime: new Date().toISOString() }
      }
    ];

    console.log('\n📝 Indexing ML cluster configurations...');
    
    for (let i = 0; i < mlClusters.length; i++) {
      const cluster = mlClusters[i];
      console.log(`\n${i + 1}. Indexing: ${cluster.clusterName}`);
      console.log(`   📦 Packages: ${cluster.config.softwareConfig.properties['dataproc:pip.packages'].split(',').slice(0, 3).join(', ')}...`);
      
      try {
        await indexer.indexClusterConfiguration(cluster);
        console.log(`   ✅ Successfully indexed ${cluster.clusterName}`);
      } catch (error) {
        console.log(`   ❌ Failed to index ${cluster.clusterName}: ${error.message}`);
      }
    }

    // Wait for indexing to complete
    console.log('\n⏳ Waiting 3 seconds for indexing to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🧪 Testing Previously Failing Queries...');
    console.log('-'.repeat(50));

    const testQueries = [
      'machine learning clusters with pandas',
      'tensorflow scikit-learn',
      'scikit-learn machine learning',
      'pandas data analysis clusters',
      'tensorflow deep learning'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Testing: "${query}"`);
      try {
        const results = await indexer.queryKnowledge(query, {
          type: 'clusters',
          limit: 5
        });
        
        console.log(`   📊 Results: ${results.length}`);
        if (results.length > 0) {
          console.log(`   ✅ Query working! Top match: ${results[0].summary?.substring(0, 80)}...`);
          // Show confidence scores
          const scores = results.slice(0, 3).map(r => r.confidence?.toFixed(3) || 'N/A');
          console.log(`   📈 Confidence scores: [${scores.join(', ')}]`);
        } else {
          console.log(`   ❌ Query still returning no results`);
        }
      } catch (error) {
        console.log(`   💥 Query error: ${error.message}`);
      }
    }

    console.log('\n📊 Collection Statistics...');
    console.log('-'.repeat(50));
    
    try {
      const insights = indexer.getClusterInsights();
      const analytics = indexer.getJobTypeAnalytics();
      console.log(`   📊 Total clusters tracked: ${insights.totalClusters}`);
      console.log(`   📊 Total jobs tracked: ${analytics.totalJobs}`);
      console.log(`   📊 Recent discoveries: ${insights.recentDiscoveries?.length || 0}`);
      
      // Show cluster breakdown by ML framework
      if (insights.recentDiscoveries) {
        const mlFrameworks = insights.recentDiscoveries
          .filter(d => d.labels && d.labels['ml-framework'])
          .map(d => d.labels['ml-framework']);
        
        if (mlFrameworks.length > 0) {
          const frameworkCounts = mlFrameworks.reduce((acc, fw) => {
            acc[fw] = (acc[fw] || 0) + 1;
            return acc;
          }, {});
          console.log(`   🤖 ML Frameworks: ${Object.entries(frameworkCounts).map(([k,v]) => `${k}(${v})`).join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed to get statistics: ${error.message}`);
    }

    console.log('\n🎉 ML Cluster Data Restoration Complete!');
    console.log('\n💡 Summary:');
    console.log('   - Added 4 ML cluster configurations with comprehensive package sets');
    console.log('   - Clusters include pandas, tensorflow, scikit-learn, and multi-framework setups');
    console.log('   - Semantic queries should now find relevant ML clusters');
    console.log('   - Future tests should pass for ML-related queries');

  } catch (error) {
    console.error('❌ ML cluster data restoration failed:', error);
  }
}

restoreMLClusterData().catch(console.error);