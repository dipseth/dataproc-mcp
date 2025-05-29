#!/usr/bin/env node

/**
 * Test to simulate the full cluster manager flow
 */

import { readYamlConfig, convertYamlToDataprocConfig } from './build/config/yaml.js';

async function testClusterManagerFlow() {
  console.log('Testing full cluster manager flow...');
  
  try {
    // Simulate what ClusterManager.createClusterFromProfile does
    const profilePath = './profiles/production/pricing-promotions.yaml';
    
    // Step 1: Read the profile YAML (like cluster manager does)
    const { clusterName, config, labels } = await convertYamlToDataprocConfig(
      await readYamlConfig(profilePath), 
      profilePath
    );
    
    console.log('=== Profile Data ===');
    console.log('Cluster name:', clusterName);
    console.log('Labels from profile:', JSON.stringify(labels, null, 2));
    
    // Step 2: Apply overrides (like cluster manager does)
    const finalClusterName = 'location-data-inspection'; // Override
    const finalConfig = { ...config };
    
    // Step 3: Add labels to config (like our fix does)
    if (labels) {
      finalConfig.labels = labels;
      console.log('✅ Labels added to finalConfig');
    } else {
      console.log('❌ No labels to add');
    }
    
    // Step 4: Simulate createCluster call
    const projectId = 'prj-grp-data-sci-prod-b425';
    const clusterConfig = finalConfig;
    
    // Step 5: Simulate createClusterWithRest request body preparation
    const requestBody = {
      projectId,
      clusterName: finalClusterName,
      config: clusterConfig
    };
    
    // Add labels at the top level if they exist (labels should be outside config)
    if (clusterConfig.labels) {
      requestBody.labels = clusterConfig.labels;
      console.log('✅ Labels added to request body');
    } else {
      console.log('❌ No labels in clusterConfig to add to request body');
    }
    
    console.log('\n=== Final Request Body ===');
    console.log('Service Account:', requestBody.config?.gceClusterConfig?.serviceAccount);
    console.log('Subnetwork:', requestBody.config?.gceClusterConfig?.subnetworkUri);
    console.log('Labels:', JSON.stringify(requestBody.labels, null, 2));
    
    // Show the structure that would be sent to API
    console.log('\n=== Request Structure Check ===');
    if (requestBody.config?.gceClusterConfig?.serviceAccount) {
      console.log('✅ Service account properly configured');
    } else {
      console.log('❌ Service account missing');
    }
    
    if (requestBody.labels) {
      console.log('✅ Labels properly configured');
    } else {
      console.log('❌ Labels missing');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testClusterManagerFlow();