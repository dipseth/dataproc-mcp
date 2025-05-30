# Distribution Guide 📦

This document outlines the distribution strategy for the Dataproc MCP Server, including NPM registry publishing, GitHub releases, documentation hosting, and package badges.

## Distribution Channels

### 1. NPM Registry
Primary distribution channel for the Dataproc MCP Server package.

### 2. GitHub Releases
Tagged releases with compiled assets and release notes.

### 3. Documentation Hosting
Comprehensive documentation hosted on GitHub Pages.

### 4. Package Badges
Visual indicators of package status and metrics.

## NPM Registry Distribution

### Package Configuration

**File: `package.json`** (Key distribution fields)
```json
{
  "name": "@dataproc/mcp-server",
  "version": "1.0.0",
  "description": "Google Cloud Dataproc MCP Server with intelligent parameter injection",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "bin": {
    "dataproc-mcp": "build/cli.js"
  },
  "files": [
    "build/",
    "profiles/",
    "config/",
    "docs/",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "keywords": [
    "mcp",
    "model-context-protocol",
    "dataproc",
    "google-cloud",
    "big-data",
    "spark",
    "hadoop",
    "analytics",
    "ai",
    "llm"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/dipseth/dataproc-mcp.git"
  },
  "homepage": "https://dipseth.github.io/dataproc-mcp",
  "bugs": {
    "url": "https://github.com/dipseth/dataproc-mcp/issues"
  },
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### NPM Scripts for Distribution

```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm run test && npm run validate-package",
    "publish:dry-run": "npm publish --dry-run",
    "publish:beta": "npm publish --tag beta",
    "publish:latest": "npm publish --tag latest",
    "validate-package": "npm pack --dry-run && npm audit --audit-level moderate"
  }
}
```

### Publishing Process

#### 1. Pre-Publish Validation
```bash
# Validate package contents
npm run validate-package

# Test installation locally
npm pack
npm install -g dataproc-mcp-server-1.0.0.tgz

# Verify CLI works
dataproc-mcp --version
dataproc-mcp --help
```

#### 2. Publishing Commands

```bash
# Dry run to check what will be published
npm run publish:dry-run

# Publish beta version
npm run publish:beta

# Publish stable version
npm run publish:latest
```

#### 3. Post-Publish Verification
```bash
# Verify package is available
npm view @dataproc/mcp-server

# Test installation from registry
npm install -g @dataproc/mcp-server

# Verify functionality
dataproc-mcp --version
```

### NPM Package Structure

```
@dataproc/mcp-server/
├── build/                 # Compiled TypeScript
│   ├── index.js          # Main entry point
│   ├── index.d.ts        # Type definitions
│   ├── cli.js            # CLI entry point
│   └── ...
├── profiles/             # Default cluster profiles
│   ├── @analytics-workloads.yaml
│   └── ...
├── config/               # Configuration templates
│   ├── server.json.template
│   └── default-params.json.template
├── docs/                 # Documentation
│   ├── QUICK_START.md
│   ├── API_REFERENCE.md
│   └── ...
├── README.md
├── LICENSE
├── CHANGELOG.md
└── package.json
```

## GitHub Releases

### Release Automation Workflow

**File: `.github/workflows/release.yml`**
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build package
        run: npm run build

      - name: Create distribution assets
        run: |
          # Create standalone distribution
          npm run build:standalone
          
          # Create documentation bundle
          npm run build:docs
          
          # Create configuration templates
          npm run build:templates

      - name: Package assets
        run: |
          # Create tarball
          npm pack
          
          # Create zip distribution
          zip -r dataproc-mcp-server-${{ github.ref_name }}.zip \
            build/ profiles/ config/ docs/ README.md LICENSE CHANGELOG.md
          
          # Create standalone binary (if applicable)
          # npm run build:binary

      - name: Generate release notes
        id: release_notes
        run: |
          # Extract changelog for this version
          node scripts/extract-changelog.js ${{ github.ref_name }} > release-notes.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: release-notes.md
          files: |
            *.tgz
            *.zip
            build/standalone/*
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Publish to NPM
        if: ${{ !contains(github.ref_name, '-') }}
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish beta to NPM
        if: ${{ contains(github.ref_name, '-') }}
        run: npm publish --tag beta
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Release Assets

Each GitHub release includes:

1. **Source Code**: Automatic GitHub archive
2. **NPM Package**: `.tgz` file from `npm pack`
3. **Standalone Distribution**: Zip file with all necessary files
4. **Documentation Bundle**: Offline documentation package
5. **Configuration Templates**: Ready-to-use configuration files

### Release Notes Template

**File: `scripts/extract-changelog.js`**
```javascript
#!/usr/bin/env node

const fs = require('fs');
const version = process.argv[2];

if (!version) {
  console.error('Usage: extract-changelog.js <version>');
  process.exit(1);
}

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
// Regex pattern to match version sections in changelog
const versionRegex = new RegExp('## \\\\[' + version.replace('v', '') + '\\\\](.*?)(?=## \\\\[|$)', 's');
const match = changelog.match(versionRegex);

if (match) {
  console.log(match[1].trim());
} else {
  console.log(`Release ${version}\n\nSee CHANGELOG.md for details.`);
}
```

## Documentation Hosting

### GitHub Pages Setup

**File: `.github/workflows/docs.yml`**
```yaml
name: Documentation

on:
  push:
    branches: [main]
    paths: ['docs/**', 'README.md']
  release:
    types: [published]

jobs:
  deploy-docs:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build documentation
        run: |
          # Generate API documentation
          npm run docs:api
          
          # Build documentation site
          npm run docs:build
          
          # Copy additional files
          cp README.md docs/_site/
          cp CHANGELOG.md docs/_site/
          cp LICENSE docs/_site/

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/_site

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Documentation Site Structure

```
docs/
├── _site/                # Generated site (GitHub Pages)
│   ├── index.html       # Landing page
│   ├── quick-start/     # Quick start guide
│   ├── api/             # API reference
│   ├── guides/          # User guides
│   ├── examples/        # Configuration examples
│   └── changelog/       # Version history
├── _config.yml          # Jekyll configuration
├── index.md             # Site homepage
└── ...
```

**File: `docs/_config.yml`**
```yaml
title: Dataproc MCP Server
description: Google Cloud Dataproc MCP Server with intelligent parameter injection
url: https://dipseth.github.io/dataproc-mcp
baseurl: /dataproc-mcp

theme: minima

plugins:
  - jekyll-feed
  - jekyll-sitemap
  - jekyll-seo-tag

markdown: kramdown
highlighter: rouge

navigation:
  - title: Quick Start
    url: /quick-start/
  - title: API Reference
    url: /api/
  - title: Configuration
    url: /configuration/
  - title: Examples
    url: /examples/
  - title: Changelog
    url: /changelog/

footer_links:
  - title: GitHub
    url: https://github.com/dipseth/dataproc-mcp
  - title: NPM
    url: https://www.npmjs.com/package/@dataproc/mcp-server
  - title: Issues
    url: https://github.com/dipseth/dataproc-mcp/issues
```

### Documentation Build Scripts

```json
{
  "scripts": {
    "docs:api": "typedoc --out docs/_site/api src/index.ts",
    "docs:build": "jekyll build --source docs --destination docs/_site",
    "docs:serve": "jekyll serve --source docs --destination docs/_site",
    "docs:clean": "rm -rf docs/_site"
  }
}
```

## Package Badges

### Badge Configuration

Add badges to `README.md` for key metrics and status indicators:

```markdown
# Dataproc MCP Server

[![npm version](https://badge.fury.io/js/%40dataproc%2Fmcp-server.svg)](https://badge.fury.io/js/%40dataproc%2Fmcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@dataproc/mcp-server.svg)](https://npmjs.org/package/@dataproc/mcp-server)
[![Build Status](https://github.com/dipseth/dataproc-mcp/workflows/CI/badge.svg)](https://github.com/dipseth/dataproc-mcp/actions)
[![Coverage Status](https://coveralls.io/repos/github/dipseth/dataproc-mcp/badge.svg?branch=main)](https://coveralls.io/github/dipseth/dataproc-mcp?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@dataproc/mcp-server.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
```

### Badge Types

#### 📊 **Package Metrics**
- **Version**: Current published version
- **Downloads**: Monthly/weekly download count
- **Size**: Package size information
- **Dependencies**: Dependency status

#### 🔧 **Build Status**
- **CI/CD**: Build and test status
- **Coverage**: Test coverage percentage
- **Security**: Security audit status
- **Quality**: Code quality metrics

#### 📋 **Compatibility**
- **Node.js**: Supported Node.js versions
- **TypeScript**: TypeScript support
- **MCP**: MCP protocol compatibility
- **Platform**: Supported platforms

#### 📄 **Legal & Support**
- **License**: License type
- **Maintenance**: Maintenance status
- **Support**: Support availability

### Custom Badge Creation

For custom metrics, create badges using shields.io:

```markdown
[![Custom Metric](https://img.shields.io/badge/Custom-Metric-blue.svg)](https://example.com)
```

## Distribution Checklist

### Pre-Release Checklist
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Run full test suite (`npm test`)
- [ ] Build package (`npm run build`)
- [ ] Validate package contents (`npm run validate-package`)
- [ ] Test local installation (`npm pack && npm install -g`)
- [ ] Update documentation
- [ ] Create migration guide (if breaking changes)

### Release Checklist
- [ ] Create and push version tag (`git tag v1.0.0 && git push --tags`)
- [ ] Verify GitHub Actions workflow completion
- [ ] Confirm GitHub release creation
- [ ] Verify NPM package publication
- [ ] Test installation from NPM (`npm install -g @dataproc/mcp-server`)
- [ ] Verify documentation deployment
- [ ] Update package badges if needed

### Post-Release Checklist
- [ ] Announce release on relevant channels
- [ ] Update dependent projects
- [ ] Monitor for issues and feedback
- [ ] Update distribution metrics
- [ ] Plan next release cycle

## Distribution Monitoring

### Metrics to Track

1. **Download Statistics**
   - NPM download counts (daily/weekly/monthly)
   - GitHub release download counts
   - Documentation page views

2. **Usage Analytics**
   - Installation success rates
   - Error reports and feedback
   - Feature usage patterns

3. **Quality Metrics**
   - Build success rates
   - Test coverage trends
   - Security audit results

### Monitoring Tools

- **NPM Stats**: Track download metrics
- **GitHub Insights**: Monitor repository activity
- **Google Analytics**: Track documentation usage
- **Error Tracking**: Monitor runtime issues

This comprehensive distribution strategy ensures the Dataproc MCP Server reaches users through multiple channels with proper versioning, documentation, and quality indicators.