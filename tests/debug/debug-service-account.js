import { ProfileManager } from './build/services/profile.js';
import { ClusterManager } from './build/services/cluster-manager.js';
import { ClusterTracker } from './build/services/tracker.js';

async function debugServiceAccount() {
  try {
    console.log('=== Debug Service Account Configuration ===');
    
    // Initialize profile manager
    const profileManager = new ProfileManager({
      profilesDirectory: './profiles',
      scanInterval: 0
    });
    await profileManager.initialize();
    
    // Get the profile
    const profile = profileManager.getProfile('production/pricing-promotions');
    console.log('Profile found:', !!profile);
    
    if (profile) {
      console.log('Profile config keys:', Object.keys(profile.config || {}));
      console.log('Profile metadata:', profile.metadata);
      
      // Check if service account is in the config
      const config = profile.config;
      console.log('Config structure:');
      console.log('- cluster_config exists:', !!config.cluster_config);
      console.log('- gce_cluster_config exists:', !!config.cluster_config?.gce_cluster_config);
      console.log('- service_account:', config.cluster_config?.gce_cluster_config?.service_account);
      
      // Check the full config
      console.log('\nFull gce_cluster_config:');
      console.log(JSON.stringify(config.cluster_config?.gce_cluster_config, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugServiceAccount();