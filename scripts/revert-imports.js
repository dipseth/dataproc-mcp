#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function revertImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Revert .ts imports back to .js for local modules (not node_modules)
  const fixedContent = content.replace(
    /from\s+['"]([^'"]*?)\.ts['"]/g,
    (match, importPath) => {
      // Only fix relative imports (starting with . or ..)
      if (importPath.startsWith('.')) {
        return match.replace('.ts', '.js');
      }
      return match;
    }
  );
  
  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Reverted imports in: ${filePath}`);
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
      if (revertImportsInFile(fullPath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

const srcDir = path.join(__dirname, '..', 'src');
const testsDir = path.join(__dirname, '..', 'tests');

console.log('Reverting .ts imports back to .js in source files...');
const srcFixed = processDirectory(srcDir);
console.log(`Reverted ${srcFixed} files in src/`);

console.log('Reverting .ts imports back to .js in test files...');
const testsFixed = processDirectory(testsDir);
console.log(`Reverted ${testsFixed} files in tests/`);

console.log(`Total files reverted: ${srcFixed + testsFixed}`);