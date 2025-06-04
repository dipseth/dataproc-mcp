#!/usr/bin/env node

/**
 * Documentation Update Script
 * 
 * This script updates documentation files with the current package version
 * and ensures all references are consistent across the project.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read package.json to get current version
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
const packageName = packageJson.name;

console.log(`📚 Updating documentation for ${packageName}@${currentVersion}`);

/**
 * Update README.md with current version
 */
function updateReadme() {
  const readmePath = path.join(projectRoot, 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    console.log('⚠️  README.md not found, skipping...');
    return;
  }

  let content = fs.readFileSync(readmePath, 'utf8');
  let updated = false;

  // Update npm version badge
  const versionBadgeRegex = /npm\/v\/@dipseth\/dataproc-mcp-server\.svg/g;
  if (content.match(versionBadgeRegex)) {
    content = content.replace(versionBadgeRegex, `npm/v/@dipseth/dataproc-mcp-server.svg`);
    updated = true;
  }

  // Update package references with version
  const packageRefRegex = /@dipseth\/dataproc-mcp-server@[\d\.]+/g;
  const newPackageRef = `@dipseth/dataproc-mcp-server@${currentVersion}`;
  if (content.match(packageRefRegex)) {
    content = content.replace(packageRefRegex, newPackageRef);
    updated = true;
  }

  // Update installation commands
  const installRegex = /npm install -g @dataproc\/mcp-server/g;
  const newInstallCmd = `npm install -g @dipseth/dataproc-mcp-server@${currentVersion}`;
  if (content.match(installRegex)) {
    content = content.replace(installRegex, newInstallCmd);
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(readmePath, content);
    console.log('✅ README.md updated');
  } else {
    console.log('ℹ️  README.md - no updates needed');
  }
}

/**
 * Update documentation files in docs/ directory
 */
function updateDocsDirectory() {
  const docsPath = path.join(projectRoot, 'docs');
  
  if (!fs.existsSync(docsPath)) {
    console.log('⚠️  docs/ directory not found, skipping...');
    return;
  }

  const markdownFiles = [];
  
  function findMarkdownFiles(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        findMarkdownFiles(filePath);
      } else if (file.endsWith('.md')) {
        markdownFiles.push(filePath);
      }
    }
  }

  findMarkdownFiles(docsPath);

  let updatedCount = 0;
  
  for (const filePath of markdownFiles) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Update package references
    const packageRefRegex = /@dipseth\/dataproc-mcp-server@[\d\.]+/g;
    const newPackageRef = `@dipseth/dataproc-mcp-server@${currentVersion}`;
    if (content.match(packageRefRegex)) {
      content = content.replace(packageRefRegex, newPackageRef);
      updated = true;
    }

    // Update version references
    const versionRegex = /version: [\d\.]+/g;
    const newVersionRef = `version: ${currentVersion}`;
    if (content.match(versionRegex)) {
      content = content.replace(versionRegex, newVersionRef);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, content);
      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} documentation files`);
}

/**
 * Update docs/_config.yml if it exists
 */
function updateConfigYml() {
  const configPath = path.join(projectRoot, 'docs', '_config.yml');
  
  if (!fs.existsSync(configPath)) {
    console.log('ℹ️  docs/_config.yml not found, skipping...');
    return;
  }

  let content = fs.readFileSync(configPath, 'utf8');
  let updated = false;

  // Update version in config
  const versionRegex = /version: [\d\.]+/g;
  const newVersionRef = `version: ${currentVersion}`;
  if (content.match(versionRegex)) {
    content = content.replace(versionRegex, newVersionRef);
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(configPath, content);
    console.log('✅ docs/_config.yml updated');
  } else {
    console.log('ℹ️  docs/_config.yml - no updates needed');
  }
}

/**
 * Create or update package info file
 */
function updatePackageInfo() {
  const packageInfoPath = path.join(projectRoot, 'docs', 'package-info.json');
  
  // Ensure docs directory exists
  const docsDir = path.dirname(packageInfoPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const packageInfo = {
    name: packageName,
    version: currentVersion,
    updated: new Date().toISOString(),
    npmUrl: `https://www.npmjs.com/package/@dipseth/dataproc-mcp-server/v/${currentVersion}`,
    githubRelease: `https://github.com/dipseth/dataproc-mcp/releases/tag/v${currentVersion}`,
    installCommand: `npm install @dipseth/dataproc-mcp-server@${currentVersion}`,
    homepage: packageJson.homepage,
    repository: packageJson.repository?.url,
    bugs: packageJson.bugs?.url
  };

  fs.writeFileSync(packageInfoPath, JSON.stringify(packageInfo, null, 2));
  console.log('✅ Package info file updated');
}

/**
 * Update package.json metadata for NPM
 */
function updatePackageMetadata() {
  let updated = false;

  // Update homepage if needed
  const expectedHomepage = "https://dipseth.github.io/dataproc-mcp/";
  if (packageJson.homepage !== expectedHomepage) {
    packageJson.homepage = expectedHomepage;
    updated = true;
  }

  // Update repository URL format
  const expectedRepoUrl = "git+https://github.com/dipseth/dataproc-mcp.git";
  if (packageJson.repository?.url !== expectedRepoUrl) {
    packageJson.repository = packageJson.repository || {};
    packageJson.repository.url = expectedRepoUrl;
    updated = true;
  }

  // Update bugs URL
  const expectedBugsUrl = "https://github.com/dipseth/dataproc-mcp/issues";
  if (packageJson.bugs?.url !== expectedBugsUrl) {
    packageJson.bugs = packageJson.bugs || {};
    packageJson.bugs.url = expectedBugsUrl;
    updated = true;
  }

  // Ensure keywords include all necessary terms
  const requiredKeywords = ["mcp", "dataproc", "google-cloud", "model-context-protocol", "typescript", "nodejs"];
  const currentKeywords = packageJson.keywords || [];
  const missingKeywords = requiredKeywords.filter(keyword => !currentKeywords.includes(keyword));
  
  if (missingKeywords.length > 0) {
    packageJson.keywords = [...new Set([...currentKeywords, ...missingKeywords])];
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Package metadata updated');
  } else {
    console.log('ℹ️  Package metadata - no updates needed');
  }
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('🚀 Starting documentation update process...\n');
    
    updateReadme();
    updateDocsDirectory();
    updateConfigYml();
    updatePackageInfo();
    updatePackageMetadata();
    
    console.log('\n🎉 Documentation update completed successfully!');
    console.log(`📦 All references updated to version ${currentVersion}`);
    
  } catch (error) {
    console.error('❌ Error updating documentation:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as updateDocumentation };