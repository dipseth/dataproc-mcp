/**
 * Test for YAML metadata key preservation
 * Ensures that metadata keys remain in their original format (snake_case)
 * while other configuration keys are converted to camelCase
 */

import { expect } from 'chai';
import { convertYamlToDataprocConfig } from '../../build/config/yaml.js';

describe('YAML Metadata Key Preservation', () => {
  describe('Enhanced YAML format', () => {
    it('should preserve snake_case metadata keys while converting other keys to camelCase', () => {
      const yamlConfig = {
        'test-project-123': {
          region: 'us-central1',
          labels: {
            service: 'test-service',
            owner: 'test-owner'
          },
          cluster_config: {
            gce_cluster_config: {
              zone_uri: 'us-central1-f',
              service_account: 'test@example.com',
              metadata: {
                artifact_urls: 'com/example/artifact.zip',
                secret_name: 'test-secret',
                key_store_file_name: 'test.jks',
                dataproc_cluster_name: 'test-cluster'
              }
            },
            master_config: {
              num_instances: 1,
              machine_type_uri: 'e2-standard-8',
              disk_config: {
                boot_disk_type: 'pd-standard',
                boot_disk_size_gb: 512
              }
            },
            software_config: {
              optional_components: ['ZEPPELIN'],
              image_version: '1.5-debian10'
            }
          }
        }
      };

      const result = convertYamlToDataprocConfig(yamlConfig, 'test-config.yaml');

      // Verify that top-level config keys are converted to camelCase
      expect(result.config).to.have.property('gceClusterConfig');
      expect(result.config).to.have.property('masterConfig');
      expect(result.config).to.have.property('softwareConfig');

      // Verify that nested config keys are converted to camelCase
      expect(result.config.gceClusterConfig).to.have.property('zoneUri');
      expect(result.config.gceClusterConfig).to.have.property('serviceAccount');
      expect(result.config.masterConfig).to.have.property('numInstances');
      expect(result.config.masterConfig).to.have.property('machineTypeUri');
      expect(result.config.masterConfig).to.have.property('diskConfig');
      expect(result.config.masterConfig.diskConfig).to.have.property('bootDiskType');
      expect(result.config.masterConfig.diskConfig).to.have.property('bootDiskSizeGb');
      expect(result.config.softwareConfig).to.have.property('optionalComponents');
      expect(result.config.softwareConfig).to.have.property('imageVersion');

      // CRITICAL: Verify that metadata keys remain in snake_case
      expect(result.config.gceClusterConfig).to.have.property('metadata');
      const metadata = result.config.gceClusterConfig.metadata;
      
      // These should remain in snake_case format
      expect(metadata).to.have.property('artifact_urls');
      expect(metadata).to.have.property('secret_name');
      expect(metadata).to.have.property('key_store_file_name');
      expect(metadata).to.have.property('dataproc_cluster_name');
      
      // These should NOT exist (would be the camelCase versions)
      expect(metadata).to.not.have.property('artifactUrls');
      expect(metadata).to.not.have.property('secretName');
      expect(metadata).to.not.have.property('keyStoreFileName');
      expect(metadata).to.not.have.property('dataprocClusterName');

      // Verify the actual values are preserved
      expect(metadata.artifact_urls).to.equal('com/example/artifact.zip');
      expect(metadata.secret_name).to.equal('test-secret');
      expect(metadata.key_store_file_name).to.equal('test.jks');
      expect(metadata.dataproc_cluster_name).to.equal('test-cluster');
    });

    it('should handle metadata with mixed naming conventions', () => {
      const yamlConfig = {
        'test-project-456': {
          region: 'us-west1',
          cluster_config: {
            gce_cluster_config: {
              metadata: {
                // Mix of snake_case and camelCase (both should be preserved)
                artifact_urls: 'snake_case_value',
                artifactUrls: 'camelCase_value',
                secret_name: 'snake_secret',
                secretName: 'camel_secret'
              }
            }
          }
        }
      };

      const result = convertYamlToDataprocConfig(yamlConfig, 'mixed-config.yaml');
      const metadata = result.config.gceClusterConfig.metadata;

      // Both naming conventions should be preserved in metadata
      expect(metadata).to.have.property('artifact_urls');
      expect(metadata).to.have.property('artifactUrls');
      expect(metadata).to.have.property('secret_name');
      expect(metadata).to.have.property('secretName');

      expect(metadata.artifact_urls).to.equal('snake_case_value');
      expect(metadata.artifactUrls).to.equal('camelCase_value');
      expect(metadata.secret_name).to.equal('snake_secret');
      expect(metadata.secretName).to.equal('camel_secret');
    });

    it('should handle nested metadata objects correctly', () => {
      const yamlConfig = {
        'test-project-789': {
          region: 'europe-west1',
          cluster_config: {
            gce_cluster_config: {
              metadata: {
                simple_key: 'simple_value',
                nested_config: {
                  inner_snake_key: 'inner_value',
                  another_nested: {
                    deep_snake_key: 'deep_value'
                  }
                }
              }
            }
          }
        }
      };

      const result = convertYamlToDataprocConfig(yamlConfig, 'nested-config.yaml');
      const metadata = result.config.gceClusterConfig.metadata;

      // All metadata keys should remain in original format, even nested ones
      expect(metadata).to.have.property('simple_key');
      expect(metadata).to.have.property('nested_config');
      expect(metadata.nested_config).to.have.property('inner_snake_key');
      expect(metadata.nested_config).to.have.property('another_nested');
      expect(metadata.nested_config.another_nested).to.have.property('deep_snake_key');

      expect(metadata.simple_key).to.equal('simple_value');
      expect(metadata.nested_config.inner_snake_key).to.equal('inner_value');
      expect(metadata.nested_config.another_nested.deep_snake_key).to.equal('deep_value');
    });
  });

  describe('Configuration validation', () => {
    it('should convert non-metadata configuration keys to camelCase', () => {
      const yamlConfig = {
        'validation-project': {
          region: 'asia-east1',
          cluster_config: {
            master_config: {
              machine_type_uri: 'n1-standard-4',
              disk_config: {
                boot_disk_size_gb: 100,
                local_ssd_interface: 'SCSI'
              }
            },
            worker_config: {
              num_instances: 2,
              preemptibility: 'PREEMPTIBLE'
            },
            software_config: {
              optional_components: ['JUPYTER'],
              image_version: '2.0-debian10'
            }
          }
        }
      };

      const result = convertYamlToDataprocConfig(yamlConfig, 'validation-config.yaml');

      // Verify camelCase conversion for configuration
      expect(result.config.masterConfig.machineTypeUri).to.equal('n1-standard-4');
      expect(result.config.masterConfig.diskConfig.bootDiskSizeGb).to.equal(100);
      expect(result.config.masterConfig.diskConfig.localSsdInterface).to.equal('SCSI');
      expect(result.config.workerConfig.numInstances).to.equal(2);
      expect(result.config.workerConfig.preemptibility).to.equal('PREEMPTIBLE');
      expect(result.config.softwareConfig.optionalComponents).to.deep.equal(['JUPYTER']);
      expect(result.config.softwareConfig.imageVersion).to.equal('2.0-debian10');
    });
  });
});