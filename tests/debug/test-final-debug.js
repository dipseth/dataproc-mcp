#!/usr/bin/env node

/**
 * Final debug test to see exactly what's happening
 */

import { ProfileManager } from './build/services/profile.js';
import { getDataprocConfigFromYaml } from './build/config/yaml.js';
import { getServerConfig } from './build/config/server.js';

async function finalDebugTest() {
  console.log('=== FINAL DEBUG TEST ===');
  
  try {
    // Set up environment exactly like MCP server
    process.env.LOG_LEVEL = 'debug';
    process.env.MCP_CONFIG = JSON.stringify({
      profileManager: {
        rootConfigPath: './profiles'
      }
    });
    
    console.log('1. Environment setup complete');
    
    // Initialize exactly like MCP server
    const serverConfig = await getServerConfig();
    const profileManager = new ProfileManager(serverConfig.profileManager);
    await profileManager.initialize();
    
    console.log('2. ProfileManager initialized');
    
    // Get profile exactly like cluster manager does
    const profileId = 'production/pricing-promotions';
    const profile = profileManager.getProfile(profileId);
    
    if (!profile) {
      console.error('❌ Profile not found!');
      return;
    }
    
    console.log('3. Profile found:', profile.path);
    
    // Read YAML exactly like cluster manager does
    const { clusterName, config, labels } = await getDataprocConfigFromYaml(profile.path);
    
    console.log('4. YAML loaded:');
    console.log('   - Cluster name:', clusterName);
    console.log('   - Service account:', config?.gceClusterConfig?.serviceAccount);
    console.log('   - Labels:', JSON.stringify(labels, null, 2));
    
    // Apply cluster manager logic
    const finalClusterName = 'debug-test-cluster';
    const finalConfig = { ...config };
    
    // Add labels to config like cluster manager does
    if (labels) {
      finalConfig.labels = labels;
      console.log('5. ✅ Labels added to finalConfig');
    }
    
    // Simulate createClusterWithRest logic
    const projectId = 'prj-grp-data-sci-prod-b425';
    const clusterConfig = finalConfig;
    
    // This is the exact logic from createClusterWithRest
    const requestBody = {
      projectId,
      clusterName: finalClusterName,
      config: clusterConfig
    };
    
    // Add labels at the top level if they exist (our fix)
    if (clusterConfig.labels) {
      requestBody.labels = clusterConfig.labels;
      // Remove labels from config since they should be at cluster level
      delete clusterConfig.labels;
      console.log('6. ✅ Labels moved to top level and removed from config');
    } else {
      console.log('6. ❌ No labels found in clusterConfig');
    }
    
    console.log('\n=== FINAL API REQUEST BODY ===');
    console.log('Project ID:', requestBody.projectId);
    console.log('Cluster Name:', requestBody.clusterName);
    console.log('Labels (top level):', JSON.stringify(requestBody.labels, null, 2));
    console.log('Service Account:', requestBody.config?.gceClusterConfig?.serviceAccount);
    console.log('Subnetwork:', requestBody.config?.gceClusterConfig?.subnetworkUri);
    console.log('Internal IP Only:', requestBody.config?.gceClusterConfig?.internalIpOnly);
    
    // Verify the critical fields
    console.log('\n=== VERIFICATION ===');
    
    const expectedServiceAccount = 'loc-sa-pricing-promo-dataproc@prj-grp-data-sci-prod-b425.iam.gserviceaccount.com';
    const actualServiceAccount = requestBody.config?.gceClusterConfig?.serviceAccount;
    
    if (actualServiceAccount === expectedServiceAccount) {
      console.log('✅ SERVICE ACCOUNT: Correct!');
      console.log('   Expected:', expectedServiceAccount);
      console.log('   Actual:  ', actualServiceAccount);
    } else {
      console.log('❌ SERVICE ACCOUNT: WRONG!');
      console.log('   Expected:', expectedServiceAccount);
      console.log('   Actual:  ', actualServiceAccount);
    }
    
    if (requestBody.labels && Object.keys(requestBody.labels).length > 0) {
      console.log('✅ LABELS: Present at top level');
    } else {
      console.log('❌ LABELS: Missing or empty');
    }
    
    const expectedSubnetwork = 'projects/prj-grp-shared-vpc-prod-2511/regions/us-central1/subnetworks/sub-vpc-prod-sharedvpc01-us-central1-private';
    const actualSubnetwork = requestBody.config?.gceClusterConfig?.subnetworkUri;
    
    if (actualSubnetwork === expectedSubnetwork) {
      console.log('✅ SUBNETWORK: Correct!');
    } else {
      console.log('❌ SUBNETWORK: Wrong or missing');
      console.log('   Expected:', expectedSubnetwork);
      console.log('   Actual:  ', actualSubnetwork);
    }
    
    // Show the complete request structure
    console.log('\n=== COMPLETE REQUEST STRUCTURE ===');
    console.log(JSON.stringify(requestBody, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

finalDebugTest();