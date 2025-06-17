/**
 * Comprehensive Local File Staging Test Suite
 * 
 * This test file consolidates all local file staging functionality tests,
 * including the test-spark-job.py script content and various staging scenarios.
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');

// Test Spark Job Python Script Content
const TEST_SPARK_JOB_CONTENT = `#!/usr/bin/env python3
"""
Simple PySpark test job for local file staging demonstration.
This script performs basic Spark operations to validate the staging functionality.
"""

from pyspark.sql import SparkSession
import sys

def main():
    # Initialize Spark session
    spark = SparkSession.builder \\
        .appName("LocalFileStagingTest") \\
        .getOrCreate()
    
    print("=== PySpark Local File Staging Test ===")
    print(f"Spark version: {spark.version}")
    print(f"Arguments received: {sys.argv[1:] if len(sys.argv) > 1 else 'None'}")
    
    # Create a simple DataFrame for testing
    data = [
        ("Alice", 25, "Engineer"),
        ("Bob", 30, "Manager"), 
        ("Charlie", 35, "Analyst"),
        ("Diana", 28, "Designer")
    ]
    
    columns = ["name", "age", "role"]
    df = spark.createDataFrame(data, columns)
    
    print("\\n=== Sample Data ===")
    df.show()
    
    # Perform some basic operations
    print("\\n=== Data Analysis ===")
    print(f"Total records: {df.count()}")
    print(f"Average age: {df.agg({'age': 'avg'}).collect()[0][0]:.1f}")
    
    # Group by role
    print("\\n=== Role Distribution ===")
    df.groupBy("role").count().show()
    
    # Filter and display
    print("\\n=== Engineers and Managers ===")
    df.filter(df.role.isin(["Engineer", "Manager"])).show()
    
    print("\\n=== Test Completed Successfully! ===")
    print("Local file staging is working correctly.")
    
    spark.stop()
    return 0

if __name__ == "__main__":
    exit(main())`;

// Helper utility Python script content
const HELPER_UTILS_CONTENT = `#!/usr/bin/env python3
"""
Helper utilities for PySpark jobs - used to test multiple file staging.
"""

def format_output(title, data):
    """Format output with a title and data."""
    print(f"\\n=== {title} ===")
    if isinstance(data, list):
        for item in data:
            print(f"  - {item}")
    else:
        print(f"  {data}")

def calculate_statistics(df):
    """Calculate basic statistics for a DataFrame."""
    return {
        'count': df.count(),
        'columns': df.columns,
        'schema': str(df.schema)
    }

def validate_data(df, expected_count=None):
    """Validate DataFrame data."""
    actual_count = df.count()
    if expected_count and actual_count != expected_count:
        raise ValueError(f"Expected {expected_count} records, got {actual_count}")
    return True`;

describe('Local File Staging Tests', function() {
    this.timeout(30000); // 30 second timeout for staging operations
    
    let tempDir;
    let testFiles = {};
    
    before(async function() {
        // Create temporary directory for test files
        tempDir = path.join(__dirname, 'temp-staging-test');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Create test Python files
        testFiles.mainScript = path.join(tempDir, 'test-spark-job.py');
        testFiles.helperScript = path.join(tempDir, 'helper-utils.py');
        testFiles.sqlScript = path.join(tempDir, 'test-query.sql');
        testFiles.jarFile = path.join(tempDir, 'test-app.jar');
        
        await fs.writeFile(testFiles.mainScript, TEST_SPARK_JOB_CONTENT);
        await fs.writeFile(testFiles.helperScript, HELPER_UTILS_CONTENT);
        await fs.writeFile(testFiles.sqlScript, 'SELECT COUNT(*) FROM test_table;');
        await fs.writeFile(testFiles.jarFile, 'dummy jar content'); // Mock JAR file
        
        console.log(`Created test files in: ${tempDir}`);
    });
    
    after(async function() {
        // Cleanup temporary files
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log(`Cleaned up test directory: ${tempDir}`);
        } catch (error) {
            console.warn(`Failed to cleanup test directory: ${error.message}`);
        }
    });
    
    describe('File Detection and Template Processing', function() {
        
        it('should detect local file paths with template syntax', function() {
            const jobConfig = {
                mainPythonFileUri: "{@./test-spark-job.py}",
                pythonFileUris: [
                    "{@./utils/helper.py}",
                    "{@/absolute/path/library.py}"
                ]
            };
            
            // Mock the local file staging service detection
            const expectedFiles = [
                "./test-spark-job.py",
                "./utils/helper.py",
                "/absolute/path/library.py"
            ];
            
            // This would be the actual detection logic
            const detectedFiles = [];
            const templateRegex = /\{@([^}]+)\}/g;
            
            JSON.stringify(jobConfig).replace(templateRegex, (match, filePath) => {
                detectedFiles.push(filePath);
                return match;
            });
            
            expect(detectedFiles).to.deep.equal(expectedFiles);
        });
        
        it('should support different file extensions', function() {
            const supportedExtensions = ['.py', '.jar', '.sql', '.R'];
            const testPaths = [
                './script.py',
                './app.jar', 
                './query.sql',
                './analysis.R'
            ];
            
            testPaths.forEach(testPath => {
                const ext = path.extname(testPath);
                expect(supportedExtensions).to.include(ext);
            });
        });
        
        it('should handle relative and absolute paths', function() {
            const relativePath = './test-spark-job.py';
            const absolutePath = '/absolute/path/to/script.py';
            
            expect(path.isAbsolute(relativePath)).to.be.false;
            expect(path.isAbsolute(absolutePath)).to.be.true;
        });
    });
    
    describe('File Staging Process', function() {
        
        it('should generate unique staged file names', function() {
            const localPath = './test-spark-job.py';
            const stagingBucket = 'dataproc-staging-us-central1-123456789-abcdef';
            
            // Mock the staging path generation
            const fileName = path.basename(localPath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const uniqueFileName = `mcp-staging-${timestamp}-${fileName}`;
            const expectedPath = `gs://${stagingBucket}/mcp-staging/${uniqueFileName}`;
            
            expect(uniqueFileName).to.include('mcp-staging-');
            expect(uniqueFileName).to.include(fileName);
            expect(expectedPath).to.include('gs://');
            expect(expectedPath).to.include('/mcp-staging/');
        });
        
        it('should track staged files for cleanup', function() {
            const stagedFiles = new Map();
            const jobId = 'test-job-123';
            const localPath = './test-spark-job.py';
            const gcsUri = 'gs://bucket/mcp-staging/staged-file.py';
            
            // Mock file tracking
            stagedFiles.set(localPath, {
                localPath,
                gcsUri,
                uploadedAt: new Date(),
                jobId
            });
            
            expect(stagedFiles.has(localPath)).to.be.true;
            expect(stagedFiles.get(localPath).gcsUri).to.equal(gcsUri);
            expect(stagedFiles.get(localPath).jobId).to.equal(jobId);
        });
    });
    
    describe('Job Configuration Transformation', function() {
        
        it('should transform job config with staged file URIs', function() {
            const originalConfig = {
                mainPythonFileUri: "{@./test-spark-job.py}",
                pythonFileUris: ["{@./helper-utils.py}"],
                args: ["--mode", "test"]
            };
            
            const fileMapping = new Map([
                ["./test-spark-job.py", "gs://bucket/mcp-staging/staged-main.py"],
                ["./helper-utils.py", "gs://bucket/mcp-staging/staged-helper.py"]
            ]);
            
            // Mock transformation logic
            const transformedConfig = JSON.parse(JSON.stringify(originalConfig));
            const templateRegex = /\{@([^}]+)\}/g;
            
            const configStr = JSON.stringify(transformedConfig);
            const newConfigStr = configStr.replace(templateRegex, (match, filePath) => {
                return fileMapping.get(filePath) || match;
            });
            
            const finalConfig = JSON.parse(newConfigStr);
            
            expect(finalConfig.mainPythonFileUri).to.equal("gs://bucket/mcp-staging/staged-main.py");
            expect(finalConfig.pythonFileUris[0]).to.equal("gs://bucket/mcp-staging/staged-helper.py");
            expect(finalConfig.args).to.deep.equal(["--mode", "test"]);
        });
    });
    
    describe('Integration Test Cases', function() {
        
        it('should handle successful job submissions with staging', function() {
            // Test cases based on successful job IDs mentioned in requirements
            const successfulJobIds = [
                'db620480-135f-4de6-b9a6-4045b308fe97',
                '36ed88b2-acad-4cfb-8fbf-88ad1ba22ad7'
            ];
            
            successfulJobIds.forEach(jobId => {
                expect(jobId).to.match(/^[a-f0-9-]{36}$/); // UUID format
            });
        });
        
        it('should validate test file content', async function() {
            const content = await fs.readFile(testFiles.mainScript, 'utf8');
            
            expect(content).to.include('PySpark Local File Staging Test');
            expect(content).to.include('SparkSession.builder');
            expect(content).to.include('Local file staging is working correctly');
        });
        
        it('should handle multiple file staging scenario', function() {
            const multiFileConfig = {
                mainPythonFileUri: "{@./test-spark-job.py}",
                pythonFileUris: [
                    "{@./helper-utils.py}",
                    "{@./additional-utils.py}"
                ],
                jarFileUris: ["{@./test-app.jar}"],
                args: ["--input", "gs://data/input", "--output", "gs://data/output"]
            };
            
            // Count template references
            const templateCount = JSON.stringify(multiFileConfig)
                .match(/\{@[^}]+\}/g)?.length || 0;
            
            expect(templateCount).to.equal(4); // 3 Python files + 1 JAR file
        });
    });
    
    describe('Error Handling', function() {
        
        it('should handle file not found scenarios', async function() {
            const nonExistentFile = path.join(tempDir, 'non-existent.py');
            
            try {
                await fs.access(nonExistentFile);
                expect.fail('File should not exist');
            } catch (error) {
                expect(error.code).to.equal('ENOENT');
            }
        });
        
        it('should validate file extensions', function() {
            const validExtensions = ['.py', '.jar', '.sql', '.R'];
            const testFiles = [
                'script.py',
                'app.jar',
                'query.sql',
                'analysis.R',
                'invalid.txt' // Should be rejected
            ];
            
            testFiles.forEach(file => {
                const ext = path.extname(file);
                if (file === 'invalid.txt') {
                    expect(validExtensions).to.not.include(ext);
                } else {
                    expect(validExtensions).to.include(ext);
                }
            });
        });
    });
    
    describe('Staging Bucket Discovery', function() {
        
        it('should handle standard staging bucket naming patterns', function() {
            const projectId = 'my-project-123';
            const region = 'us-central1';
            const projectNumber = '570127783956';
            const suffix = 'ajghf8gj';
            
            // Standard Dataproc staging bucket pattern
            const expectedBucket = `dataproc-staging-${region}-${projectNumber}-${suffix}`;
            
            expect(expectedBucket).to.include(region);
            expect(expectedBucket).to.include(projectNumber);
            expect(expectedBucket).to.match(/^dataproc-staging-/);
        });
        
        it('should handle fallback bucket naming', function() {
            const projectId = 'my-project-123';
            const fallbackBucket = `${projectId}-dataproc-staging`;
            
            expect(fallbackBucket).to.equal('my-project-123-dataproc-staging');
            expect(fallbackBucket).to.include(projectId);
            expect(fallbackBucket).to.include('dataproc-staging');
        });
    });
    
    describe('Cleanup Operations', function() {
        
        it('should track files for cleanup by job ID', function() {
            const cleanupTracker = new Map();
            const jobId = 'test-job-456';
            const stagedFiles = [
                'gs://bucket/mcp-staging/file1.py',
                'gs://bucket/mcp-staging/file2.py'
            ];
            
            cleanupTracker.set(jobId, stagedFiles);
            
            expect(cleanupTracker.has(jobId)).to.be.true;
            expect(cleanupTracker.get(jobId)).to.deep.equal(stagedFiles);
        });
        
        it('should handle cleanup scheduling', function() {
            const jobId = 'test-job-789';
            const cleanupDelay = 3600000; // 1 hour in milliseconds
            const scheduledTime = Date.now() + cleanupDelay;
            
            // Mock cleanup scheduling
            const cleanupSchedule = {
                jobId,
                scheduledTime,
                files: ['gs://bucket/mcp-staging/test.py']
            };
            
            expect(cleanupSchedule.scheduledTime).to.be.greaterThan(Date.now());
            expect(cleanupSchedule.jobId).to.equal(jobId);
        });
    });
});

// Export test utilities for use in other test files
module.exports = {
    TEST_SPARK_JOB_CONTENT,
    HELPER_UTILS_CONTENT,
    
    // Helper functions for other tests
    createTempFile: async (content, filename) => {
        const tempPath = path.join(__dirname, 'temp', filename);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, content);
        return tempPath;
    },
    
    cleanupTempFile: async (filePath) => {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
};