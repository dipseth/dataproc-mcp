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

## 🛠️ Complete MCP Tools Suite (21 Tools)

### 🚀 **Cluster Management (8 Tools)**
| Tool | Description | Smart Defaults | Key Features |
|------|-------------|----------------|--------------|
| `start_dataproc_cluster` | Create and start new clusters | ✅ 80% fewer params | Profile-based, auto-config |
| `create_cluster_from_yaml` | Create from YAML configuration | ✅ Project/region injection | Template-driven setup |
| `create_cluster_from_profile` | Create using predefined profiles | ✅ 85% fewer params | 8 built-in profiles |
| `list_clusters` | List all clusters with filtering | ✅ No params needed | Semantic queries, pagination |
| `list_tracked_clusters` | List MCP-created clusters | ✅ Profile filtering | Creation tracking |
| `get_cluster` | Get detailed cluster information | ✅ 75% fewer params | Semantic data extraction |
| `delete_cluster` | Delete existing clusters | ✅ Project/region defaults | Safe deletion |
| `get_zeppelin_url` | Get Zeppelin notebook URL | ✅ Auto-discovery | Web interface access |

### 💼 **Job Management (6 Tools)**
| Tool | Description | Smart Defaults | Key Features |
|------|-------------|----------------|--------------|
| `submit_hive_query` | Submit Hive queries to clusters | ✅ 70% fewer params | Async support, timeouts |
| `submit_dataproc_job` | Submit Spark/PySpark/Presto jobs | ✅ 75% fewer params | Multi-engine support |
| `get_job_status` | Get job execution status | ✅ JobID only needed | Real-time monitoring |
| `get_job_results` | Get job outputs and results | ✅ Auto-pagination | Result formatting |
| `get_query_status` | Get Hive query status | ✅ Minimal params | Query tracking |
| `get_query_results` | Get Hive query results | ✅ Smart pagination | Enhanced async support |

### 📋 **Configuration & Profiles (3 Tools)**
| Tool | Description | Smart Defaults | Key Features |
|------|-------------|----------------|--------------|
| `list_profiles` | List available cluster profiles | ✅ Category filtering | 8 production profiles |
| `get_profile` | Get detailed profile configuration | ✅ Profile ID only | Template access |
| `query_cluster_data` | Query stored cluster data | ✅ Natural language | Semantic search |

### 📊 **Analytics & Insights (4 Tools)**
| Tool | Description | Smart Defaults | Key Features |
|------|-------------|----------------|--------------|
| `check_active_jobs` | Quick status of all active jobs | ✅ No params needed | Multi-project view |
| `get_cluster_insights` | Comprehensive cluster analytics | ✅ Auto-discovery | Machine types, components |
| `get_job_analytics` | Job performance analytics | ✅ Success rates | Error patterns, metrics |
| `query_knowledge` | Query comprehensive knowledge base | ✅ Natural language | Clusters, jobs, errors |

### 🎯 **Key Capabilities**
- **🧠 Semantic Search**: Natural language queries with Qdrant integration
- **⚡ Smart Defaults**: 60-80% parameter reduction through intelligent injection
- **📊 Response Optimization**: 96% token reduction with full data preservation
- **🔄 Async Support**: Non-blocking job submission and monitoring
- **🏷️ Profile System**: 8 production-ready cluster templates
- **📈 Analytics**: Comprehensive insights and performance tracking

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

- **[Quick Start Guide](https://dipseth.github.io/dataproc-mcp/QUICK_START)** - Get started in 5 minutes
- **[Knowledge Base Semantic Search](https://dipseth.github.io/dataproc-mcp/KNOWLEDGE_BASE_SEMANTIC_SEARCH)** - Natural language queries and setup
- **[API Reference](https://dipseth.github.io/dataproc-mcp/api/)** - Complete tool documentation
- **[Configuration Examples](https://dipseth.github.io/dataproc-mcp/CONFIGURATION_EXAMPLES)** - Real-world configurations
- **[Security Guide](https://dipseth.github.io/dataproc-mcp/security/)** - Best practices and compliance
- **[Installation Guide](https://dipseth.github.io/dataproc-mcp/INSTALLATION_GUIDE)** - Detailed setup instructions

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
- [Qdrant](https://github.com/qdrant/qdrant) - High-performance vector database powering our semantic search and knowledge indexing
- [TypeScript](https://www.typescriptlang.org/) - For type safety and developer experience

---

**Made with ❤️ for the MCP and Google Cloud communities**
