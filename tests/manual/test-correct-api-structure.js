#!/usr/bin/env node

/**
 * Test the correct Dataproc API structure based on official documentation
 */

import { readYamlConfig, convertYamlToDataprocConfig } from './build/config/yaml.js';

async function testCorrectApiStructure() {
  console.log('=== Testing Correct Dataproc API Structure ===');
  
  try {
    // Load our profile
    const profilePath = './profiles/production/pricing-promotions.yaml';
    const yamlConfig = await readYamlConfig(profilePath);
    const dataprocConfig = convertYamlToDataprocConfig(yamlConfig, profilePath);
    
    console.log('1. Our current structure:');
    console.log('   Service Account:', dataprocConfig.config?.gceClusterConfig?.serviceAccount);
    console.log('   Labels:', JSON.stringify(dataprocConfig.labels, null, 2));
    
    // Based on Google Cloud documentation, the correct structure should be:
    // https://cloud.google.com/dataproc/docs/reference/rest/v1/projects.regions.clusters/create
    
    const correctApiRequest = {
      projectId: 'prj-grp-data-sci-prod-b425',
      clusterName: 'test-cluster',
      // Labels should be at the cluster level, not in config
      labels: dataprocConfig.labels,
      config: {
        // GCE cluster config with service account
        gceClusterConfig: {
          serviceAccount: dataprocConfig.config?.gceClusterConfig?.serviceAccount,
          serviceAccountScopes: dataprocConfig.config?.gceClusterConfig?.serviceAccountScopes,
          subnetworkUri: dataprocConfig.config?.gceClusterConfig?.subnetworkUri,
          zoneUri: dataprocConfig.config?.gceClusterConfig?.zoneUri,
          internalIpOnly: dataprocConfig.config?.gceClusterConfig?.internalIpOnly,
          tags: dataprocConfig.config?.gceClusterConfig?.tags,
          metadata: dataprocConfig.config?.gceClusterConfig?.metadata
        },
        // Other config sections
        masterConfig: dataprocConfig.config?.masterConfig,
        workerConfig: dataprocConfig.config?.workerConfig,
        softwareConfig: dataprocConfig.config?.softwareConfig,
        initializationActions: dataprocConfig.config?.initializationActions,
        lifecycleConfig: dataprocConfig.config?.lifecycleConfig,
        autoscalingConfig: dataprocConfig.config?.autoscalingConfig,
        metastoreConfig: dataprocConfig.config?.metastoreConfig,
        endpointConfig: dataprocConfig.config?.endpointConfig
      }
    };
    
    console.log('\n2. Correct API structure:');
    console.log('   Labels at top level:', JSON.stringify(correctApiRequest.labels, null, 2));
    console.log('   Service Account in config:', correctApiRequest.config?.gceClusterConfig?.serviceAccount);
    console.log('   Subnetwork in config:', correctApiRequest.config?.gceClusterConfig?.subnetworkUri);
    
    // Verify all required fields are present
    console.log('\n3. Verification:');
    
    if (correctApiRequest.labels) {
      console.log('   ✅ Labels present at cluster level');
    } else {
      console.log('   ❌ Labels missing');
    }
    
    if (correctApiRequest.config?.gceClusterConfig?.serviceAccount) {
      console.log('   ✅ Service account present in gceClusterConfig');
      console.log('      Value:', correctApiRequest.config.gceClusterConfig.serviceAccount);
    } else {
      console.log('   ❌ Service account missing');
    }
    
    if (correctApiRequest.config?.gceClusterConfig?.subnetworkUri) {
      console.log('   ✅ Subnetwork present in gceClusterConfig');
    } else {
      console.log('   ❌ Subnetwork missing');
    }
    
    // Check if this is different from what we're currently sending
    console.log('\n4. Comparison with current implementation:');
    
    // Current implementation puts labels in config
    const currentImplementation = {
      projectId: 'prj-grp-data-sci-prod-b425',
      clusterName: 'test-cluster',
      config: {
        ...dataprocConfig.config,
        labels: dataprocConfig.labels  // This is wrong!
      }
    };
    
    console.log('   Current (wrong): Labels in config.labels');
    console.log('   Correct: Labels at top level');
    
    if (JSON.stringify(correctApiRequest.labels) === JSON.stringify(currentImplementation.config.labels)) {
      console.log('   🔍 Same labels, but in wrong location!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testCorrectApiStructure();