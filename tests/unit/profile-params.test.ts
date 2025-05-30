import { expect } from 'chai';
import { ProfileManager } from '../../src/services/profile.js';
import { DefaultParameterManager } from '../../src/services/default-params.js';
import { DefaultParameterManagerConfig } from '../../src/types/default-params.js';

describe('Profile Parameter Integration', () => {
  let profileManager: ProfileManager;
  let parameterManager: DefaultParameterManager;

  beforeEach(() => {
    // Set up DefaultParameterManager with test config
    const paramConfig: DefaultParameterManagerConfig = {
      defaultEnvironment: 'production',
      parameters: [
        {
          name: 'machineType',
          description: 'GCP machine type',
          type: 'string',
          required: true,
          defaultValue: 'n1-standard-4',
        },
        {
          name: 'numWorkers',
          description: 'Number of workers',
          type: 'number',
          required: true,
          defaultValue: 2,
          validation: {
            min: 2,
            max: 10,
          },
        },
      ],
      environments: [
        {
          environment: 'production',
          parameters: {
            machineType: 'n1-standard-8',
            numWorkers: 4,
          },
        },
        {
          environment: 'stable',
          parameters: {
            machineType: 'n1-standard-4',
            numWorkers: 2,
          },
        },
      ],
    };

    parameterManager = new DefaultParameterManager(paramConfig);

    // Set up ProfileManager with test config and parameter manager
    profileManager = new ProfileManager(
      {
        rootConfigPath: './test/profiles',
        defaultParameters: {
          environment: 'production',
          validateParameters: true,
        },
      },
      parameterManager
    );
  });

  describe('Parameter Resolution', () => {
    it('should merge default parameters with profile overrides', async () => {
      // Mock profile with overrides
      const profileInfo = {
        id: 'test/profile1',
        name: 'test-cluster',
        path: './test/profiles/test/profile1.yaml',
        category: 'test',
        timesUsed: 0,
        parameters: {
          numWorkers: 6,
        },
      };

      // Add profile manually since we're not reading from disk
      (profileManager as any).profiles.set(profileInfo.id, profileInfo);

      const params = profileManager.getProfileParameters('test/profile1');
      expect(params).to.deep.equal({
        machineType: 'n1-standard-8', // From production environment
        numWorkers: 6, // From profile override
      });
    });

    it('should validate parameters against constraints', () => {
      const invalidProfile = {
        id: 'test/invalid',
        name: 'invalid-cluster',
        path: './test/profiles/test/invalid.yaml',
        category: 'test',
        timesUsed: 0,
        parameters: {
          numWorkers: 20, // Exceeds max value of 10
        },
      };

      // Add profile manually
      expect(() => {
        (profileManager as any).profiles.set(invalidProfile.id, invalidProfile);
        (profileManager as any).validateProfileParameters(invalidProfile);
      }).to.throw('Value 20 for parameter numWorkers is greater than maximum 10');
    });

    it('should use environment-specific defaults when no profile override', async () => {
      const profileInfo = {
        id: 'test/profile2',
        name: 'test-cluster',
        path: './test/profiles/test/profile2.yaml',
        category: 'test',
        timesUsed: 0,
        parameters: {}, // No overrides
      };

      // Add profile manually
      (profileManager as any).profiles.set(profileInfo.id, profileInfo);

      const params = profileManager.getProfileParameters('test/profile2');
      expect(params).to.deep.equal({
        machineType: 'n1-standard-8',
        numWorkers: 4,
      });
    });

    it('should handle profiles without parameters', async () => {
      const profileInfo = {
        id: 'test/profile3',
        name: 'test-cluster',
        path: './test/profiles/test/profile3.yaml',
        category: 'test',
        timesUsed: 0,
      };

      // Add profile manually
      (profileManager as any).profiles.set(profileInfo.id, profileInfo);

      const params = profileManager.getProfileParameters('test/profile3');
      expect(params).to.deep.equal({
        machineType: 'n1-standard-8',
        numWorkers: 4,
      });
    });
  });

  describe('Environment Switching', () => {
    it('should use correct environment parameters', async () => {
      // Set ProfileManager to use 'stable' environment
      const stableProfileManager = new ProfileManager(
        {
          rootConfigPath: './test/profiles',
          defaultParameters: {
            environment: 'stable',
            validateParameters: true,
          },
        },
        parameterManager
      );

      const profileInfo = {
        id: 'test/profile4',
        name: 'test-cluster',
        path: './test/profiles/test/profile4.yaml',
        category: 'test',
        timesUsed: 0,
        parameters: {},
      };

      // Add profile manually
      (stableProfileManager as any).profiles.set(profileInfo.id, profileInfo);

      const params = stableProfileManager.getProfileParameters('test/profile4');
      expect(params).to.deep.equal({
        machineType: 'n1-standard-4',
        numWorkers: 2,
      });
    });
  });
});
