---
layout: default
title: Home
---

# Dataproc MCP Server

[![npm version](https://badge.fury.io/js/%40dipseth%2Fdataproc-mcp-server.svg)](https://badge.fury.io/js/%40dipseth%2Fdataproc-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@dipseth/dataproc-mcp-server.svg)](https://npmjs.org/package/@dipseth/dataproc-mcp-server)
[![Build Status](https://github.com/dipseth/dataproc-mcp/workflows/%F0%9F%94%84%20Continuous%20Integration/badge.svg)](https://github.com/dipseth/dataproc-mcp/actions)
[![Coverage Status](https://coveralls.io/repos/github/dipseth/dataproc-mcp/badge.svg?branch=main)](https://coveralls.io/github/dipseth/dataproc-mcp?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@dipseth/dataproc-mcp-server.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)

A production-ready Model Context Protocol (MCP) server for Google Cloud Dataproc operations with intelligent parameter injection, enterprise-grade security, and comprehensive tooling. Designed for seamless integration with **Roo (VS Code)**.

## 🚀 Quick Start

### **Recommended: Roo (VS Code) Integration**

Add this to your Roo MCP settings:

```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### **With Custom Config File**

```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"],
      "env": {
        "LOG_LEVEL": "info",
        "DATAPROC_CONFIG_PATH": "/path/to/your/config.json"
      }
    }
  }
}
```

## 📋 Configuration

### Project-Based Configuration

The server supports a project-based configuration format:

```yaml
# profiles/@analytics-workloads.yaml
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
  cluster_config:
    # ... cluster configuration
```

### Authentication Methods

1. **Service Account Impersonation** (Recommended)
2. **Direct Service Account Key**
3. **Application Default Credentials**
4. **Hybrid Authentication** with fallbacks

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATAPROC_CONFIG_PATH` | Path to configuration file | `config/server.json` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key | - |
| `DATAPROC_PROJECT_ID` | Default GCP project ID | - |
| `DATAPROC_REGION` | Default Dataproc region | `us-central1` |

### Configuration File Structure

```json
{
  "projectId": "your-gcp-project",
  "region": "us-central1",
  "authentication": {
    "type": "service_account_impersonation",
    "serviceAccountEmail": "dataproc-service@project.iam.gserviceaccount.com",
    "impersonationChain": ["intermediate@project.iam.gserviceaccount.com"]
  },
  "defaultParameters": {
    "numWorkers": 2,
    "machineType": "n1-standard-4",
    "diskSize": 100
  },
  "profiles": {
    "development": {
      "numWorkers": 2,
      "machineType": "n1-standard-2"
    },
    "production": {
      "numWorkers": 10,
      "machineType": "n1-standard-8"
    }
  }
}
```

## 🔧 MCP Client Integration

### Claude Desktop

```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dataproc/mcp-server"],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Roo (VS Code)

```json
{
  "mcpServers": {
    "dataproc-server": {
      "command": "npx",
      "args": ["@dataproc/mcp-server"],
      "env": {
        "LOG_LEVEL": "info",
        "DATAPROC_CONFIG_PATH": "./config/server.json"
      }
    }
  }
}
```

## 📚 Documentation

- **[Quick Start Guide](QUICK_START)** - Get started in 5 minutes
- **[API Reference](api/)** - Complete tool documentation
- **[Configuration Examples](CONFIGURATION_EXAMPLES)** - Real-world configurations
- **[Security Guide](security/)** - Best practices and compliance
- **[Installation Guide](INSTALLATION_GUIDE)** - Detailed setup instructions

## 🛠️ Key Features

- **🎯 60-80% Parameter Reduction** - Intelligent default injection
- **🔐 Enterprise Security** - Service account impersonation, credential management
- **📊 Multi-Environment Support** - Dev/staging/production configurations
- **⚡ Async Query Tracking** - Real-time job monitoring and results
- **🔄 Auto-Cleanup** - Intelligent resource management
- **📈 Performance Monitoring** - Built-in metrics and health checks

## 🤝 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/dipseth/dataproc-mcp/issues)
- **Documentation**: [Complete documentation](https://dipseth.github.io/dataproc-mcp/)
- **NPM Package**: [Package information](https://www.npmjs.com/package/@dataproc/mcp-server)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/dipseth/dataproc-mcp/blob/main/LICENSE) file for details.

---

Built with ❤️ for the [Model Context Protocol](https://modelcontextprotocol.io/) ecosystem.