#!/usr/bin/env node

/**
 * Setup script for Dataproc MCP Server
 * This script helps users configure the server on first installation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createDirectories() {
  const dirs = [
    'config',
    'profiles',
    'state',
    'output'
  ];

  console.log('📁 Creating necessary directories...');
  
  for (const dir of dirs) {
    const dirPath = path.join(rootDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  ✅ Created ${dir}/`);
    } else {
      console.log(`  ℹ️  ${dir}/ already exists`);
    }
  }
}

async function createDefaultParams() {
  const configPath = path.join(rootDir, 'config', 'default-params.json');
  
  if (fs.existsSync(configPath)) {
    console.log('ℹ️  Default parameters configuration already exists');
    return;
  }

  console.log('\n🔧 Setting up default parameters...');
  
  const projectId = await question('Enter your GCP Project ID: ');
  const region = await question('Enter your preferred region (default: us-central1): ') || 'us-central1';
  const environment = await question('Enter your environment name (default: production): ') || 'production';

  const defaultParams = {
    defaultEnvironment: environment,
    parameters: [
      { name: "projectId", type: "string", required: true },
      { name: "region", type: "string", required: true, defaultValue: region }
    ],
    environments: [
      {
        environment: environment,
        parameters: {
          projectId: projectId,
          region: region
        }
      }
    ]
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultParams, null, 2));
  console.log(`✅ Created config/default-params.json`);
}

async function createServerConfig() {
  const configPath = path.join(rootDir, 'config', 'server.json');
  
  if (fs.existsSync(configPath)) {
    console.log('ℹ️  Server configuration already exists');
    return;
  }

  console.log('\n🔐 Setting up authentication...');
  
  const useImpersonation = await question('Do you want to use service account impersonation? (y/n): ');
  
  if (useImpersonation.toLowerCase() === 'y') {
    const serviceAccount = await question('Enter the service account email to impersonate: ');
    const keyPath = await question('Enter the path to your source service account key file: ');
    
    const serverConfig = {
      authentication: {
        impersonateServiceAccount: serviceAccount,
        fallbackKeyPath: keyPath,
        preferImpersonation: true,
        useApplicationDefaultFallback: false
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 2));
    console.log(`✅ Created config/server.json with impersonation setup`);
  } else {
    console.log('ℹ️  Skipping server configuration - you can create it manually later');
  }
}

async function createMCPTemplate() {
  const templatePath = path.join(rootDir, 'templates', 'mcp-settings.json.template');
  
  const mcpTemplate = {
    "dataproc-server": {
      "command": "node",
      "args": [
        "/path/to/dataproc-mcp-server/build/index.js"
      ],
      "disabled": false,
      "timeout": 60,
      "alwaysAllow": [
        "start_dataproc_cluster",
        "create_cluster_from_yaml",
        "create_cluster_from_profile",
        "list_clusters",
        "list_tracked_clusters",
        "list_profiles",
        "get_profile",
        "get_cluster",
        "submit_hive_query",
        "get_query_status",
        "get_query_results",
        "delete_cluster",
        "submit_dataproc_job",
        "get_job_status",
        "get_job_results",
        "get_zeppelin_url"
      ],
      "env": {
        "LOG_LEVEL": "error"
      }
    }
  };

  fs.writeFileSync(templatePath, JSON.stringify(mcpTemplate, null, 2));
  console.log(`✅ Created templates/mcp-settings.json.template`);
}

async function copyDefaultProfiles() {
  const profilesDir = path.join(rootDir, 'profiles');
  
  // Check if profiles already exist
  if (fs.existsSync(path.join(profilesDir, 'development')) || 
      fs.existsSync(path.join(profilesDir, 'production'))) {
    console.log('ℹ️  Default profiles already exist');
    return;
  }

  console.log('📋 Default profiles are already included in the profiles/ directory');
}

async function showNextSteps() {
  console.log('\n🎉 Setup complete! Next steps:');
  console.log('');
  console.log('1. Build the project:');
  console.log('   npm run build');
  console.log('');
  console.log('2. Test the configuration:');
  console.log('   npm run validate');
  console.log('');
  console.log('3. Add to your MCP client settings using the template:');
  console.log('   templates/mcp-settings.json.template');
  console.log('');
  console.log('4. Update the path in the template to point to your installation');
  console.log('');
  console.log('5. Test with MCP Inspector:');
  console.log('   npm run inspector');
  console.log('');
  console.log('📚 For more information, see:');
  console.log('   - README.md');
  console.log('   - docs/CONFIGURATION_GUIDE.md');
  console.log('   - PRODUCTION_READINESS_PLAN.md');
}

async function main() {
  console.log('🚀 Dataproc MCP Server Setup');
  console.log('=============================\n');

  try {
    await createDirectories();
    await createDefaultParams();
    await createServerConfig();
    await createMCPTemplate();
    await copyDefaultProfiles();
    await showNextSteps();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}