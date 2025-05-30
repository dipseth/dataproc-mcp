#!/usr/bin/env node

/**
 * Configuration validation script for Dataproc MCP Server
 * Validates configuration files and environment setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: '❌',
      warning: '⚠️ ',
      success: '✅'
    }[type];
    
    console.log(`${prefix} ${message}`);
    this[type === 'error' ? 'errors' : type === 'warning' ? 'warnings' : 'success'].push(message);
  }

  validateDirectories() {
    console.log('\n📁 Validating directory structure...');
    
    const requiredDirs = [
      'config',
      'profiles',
      'state',
      'build'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(rootDir, dir);
      if (fs.existsSync(dirPath)) {
        this.log('success', `Directory ${dir}/ exists`);
      } else {
        this.log('error', `Missing required directory: ${dir}/`);
      }
    }
  }

  validateDefaultParams() {
    console.log('\n🔧 Validating default parameters...');
    
    const configPath = path.join(rootDir, 'config', 'default-params.json');
    
    if (!fs.existsSync(configPath)) {
      this.log('warning', 'No default-params.json found - tools will require explicit projectId/region');
      return;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Validate structure
      if (!config.defaultEnvironment) {
        this.log('error', 'Missing defaultEnvironment in default-params.json');
      }
      
      if (!config.parameters || !Array.isArray(config.parameters)) {
        this.log('error', 'Missing or invalid parameters array in default-params.json');
      }
      
      if (!config.environments || !Array.isArray(config.environments)) {
        this.log('error', 'Missing or invalid environments array in default-params.json');
      }

      // Validate required parameters
      const hasProjectId = config.parameters?.some(p => p.name === 'projectId');
      const hasRegion = config.parameters?.some(p => p.name === 'region');
      
      if (!hasProjectId) {
        this.log('error', 'Missing projectId parameter definition');
      }
      
      if (!hasRegion) {
        this.log('error', 'Missing region parameter definition');
      }

      // Validate default environment exists
      const defaultEnv = config.environments?.find(e => e.environment === config.defaultEnvironment);
      if (!defaultEnv) {
        this.log('error', `Default environment '${config.defaultEnvironment}' not found in environments`);
      } else {
        if (!defaultEnv.parameters?.projectId) {
          this.log('error', `Missing projectId in default environment '${config.defaultEnvironment}'`);
        }
        if (!defaultEnv.parameters?.region) {
          this.log('error', `Missing region in default environment '${config.defaultEnvironment}'`);
        }
      }

      if (this.errors.length === 0) {
        this.log('success', 'Default parameters configuration is valid');
      }
      
    } catch (error) {
      this.log('error', `Invalid JSON in default-params.json: ${error.message}`);
    }
  }

  validateServerConfig() {
    console.log('\n🔐 Validating server configuration...');
    
    const configPath = path.join(rootDir, 'config', 'server.json');
    
    if (!fs.existsSync(configPath)) {
      this.log('warning', 'No server.json found - using default authentication');
      return;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (config.authentication) {
        const auth = config.authentication;
        
        if (auth.impersonateServiceAccount) {
          this.log('success', 'Service account impersonation configured');
          
          if (!auth.fallbackKeyPath) {
            this.log('warning', 'No fallbackKeyPath specified for impersonation');
          } else if (!fs.existsSync(auth.fallbackKeyPath)) {
            this.log('error', `Fallback key file not found: ${auth.fallbackKeyPath}`);
          } else {
            this.log('success', 'Fallback key file exists');
          }
        }
        
        if (auth.keyFilePath && !fs.existsSync(auth.keyFilePath)) {
          this.log('error', `Key file not found: ${auth.keyFilePath}`);
        }
      }
      
    } catch (error) {
      this.log('error', `Invalid JSON in server.json: ${error.message}`);
    }
  }

  validateProfiles() {
    console.log('\n📋 Validating profiles...');
    
    const profilesDir = path.join(rootDir, 'profiles');
    
    if (!fs.existsSync(profilesDir)) {
      this.log('error', 'Profiles directory not found');
      return;
    }

    const profiles = this.findProfiles(profilesDir);
    
    if (profiles.length === 0) {
      this.log('warning', 'No profile files found');
    } else {
      this.log('success', `Found ${profiles.length} profile(s)`);
      
      for (const profile of profiles) {
        try {
          const content = fs.readFileSync(profile, 'utf8');
          // Basic YAML validation - just check if it's readable
          if (content.trim().length > 0) {
            const relativePath = path.relative(rootDir, profile);
            this.log('success', `Profile ${relativePath} is readable`);
          }
        } catch (error) {
          const relativePath = path.relative(rootDir, profile);
          this.log('error', `Profile ${relativePath} is not readable: ${error.message}`);
        }
      }
    }
  }

  findProfiles(dir) {
    const profiles = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          profiles.push(...this.findProfiles(itemPath));
        } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
          profiles.push(itemPath);
        }
      }
    } catch (error) {
      // Directory not readable
    }
    
    return profiles;
  }

  validateBuild() {
    console.log('\n🔨 Validating build...');
    
    const buildPath = path.join(rootDir, 'build', 'index.js');
    
    if (!fs.existsSync(buildPath)) {
      this.log('error', 'Build not found - run "npm run build" first');
    } else {
      this.log('success', 'Build exists');
      
      // Check if build is executable
      try {
        const stats = fs.statSync(buildPath);
        if (stats.mode & parseInt('111', 8)) {
          this.log('success', 'Build is executable');
        } else {
          this.log('warning', 'Build is not executable - may need chmod +x');
        }
      } catch (error) {
        this.log('warning', 'Could not check build permissions');
      }
    }
  }

  validateEnvironment() {
    console.log('\n🌍 Validating environment...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      this.log('success', `Node.js version ${nodeVersion} is supported`);
    } else {
      this.log('error', `Node.js version ${nodeVersion} is not supported (requires >=18.0.0)`);
    }

    // Check for required dependencies
    const packageJsonPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const requiredDeps = [
          '@google-cloud/dataproc',
          '@modelcontextprotocol/sdk',
          'typescript'
        ];
        
        for (const dep of requiredDeps) {
          if (deps[dep]) {
            this.log('success', `Dependency ${dep} is installed`);
          } else {
            this.log('error', `Missing dependency: ${dep}`);
          }
        }
      } catch (error) {
        this.log('error', 'Could not read package.json');
      }
    }
  }

  printSummary() {
    console.log('\n📊 Validation Summary');
    console.log('====================');
    console.log(`✅ Success: ${this.success.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Critical Issues:');
      this.errors.forEach(error => console.log(`  • ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    if (this.errors.length === 0) {
      console.log('\n🎉 Configuration validation passed!');
      console.log('Your Dataproc MCP Server is ready to use.');
    } else {
      console.log('\n🔧 Please fix the errors above before using the server.');
    }
  }

  validate() {
    console.log('🔍 Dataproc MCP Server Configuration Validation');
    console.log('===============================================');
    
    this.validateEnvironment();
    this.validateDirectories();
    this.validateBuild();
    this.validateDefaultParams();
    this.validateServerConfig();
    this.validateProfiles();
    this.printSummary();
    
    return this.errors.length === 0;
  }
}

function main() {
  const validator = new ConfigValidator();
  const isValid = validator.validate();
  process.exit(isValid ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}