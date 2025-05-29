#!/usr/bin/env node

/**
 * Debug script to test profile loading and configuration transformation
 */

import { ProfileManager } from './build/services/profile.js';
import { getDataprocConfigFromYaml } from './build/config/yaml.js';
import { getServerConfig } from './build/config/server.js';

async function debugProfileLoading() {
  console.log('=== Debug Profile Loading ===');
  
  try {
    // Set debug environment
    process.env.LOG_LEVEL = 'debug';
    process.env.MCP_CONFIG = JSON.stringify({
      profileManager: {
        rootConfigPath: './profiles'
      }
    });
    
    console.log('1. Loading server configuration...');
    const serverConfig = await getServerConfig();
    console.log('Server config:', JSON.stringify(serverConfig, null, 2));
    
    console.log('\n2. Initializing ProfileManager...');
    const profileManager = new ProfileManager(serverConfig.profileManager);
    await profileManager.initialize();
    
    console.log('\n3. Listing all profiles...');
    const profiles = profileManager.getAllProfiles();
    console.log('Found profiles:', profiles.map(p => ({ id: p.id, path: p.path })));
    
    console.log('\n4. Testing production/pricing-promotions profile...');
    const profile = profileManager.getProfile('production/pricing-promotions');
    if (!profile) {
      console.error('Profile not found!');
      return;
    }
    
    console.log('Profile details:', JSON.stringify(profile, null, 2));
    
    console.log('\n5. Loading YAML configuration...');
    const yamlConfig = await getDataprocConfigFromYaml(profile.path);
    console.log('YAML config:', JSON.stringify(yamlConfig, null, 2));
    
    console.log('\n6. Checking service account configuration...');
    if (yamlConfig.config?.gceClusterConfig?.serviceAccount) {
      console.log('✅ Service account found:', yamlConfig.config.gceClusterConfig.serviceAccount);
    } else {
      console.log('❌ Service account NOT found in configuration');
      console.log('Available gceClusterConfig keys:', Object.keys(yamlConfig.config?.gceClusterConfig || {}));
    }
    
    console.log('\n7. Checking subnetwork configuration...');
    if (yamlConfig.config?.gceClusterConfig?.subnetworkUri) {
      console.log('✅ Subnetwork found:', yamlConfig.config.gceClusterConfig.subnetworkUri);
    } else {
      console.log('❌ Subnetwork NOT found in configuration');
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugProfileLoading().catch(console.error);