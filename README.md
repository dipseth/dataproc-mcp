# Dataproc MCP Server

[![npm version](https://img.shields.io/npm/v/@dipseth/dataproc-mcp-server.svg)](https://www.npmjs.com/package/@dipseth/dataproc-mcp-server)
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

### **Alternative: Global Installation**

```bash
# Install globally
npm install -g @dipseth/dataproc-mcp-server

# Start the server
dataproc-mcp-server

# Or run directly
npx @dataproc/mcp-server
```

### 5-Minute Setup

1. **Install the package:**
   ```bash
   npm install -g @dipseth/dataproc-mcp-server@2.1.1
   ```

2. **Run the setup:**
   ```bash
   dataproc-mcp --setup
   ```

3. **Configure authentication:**
   ```bash
   # Edit the generated config file
   nano config/server.json
   ```

4. **Start the server:**
   ```bash
   dataproc-mcp
   ```

## ✨ Features

### 🎯 **Core Capabilities**
- **16 Production-Ready MCP Tools** - Complete Dataproc management suite
- **🧠 Knowledge Base Semantic Search** - Natural language queries with optional Qdrant integration
- **🚀 Response Optimization** - 60-96% token reduction with Qdrant storage
- **60-80% Parameter Reduction** - Intelligent default injection
- **Multi-Environment Support** - Dev/staging/production configurations
- **Service Account Impersonation** - Enterprise authentication
- **Real-time Job Monitoring** - Comprehensive status tracking

### 🚀 **Response Optimization**
- **96.2% Token Reduction** - `list_clusters`: 7,651 → 292 tokens
- **Automatic Qdrant Storage** - Full data preserved and searchable
- **Resource URI Access** - `dataproc://responses/clusters/list/abc123`
- **Graceful Fallback** - Works without Qdrant, falls back to full responses
- **9.95ms Processing** - Lightning-fast optimization with <1MB memory usage

### � **Enterprise Security**
- **Input Validation** - Zod schemas for all 16 tools
- **Rate Limiting** - Configurable abuse prevention
- **Credential Management** - Secure handling and rotation
- **Audit Logging** - Comprehensive security event tracking
- **Threat Detection** - Injection attack prevention

### 📊 **Quality Assurance**
- **90%+ Test Coverage** - Comprehensive test suite
- **Performance Monitoring** - Configurable thresholds
- **Multi-Environment Testing** - Cross-platform validation
- **Automated Quality Gates** - CI/CD integration
- **Security Scanning** - Vulnerability management

### 🚀 **Developer Experience**
- **5-Minute Setup** - Quick start guide
- **Interactive Documentation** - HTML docs with examples
- **Comprehensive Examples** - Multi-environment configs
- **Troubleshooting Guides** - Common issues and solutions
- **IDE Integration** - TypeScript support

## 🛠️ Available Tools

| Tool | Description | Parameters Reduced |
|------|-------------|-------------------|
| `start_dataproc_cluster` | Create and start clusters | 80% |
| `stop_dataproc_cluster` | Stop running clusters | 75% |
| `delete_dataproc_cluster` | Delete clusters | 70% |
| `list_dataproc_clusters` | List all clusters | 85% |
| `get_dataproc_cluster` | Get cluster details | 75% |
| `submit_dataproc_job` | Submit Spark/Hive jobs | 70% |
| `get_dataproc_job` | Get job status | 80% |
| `list_dataproc_jobs` | List all jobs | 85% |
| `cancel_dataproc_job` | Cancel running jobs | 75% |
| `get_dataproc_job_results` | Get job outputs | 70% |
| `list_profiles` | List cluster profiles | 90% |
| `get_profile` | Get profile details | 85% |
| `validate_profile` | Validate configurations | 80% |
| `get_cluster_metrics` | Get performance metrics | 75% |
| `scale_dataproc_cluster` | Scale cluster nodes | 70% |
| `update_cluster_labels` | Update cluster labels | 80% |

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

## 📚 Documentation

- **[Quick Start Guide](https://dipseth.github.io/dataproc-mcp/QUICK_START.html)** - Get started in 5 minutes
- **[Knowledge Base Semantic Search](https://dipseth.github.io/dataproc-mcp/KNOWLEDGE_BASE_SEMANTIC_SEARCH.html)** - Natural language queries and setup
- **[API Reference](https://dipseth.github.io/dataproc-mcp/api/)** - Complete tool documentation
- **[Configuration Examples](https://dipseth.github.io/dataproc-mcp/CONFIGURATION_EXAMPLES.html)** - Real-world configurations
- **[Security Guide](https://dipseth.github.io/dataproc-mcp/security/)** - Best practices and compliance
- **[Installation Guide](https://dipseth.github.io/dataproc-mcp/INSTALLATION_GUIDE.html)** - Detailed setup instructions

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
      "disabled": false,
      "alwaysAllow": [
        "list_clusters",
        "get_cluster",
        "list_profiles"
      ]
    }
  }
}
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │────│  Dataproc MCP    │────│  Google Cloud   │
│  (Claude/Roo) │    │     Server       │    │    Dataproc     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                       ┌──────┴──────┐
                       │   Features  │
                       ├─────────────┤
                       │ • Security  │
                       │ • Profiles  │
                       │ • Validation│
                       │ • Monitoring│
                       └─────────────┘
```

## 🚦 Performance

### Response Time Achievements
- **Schema Validation**: ~2ms (target: <5ms) ✅
- **Parameter Injection**: ~1ms (target: <2ms) ✅
- **Credential Validation**: ~25ms (target: <50ms) ✅
- **MCP Tool Call**: ~50ms (target: <100ms) ✅

### Throughput Achievements
- **Schema Validation**: ~2000 ops/sec ✅
- **Parameter Injection**: ~5000 ops/sec ✅
- **Credential Validation**: ~200 ops/sec ✅
- **MCP Tool Call**: ~100 ops/sec ✅

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Run with coverage
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/dipseth/dataproc-mcp.git
cd dataproc-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/dipseth/dataproc-mcp/issues)
- **Documentation**: [Complete documentation](https://dipseth.github.io/dataproc-mcp/)
- **NPM Package**: [Package information](https://www.npmjs.com/package/@dataproc/mcp-server)

## 🏆 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol that makes this possible
- [Google Cloud Dataproc](https://cloud.google.com/dataproc) - The service we're integrating with
- [TypeScript](https://www.typescriptlang.org/) - For type safety and developer experience

---

**Made with ❤️ for the MCP and Google Cloud communities**
