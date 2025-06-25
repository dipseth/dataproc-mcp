/**
 * Test the modern Transformers.js embedding service
 */

import { expect } from 'chai';
import { TransformersEmbeddingService } from '../../../src/services/transformers-embeddings';

interface TestClusterData {
  clusterName: string;
  projectId: string;
  region: string;
  config: {
    softwareConfig?: {
      properties?: Record<string, string>;
      optionalComponents?: string[];
    };
    masterConfig?: {
      machineTypeUri?: string;
      numInstances?: number;
    };
  };
  labels: Record<string, string>;
  [key: string]: unknown;
}

describe('TransformersEmbeddingService', () => {
  let embeddingService: TransformersEmbeddingService;
  let testClusterData: TestClusterData;

  beforeEach(() => {
    embeddingService = new TransformersEmbeddingService();
    
    // Test cluster data similar to what we get from GCP - using proper types
    testClusterData = {
      clusterName: 'test-pandas-cluster',
      projectId: 'test-project',
      region: 'us-central1',
      config: {
        softwareConfig: {
          properties: {
            'dataproc:pip.packages': 'pandas==1.3.5,numpy==1.21.6,scikit-learn==1.0.2,matplotlib==3.5.1'
          },
          optionalComponents: ['ZEPPELIN', 'JUPYTER']
        },
        masterConfig: {
          machineTypeUri: 'projects/test/zones/us-central1-f/machineTypes/n1-standard-8',
          numInstances: 1
        }
      },
      labels: {
        service: 'data-science',
        team: 'ml-team',
        environment: 'production'
      }
    };
  });

  it('should initialize the embedding service', () => {
    expect(embeddingService).to.be.instanceOf(TransformersEmbeddingService);
  });

  it('should get initial stats', () => {
    const stats = embeddingService.getStats();
    expect(stats).to.have.property('modelName');
    expect(stats).to.have.property('documentsProcessed');
    expect(stats.documentsProcessed).to.be.a('number');
  });

  it('should train on cluster data', () => {
    embeddingService.trainOnClusterData(testClusterData);
    const stats = embeddingService.getStats();
    expect(stats.documentsProcessed).to.be.greaterThan(0);
  });

  it('should generate embeddings for queries', async () => {
    const query = 'pandas numpy data science';
    const embedding = await embeddingService.generateEmbedding(query);
    
    expect(embedding).to.be.an('array');
    expect(embedding.length).to.be.greaterThan(0);
    
    // Check that it's a valid embedding vector (normalized)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).to.be.greaterThan(0);
  });

  it('should generate cluster embeddings', async () => {
    const clusterEmbedding = await embeddingService.generateClusterEmbedding(testClusterData);
    
    expect(clusterEmbedding).to.be.an('array');
    expect(clusterEmbedding.length).to.be.greaterThan(0);
    
    const magnitude = Math.sqrt(clusterEmbedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).to.be.greaterThan(0);
  });

  it('should search training data', () => {
    embeddingService.trainOnClusterData(testClusterData);
    const searchResults = embeddingService.searchTrainingData('pandas');
    
    expect(searchResults).to.be.an('array');
    if (searchResults.length > 0) {
      expect(searchResults[0]).to.have.property('extractedText');
      expect(searchResults[0]).to.have.property('clusterName');
    }
  });

  it('should save training data', () => {
    embeddingService.trainOnClusterData(testClusterData);
    expect(() => embeddingService.saveTrainingDataNow()).to.not.throw();
  });

  it('should get sample training data', () => {
    embeddingService.trainOnClusterData(testClusterData);
    const samples = embeddingService.getSampleTrainingData(1);
    
    expect(samples).to.be.an('array');
    if (samples.length > 0) {
      expect(samples[0]).to.have.property('clusterName');
      expect(samples[0]).to.have.property('extractedText');
    }
  });
});