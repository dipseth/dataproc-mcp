#!/usr/bin/env node

/**
 * Simple test to check profile loading
 */

import fs from 'fs';
import { readYamlConfig, convertYamlToDataprocConfig } from './build/config/yaml.js';

async function testProfile() {
  console.log('Testing profile loading...');
  
  try {
    // Test if profile file exists
    const profilePath = './profiles/production/pricing-promotions.yaml';
    if (!fs.existsSync(profilePath)) {
      console.log('❌ Profile file not found at:', profilePath);
      return;
    }
    
    console.log('✅ Profile file found at:', profilePath);
    
    // Read and parse YAML
    const yamlConfig = await readYamlConfig(profilePath);
    console.log('✅ YAML parsed successfully');
    
    // Convert to Dataproc config
    const dataprocConfig = convertYamlToDataprocConfig(yamlConfig, profilePath);
    console.log('✅ Converted to Dataproc config');
    
    // Check service account
    if (dataprocConfig.config?.gceClusterConfig?.serviceAccount) {
      console.log('✅ Service account found:', dataprocConfig.config.gceClusterConfig.serviceAccount);
    } else {
      console.log('❌ Service account NOT found');
      console.log('Available config keys:', Object.keys(dataprocConfig.config || {}));
      if (dataprocConfig.config?.gceClusterConfig) {
        console.log('gceClusterConfig keys:', Object.keys(dataprocConfig.config.gceClusterConfig));
      }
    }
    
    // Check subnetwork
    if (dataprocConfig.config?.gceClusterConfig?.subnetworkUri) {
      console.log('✅ Subnetwork found:', dataprocConfig.config.gceClusterConfig.subnetworkUri);
    } else {
      console.log('❌ Subnetwork NOT found');
    }
    
    console.log('\nFull config structure:');
    console.log(JSON.stringify(dataprocConfig, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProfile();