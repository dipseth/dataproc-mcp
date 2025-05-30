import { DefaultParameterManager } from '../../src/services/default-params.js';
import { DefaultParameterManagerConfig } from '../../src/types/default-params.js';
import { expect } from 'chai';

describe('DefaultParameterManager', () => {
  let manager: DefaultParameterManager;
  let config: DefaultParameterManagerConfig;

  beforeEach(() => {
    config = {
      defaultEnvironment: 'production',
      parameters: [
        {
          name: 'testParam',
          description: 'Test parameter',
          type: 'string',
          required: true,
          defaultValue: 'default',
        },
        {
          name: 'numericParam',
          type: 'number',
          required: true,
          defaultValue: 10,
          validation: {
            min: 1,
            max: 100,
          },
        },
        {
          name: 'optionalParam',
          type: 'string',
          required: false,
        },
      ],
      environments: [
        {
          environment: 'production',
          parameters: {
            testParam: 'prod-value',
          },
        },
        {
          environment: 'stable',
          parameters: {
            testParam: 'stable-value',
            numericParam: 20,
          },
        },
      ],
    };
    manager = new DefaultParameterManager(config);
  });

  describe('Parameter retrieval', () => {
    it('should get default parameter value', () => {
      const value = manager.getParameterValue('numericParam');
      expect(value).to.equal(10);
    });

    it('should get environment-specific override', () => {
      const value = manager.getParameterValue('testParam', 'stable');
      expect(value).to.equal('stable-value');
    });

    it('should fall back to default when no environment override exists', () => {
      const value = manager.getParameterValue('numericParam', 'production');
      expect(value).to.equal(10);
    });

    it('should return undefined for optional parameters', () => {
      const value = manager.getParameterValue('optionalParam');
      expect(value).to.be.undefined;
    });

    it('should throw error for unknown parameter', () => {
      expect(() => manager.getParameterValue('unknown')).to.throw('Parameter unknown not found');
    });
  });

  describe('Parameter validation', () => {
    it('should validate numeric constraints', () => {
      expect(() => manager.updateEnvironmentParameters('test', { numericParam: 0 })).to.throw(
        'less than minimum'
      );

      expect(() => manager.updateEnvironmentParameters('test', { numericParam: 101 })).to.throw(
        'greater than maximum'
      );
    });

    it('should validate parameter types', () => {
      expect(() =>
        manager.updateEnvironmentParameters('test', { numericParam: 'invalid' })
      ).to.throw('Invalid type');
    });

    it('should validate required parameters', () => {
      expect(() => manager.updateEnvironmentParameters('test', { testParam: undefined })).to.throw(
        'Required parameter'
      );
    });
  });

  describe('Environment management', () => {
    it('should get all parameters for environment', () => {
      const params = manager.getAllParameters('stable');
      expect(params).to.deep.equal({
        testParam: 'stable-value',
        numericParam: 20,
      });
    });

    it('should update environment parameters', () => {
      manager.updateEnvironmentParameters('test', {
        testParam: 'new-value',
        numericParam: 50,
      });

      const params = manager.getAllParameters('test');
      expect(params.testParam).to.equal('new-value');
      expect(params.numericParam).to.equal(50);
    });

    it('should merge environment updates', () => {
      manager.updateEnvironmentParameters('test', { testParam: 'value1' });
      manager.updateEnvironmentParameters('test', { numericParam: 30 });

      const params = manager.getAllParameters('test');
      expect(params).to.deep.equal({
        testParam: 'value1',
        numericParam: 30,
      });
    });
  });

  describe('Parameter definitions', () => {
    it('should get parameter definition', () => {
      const def = manager.getParameterDefinition('testParam');
      expect(def).to.deep.equal({
        name: 'testParam',
        description: 'Test parameter',
        type: 'string',
        required: true,
        defaultValue: 'default',
      });
    });

    it('should get all parameter definitions', () => {
      const defs = manager.getAllParameterDefinitions();
      expect(defs).to.have.length(3);
    });

    it('should add new parameter definition', () => {
      manager.addParameterDefinition({
        name: 'newParam',
        type: 'boolean',
        required: false,
        defaultValue: false,
      });

      const def = manager.getParameterDefinition('newParam');
      expect(def).to.not.be.undefined;
      expect(def?.type).to.equal('boolean');
    });

    it('should prevent duplicate parameter definitions', () => {
      expect(() =>
        manager.addParameterDefinition({
          name: 'testParam',
          type: 'string',
          required: true,
        })
      ).to.throw('already exists');
    });
  });
});
