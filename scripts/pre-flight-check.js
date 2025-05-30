#!/usr/bin/env node

/**
 * Pre-flight Check Script for Production Release
 * Validates all systems before executing CI/CD pipeline
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PreFlightChecker {
  constructor() {
    this.checks = [];
    this.warnings = [];
    this.errors = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCheck(name, checkFn) {
    this.log(`Running check: ${name}`);
    try {
      const result = await checkFn();
      if (result.success) {
        this.log(`${name}: ${result.message}`, 'success');
        this.checks.push({ name, status: 'pass', message: result.message });
      } else {
        this.log(`${name}: ${result.message}`, result.severity || 'error');
        if (result.severity === 'warning') {
          this.warnings.push({ name, message: result.message });
        } else {
          this.errors.push({ name, message: result.message });
        }
        this.checks.push({ name, status: 'fail', message: result.message, severity: result.severity });
      }
    } catch (error) {
      this.log(`${name}: ${error.message}`, 'error');
      this.errors.push({ name, message: error.message });
      this.checks.push({ name, status: 'error', message: error.message });
    }
  }

  // Environment Checks
  async checkNodeVersion() {
    return new Promise((resolve) => {
      try {
        const version = process.version;
        const majorVersion = parseInt(version.slice(1).split('.')[0]);
        
        if (majorVersion >= 18) {
          resolve({ success: true, message: `Node.js ${version} (✓ ≥18.0.0)` });
        } else {
          resolve({ success: false, message: `Node.js ${version} (✗ requires ≥18.0.0)` });
        }
      } catch (error) {
        resolve({ success: false, message: `Failed to check Node.js version: ${error.message}` });
      }
    });
  }

  async checkNpmVersion() {
    return new Promise((resolve) => {
      try {
        const version = execSync('npm --version', { encoding: 'utf8' }).trim();
        const majorVersion = parseInt(version.split('.')[0]);
        
        if (majorVersion >= 8) {
          resolve({ success: true, message: `npm ${version} (✓ ≥8.0.0)` });
        } else {
          resolve({ success: false, message: `npm ${version} (✗ requires ≥8.0.0)` });
        }
      } catch (error) {
        resolve({ success: false, message: `Failed to check npm version: ${error.message}` });
      }
    });
  }

  async checkGitStatus() {
    return new Promise((resolve) => {
      try {
        const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        
        if (status === '') {
          resolve({ success: true, message: 'Working directory clean' });
        } else {
          const fileCount = status.split('\n').length;
          resolve({ 
            success: false, 
            message: `${fileCount} uncommitted changes detected`,
            severity: 'warning'
          });
        }
      } catch (error) {
        resolve({ success: false, message: `Failed to check git status: ${error.message}` });
      }
    });
  }

  async checkGitBranch() {
    return new Promise((resolve) => {
      try {
        const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        
        if (branch === 'main' || branch === 'master') {
          resolve({ 
            success: false, 
            message: `Currently on ${branch} branch. Should create feature branch first.`,
            severity: 'warning'
          });
        } else {
          resolve({ success: true, message: `On feature branch: ${branch}` });
        }
      } catch (error) {
        resolve({ success: false, message: `Failed to check git branch: ${error.message}` });
      }
    });
  }

  // File Structure Checks
  async checkRequiredFiles() {
    return new Promise((resolve) => {
      const requiredFiles = [
        'package.json',
        'tsconfig.json',
        'README.md',
        'LICENSE',
        'CHANGELOG.md',
        'CODE_OF_CONDUCT.md',
        'CONTRIBUTING.md',
        '.github/workflows/ci.yml',
        '.github/workflows/release.yml',
        '.github/workflows/community-management.yml',
        '.github/ISSUE_TEMPLATE/bug_report.md',
        '.github/ISSUE_TEMPLATE/feature_request.md',
        '.github/pull_request_template.md',
        'docs/QUICK_START.md',
        'docs/API_REFERENCE.md',
        'docs/CONFIGURATION_EXAMPLES.md',
        'docs/VERSION_MANAGEMENT.md',
        'docs/DISTRIBUTION_GUIDE.md',
        'docs/COMMUNITY_SUPPORT.md',
        'scripts/prepare-release.js',
        'scripts/extract-changelog.js'
      ];

      const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
      
      if (missingFiles.length === 0) {
        resolve({ success: true, message: `All ${requiredFiles.length} required files present` });
      } else {
        resolve({ 
          success: false, 
          message: `Missing files: ${missingFiles.join(', ')}` 
        });
      }
    });
  }

  async checkPackageJson() {
    return new Promise((resolve) => {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const issues = [];

        // Check required fields
        if (!packageJson.name) issues.push('missing name');
        if (!packageJson.version) issues.push('missing version');
        if (!packageJson.description) issues.push('missing description');
        if (!packageJson.license) issues.push('missing license');
        if (!packageJson.repository) issues.push('missing repository');
        
        // Check scripts
        const requiredScripts = ['build', 'test', 'lint', 'prepare-release'];
        const missingScripts = requiredScripts.filter(script => !packageJson.scripts?.[script]);
        if (missingScripts.length > 0) {
          issues.push(`missing scripts: ${missingScripts.join(', ')}`);
        }

        // Check dependencies
        if (!packageJson.dependencies) issues.push('missing dependencies');
        if (!packageJson.devDependencies) issues.push('missing devDependencies');

        if (issues.length === 0) {
          resolve({ success: true, message: 'package.json validation passed' });
        } else {
          resolve({ success: false, message: `package.json issues: ${issues.join(', ')}` });
        }
      } catch (error) {
        resolve({ success: false, message: `Failed to validate package.json: ${error.message}` });
      }
    });
  }

  // Build and Test Checks
  async checkTypeScriptCompilation() {
    return new Promise((resolve) => {
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
        resolve({ success: true, message: 'TypeScript compilation successful' });
      } catch (error) {
        resolve({ success: false, message: `TypeScript compilation failed: ${error.message}` });
      }
    });
  }

  async checkLinting() {
    return new Promise((resolve) => {
      try {
        execSync('npm run lint', { stdio: 'pipe' });
        resolve({ success: true, message: 'ESLint validation passed' });
      } catch (error) {
        resolve({ 
          success: false, 
          message: 'ESLint validation failed. Run `npm run lint:fix` to auto-fix issues.',
          severity: 'warning'
        });
      }
    });
  }

  async checkFormatting() {
    return new Promise((resolve) => {
      try {
        execSync('npm run format:check', { stdio: 'pipe' });
        resolve({ success: true, message: 'Prettier formatting check passed' });
      } catch (error) {
        resolve({ 
          success: false, 
          message: 'Prettier formatting check failed. Run `npm run format` to fix.',
          severity: 'warning'
        });
      }
    });
  }

  async checkTests() {
    return new Promise((resolve) => {
      try {
        execSync('npm test', { stdio: 'pipe' });
        resolve({ success: true, message: 'All tests passed' });
      } catch (error) {
        resolve({ success: false, message: `Tests failed: ${error.message}` });
      }
    });
  }

  async checkSecurityAudit() {
    return new Promise((resolve) => {
      try {
        execSync('npm audit --audit-level moderate', { stdio: 'pipe' });
        resolve({ success: true, message: 'Security audit passed' });
      } catch (error) {
        const output = error.stdout?.toString() || error.message;
        if (output.includes('found 0 vulnerabilities')) {
          resolve({ success: true, message: 'Security audit passed' });
        } else {
          resolve({ 
            success: false, 
            message: 'Security vulnerabilities found. Run `npm audit fix` to resolve.',
            severity: 'warning'
          });
        }
      }
    });
  }

  // CI/CD Workflow Checks
  async checkWorkflowSyntax() {
    return new Promise((resolve) => {
      try {
        const workflowFiles = [
          '.github/workflows/ci.yml',
          '.github/workflows/release.yml',
          '.github/workflows/community-management.yml'
        ];

        for (const file of workflowFiles) {
          if (!fs.existsSync(file)) {
            resolve({ success: false, message: `Missing workflow file: ${file}` });
            return;
          }
          
          // Basic YAML syntax check
          const content = fs.readFileSync(file, 'utf8');
          if (!content.includes('name:') || !content.includes('on:') || !content.includes('jobs:')) {
            resolve({ success: false, message: `Invalid workflow syntax in ${file}` });
            return;
          }
        }

        resolve({ success: true, message: 'All GitHub Actions workflows present and valid' });
      } catch (error) {
        resolve({ success: false, message: `Workflow validation failed: ${error.message}` });
      }
    });
  }

  // Generate Report
  generateReport() {
    this.log('\n📊 PRE-FLIGHT CHECK REPORT', 'info');
    this.log('='.repeat(50), 'info');
    
    const totalChecks = this.checks.length;
    const passedChecks = this.checks.filter(c => c.status === 'pass').length;
    const failedChecks = this.errors.length;
    const warningChecks = this.warnings.length;

    this.log(`Total Checks: ${totalChecks}`, 'info');
    this.log(`Passed: ${passedChecks}`, 'success');
    this.log(`Warnings: ${warningChecks}`, warningChecks > 0 ? 'warning' : 'info');
    this.log(`Errors: ${failedChecks}`, failedChecks > 0 ? 'error' : 'info');

    if (this.errors.length > 0) {
      this.log('\n❌ ERRORS (Must Fix):', 'error');
      this.errors.forEach(error => {
        this.log(`  • ${error.name}: ${error.message}`, 'error');
      });
    }

    if (this.warnings.length > 0) {
      this.log('\n⚠️  WARNINGS (Recommended):', 'warning');
      this.warnings.forEach(warning => {
        this.log(`  • ${warning.name}: ${warning.message}`, 'warning');
      });
    }

    const readyForRelease = this.errors.length === 0;
    
    this.log('\n🎯 RELEASE READINESS:', 'info');
    if (readyForRelease) {
      this.log('✅ READY FOR CI/CD EXECUTION', 'success');
      this.log('\nNext steps:', 'info');
      this.log('1. Create feature branch: git checkout -b feat/production-readiness-v1.0.0', 'info');
      this.log('2. Commit changes: git add . && git commit -m "feat!: production-ready v1.0.0"', 'info');
      this.log('3. Push branch: git push -u origin feat/production-readiness-v1.0.0', 'info');
      this.log('4. Create PR and validate CI/CD pipeline', 'info');
    } else {
      this.log('❌ NOT READY - Fix errors before proceeding', 'error');
    }

    return readyForRelease;
  }

  async runAllChecks() {
    this.log('🚀 Starting Pre-flight Checks for Production Release', 'info');
    this.log('='.repeat(60), 'info');

    // Environment checks
    await this.runCheck('Node.js Version', () => this.checkNodeVersion());
    await this.runCheck('npm Version', () => this.checkNpmVersion());
    await this.runCheck('Git Status', () => this.checkGitStatus());
    await this.runCheck('Git Branch', () => this.checkGitBranch());

    // File structure checks
    await this.runCheck('Required Files', () => this.checkRequiredFiles());
    await this.runCheck('package.json Validation', () => this.checkPackageJson());

    // Build and quality checks
    await this.runCheck('TypeScript Compilation', () => this.checkTypeScriptCompilation());
    await this.runCheck('ESLint Validation', () => this.checkLinting());
    await this.runCheck('Prettier Formatting', () => this.checkFormatting());
    await this.runCheck('Test Suite', () => this.checkTests());
    await this.runCheck('Security Audit', () => this.checkSecurityAudit());

    // CI/CD checks
    await this.runCheck('GitHub Actions Workflows', () => this.checkWorkflowSyntax());

    return this.generateReport();
  }
}

async function main() {
  const checker = new PreFlightChecker();
  const isReady = await checker.runAllChecks();
  
  process.exit(isReady ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Pre-flight check failed:', error);
    process.exit(1);
  });
}

export { PreFlightChecker };