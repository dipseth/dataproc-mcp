#!/usr/bin/env node

/**
 * Post-install script for Dataproc MCP Server
 * Runs automatically after npm install to set up basic directory structure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

function createDirectories() {
  const dirs = [
    'config',
    'state',
    'output'
  ];

  console.log('📁 Setting up Dataproc MCP Server directories...');
  
  for (const dir of dirs) {
    const dirPath = path.join(rootDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`  ✅ Created ${dir}/`);
    }
  }
}

function createGitkeepFiles() {
  const dirs = ['state', 'output'];
  
  for (const dir of dirs) {
    const gitkeepPath = path.join(rootDir, dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, '');
    }
  }
}

function showWelcomeMessage() {
  console.log('\n🎉 Dataproc MCP Server installed successfully!');
  console.log('');
  console.log('To complete setup, run:');
  console.log('  npm run setup');
  console.log('');
  console.log('Or build and start immediately:');
  console.log('  npm run build');
  console.log('  npm start');
  console.log('');
  console.log('For more information:');
  console.log('  📖 README.md');
  console.log('  🔧 docs/CONFIGURATION_GUIDE.md');
  console.log('');
}

function main() {
  try {
    createDirectories();
    createGitkeepFiles();
    showWelcomeMessage();
  } catch (error) {
    console.error('⚠️  Post-install setup encountered an issue:', error.message);
    console.log('You can run "npm run setup" manually to complete configuration.');
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}