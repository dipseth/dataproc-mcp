/**
 * Unit Tests for Validation Schemas
 *
 * Tests the Zod validation schemas used throughout the application.
 */

import { expect } from 'chai';
import {
  StartDataprocClusterSchema,
  ListClustersSchema,
  SubmitHiveQuerySchema,
  CreateClusterFromProfileSchema,
} from '../../src/validation/schemas.ts';

describe('Validation Schemas', () => {
  describe('StartDataprocClusterSchema', () => {
    it('should validate valid cluster creation request', () => {
      const validInput = {
        clusterName: 'test-cluster-123',
        projectId: 'my-project',
        region: 'us-central1',
      };

      const result = StartDataprocClusterSchema.safeParse(validInput);
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.clusterName).to.equal('test-cluster-123');
      }
    });

    it('should reject invalid cluster names', () => {
      const invalidInputs = [
        { clusterName: 'Test_Cluster', projectId: 'my-project', region: 'us-central1' }, // uppercase
        { clusterName: 'test-cluster-', projectId: 'my-project', region: 'us-central1' }, // trailing dash
        { clusterName: '123-cluster', projectId: 'my-project', region: 'us-central1' }, // starts with number
        { clusterName: 'a', projectId: 'my-project', region: 'us-central1' }, // too short
        { clusterName: 'a'.repeat(64), projectId: 'my-project', region: 'us-central1' }, // too long
      ];

      invalidInputs.forEach((input) => {
        const result = StartDataprocClusterSchema.safeParse(input);
        expect(result.success).to.be.false;
      });
    });

    it('should reject invalid project IDs', () => {
      const invalidInputs = [
        { clusterName: 'test-cluster', projectId: 'Project_123', region: 'us-central1' }, // uppercase
        { clusterName: 'test-cluster', projectId: '123project', region: 'us-central1' }, // starts with number
        { clusterName: 'test-cluster', projectId: 'a', region: 'us-central1' }, // too short
        { clusterName: 'test-cluster', projectId: 'a'.repeat(64), region: 'us-central1' }, // too long
      ];

      invalidInputs.forEach((input) => {
        const result = StartDataprocClusterSchema.safeParse(input);
        expect(result.success).to.be.false;
      });
    });

    it('should reject invalid regions', () => {
      const invalidInputs = [
        { clusterName: 'test-cluster', projectId: 'my-project', region: 'invalid-region' },
        { clusterName: 'test-cluster', projectId: 'my-project', region: 'us_central1' }, // underscore
        { clusterName: 'test-cluster', projectId: 'my-project', region: '' }, // empty
      ];

      invalidInputs.forEach((input) => {
        const result = StartDataprocClusterSchema.safeParse(input);
        expect(result.success).to.be.false;
      });
    });
  });

  describe('ListClustersSchema', () => {
    it('should validate empty input', () => {
      const result = ListClustersSchema.safeParse({});
      expect(result.success).to.be.true;
    });

    it('should validate with optional parameters', () => {
      const validInput = {
        projectId: 'my-project',
        region: 'us-central1',
        filter: 'status.state=RUNNING',
        pageSize: 50,
      };

      const result = ListClustersSchema.safeParse(validInput);
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.pageSize).to.equal(50);
      }
    });

    it('should reject invalid page sizes', () => {
      const invalidInputs = [{ pageSize: 0 }, { pageSize: 1001 }, { pageSize: -1 }];

      invalidInputs.forEach((input) => {
        const result = ListClustersSchema.safeParse(input);
        expect(result.success).to.be.false;
      });
    });
  });

  describe('SubmitHiveQuerySchema', () => {
    it('should validate basic Hive query', () => {
      const validInput = {
        projectId: 'my-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        query: 'SHOW TABLES;',
      };

      const result = SubmitHiveQuerySchema.safeParse(validInput);
      expect(result.success).to.be.true;
    });

    it('should reject empty queries', () => {
      const invalidInput = {
        projectId: 'my-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        query: '',
      };

      const result = SubmitHiveQuerySchema.safeParse(invalidInput);
      expect(result.success).to.be.false;
    });

    it('should validate with query options', () => {
      const validInput = {
        projectId: 'my-project',
        region: 'us-central1',
        clusterName: 'test-cluster',
        query: 'SELECT * FROM table;',
        queryOptions: {
          timeoutMs: 30000,
          parameters: { param1: 'value1' },
          properties: { 'hive.exec.dynamic.partition': 'true' },
        },
      };

      const result = SubmitHiveQuerySchema.safeParse(validInput);
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.queryOptions?.timeoutMs).to.equal(30000);
      }
    });
  });

  describe('CreateClusterFromProfileSchema', () => {
    it('should validate profile-based cluster creation', () => {
      const validInput = {
        projectId: 'my-project',
        region: 'us-central1',
        profileName: 'development-small',
        clusterName: 'test-cluster',
      };

      const result = CreateClusterFromProfileSchema.safeParse(validInput);
      expect(result.success).to.be.true;
    });

    it('should validate with overrides', () => {
      const validInput = {
        projectId: 'my-project',
        region: 'us-central1',
        profileName: 'development-small',
        clusterName: 'test-cluster',
        overrides: {
          workerConfig: {
            numInstances: 5,
          },
        },
      };

      const result = CreateClusterFromProfileSchema.safeParse(validInput);
      expect(result.success).to.be.true;
      if (result.success) {
        expect(result.data.overrides?.workerConfig?.numInstances).to.equal(5);
      }
    });

    it('should reject invalid profile names', () => {
      const invalidInputs = [
        { projectId: 'my-project', region: 'us-central1', profileName: '', clusterName: 'test' },
        {
          projectId: 'my-project',
          region: 'us-central1',
          profileName: 'invalid/profile',
          clusterName: 'test',
        },
        {
          projectId: 'my-project',
          region: 'us-central1',
          profileName: 'profile with spaces',
          clusterName: 'test',
        },
      ];

      invalidInputs.forEach((input) => {
        const result = CreateClusterFromProfileSchema.safeParse(input);
        expect(result.success).to.be.false;
      });
    });
  });
});
