#!/usr/bin/env node

/**
 * Build standalone distribution package
 * Creates a self-contained distribution with all necessary files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createStandaloneDistribution() {
  console.log('🔨 Building standalone distribution...');
  
  const distDir = path.join(__dirname, '..', 'dist');
  const buildDir = path.join(__dirname, '..', 'build');
  
  // Create dist directory
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Copy build files
  if (fs.existsSync(buildDir)) {
    copyDirectory(buildDir, path.join(distDir, 'build'));
    console.log('✅ Copied build files');
  }
  
  // Copy profiles
  const profilesDir = path.join(__dirname, '..', 'profiles');
  if (fs.existsSync(profilesDir)) {
    copyDirectory(profilesDir, path.join(distDir, 'profiles'));
    console.log('✅ Copied profiles');
  }
  
  // Copy config templates
  const configDir = path.join(__dirname, '..', 'config');
  if (fs.existsSync(configDir)) {
    copyDirectory(configDir, path.join(distDir, 'config'));
    console.log('✅ Copied config templates');
  }
  
  // Copy templates directory
  const templatesDir = path.join(__dirname, '..', 'templates');
  if (fs.existsSync(templatesDir)) {
    copyDirectory(templatesDir, path.join(distDir, 'templates'));
    console.log('✅ Copied configuration templates');
  }
  
  // Copy documentation
  const docsDir = path.join(__dirname, '..', 'docs');
  if (fs.existsSync(docsDir)) {
    copyDirectory(docsDir, path.join(distDir, 'docs'));
    console.log('✅ Copied documentation');
  }
  
  // Copy essential files
  const essentialFiles = ['README.md', 'LICENSE', 'CHANGELOG.md', 'package.json'];
  essentialFiles.forEach(file => {
    const srcPath = path.join(__dirname, '..', file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied ${file}`);
    }
  });
  
  // Create startup script
  createStartupScript(distDir);
  
  // Create distribution manifest
  createDistributionManifest(distDir);
  
  console.log('🎉 Standalone distribution created in dist/');
  console.log('📦 Distribution contents:');
  listDirectoryContents(distDir, '  ');
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createStartupScript(distDir) {
  const startScript = `#!/usr/bin/env node

/**
 * Dataproc MCP Server Startup Script
 * This script starts the Dataproc MCP Server with proper configuration
 */

import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'build', 'index.js');

console.log('🚀 Starting Dataproc MCP Server...');
console.log('📁 Server path:', serverPath);

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  cwd: __dirname
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(\`🛑 Server exited with code \${code}\`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Shutting down server...');
  server.kill('SIGTERM');
});
`;

  const startScriptPath = path.join(distDir, 'start.js');
  fs.writeFileSync(startScriptPath, startScript);
  fs.chmodSync(startScriptPath, '755');
  console.log('✅ Created startup script');
  
  // Create README for distribution
  const distReadme = `# Dataproc MCP Server - Standalone Distribution

This is a standalone distribution of the Dataproc MCP Server.

## Quick Start

1. **Start the server:**
   \`\`\`bash
   node start.js
   \`\`\`

2. **Or run directly:**
   \`\`\`bash
   node build/index.js
   \`\`\`

## Configuration

- Edit \`config/server.json\` for server configuration
- Edit \`config/default-params.json\` for default parameters
- Add custom profiles in the \`profiles/\` directory

## Documentation

See the \`docs/\` directory for comprehensive documentation:
- \`docs/QUICK_START.md\` - Getting started guide
- \`docs/API_REFERENCE.md\` - Complete API documentation
- \`docs/CONFIGURATION_EXAMPLES.md\` - Configuration examples

## Support

- GitHub: https://github.com/dipseth/dataproc-mcp
- Issues: https://github.com/dipseth/dataproc-mcp/issues
- NPM: https://www.npmjs.com/package/@dataproc/mcp-server
`;

  fs.writeFileSync(path.join(distDir, 'README-STANDALONE.md'), distReadme);
  console.log('✅ Created standalone README');
}

function createDistributionManifest(distDir) {
  const manifest = {
    "name": "@dataproc/mcp-server",
    "type": "standalone-distribution",
    "version": "2.0.0",
    "buildDate": new Date().toISOString(),
    "contents": {
      "build/": "Compiled TypeScript application",
      "profiles/": "Cluster configuration profiles",
      "config/": "Runtime configuration files",
      "templates/": "Configuration templates for setup",
      "docs/": "Complete documentation",
      "start.js": "Standalone startup script",
      "README-STANDALONE.md": "Distribution-specific documentation"
    },
    "requirements": {
      "node": ">=18.0.0",
      "npm": ">=8.0.0"
    },
    "quickStart": [
      "node start.js",
      "# or",
      "node build/index.js"
    ],
    "configuration": {
      "server": "config/server.json",
      "defaults": "config/default-params.json",
      "profiles": "profiles/*.yaml"
    }
  };
  
  const manifestPath = path.join(distDir, 'distribution-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Created distribution manifest');
}

function listDirectoryContents(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach(entry => {
    console.log(`${prefix}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`);
    if (entry.isDirectory() && prefix.length < 6) { // Limit depth
      listDirectoryContents(path.join(dir, entry.name), prefix + '  ');
    }
  });
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createStandaloneDistribution();
}

export { createStandaloneDistribution };