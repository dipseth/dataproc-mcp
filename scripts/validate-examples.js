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

    async validateExamples() {
        this.log('🔍 Validating Configuration Examples');
        this.log('=====================================');

        // Check if examples directory exists
        if (!fs.existsSync(EXAMPLES_DIR)) {
            this.log('Creating examples directory...', 'info');
            fs.mkdirSync(EXAMPLES_DIR, { recursive: true });
            
            // Create a basic example
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
                path.join(EXAMPLES_DIR, 'basic-cluster.yaml'),
                yaml.dump(basicExample, { indent: 2 })
            );
            this.log('Created basic example file', 'success');
        }

        // Validate all files in examples directory
        const files = fs.readdirSync(EXAMPLES_DIR, { recursive: true });
        
        for (const file of files) {
            const filePath = path.join(EXAMPLES_DIR, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile()) {
                const ext = path.extname(file).toLowerCase();
                
                if (ext === '.yaml' || ext === '.yml') {
                    this.log(`Validating YAML: ${file}`, 'info');
                    this.validateYamlFile(filePath);
                } else if (ext === '.json') {
                    this.log(`Validating JSON: ${file}`, 'info');
                    this.validateJsonFile(filePath);
                } else {
                    this.log(`Skipping non-config file: ${file}`, 'info');
                }
            }
        }

        // Validate existing config files
        if (fs.existsSync(CONFIG_DIR)) {
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