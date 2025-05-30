#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace .js imports with .ts for local modules (not node_modules)
  const fixedContent = content.replace(
    /from\s+['"]([^'"]*?)\.js['"]/g,
    (match, importPath) => {
      // Only fix relative imports (starting with . or ..)
      if (importPath.startsWith('.')) {
        return match.replace('.js', '.ts');
      }
      return match;
    }
  );
  
  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Fixed imports in: ${filePath}`);
    return true;
  }
  return false;
}

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let fixedCount = 0;
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      fixedCount += processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (fixImportsInFile(fullPath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

const srcDir = path.join(__dirname, '..', 'src');
const testsDir = path.join(__dirname, '..', 'tests');

console.log('Fixing .js imports to .ts in source files...');
const srcFixed = processDirectory(srcDir);
console.log(`Fixed ${srcFixed} files in src/`);

console.log('Fixing .js imports to .ts in test files...');
const testsFixed = processDirectory(testsDir);
console.log(`Fixed ${testsFixed} files in tests/`);

console.log(`Total files fixed: ${srcFixed + testsFixed}`);