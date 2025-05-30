import { expect } from 'chai';
import { ProfileManager } from '../../build/services/profile.js';
import { DefaultParameterManager } from '../../build/services/default-params.js';
describe('Profile Parameter Integration', () => {
    let profileManager;
    let parameterManager;
    beforeEach(() => {
        // Set up DefaultParameterManager with test config
        const paramConfig = {
            defaultEnvironment: 'production',
            parameters: [
                {
                    name: 'machineType',
                    description: 'GCP machine type',
                    type: 'string',
                    required: true,
                    defaultValue: 'n1-standard-4'
                },
                {
                    name: 'numWorkers',
                    description: 'Number of workers',
                    type: 'number',
                    required: true,
                    defaultValue: 2,
                    validation: {
                        min: 2,
                        max: 10
                    }
                }
            ],
            environments: [
                {
                    environment: 'production',
                    parameters: {
                        machineType: 'n1-standard-8',
                        numWorkers: 4
                    }
                },
                {
                    environment: 'stable',
                    parameters: {
                        machineType: 'n1-standard-4',
                        numWorkers: 2
                    }
                }
            ]
        };
        parameterManager = new DefaultParameterManager(paramConfig);
        // Set up ProfileManager with test config and parameter manager
        profileManager = new ProfileManager({
            rootConfigPath: './test/profiles',
            defaultParameters: {
                environment: 'production',
                validateParameters: true
            }
        }, parameterManager);
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
                    numWorkers: 6
                }
            };
            // Add profile manually since we're not reading from disk
            profileManager.profiles.set(profileInfo.id, profileInfo);
            const params = profileManager.getProfileParameters('test/profile1');
            expect(params).to.deep.equal({
                machineType: 'n1-standard-8', // From production environment
                numWorkers: 6 // From profile override
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
                    numWorkers: 20 // Exceeds max value of 10
                }
            };
            // Add profile manually
            expect(() => {
                profileManager.profiles.set(invalidProfile.id, invalidProfile);
                profileManager.validateProfileParameters(invalidProfile);
            }).to.throw('greater than maximum');
        });
        it('should use environment-specific defaults when no profile override', async () => {
            const profileInfo = {
                id: 'test/profile2',
                name: 'test-cluster',
                path: './test/profiles/test/profile2.yaml',
                category: 'test',
                timesUsed: 0,
                parameters: {} // No overrides
            };
            // Add profile manually
            profileManager.profiles.set(profileInfo.id, profileInfo);
            const params = profileManager.getProfileParameters('test/profile2');
            expect(params).to.deep.equal({
                machineType: 'n1-standard-8',
                numWorkers: 4
            });
        });
        it('should handle profiles without parameters', async () => {
            const profileInfo = {
                id: 'test/profile3',
                name: 'test-cluster',
                path: './test/profiles/test/profile3.yaml',
                category: 'test',
                timesUsed: 0
            };
            // Add profile manually
            profileManager.profiles.set(profileInfo.id, profileInfo);
            const params = profileManager.getProfileParameters('test/profile3');
            expect(params).to.deep.equal({
                machineType: 'n1-standard-8',
                numWorkers: 4
            });
        });
    });
    describe('Environment Switching', () => {
        it('should use correct environment parameters', async () => {
            // Set ProfileManager to use 'stable' environment
            const stableProfileManager = new ProfileManager({
                rootConfigPath: './test/profiles',
                defaultParameters: {
                    environment: 'stable',
                    validateParameters: true
                }
            }, parameterManager);
            const profileInfo = {
                id: 'test/profile4',
                name: 'test-cluster',
                path: './test/profiles/test/profile4.yaml',
                category: 'test',
                timesUsed: 0,
                parameters: {}
            };
            // Add profile manually
            stableProfileManager.profiles.set(profileInfo.id, profileInfo);
            const params = stableProfileManager.getProfileParameters('test/profile4');
            expect(params).to.deep.equal({
                machineType: 'n1-standard-4',
                numWorkers: 2
            });
        });
    });
});
