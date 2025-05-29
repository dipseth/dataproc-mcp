#!/usr/bin/env node

/**
 * Debug the exact cluster manager flow
 */

import { ProfileManager } from './build/services/profile.js';
import { getDataprocConfigFromYaml } from './build/config/yaml.js';
import { getServerConfig } from './build/config/server.js';

async function debugClusterManager() {
  console.log('=== Debug Cluster Manager Flow ===');
  
  try {
    // Set up environment like MCP server does
    process.env.LOG_LEVEL = 'debug';
    process.env.MCP_CONFIG = JSON.stringify({
      profileManager: {
        rootConfigPath: './profiles'
      }
    });
    
    // Initialize like MCP server does
    const serverConfig = await getServerConfig();
    console.log('1. Server config:', JSON.stringify(serverConfig.profileManager, null, 2));
    
    const profileManager = new ProfileManager(serverConfig.profileManager);
    await profileManager.initialize();
    
    // Get the profile like cluster manager does
    const profileId = 'production/pricing-promotions';
    const profile = profileManager.getProfile(profileId);
    
    if (!profile) {
      console.error('❌ Profile not found!');
      return;
    }
    
    console.log('2. Profile found:', profile.path);
    
    // Read the profile YAML like cluster manager does
    const { clusterName, config, labels } = await getDataprocConfigFromYaml(profile.path);
    
    console.log('3. Extracted from YAML:');
    console.log('   - Cluster name:', clusterName);
    console.log('   - Labels:', JSON.stringify(labels, null, 2));
    console.log('   - Service account:', config?.gceClusterConfig?.serviceAccount);
    
    // Apply overrides like cluster manager does
    const finalClusterName = 'test-debug-cluster';
    const finalConfig = { ...config };
    
    // Add labels to config like our fix does
    if (labels) {
      finalConfig.labels = labels;
      console.log('4. ✅ Labels added to finalConfig');
    } else {
      console.log('4. ❌ No labels to add');
    }
    
    // Simulate what createCluster would receive
    console.log('5. Final config passed to createCluster:');
    console.log('   - Service account:', finalConfig?.gceClusterConfig?.serviceAccount);
    console.log('   - Labels in config:', JSON.stringify(finalConfig.labels, null, 2));
    
    // Simulate createClusterWithRest request body
    const projectId = 'prj-grp-data-sci-prod-b425';
    const requestBody = {
      projectId,
      clusterName: finalClusterName,
      config: finalConfig
    };
    
    // Add labels at top level like our fix does
    if (finalConfig.labels) {
      requestBody.labels = finalConfig.labels;
      console.log('6. ✅ Labels added to request body');
    } else {
      console.log('6. ❌ No labels in finalConfig to add to request body');
    }
    
    console.log('7. Final API request would be:');
    console.log('   - Service account:', requestBody.config?.gceClusterConfig?.serviceAccount);
    console.log('   - Subnetwork:', requestBody.config?.gceClusterConfig?.subnetworkUri);
    console.log('   - Labels:', JSON.stringify(requestBody.labels, null, 2));
    
    // Check if this matches what we expect
    const expectedServiceAccount = 'loc-sa-pricing-promo-dataproc@prj-grp-data-sci-prod-b425.iam.gserviceaccount.com';
    if (requestBody.config?.gceClusterConfig?.serviceAccount === expectedServiceAccount) {
      console.log('✅ SUCCESS: Service account is correct!');
    } else {
      console.log('❌ FAILURE: Service account is wrong!');
      console.log('   Expected:', expectedServiceAccount);
      console.log('   Got:', requestBody.config?.gceClusterConfig?.serviceAccount);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugClusterManager();