#!/usr/bin/env node

/**
 * Documentation Link Testing Script
 * 
 * This script tests all links in documentation files to ensure they are valid
 * and accessible. It checks both internal and external links.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const ROOT_DIR = path.join(__dirname, '..');

class LinkTester {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.tested = 0;
        this.skipped = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '🔗',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'skip': '⏭️'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} ${message}`);
    }

    extractLinksFromMarkdown(content, filePath) {
        const links = [];
        
        // First, identify code blocks to exclude from link detection
        const codeBlocks = this.findCodeBlocks(content);
        
        // Match markdown links: [text](url) - more specific to avoid false positives
        // Only match valid URLs (must contain . or start with / or #)
        const markdownLinkRegex = /\[([^\]]*)\]\(([^)\s]+(?:\.[^)\s]*|\/[^)\s]*|#[^)\s]*)?)\)/g;
        let match;
        
        while ((match = markdownLinkRegex.exec(content)) !== null) {
            const [fullMatch, text, url] = match;
            const matchStart = match.index;
            const matchEnd = match.index + fullMatch.length;
            
            // Skip if this match is inside a code block
            if (this.isInCodeBlock(matchStart, matchEnd, codeBlocks)) {
                continue;
            }
            
            // Additional validation: skip if URL looks like TypeScript syntax
            if (this.isTypeScriptSyntax(url)) {
                continue;
            }
            
            links.push({
                text: text.trim(),
                url: url.trim(),
                type: 'markdown',
                line: this.getLineNumber(content, match.index),
                filePath
            });
        }

        // Match HTML links: <a href="url">
        const htmlLinkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
        while ((match = htmlLinkRegex.exec(content)) !== null) {
            const [fullMatch, url] = match;
            links.push({
                text: 'HTML link',
                url: url.trim(),
                type: 'html',
                line: this.getLineNumber(content, match.index),
                filePath
            });
        }

        // Match reference-style links: [text]: url
        const refLinkRegex = /^\s*\[([^\]]+)\]:\s*(.+)$/gm;
        while ((match = refLinkRegex.exec(content)) !== null) {
            const [fullMatch, ref, url] = match;
            links.push({
                text: `Reference: ${ref}`,
                url: url.trim(),
                type: 'reference',
                line: this.getLineNumber(content, match.index),
                filePath
            });
        }

        return links;
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    findCodeBlocks(content) {
        const codeBlocks = [];
        
        // Find fenced code blocks (```...```)
        const fencedCodeRegex = /```[\s\S]*?```/g;
        let match;
        while ((match = fencedCodeRegex.exec(content)) !== null) {
            codeBlocks.push({
                start: match.index,
                end: match.index + match[0].length,
                type: 'fenced'
            });
        }
        
        // Find inline code blocks (`...`)
        const inlineCodeRegex = /`[^`\n]+`/g;
        while ((match = inlineCodeRegex.exec(content)) !== null) {
            codeBlocks.push({
                start: match.index,
                end: match.index + match[0].length,
                type: 'inline'
            });
        }
        
        // Find indented code blocks (4+ spaces at start of line)
        const lines = content.split('\n');
        let inCodeBlock = false;
        let codeBlockStart = 0;
        let currentIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isCodeLine = /^    /.test(line) || /^\t/.test(line);
            
            if (isCodeLine && !inCodeBlock) {
                inCodeBlock = true;
                codeBlockStart = currentIndex;
            } else if (!isCodeLine && inCodeBlock && line.trim() !== '') {
                codeBlocks.push({
                    start: codeBlockStart,
                    end: currentIndex,
                    type: 'indented'
                });
                inCodeBlock = false;
            }
            
            currentIndex += line.length + 1; // +1 for newline
        }
        
        // Handle case where file ends with code block
        if (inCodeBlock) {
            codeBlocks.push({
                start: codeBlockStart,
                end: currentIndex,
                type: 'indented'
            });
        }
        
        return codeBlocks;
    }

    isInCodeBlock(start, end, codeBlocks) {
        return codeBlocks.some(block =>
            (start >= block.start && start < block.end) ||
            (end > block.start && end <= block.end) ||
            (start <= block.start && end >= block.end)
        );
    }

    isTypeScriptSyntax(url) {
        // Check for common TypeScript syntax patterns that might be mistaken for URLs
        const typeScriptPatterns = [
            /^[A-Z]\[.*\]\s+extends\s+/, // Generic type constraints like T[K] extends
            /\|\s*(string|number|boolean|null|undefined)/, // Union types
            /extends\s+(string|number|boolean|null|undefined)/, // Type extensions
            /^[A-Z]\[[^\]]+\]$/, // Generic type access like T[K]
            /\s+(extends|keyof|typeof|infer)\s+/, // TypeScript keywords
        ];
        
        return typeScriptPatterns.some(pattern => pattern.test(url));
    }

    isInternalLink(url) {
        return !url.startsWith('http://') && 
               !url.startsWith('https://') && 
               !url.startsWith('mailto:') &&
               !url.startsWith('tel:');
    }

    async testInternalLink(link) {
        const { url, filePath } = link;
        
        // Remove anchor fragments
        const cleanUrl = url.split('#')[0];
        if (!cleanUrl) return true; // Just an anchor

        // Resolve relative path
        const basePath = path.dirname(filePath);
        let targetPath;

        if (cleanUrl.startsWith('/')) {
            // Absolute path from root
            targetPath = path.join(ROOT_DIR, cleanUrl.substring(1));
        } else {
            // Relative path
            targetPath = path.resolve(basePath, cleanUrl);
        }

        // Check if file exists
        try {
            const stat = fs.statSync(targetPath);
            if (stat.isFile() || stat.isDirectory()) {
                return true;
            }
        } catch (error) {
            // Try with common extensions if it's not found
            const extensions = ['.md', '.html', '.txt', '.json', '.yaml', '.yml'];
            for (const ext of extensions) {
                try {
                    const extPath = targetPath + ext;
                    const stat = fs.statSync(extPath);
                    if (stat.isFile()) {
                        return true;
                    }
                } catch (e) {
                    // Continue trying
                }
            }
            
            this.errors.push(`${link.filePath}:${link.line} - Broken internal link: ${url}`);
            return false;
        }

        return true;
    }

    async testExternalLink(link) {
        const { url } = link;
        
        // Skip certain URLs that are known to be problematic for automated testing
        const skipPatterns = [
            /localhost/,
            /127\.0\.0\.1/,
            /example\.com/,
            /your-domain\.com/,
            /placeholder/,
            /your-project/,
            /your-bucket/
        ];

        for (const pattern of skipPatterns) {
            if (pattern.test(url)) {
                this.skipped++;
                this.log(`Skipping placeholder URL: ${url}`, 'skip');
                return true;
            }
        }

        // Validate URL format first
        try {
            new URL(url);
        } catch (error) {
            this.errors.push(`${link.filePath}:${link.line} - Invalid URL format: ${url}`);
            return false;
        }

        // In CI environment, perform actual HTTP checks for critical domains
        const criticalDomains = [
            'github.com',
            'npmjs.org',
            'nodejs.org',
            'cloud.google.com'
        ];

        const shouldTestHttp = process.env.CI === 'true' &&
                              criticalDomains.some(domain => url.includes(domain));

        if (shouldTestHttp) {
            try {
                // Use dynamic import for node-fetch to handle ES modules
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(url, {
                    method: 'HEAD',
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Dataproc-MCP-Server-Link-Checker/1.0'
                    }
                });
                
                if (!response.ok) {
                    this.warnings.push(`${link.filePath}:${link.line} - HTTP ${response.status} for: ${url}`);
                    return false;
                }
                
                this.log(`External URL verified: ${url}`, 'success');
                return true;
            } catch (error) {
                this.warnings.push(`${link.filePath}:${link.line} - HTTP check failed for: ${url} (${error.message})`);
                return false;
            }
        } else {
            this.log(`External URL format valid: ${url}`, 'info');
            return true;
        }
    }

    async testLink(link) {
        this.tested++;
        
        if (this.isInternalLink(link.url)) {
            return await this.testInternalLink(link);
        } else {
            return await this.testExternalLink(link);
        }
    }

    async testFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const links = this.extractLinksFromMarkdown(content, filePath);
            
            this.log(`Testing ${links.length} links in ${path.relative(ROOT_DIR, filePath)}`, 'info');
            
            for (const link of links) {
                await this.testLink(link);
            }
            
            return true;
        } catch (error) {
            this.errors.push(`Error reading file ${filePath}: ${error.message}`);
            return false;
        }
    }

    async testAllDocumentation() {
        this.log('🔍 Testing Documentation Links');
        this.log('==============================');

        // Find all markdown files
        const markdownFiles = this.findMarkdownFiles(ROOT_DIR);
        
        this.log(`Found ${markdownFiles.length} documentation files to test`, 'info');

        for (const file of markdownFiles) {
            await this.testFile(file);
        }

        this.printSummary();
        return this.errors.length === 0;
    }

    findMarkdownFiles(dir, files = []) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules, .git, and build directories
                if (!['node_modules', '.git', 'build'].includes(entry.name)) {
                    this.findMarkdownFiles(fullPath, files);
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // Skip files that are not being tracked
                const excludedFiles = [
                    'REFLECTION_POEM.md',
                    'RESTART_MCP_SERVER_INSTRUCTIONS.md'
                ];
                
                const excludedDirs = [
                    'old-tests',
                    'old-configs'
                ];
                
                // Check if file should be excluded
                if (excludedFiles.includes(entry.name)) {
                    return files; // Skip this file
                }
                
                // Check if file is in excluded directory
                const relativePath = path.relative(ROOT_DIR, fullPath);
                const isInExcludedDir = excludedDirs.some(excludedDir =>
                    relativePath.startsWith(excludedDir + path.sep)
                );
                
                if (!isInExcludedDir) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }

    printSummary() {
        this.log('');
        this.log('📊 Link Testing Summary');
        this.log('======================');
        this.log(`🔗 Links tested: ${this.tested}`, 'success');
        this.log(`⏭️  Links skipped: ${this.skipped}`, 'info');
        this.log(`⚠️  Warnings: ${this.warnings.length}`, this.warnings.length > 0 ? 'warning' : 'success');
        this.log(`❌ Errors: ${this.errors.length}`, this.errors.length > 0 ? 'error' : 'success');

        if (this.warnings.length > 0) {
            this.log('');
            this.log('⚠️  Warnings:', 'warning');
            this.warnings.forEach(warning => this.log(`   ${warning}`, 'warning'));
        }

        if (this.errors.length > 0) {
            this.log('');
            this.log('❌ Errors:', 'error');
            this.errors.forEach(error => this.log(`   ${error}`, 'error'));
        }

        if (this.errors.length === 0) {
            this.log('');
            this.log('🎉 All documentation links are valid!', 'success');
        } else {
            this.log('');
            this.log('💡 Tip: Fix broken internal links by ensuring files exist at the specified paths', 'info');
        }
    }
}

// Run link testing
const tester = new LinkTester();
tester.testAllDocumentation().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Link testing failed:', error);
    process.exit(1);
});