# Installation Guide - Dataproc MCP Server

## 🚀 **Recommended Installation (NPM Package)**

### **Quick Setup for Roo (VS Code)**

Add this configuration to your Roo MCP settings:

```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server@latest"],
      "env": {
        "LOG_LEVEL": "info"
      },
      "alwaysAllow": []
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

### **Advanced Configuration**

```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server@latest"],
      "env": {
        "LOG_LEVEL": "debug",
        "DATAPROC_CONFIG_PATH": "/path/to/your/.config/dataproc/server.json",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      },
      "alwaysAllow": []
    }
  }
}
```

## 📋 **Environment Variables**

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LOG_LEVEL` | Logging verbosity | `info` | `debug`, `info`, `warn`, `error` |
| `DATAPROC_CONFIG_PATH` | Custom config file path | `config/server.json` | `/Users/me/.config/dataproc.json` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account key file | - | `/path/to/service-account.json` |
| `MCP_CONFIG` | Inline JSON configuration | - | `{"projectId":"my-project"}` |

## 🔧 **Alternative Installation Methods**

### **Global Installation**
```bash
npm install -g @dipseth/dataproc-mcp-server
```

Then use:
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "dataproc-mcp-server",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### **Local Development**
```bash
git clone https://github.com/dipseth/dataproc-mcp.git
cd dataproc-mcp
npm install
npm run build
```

Then use:
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "node",
      "args": ["/path/to/dataproc-mcp/build/index.js"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

## 📁 **Configuration File Structure**

Create a custom config file (e.g., `~/.config/dataproc/server.json`):

```json
{
  "projectId": "your-gcp-project",
  "region": "us-central1",
  "authentication": {
    "type": "service-account",
    "keyFilename": "/path/to/service-account.json"
  },
  "defaults": {
    "clusterConfig": {
      "softwareConfig": {
        "imageVersion": "2.1-debian11"
      }
    }
  }
}
```

## 🎯 **Quick Start Examples**

### **Basic Setup (Recommended)**
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"]
    }
  }
}
```

### **Production Setup**
```json
{
  "mcpServers": {
    "dataproc-prod": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"],
      "env": {
        "LOG_LEVEL": "warn",
        "DATAPROC_CONFIG_PATH": "/etc/dataproc/production.json",
        "GOOGLE_APPLICATION_CREDENTIALS": "/etc/gcp/service-account.json"
      }
    }
  }
}
```

### **Development Setup**
```json
{
  "mcpServers": {
    "dataproc-dev": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"],
      "env": {
        "LOG_LEVEL": "debug",
        "DATAPROC_CONFIG_PATH": "~/.config/dataproc/dev.json"
      }
    }
  }
}
```

## ✅ **Verification**

After installation, verify the server is working:

1. **Check Roo MCP Connection**: Look for "dataproc" in your MCP servers list
2. **Test Basic Command**: Try listing available tools
3. **Check Logs**: Set `LOG_LEVEL=debug` to see detailed output

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Package not found**: Make sure you're using `@dipseth/dataproc-mcp-server`
2. **Config file not found**: Use `DATAPROC_CONFIG_PATH` to specify custom location
3. **Authentication errors**: Verify `GOOGLE_APPLICATION_CREDENTIALS` path
4. **Permission errors**: Ensure service account has Dataproc permissions

### **Debug Mode**
```json
{
  "mcpServers": {
    "dataproc": {
      "command": "npx",
      "args": ["@dipseth/dataproc-mcp-server"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

This will provide detailed logging to help diagnose issues.

## 🎉 **Success!**

You should now have the Dataproc MCP Server running and connected to Roo (VS Code)! 

Next steps:
- Check out the [Configuration Guide](CONFIGURATION_GUIDE.md)
- Review [Available Tools](API_REFERENCE.md)
- Try the [Quick Start Examples](QUICK_START.md)