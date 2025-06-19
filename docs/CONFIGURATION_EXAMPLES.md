---
layout: default
title: Configuration Examples
description: Real-world configuration examples for different environments and use cases
permalink: /CONFIGURATION_EXAMPLES/
---

# 🔧 Configuration Examples

This guide provides real-world configuration examples for different environments and use cases.

## Multi-Environment Setup

### Development Environment

**File: `config/default-params.json`**
```json
{
  "defaultEnvironment": "development",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-west1"},
    {"name": "zone", "type": "string", "required": false, "defaultValue": "us-west1-a"}
  ],
  "environments": [
    {
      "environment": "development",
      "parameters": {
        "projectId": "my-company-dev-project",
        "region": "us-west1",
        "zone": "us-west1-a"
      }
    }
  ]
}
```

**File: `config/server.json`**
```json
{
  "authentication": {
    "impersonateServiceAccount": "dataproc-dev@my-company-dev-project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/secure/keys/dev-source-key.json",
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
    "maxRequestsPerMinute": 200,
    "enableInputValidation": true,
    "auditLogLevel": "debug"
  }
}
```

### Staging Environment

**File: `config/default-params.json`**
```json
{
  "defaultEnvironment": "staging",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"},
    {"name": "zone", "type": "string", "required": false, "defaultValue": "us-central1-b"}
  ],
  "environments": [
    {
      "environment": "staging",
      "parameters": {
        "projectId": "my-company-staging-project",
        "region": "us-central1",
        "zone": "us-central1-b"
      }
    }
  ]
}
```

**File: `config/server.json`**
```json
{
  "authentication": {
    "impersonateServiceAccount": "dataproc-staging@my-company-staging-project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/secure/keys/staging-source-key.json",
    "preferImpersonation": true,
    "useApplicationDefaultFallback": false
  },
  "profileManager": {
    "rootConfigPath": "./profiles",
    "scanInterval": 600000,
    "enableAutoReload": true
  },
  "security": {
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 150,
    "enableInputValidation": true,
    "auditLogLevel": "info"
  }
}
```

### Production Environment

**File: `config/default-params.json`**
```json
{
  "defaultEnvironment": "production",
  "parameters": [
    {"name": "projectId", "type": "string", "required": true},
    {"name": "region", "type": "string", "required": true, "defaultValue": "us-central1"},
    {"name": "zone", "type": "string", "required": false, "defaultValue": "us-central1-a"}
  ],
  "environments": [
    {
      "environment": "production",
      "parameters": {
        "projectId": "my-company-prod-project",
        "region": "us-central1",
        "zone": "us-central1-a"
      }
    }
  ]
}
```

**File: `config/server.json`**
```json
{
  "authentication": {
    "impersonateServiceAccount": "dataproc-prod@my-company-prod-project.iam.gserviceaccount.com",
    "fallbackKeyPath": "/secure/keys/prod-source-key.json",
    "preferImpersonation": true,
    "useApplicationDefaultFallback": false
  },
  "profileManager": {
    "rootConfigPath": "./profiles",
    "scanInterval": 900000,
    "enableAutoReload": false
  },
  "security": {
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 100,
    "enableInputValidation": true,
    "auditLogLevel": "warn"
  },
  "logging": {
    "level": "error",
    "enableConsole": false,
    "enableFile": true,
    "filePath": "/var/log/dataproc-mcp/server.log"
  }
}
```

## Authentication Scenarios

For detailed authentication scenarios and configurations, refer to the [Authentication Implementation Guide](AUTHENTICATION_IMPLEMENTATION_GUIDE.md).

## Custom Profiles

### Project-Based Configuration Structure

The Dataproc MCP Server supports a project-based configuration format where each project ID serves as the top-level key, followed by region, tags, labels, and cluster configuration. This structure allows for easy multi-project and multi-environment management.

**File: `profiles/@analytics-workloads.yaml`**
```yaml
# Project-based Dataproc cluster configurations
# Structure: project_id -> region/tags/labels -> cluster_config
# This format allows easy management of multiple projects and environments

# Production Environment - Analytics Project
my-company-analytics-prod-1a2b:
  region: us-central1
  tags:
    - DataProc
    - analytics-workloads
    - production
  labels:
    service: analytics-service
    owner: data-team
    pipeline: batch-processing
    environment: production
    cost-center: analytics
  cluster_config:
    gce_cluster_config:
      zone_uri: us-central1-f
      subnetwork_uri: projects/my-company-shared-vpc-prod-3c4d/regions/us-central1/subnetworks/subnet-prod-analytics-us-central1-private
      service_account_scopes:
        - https://www.googleapis.com/auth/cloud-platform
      service_account: analytics-dataproc@my-company-analytics-prod-1a2b.iam.gserviceaccount.com
      # Alternative service accounts for different use cases:
      # service_account: dataproc-compute@my-company-analytics-prod-1a2b.iam.gserviceaccount.com
      # service_account: shared-analytics-sa@my-company-shared-services-5e6f.iam.gserviceaccount.com
      internal_ip_only: true
      tags:
        - allow-iap-ssh
        - dataproc-vm
        - allow-google-apis
      metadata:
        artifact_urls: com/company/analytics/data-processor/v.2025.01.001-prod/data-processor-v.2025.01.001-prod.zip
        secret_name: tls-analytics-service
        key_store_file_name: analytics-service.jks
    initialization_actions:
      - executable_file: gs://my-company-prod-analytics-common/init/load-artifacts.sh
      - executable_file: gs://my-company-prod-analytics-common/init/load-certificates.sh
    lifecycle_config:
      idle_delete_ttl:
        seconds: 600  # 10 minutes idle timeout for cost optimization
    autoscaling_config:
      policy_uri: projects/my-company-analytics-prod-1a2b/regions/us-central1/autoscalingPolicies/analytics-autoscaling-policy
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
      # Optional components can be enabled as needed:
      # optional_components:
      #   - ZEPPELIN
      properties:
        dataproc:dataproc.logging.stackdriver.job.driver.enable: "false"
        dataproc:dataproc.logging.stackdriver.enable: "false"
        dataproc:jobs.file-backed-output.enable: "true"
        dataproc:dataproc.logging.stackdriver.job.yarn.container.enable: "true"
        hive:hive.server2.materializedviews.cache.at.startup: "false"
      image_version: 2.1.1-debian10
    metastore_config:
      dataproc_metastore_service: projects/my-company-datalake-prod-7g8h/locations/us-central1/services/analytics-metastore-prod
    endpoint_config:
      enable_http_port_access: true

# Staging Environment - Analytics Project
my-company-analytics-staging-9i0j:
  region: us-central1
  tags:
    - DataProc
    - analytics-workloads
    - staging
  labels:
    service: analytics-service
    owner: data-team
    pipeline: batch-processing
    environment: staging
    cost-center: analytics
  cluster_config:
    gce_cluster_config:
      zone_uri: us-central1-f
      service_account_scopes:
        - https://www.googleapis.com/auth/cloud-platform
      subnetwork_uri: projects/my-company-shared-vpc-staging-2k3l/regions/us-central1/subnetworks/subnet-staging-analytics-us-central1-private
      service_account: analytics-dataproc@my-company-analytics-staging-9i0j.iam.gserviceaccount.com
      internal_ip_only: true
      tags:
        - allow-iap-ssh
        - dataproc-vm
        - allow-google-apis
      metadata:
        artifact_urls: com/company/analytics/data-processor/v.2025.01.001-staging/data-processor-v.2025.01.001-staging.zip
        secret_name: tls-analytics-service
        key_store_file_name: analytics-service.jks
    initialization_actions:
      - executable_file: gs://my-company-staging-analytics-common/init/load-artifacts.sh
      - executable_file: gs://my-company-staging-analytics-common/init/load-certificates.sh
    lifecycle_config:
      idle_delete_ttl:
        seconds: 600  # 10 minutes idle timeout
    master_config:
      num_instances: 1
      machine_type_uri: n1-standard-8
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 512
    worker_config:
      num_instances: 2  # Smaller cluster for staging
      machine_type_uri: n1-standard-8
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 512
    software_config:
      properties:
        dataproc:dataproc.logging.stackdriver.job.driver.enable: "true"
        dataproc:dataproc.logging.stackdriver.enable: "true"
        dataproc:jobs.file-backed-output.enable: "true"
        dataproc:dataproc.logging.stackdriver.job.yarn.container.enable: "true"
        hive:hive.server2.materializedviews.cache.at.startup: "false"
      image_version: 2.1.1-debian10
    metastore_config:
      dataproc_metastore_service: projects/my-company-datalake-staging-4m5n/locations/us-central1/services/analytics-metastore-staging
    endpoint_config:
      enable_http_port_access: true

# Development Environment - Smaller, cost-optimized configuration
my-company-analytics-dev-6o7p:
  region: us-west1
  tags:
    - DataProc
    - analytics-workloads
    - development
  labels:
    service: analytics-service
    owner: data-team
    pipeline: development
    environment: dev
    cost-center: analytics
  cluster_config:
    gce_cluster_config:
      zone_uri: us-west1-a
      subnetwork_uri: projects/my-company-shared-vpc-dev-8q9r/regions/us-west1/subnetworks/subnet-dev-analytics-us-west1-private
      service_account_scopes:
        - https://www.googleapis.com/auth/cloud-platform
      service_account: analytics-dataproc@my-company-analytics-dev-6o7p.iam.gserviceaccount.com
      internal_ip_only: true
      tags:
        - allow-iap-ssh
        - dataproc-vm
        - allow-google-apis
      metadata:
        artifact_urls: com/company/analytics/data-processor/v.2025.01.001-dev/data-processor-v.2025.01.001-dev.zip
        secret_name: tls-analytics-service-dev
        key_store_file_name: analytics-service-dev.jks
    initialization_actions:
      - executable_file: gs://my-company-dev-analytics-common/init/load-artifacts.sh
      - executable_file: gs://my-company-dev-analytics-common/init/load-certificates.sh
    lifecycle_config:
      idle_delete_ttl:
        seconds: 300  # 5 minutes idle timeout for dev
    master_config:
      num_instances: 1
      machine_type_uri: n1-standard-4  # Smaller for dev
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 256
    worker_config:
      num_instances: 2  # Minimal workers for dev
      machine_type_uri: n1-standard-4
      disk_config:
        boot_disk_type: pd-standard
        boot_disk_size_gb: 256
      is_preemptible: true  # Use preemptible for cost savings
    software_config:
      optional_components:
        - JUPYTER  # Enable Jupyter for development
      properties:
        dataproc:dataproc.logging.stackdriver.job.driver.enable: "true"
        dataproc:dataproc.logging.stackdriver.enable: "true"
        dataproc:jobs.file-backed-output.enable: "true"
        dataproc:dataproc.logging.stackdriver.job.yarn.container.enable: "true"
        hive:hive.server2.materializedviews.cache.at.startup: "false"
        dataproc:dataproc.allow.zero.workers: "true"  # Allow zero workers for cost optimization
      image_version: 2.1.1-debian10
    metastore_config:
      dataproc_metastore_service: projects/my-company-datalake-dev-0s1t/locations/us-west1/services/analytics-metastore-dev
    endpoint_config:
      enable_http_port_access: true
```

### Configuration Structure Explanation

This project-based configuration format provides several key benefits:

#### 🏗️ **Top-Level Project Structure**
```yaml
project-id:           # Google Cloud Project ID as the primary key
  region: us-central1 # Default region for the project
  tags: []           # Project-level tags for organization
  labels: {}         # Project-level labels for billing and management
  cluster_config: {} # Dataproc cluster configuration
```

#### 🏷️ **Tags and Labels**
- **Tags**: Used for network firewall rules and resource organization
- **Labels**: Used for billing, cost allocation, and resource management
- **Service/Owner**: Identifies the service and team responsible
- **Pipeline**: Indicates the data pipeline or workflow type

#### 🔧 **Cluster Configuration Hierarchy**
1. **GCE Cluster Config**: Network, security, and compute settings
2. **Initialization Actions**: Custom setup scripts and configurations
3. **Lifecycle Config**: Auto-deletion and idle timeout settings
4. **Master/Worker Config**: Node specifications and disk configurations
5. **Software Config**: Dataproc image version and component properties
6. **Metastore Config**: Shared Hive metastore service integration
7. **Endpoint Config**: Web UI and port access settings

#### 🌍 **Multi-Environment Support**
- **Production**: Full-scale clusters with enhanced monitoring
- **Staging**: Mid-scale clusters for pre-production testing
- **Development**: Cost-optimized clusters with preemptible instances

#### 🔐 **Security Features**
- **Service Accounts**: Dedicated service accounts per environment
- **Network Isolation**: Private subnets and internal IP only
- **IAP SSH**: Identity-Aware Proxy for secure SSH access
- **Custom Metadata**: Artifact URLs and certificate management

This structure allows the MCP server to automatically inject the correct project ID, region, and other parameters based on the profile selection, significantly reducing the need for manual parameter specification.

### Data Science Workload

**File: `profiles/data-science/jupyter-cluster.yaml`**
```yaml
cluster_name: "jupyter-analysis-cluster"
cluster_config:
  master_config:
    num_instances: 1
    machine_type_uri: "n1-highmem-4"
    disk_config:
      boot_disk_type: "pd-ssd"
      boot_disk_size_gb: 100
  worker_config:
    num_instances: 4
    machine_type_uri: "n1-highmem-8"
    disk_config:
      boot_disk_type: "pd-ssd"
      boot_disk_size_gb: 100
      num_local_ssds: 1
  software_config:
    image_version: "2.0-debian10"
    optional_components:
      - JUPYTER
      - ZEPPELIN
    properties:
      "dataproc:dataproc.allow.zero.workers": "false"
      "spark:spark.sql.adaptive.enabled": "true"
      "spark:spark.sql.adaptive.coalescePartitions.enabled": "true"
  initialization_actions:
    - executable_file: "gs://my-bucket/scripts/install-python-packages.sh"
      execution_timeout: "300s"
```

### ETL Pipeline Cluster

**File: `profiles/etl/production-pipeline.yaml`**
```yaml
cluster_name: "etl-production-cluster"
cluster_config:
  master_config:
    num_instances: 1
    machine_type_uri: "n1-standard-4"
    disk_config:
      boot_disk_type: "pd-standard"
      boot_disk_size_gb: 50
  worker_config:
    num_instances: 10
    machine_type_uri: "n1-standard-8"
    disk_config:
      boot_disk_type: "pd-standard"
      boot_disk_size_gb: 100
    is_preemptible: false
  secondary_worker_config:
    num_instances: 20
    machine_type_uri: "n1-standard-4"
    disk_config:
      boot_disk_type: "pd-standard"
      boot_disk_size_gb: 50
    is_preemptible: true
  software_config:
    image_version: "2.0-debian10"
    properties:
      "dataproc:dataproc.allow.zero.workers": "false"
      "spark:spark.sql.execution.arrow.pyspark.enabled": "true"
      "spark:spark.serializer": "org.apache.spark.serializer.KryoSerializer"
  gce_cluster_config:
    zone_uri: "us-central1-a"
    network_uri: "projects/my-project/global/networks/dataproc-network"
    subnetwork_uri: "projects/my-project/regions/us-central1/subnetworks/dataproc-subnet"
    internal_ip_only: true
    service_account: "etl-dataproc@my-project.iam.gserviceaccount.com"
    service_account_scopes:
      - "https://www.googleapis.com/auth/cloud-platform"
```

### Cost-Optimized Development

**File: `profiles/development/cost-optimized.yaml`**
```yaml
cluster_name: "dev-cost-optimized"
cluster_config:
  master_config:
    num_instances: 1
    machine_type_uri: "e2-medium"
    disk_config:
      boot_disk_type: "pd-standard"
      boot_disk_size_gb: 30
  worker_config:
    num_instances: 2
    machine_type_uri: "e2-standard-2"
    disk_config:
      boot_disk_type: "pd-standard"
      boot_disk_size_gb: 30
    is_preemptible: true
  software_config:
    image_version: "2.0-debian10"
    properties:
      "dataproc:dataproc.allow.zero.workers": "true"
      "dataproc:dataproc.scheduler.max-idle-time": "10m"
  lifecycle_config:
    idle_delete_ttl: "600s"
    auto_delete_time: "2023-12-31T23:59:59Z"
```

## MCP Client Integration

### Claude Desktop Configuration

**File: `~/Library/Application Support/Claude/claude_desktop_config.json`**
```json
{
  "mcpServers": {
    "dataproc-dev": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server@latest"],
      "env": {
        "LOG_LEVEL": "error",
        "DATAPROC_CONFIG_PATH": "/path/to/dev-profiles/server.json"
      }
    },
    "dataproc-prod": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server@latest"],
      "env": {
        "LOG_LEVEL": "warn",
        "DATAPROC_CONFIG_PATH": "/path/to/prod-profiles/server.json"
      }
    }
  }
}
```

### Roo Configuration

**File: `.roo/mcp.json`**
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server@latest"],
      "env": {
        "LOG_LEVEL": "info",
        "DATAPROC_CONFIG_PATH": "/path/to/your/config/server.json"
      },
      "alwaysAllow": []
    }
  }
}
```

### Custom MCP Client

**Example integration code:**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/dataproc-mcp/build/index.js'],
  env: {
    LOG_LEVEL: 'error'
  }
});

const client = new Client({
  name: "dataproc-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Create a cluster
const result = await client.callTool({
  name: "start_dataproc_cluster",
  arguments: {
    clusterName: "my-analysis-cluster"
  }
});
```

## Network Configuration

### Private Cluster Setup

```yaml
cluster_config:
  gce_cluster_config:
    zone_uri: "us-central1-a"
    network_uri: "projects/my-project/global/networks/private-network"
    subnetwork_uri: "projects/my-project/regions/us-central1/subnetworks/private-subnet"
    internal_ip_only: true
    enable_ip_alias: true
    private_ipv6_google_access: "PRIVATE_IPV6_GOOGLE_ACCESS_TO_GOOGLE"
  endpoint_config:
    enable_http_port_access: false
```

### Firewall Rules

```bash
# Allow internal communication
gcloud compute firewall-rules create dataproc-internal \
  --network private-network \
  --allow tcp:0-65535,udp:0-65535,icmp \
  --source-ranges 10.0.0.0/8

# Allow SSH access
gcloud compute firewall-rules create dataproc-ssh \
  --network private-network \
  --allow tcp:22 \
  --source-ranges 35.235.240.0/20

# Allow health checks
gcloud compute firewall-rules create dataproc-health-checks \
  --network private-network \
  --allow tcp:8080,tcp:8088,tcp:9870 \
  --source-ranges 130.211.0.0/22,35.191.0.0/16
```

## Monitoring and Logging

### Stackdriver Integration

```json
{
  "logging": {
    "level": "info",
    "enableConsole": true,
    "enableFile": true,
    "filePath": "/var/log/dataproc-mcp/server.log",
    "enableStackdriver": true,
    "stackdriverConfig": {
      "projectId": "my-monitoring-project",
      "logName": "dataproc-mcp-server",
      "resource": {
        "type": "gce_instance",
        "labels": {
          "instance_id": "auto-detect",
          "zone": "auto-detect"
        }
      }
    }
  }
}
```

### Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'dataproc-mcp'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

## Security Configurations

### High Security Environment

```json
{
  "security": {
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 50,
    "enableInputValidation": true,
    "sanitizeCredentials": true,
    "enableThreatDetection": true,
    "auditLogLevel": "info",
    "secureHeaders": {
      "enabled": true,
      "customHeaders": {
        "X-Custom-Security": "enabled"
      }
    },
    "allowedOrigins": [
      "https://claude.ai",
      "https://localhost:3000"
    ],
    "requireAuthentication": true,
    "sessionTimeout": 3600
  }
}
```

### Development Environment

```json
{
  "security": {
    "enableRateLimiting": false,
    "enableInputValidation": true,
    "sanitizeCredentials": true,
    "enableThreatDetection": false,
    "auditLogLevel": "debug",
    "allowedOrigins": ["*"],
    "requireAuthentication": false
  }
}
```

## Performance Tuning

### High-Throughput Configuration

```json
{
  "performance": {
    "maxConcurrentRequests": 100,
    "requestTimeout": 300000,
    "keepAliveTimeout": 65000,
    "headersTimeout": 66000,
    "maxHeaderSize": 16384,
    "enableCompression": true,
    "compressionLevel": 6
  },
  "caching": {
    "enableResponseCache": true,
    "cacheTTL": 300,
    "maxCacheSize": "100MB"
  }
}
```

## Troubleshooting Configurations

### Debug Configuration

```json
{
  "logging": {
    "level": "debug",
    "enableConsole": true,
    "enableFile": true,
    "filePath": "./debug.log",
    "enableRequestLogging": true,
    "enableResponseLogging": true,
    "enableTimestamps": true,
    "enableStackTraces": true
  },
  "debug": {
    "enableProfiler": true,
    "enableMemoryMonitoring": true,
    "enablePerformanceMetrics": true,
    "dumpConfigOnStart": true
  }
}
```

This comprehensive configuration guide should help you set up the Dataproc MCP Server for any environment or use case.