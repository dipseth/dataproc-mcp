#!/usr/bin/env node

/**
 * Test to simulate the actual API request structure
 */

import { readYamlConfig, convertYamlToDataprocConfig } from './build/config/yaml.js';

async function testApiRequest() {
  console.log('Testing API request structure...');
  
  try {
    // Load the profile configuration
    const profilePath = './profiles/production/pricing-promotions.yaml';
    const yamlConfig = await readYamlConfig(profilePath);
    const dataprocConfig = convertYamlToDataprocConfig(yamlConfig, profilePath);
    
    // Simulate the request body that would be sent to Dataproc API
    const projectId = 'prj-grp-data-sci-prod-b425';
    const clusterName = 'location-data-inspection';
    const clusterConfig = dataprocConfig.config;
    
    // This is what createClusterWithRest would send
    const requestBody = {
      projectId,
      clusterName,
      config: clusterConfig,
      // Ensure labels are at the top level if they exist
      ...(clusterConfig.labels && { labels: clusterConfig.labels })
    };
    
    console.log('=== API Request Body ===');
    console.log(JSON.stringify(requestBody, null, 2));
    
    console.log('\n=== Service Account Check ===');
    if (requestBody.config?.gceClusterConfig?.serviceAccount) {
      console.log('✅ Service account in request:', requestBody.config.gceClusterConfig.serviceAccount);
    } else {
      console.log('❌ Service account missing from request');
    }
    
    console.log('\n=== Subnetwork Check ===');
    if (requestBody.config?.gceClusterConfig?.subnetworkUri) {
      console.log('✅ Subnetwork in request:', requestBody.config.gceClusterConfig.subnetworkUri);
    } else {
      console.log('❌ Subnetwork missing from request');
    }
    
    console.log('\n=== Labels Check ===');
    if (dataprocConfig.labels) {
      console.log('✅ Labels from profile:', JSON.stringify(dataprocConfig.labels, null, 2));
      if (requestBody.labels) {
        console.log('✅ Labels in request body:', JSON.stringify(requestBody.labels, null, 2));
      } else {
        console.log('❌ Labels not added to request body');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testApiRequest();