#!/usr/bin/env node

/**
 * Validate Configuration Examples Script
 * 
 * This script validates all configuration examples in the docs/examples directory
 * to ensure they are syntactically correct and follow best practices.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.join(__dirname, '..', 'docs', 'examples');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

class ExampleValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.validated = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '📋',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} ${message}`);
    }

    validateYamlFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = yaml.load(content);
            
            // Basic structure validation
            if (typeof parsed !== 'object' || parsed === null) {
                this.errors.push(`${filePath}: Invalid YAML structure`);
                return false;
            }

            // Validate cluster configuration if present
            if (parsed.clusterConfig) {
                this.validateClusterConfig(parsed.clusterConfig, filePath);
            }

            // Validate profile structure if present
            if (parsed.profile) {
                this.validateProfileStructure(parsed.profile, filePath);
            }

            this.validated++;
            return true;
        } catch (error) {
            this.errors.push(`${filePath}: YAML parsing error - ${error.message}`);
            return false;
        }
    }

    validateJsonFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            // Basic structure validation
            if (typeof parsed !== 'object' || parsed === null) {
                this.errors.push(`${filePath}: Invalid JSON structure`);
                return false;
            }

            // Validate MCP configuration if present
            if (parsed.mcpServers) {
                this.validateMcpConfig(parsed.mcpServers, filePath);
            }

            this.validated++;
            return true;
        } catch (error) {
            this.errors.push(`${filePath}: JSON parsing error - ${error.message}`);
            return false;
        }
    }

    validateClusterConfig(config, filePath) {
        const requiredFields = ['masterConfig', 'workerConfig'];
        const optionalFields = ['secondaryWorkerConfig', 'softwareConfig', 'initializationActions'];

        for (const field of requiredFields) {
            if (!config[field]) {
                this.warnings.push(`${filePath}: Missing recommended field '${field}' in clusterConfig`);
            }
        }

        // Validate machine types
        if (config.masterConfig?.machineTypeUri) {
            this.validateMachineType(config.masterConfig.machineTypeUri, filePath, 'master');
        }
        if (config.workerConfig?.machineTypeUri) {
            this.validateMachineType(config.workerConfig.machineTypeUri, filePath, 'worker');
        }
    }

    validateMachineType(machineType, filePath, nodeType) {
        const validMachineTypes = [
            'n1-standard-1', 'n1-standard-2', 'n1-standard-4', 'n1-standard-8',
            'n1-highmem-2', 'n1-highmem-4', 'n1-highmem-8',
            'n2-standard-2', 'n2-standard-4', 'n2-standard-8',
            'e2-medium', 'e2-standard-2', 'e2-standard-4'
        ];

        const machineTypeName = machineType.split('/').pop();
        if (!validMachineTypes.includes(machineTypeName)) {
            this.warnings.push(`${filePath}: Uncommon machine type '${machineTypeName}' for ${nodeType} nodes`);
        }
    }

    validateProfileStructure(profile, filePath) {
        const requiredFields = ['name', 'description', 'category'];
        
        for (const field of requiredFields) {
            if (!profile[field]) {
                this.errors.push(`${filePath}: Missing required field '${field}' in profile`);
            }
        }

        if (profile.category && !['development', 'production', 'testing'].includes(profile.category)) {
            this.warnings.push(`${filePath}: Unusual category '${profile.category}'`);
        }
    }

    validateMcpConfig(mcpServers, filePath) {
        if (!Array.isArray(mcpServers) && typeof mcpServers !== 'object') {
            this.errors.push(`${filePath}: mcpServers should be an array or object`);
            return;
        }

        const servers = Array.isArray(mcpServers) ? mcpServers : Object.values(mcpServers);
        
        for (const server of servers) {
            if (!server.command) {
                this.errors.push(`${filePath}: MCP server missing 'command' field`);
            }
        }
    }

    validateHiveQueries(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Extract SQL queries from markdown code blocks
            const sqlBlocks = content.match(/```sql\n([\s\S]*?)\n```/g);
            
            if (!sqlBlocks) {
                this.warnings.push(`${filePath}: No SQL queries found in markdown file`);
                return;
            }

            for (let i = 0; i < sqlBlocks.length; i++) {
                const sqlContent = sqlBlocks[i].replace(/```sql\n/, '').replace(/\n```/, '');
                this.validateSqlSyntax(sqlContent, filePath, i + 1);
            }

            // Extract JSON examples for MCP tool usage
            const jsonBlocks = content.match(/```json\n([\s\S]*?)\n```/g);
            
            if (jsonBlocks) {
                for (let i = 0; i < jsonBlocks.length; i++) {
                    const jsonContent = jsonBlocks[i].replace(/```json\n/, '').replace(/\n```/, '');
                    try {
                        const parsed = JSON.parse(jsonContent);
                        this.validateMcpToolExample(parsed, filePath, i + 1);
                    } catch (error) {
                        this.errors.push(`${filePath}: Invalid JSON in code block ${i + 1}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            this.errors.push(`${filePath}: Error reading Hive query file - ${error.message}`);
        }
    }

    validateSqlSyntax(sql, filePath, blockNumber) {
        // Basic SQL syntax validation
        const trimmedSql = sql.trim();
        
        if (!trimmedSql) {
            this.warnings.push(`${filePath}: Empty SQL block ${blockNumber}`);
            return;
        }

        // Check for common SQL keywords
        const sqlKeywords = ['SELECT', 'CREATE', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'LOAD'];
        const hasValidKeyword = sqlKeywords.some(keyword =>
            trimmedSql.toUpperCase().includes(keyword)
        );

        if (!hasValidKeyword) {
            this.warnings.push(`${filePath}: SQL block ${blockNumber} may not contain valid SQL statements`);
        }

        // Check for placeholder values that should be replaced
        const placeholders = ['your-bucket', 'your-project-id', 'your-cluster-name'];
        for (const placeholder of placeholders) {
            if (trimmedSql.includes(placeholder)) {
                this.warnings.push(`${filePath}: SQL block ${blockNumber} contains placeholder '${placeholder}' - ensure examples are updated`);
            }
        }

        // Check for proper semicolon termination
        if (!trimmedSql.endsWith(';')) {
            this.warnings.push(`${filePath}: SQL block ${blockNumber} should end with semicolon`);
        }
    }

    validateMcpToolExample(example, filePath, blockNumber) {
        // Validate MCP tool usage examples
        const requiredFields = ['projectId', 'region', 'clusterName'];
        
        for (const field of requiredFields) {
            if (!example[field]) {
                this.errors.push(`${filePath}: JSON block ${blockNumber} missing required field '${field}'`);
            } else if (typeof example[field] === 'string' && example[field].includes('your-')) {
                this.warnings.push(`${filePath}: JSON block ${blockNumber} contains placeholder value in '${field}'`);
            }
        }

        // Validate query field if present
        if (example.query && typeof example.query !== 'string') {
            this.errors.push(`${filePath}: JSON block ${blockNumber} 'query' field must be a string`);
        }

        // Validate async field if present
        if (example.async !== undefined && typeof example.async !== 'boolean') {
            this.errors.push(`${filePath}: JSON block ${blockNumber} 'async' field must be a boolean`);
        }
    }

    async validateExamples() {
        this.log('🔍 Validating Configuration Examples');
        this.log('=====================================');

        // Check if examples directory exists
        if (!fs.existsSync(EXAMPLES_DIR)) {
            this.log('Creating examples directory...', 'info');
            fs.mkdirSync(EXAMPLES_DIR, { recursive: true });
            
            // Create subdirectories
            fs.mkdirSync(path.join(EXAMPLES_DIR, 'configs'), { recursive: true });
            fs.mkdirSync(path.join(EXAMPLES_DIR, 'queries'), { recursive: true });
            
            // Create a basic cluster config example
            const basicExample = {
                profile: {
                    name: 'basic-example',
                    description: 'Basic cluster configuration example',
                    category: 'development'
                },
                clusterConfig: {
                    masterConfig: {
                        numInstances: 1,
                        machineTypeUri: 'n1-standard-2',
                        diskConfig: {
                            bootDiskSizeGb: 50
                        }
                    },
                    workerConfig: {
                        numInstances: 2,
                        machineTypeUri: 'n1-standard-2',
                        diskConfig: {
                            bootDiskSizeGb: 50
                        }
                    }
                }
            };
            
            fs.writeFileSync(
                path.join(EXAMPLES_DIR, 'configs', 'basic-cluster.yaml'),
                yaml.dump(basicExample, { indent: 2 })
            );
            this.log('Created basic cluster config example', 'success');
        }

        // Validate all files in examples directory recursively
        this.validateDirectory(EXAMPLES_DIR);

        // Validate existing config files
        if (fs.existsSync(CONFIG_DIR)) {
            this.log('Validating configuration files...', 'info');
            const configFiles = fs.readdirSync(CONFIG_DIR);
            for (const file of configFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(CONFIG_DIR, file);
                    this.log(`Validating config: ${file}`, 'info');
                    this.validateJsonFile(filePath);
                }
            }
        }

        this.printSummary();
        return this.errors.length === 0;
    }

    validateDirectory(dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                this.validateDirectory(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                const relativePath = path.relative(EXAMPLES_DIR, fullPath);
                
                if (ext === '.yaml' || ext === '.yml') {
                    this.log(`Validating YAML: ${relativePath}`, 'info');
                    this.validateYamlFile(fullPath);
                } else if (ext === '.json') {
                    this.log(`Validating JSON: ${relativePath}`, 'info');
                    this.validateJsonFile(fullPath);
                } else if (ext === '.md') {
                    this.log(`Validating Hive queries: ${relativePath}`, 'info');
                    this.validateHiveQueries(fullPath);
                } else {
                    this.log(`Skipping non-config file: ${relativePath}`, 'info');
                }
            }
        }
    }

    printSummary() {
        this.log('');
        this.log('📊 Validation Summary');
        this.log('====================');
        this.log(`✅ Files validated: ${this.validated}`, 'success');
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
            this.log('🎉 All configuration examples are valid!', 'success');
        }
    }
}

// Run validation
const validator = new ExampleValidator();
validator.validateExamples().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
});