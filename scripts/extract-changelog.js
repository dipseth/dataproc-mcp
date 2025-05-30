#!/usr/bin/env node

/**
 * Extract changelog section for a specific version
 * Usage: node scripts/extract-changelog.js v1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractChangelog(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');
  
  // Create regex to match the version section
  // Matches from ## [version] to the next ## [ or end of file
  const versionRegex = new RegExp(
    `## \\[${cleanVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]([\\s\\S]*?)(?=## \\[|$)`,
    'i'
  );
  
  const match = changelog.match(versionRegex);
  
  if (match && match[1]) {
    // Clean up the extracted content
    let content = match[1].trim();
    
    // Remove any trailing whitespace and ensure proper formatting
    content = content
      .split('\n')
      .map(line => line.trimRight())
      .join('\n')
      .trim();
    
    return content;
  }
  
  return null;
}

function generateFallbackNotes(version) {
  return `Release ${version}

This release includes various improvements and updates. See the full CHANGELOG.md for detailed information about all changes.

## Installation

\`\`\`bash
npm install -g @dataproc/mcp-server
\`\`\`

## Documentation

- [Quick Start Guide](https://dipseth.github.io/dataproc-mcp/quick-start/)
- [API Reference](https://dipseth.github.io/dataproc-mcp/api/)
- [Configuration Examples](https://dipseth.github.io/dataproc-mcp/examples/)

## Support

- [GitHub Issues](https://github.com/dipseth/dataproc-mcp/issues)
- [Documentation](https://dipseth.github.io/dataproc-mcp/)
- [NPM Package](https://www.npmjs.com/package/@dataproc/mcp-server)`;
}

function main() {
  const version = process.argv[2];
  
  if (!version) {
    console.error('Usage: extract-changelog.js <version>');
    console.error('Example: extract-changelog.js v1.0.0');
    process.exit(1);
  }
  
  const changelogContent = extractChangelog(version);
  
  if (changelogContent) {
    console.log(changelogContent);
  } else {
    console.log(generateFallbackNotes(version));
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractChangelog, generateFallbackNotes };