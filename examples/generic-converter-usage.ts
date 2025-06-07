/**
 * Generic Converter Usage Examples
 * Demonstrates how to use the new generic type-to-Qdrant conversion system
 */

import { GenericQdrantConverter, createGenericConverter, quickConvert } from '../src/services/generic-converter.js';
import { CompressionService } from '../src/services/compression.js';
import { QdrantStorageMetadata } from '../src/types/response-filter.js';
import { ConversionConfig } from '../src/types/generic-converter.js';

// Example data types
interface CustomDataType {
  id: string;
  name: string;
  config: {
    settings: Record<string, any>;
    features: string[];
  };
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
  };
  largeData: string;
  timestamp: string;
}

const exampleData: CustomDataType = {
  id: 'example-001',
  name: 'Example Data Object',
  config: {
    settings: {
      enableFeatureA: true,
      maxConnections: 100,
      timeout: 30000
    },
    features: ['feature1', 'feature2', 'feature3']
  },
  metrics: {
    cpu: 75.5,
    memory: 8192,
    disk: 500000
  },
  largeData: 'x'.repeat(15000), // 15KB of data
  timestamp: new Date().toISOString()
};

const metadata: QdrantStorageMetadata = {
  toolName: 'example-tool',
  timestamp: new Date().toISOString(),
  projectId: 'example-project',
  region: 'us-central1',
  clusterName: 'example-cluster',
  responseType: 'custom_data',
  originalTokenCount: 2000,
  filteredTokenCount: 1000,
  compressionRatio: 0.5,
  type: 'custom'
};

/**
 * Example 1: Basic conversion with automatic configuration
 */
async function basicConversionExample() {
  console.log('🔄 Basic Conversion Example');
  
  const compressionService = new CompressionService();
  
  try {
    // Quick conversion with automatic configuration
    const result = await quickConvert(exampleData, metadata, compressionService);
    
    console.log('✅ Conversion successful!');
    console.log(`📊 Fields processed: ${result.metadata.fieldsProcessed}`);
    console.log(`🗜️ Fields compressed: ${result.metadata.fieldsCompressed}`);
    console.log(`📈 Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%`);
    console.log(`⏱️ Processing time: ${result.metadata.processingTime.toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    throw error;
  }
}

/**
 * Example 2: Advanced conversion with custom configuration
 */
async function advancedConversionExample() {
  console.log('\n🔧 Advanced Conversion Example');
  
  const compressionService = new CompressionService();
  const converter = createGenericConverter(compressionService);
  
  // Custom configuration
  const config: ConversionConfig<CustomDataType> = {
    // Custom field mappings
    fieldMappings: {
      id: 'entityId',
      name: 'entityName',
      config: 'configuration',
      metrics: 'performanceMetrics'
    },
    
    // Compression rules
    compressionRules: {
      fields: ['largeData', 'config'],
      sizeThreshold: 5120, // 5KB threshold
      compressionType: 'gzip'
    },
    
    // Field transformations
    transformations: {
      timestamp: (value) => new Date(value).toISOString(),
      metrics: (value) => ({
        ...value,
        cpuPercent: value.cpu,
        memoryMB: Math.round(value.memory / 1024 / 1024),
        diskGB: Math.round(value.disk / 1024 / 1024 / 1024)
      })
    },
    
    // Metadata injection
    metadata: {
      autoTimestamp: true,
      autoUUID: false,
      customFields: {
        processingVersion: () => '2.0.0',
        environment: () => 'production'
      }
    }
  };
  
  try {
    const result = await converter.convert(exampleData, metadata, config);
    
    console.log('✅ Advanced conversion successful!');
    console.log(`📊 Fields processed: ${result.metadata.fieldsProcessed}`);
    console.log(`🗜️ Fields compressed: ${result.metadata.fieldsCompressed}`);
    console.log(`📈 Compression ratio: ${(result.metadata.compressionRatio * 100).toFixed(1)}%`);
    console.log(`⏱️ Processing time: ${result.metadata.processingTime.toFixed(2)}ms`);
    
    // Show some payload details
    console.log('\n📋 Payload details:');
    console.log(`- Entity ID: ${(result.payload as any).entityId}`);
    console.log(`- Entity Name: ${(result.payload as any).entityName}`);
    console.log(`- Processing Version: ${(result.payload as any).processingVersion}`);
    console.log(`- Environment: ${(result.payload as any).environment}`);
    
    return result;
  } catch (error) {
    console.error('❌ Advanced conversion failed:', error);
    throw error;
  }
}

/**
 * Example 3: Automatic configuration generation
 */
async function autoConfigExample() {
  console.log('\n🤖 Auto Configuration Example');
  
  const compressionService = new CompressionService();
  const converter = createGenericConverter(compressionService);
  
  try {
    // Generate automatic configuration
    const autoConfig = await converter.createConfigForType(exampleData, 'auto');
    
    console.log('✅ Auto configuration generated!');
    console.log(`📋 Field mappings: ${Object.keys(autoConfig.fieldMappings || {}).length}`);
    console.log(`🗜️ Compression fields: ${autoConfig.compressionRules?.fields.length || 0}`);
    console.log(`🔧 Transformations: ${Object.keys(autoConfig.transformations || {}).length}`);
    
    // Use the auto configuration
    const result = await converter.convert(exampleData, metadata, autoConfig);
    
    console.log(`📊 Conversion with auto config successful!`);
    console.log(`⏱️ Processing time: ${result.metadata.processingTime.toFixed(2)}ms`);
    
    return result;
  } catch (error) {
    console.error('❌ Auto config conversion failed:', error);
    throw error;
  }
}

/**
 * Example 4: Validation and error handling
 */
async function validationExample() {
  console.log('\n🔍 Validation Example');
  
  const compressionService = new CompressionService();
  const converter = createGenericConverter(compressionService);
  
  // Test with valid data
  const validationResult = await converter.validateSource(exampleData);
  
  console.log('📋 Validation Results:');
  console.log(`✅ Valid: ${validationResult.isValid}`);
  console.log(`❌ Errors: ${validationResult.errors.length}`);
  console.log(`⚠️ Warnings: ${validationResult.warnings.length}`);
  console.log(`💡 Suggestions: ${validationResult.suggestions.length}`);
  
  if (validationResult.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    validationResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  if (validationResult.suggestions.length > 0) {
    console.log('\n💡 Suggestions:');
    validationResult.suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
  }
  
  // Test with problematic data
  const problematicData = {
    id: 'test-id', // Reserved field
    vector: [1, 2, 3], // Reserved field
    circularRef: {} as any
  };
  problematicData.circularRef = problematicData; // Create circular reference
  
  const problematicValidation = await converter.validateSource(problematicData);
  
  console.log('\n🚨 Problematic Data Validation:');
  console.log(`✅ Valid: ${problematicValidation.isValid}`);
  console.log(`❌ Errors: ${problematicValidation.errors.length}`);
  
  if (problematicValidation.errors.length > 0) {
    console.log('\n❌ Errors:');
    problematicValidation.errors.forEach(error => console.log(`  - ${error}`));
  }
}

/**
 * Example 5: Performance metrics tracking
 */
async function metricsExample() {
  console.log('\n📈 Metrics Example');
  
  const compressionService = new CompressionService();
  const converter = createGenericConverter(compressionService);
  
  // Perform multiple conversions
  console.log('🔄 Performing multiple conversions...');
  
  for (let i = 0; i < 5; i++) {
    const testData = {
      ...exampleData,
      id: `test-${i}`,
      iteration: i
    };
    
    await converter.convert(testData, metadata);
  }
  
  // Get metrics
  const metrics = converter.getMetrics();
  
  console.log('📊 Conversion Metrics:');
  console.log(`🔢 Total conversions: ${metrics.totalConversions}`);
  console.log(`⏱️ Average processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
  console.log(`🗜️ Average compression ratio: ${(metrics.averageCompressionRatio * 100).toFixed(1)}%`);
  
  // Reset metrics
  converter.resetMetrics();
  const resetMetrics = converter.getMetrics();
  console.log(`🔄 Metrics reset - Total conversions: ${resetMetrics.totalConversions}`);
}

/**
 * Main function to run all examples
 */
async function runAllExamples() {
  console.log('🚀 Generic Converter Usage Examples\n');
  
  try {
    await basicConversionExample();
    await advancedConversionExample();
    await autoConfigExample();
    await validationExample();
    await metricsExample();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n💥 Example execution failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
export {
  basicConversionExample,
  advancedConversionExample,
  autoConfigExample,
  validationExample,
  metricsExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}