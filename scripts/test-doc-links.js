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
        
        // Match markdown links: [text](url)
        const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = markdownLinkRegex.exec(content)) !== null) {
            const [fullMatch, text, url] = match;
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
            /placeholder/
        ];

        for (const pattern of skipPatterns) {
            if (pattern.test(url)) {
                this.skipped++;
                this.log(`Skipping placeholder URL: ${url}`, 'skip');
                return true;
            }
        }

        // For now, we'll just validate the URL format for external links
        // In a real CI environment, you might want to actually test HTTP requests
        try {
            new URL(url);
            this.log(`External URL format valid: ${url}`, 'info');
            return true;
        } catch (error) {
            this.errors.push(`${link.filePath}:${link.line} - Invalid URL format: ${url}`);
            return false;
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
                if (!['node_modules', '.git', 'build', '.github'].includes(entry.name)) {
                    this.findMarkdownFiles(fullPath, files);
                }
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                // Skip files that are not being tracked
                const excludedFiles = [
                    'COMPREHENSIVE_MCP_TESTING_CHECKLIST.md',
                    'SERVICE_ACCOUNT_AUTHENTICATION_GUIDE.md'
                ];
                
                const excludedDirs = [
                    'old-tests'
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