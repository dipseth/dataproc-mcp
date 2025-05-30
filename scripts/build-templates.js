#!/usr/bin/env node

/**
 * Build configuration templates for distribution
 * Creates ready-to-use configuration templates
 */

const fs = require('fs');
const path = require('path');

function buildTemplates() {
  console.log('📋 Building configuration templates...');
  
  const templatesDir = path.join(__dirname, '..', 'templates');
  
  // Create templates directory
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  // Create server configuration template
  createServerConfigTemplate(templatesDir);
  
  // Create default parameters template
  createDefaultParamsTemplate(templatesDir);
  
  // Create profile template
  createProfileTemplate(templatesDir);
  
  // Create environment-specific templates
  createEnvironmentTemplates(templatesDir);
  
  // Create setup script template
  createSetupScriptTemplate(templatesDir);
  
  console.log('✅ Configuration templates created in templates/');
}

function createServerConfigTemplate(templatesDir) {
  const serverConfig = {
    "authentication": {
      "impersonateServiceAccount": "dataproc-worker@YOUR_PROJECT.iam.gserviceaccount.com",
      "fallbackKeyPath": "/path/to/source-service-account.json",
      "preferImpersonation": true,
      "useApplicationDefaultFallback": false
    },
    "profileManager": {
      "rootConfigPath": "./profiles",
      "scanInterval": 300000,
      "enableAutoReload": true
    },
    "security": {
      "enableRateLimiting": true,
      "maxRequestsPerMinute": 100,
      "enableInputValidation": true,
      "auditLogLevel": "info"
    },
    "logging": {
      "level": "info",
      "enableConsole": true,
      "enableFile": false,
      "filePath": "./logs/server.log"
    }
  };
  
  const templatePath = path.join(templatesDir, 'server.json.template');
  fs.writeFileSync(templatePath, JSON.stringify(serverConfig, null, 2));
  console.log('✅ Created server.json.template');
}

function createDefaultParamsTemplate(templatesDir) {
  const defaultParams = {
    "defaultEnvironment": "development",
    "parameters": [
      {"name": "projectId", "type": "string", "required": true},
      {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"},
      {"name": "zone", "type": "string", "required": false, "defaultValue": "us-central1-a"}
    ],
    "environments": [
      {
        "environment": "development",
        "parameters": {
          "projectId": "YOUR_DEV_PROJECT",
          "region": "us-west1",
          "zone": "us-west1-a"
        }
      },
      {
        "environment": "staging",
        "parameters": {
          "projectId": "YOUR_STAGING_PROJECT",
          "region": "us-central1",
          "zone": "us-central1-b"
        }
      },
      {
        "environment": "production",
        "parameters": {
          "projectId": "YOUR_PROD_PROJECT",
          "region": "us-central1",
          "zone": "us-central1-a"
        }
      }
    ]
  };
  
  const templatePath = path.join(templatesDir, 'default-params.json.template');
  fs.writeFileSync(templatePath, JSON.stringify(defaultParams, null, 2));
  console.log('✅ Created default-params.json.template');
}

function createProfileTemplate(templatesDir) {
  const profileTemplate = `# Example Dataproc Cluster Profile
# Copy this template and customize for your use case

# Production Analytics Cluster
my-company-analytics-prod-1234:
  region: us-central1
  tags:
    - DataProc
    - analytics
    - production
  labels:
    service: analytics-service
    owner: data-team
    environment: production
    cost-center: analytics
  cluster_config:
    gce_cluster_config:
      zone_uri: us-central1-f
      subnetwork_uri: projects/YOUR_SHARED_VPC_PROJECT/regions/us-central1/subnetworks/YOUR_SUBNET
      service_account_scopes:
        - https://www.googleapis.com/auth/cloud-platform
      service_account: analytics-dataproc@YOUR_PROJECT.iam.gserviceaccount.com
      internal_ip_only: true
      tags:
        - allow-iap-ssh
        - dataproc-vm
        - allow-google-apis
    lifecycle_config:
      idle_delete_ttl:
        seconds: 600  # 10 minutes
    master_config:
      num_instances: 1
      machine_type_uri: n1-standard-8
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 512
    worker_config:
      num_instances: 3
      machine_type_uri: n1-standard-8
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 512
    software_config:
      image_version: 1.5-debian10
      properties:
        dataproc:dataproc.logging.stackdriver.enable: "true"
        dataproc:jobs.file-backed-output.enable: "true"
    endpoint_config:
      enable_http_port_access: true

# Development Cluster (Cost-Optimized)
my-company-analytics-dev-5678:
  region: us-west1
  tags:
    - DataProc
    - analytics
    - development
  labels:
    service: analytics-service
    owner: data-team
    environment: dev
    cost-center: analytics
  cluster_config:
    gce_cluster_config:
      zone_uri: us-west1-a
      service_account: analytics-dataproc@YOUR_DEV_PROJECT.iam.gserviceaccount.com
      internal_ip_only: true
    lifecycle_config:
      idle_delete_ttl:
        seconds: 300  # 5 minutes for dev
    master_config:
      num_instances: 1
      machine_type_uri: n1-standard-4
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 256
    worker_config:
      num_instances: 2
      machine_type_uri: n1-standard-4
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 256
      is_preemptible: true  # Cost savings
    software_config:
      optional_components:
        - JUPYTER
      image_version: 1.5-debian10
      properties:
        dataproc:dataproc.allow.zero.workers: "true"
    endpoint_config:
      enable_http_port_access: true
`;
  
  const templatePath = path.join(templatesDir, 'cluster-profile.yaml.template');
  fs.writeFileSync(templatePath, profileTemplate);
  console.log('✅ Created cluster-profile.yaml.template');
}

function createEnvironmentTemplates(templatesDir) {
  const environments = ['development', 'staging', 'production'];
  
  environments.forEach(env => {
    const envConfig = {
      "environment": env,
      "authentication": {
        "impersonateServiceAccount": `dataproc-${env}@YOUR_${env.toUpperCase()}_PROJECT.iam.gserviceaccount.com`,
        "preferImpersonation": true
      },
      "security": {
        "enableRateLimiting": true,
        "maxRequestsPerMinute": env === 'production' ? 50 : env === 'staging' ? 100 : 200,
        "auditLogLevel": env === 'production' ? 'warn' : env === 'staging' ? 'info' : 'debug'
      },
      "logging": {
        "level": env === 'production' ? 'error' : env === 'staging' ? 'warn' : 'debug',
        "enableFile": env === 'production',
        "filePath": env === 'production' ? `/var/log/dataproc-mcp/${env}.log` : `./logs/${env}.log`
      }
    };
    
    const templatePath = path.join(templatesDir, `${env}.json.template`);
    fs.writeFileSync(templatePath, JSON.stringify(envConfig, null, 2));
    console.log(`✅ Created ${env}.json.template`);
  });
}

function createSetupScriptTemplate(templatesDir) {
  const setupScript = `#!/bin/bash

# Dataproc MCP Server Setup Script
# This script helps you configure the server for your environment

set -e

echo "🚀 Setting up Dataproc MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create necessary directories
mkdir -p config
mkdir -p profiles
mkdir -p logs

echo "📁 Created directories"

# Copy configuration templates
if [ -f "templates/server.json.template" ]; then
    if [ ! -f "config/server.json" ]; then
        cp templates/server.json.template config/server.json
        echo "📋 Created config/server.json from template"
    else
        echo "⚠️  config/server.json already exists, skipping"
    fi
fi

if [ -f "templates/default-params.json.template" ]; then
    if [ ! -f "config/default-params.json" ]; then
        cp templates/default-params.json.template config/default-params.json
        echo "📋 Created config/default-params.json from template"
    else
        echo "⚠️  config/default-params.json already exists, skipping"
    fi
fi

# Copy profile template
if [ -f "templates/cluster-profile.yaml.template" ]; then
    if [ ! -f "profiles/example-cluster.yaml" ]; then
        cp templates/cluster-profile.yaml.template profiles/example-cluster.yaml
        echo "📋 Created profiles/example-cluster.yaml from template"
    else
        echo "⚠️  profiles/example-cluster.yaml already exists, skipping"
    fi
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit config/server.json with your authentication settings"
echo "2. Edit config/default-params.json with your project details"
echo "3. Customize profiles/example-cluster.yaml for your clusters"
echo "4. Start the server: node build/index.js"
echo ""
echo "📚 Documentation: docs/QUICK_START.md"
echo "🔧 Configuration examples: docs/CONFIGURATION_EXAMPLES.md"
`;

  const templatePath = path.join(templatesDir, 'setup.sh.template');
  fs.writeFileSync(templatePath, setupScript);
  fs.chmodSync(templatePath, '755');
  console.log('✅ Created setup.sh.template');
}

if (require.main === module) {
  buildTemplates();
}

module.exports = { buildTemplates };