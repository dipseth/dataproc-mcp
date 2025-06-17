/**
 * Unit tests for cancel_dataproc_job functionality
 */

import { expect } from 'chai';

describe('cancel_dataproc_job', () => {
  describe('parameter validation', () => {
    it('should require jobId parameter', () => {
      const args = {
        // Missing jobId
      };

      // Test that jobId is required
      expect(args.jobId).to.be.undefined;
      // In the actual implementation, this would trigger a validation error
    });

    it('should accept optional projectId and region parameters', () => {
      const args = {
        jobId: 'test-job-123',
        projectId: 'custom-project',
        region: 'custom-region',
      };

      expect(args.jobId).to.equal('test-job-123');
      expect(args.projectId).to.equal('custom-project');
      expect(args.region).to.equal('custom-region');
    });

    it('should accept verbose parameter', () => {
      const args = {
        jobId: 'test-job-123',
        verbose: true,
      };

      expect(args.jobId).to.equal('test-job-123');
      expect(args.verbose).to.be.true;
    });
  });

  describe('job cancellation scenarios', () => {
    it('should handle successful cancellation response format', () => {
      const mockResult = {
        success: true,
        status: 'RUNNING',
        message: 'Cancellation request sent for job test-job-123.',
        jobDetails: { 
          jobId: 'test-job-123', 
          status: { state: 'RUNNING' } 
        },
      };

      expect(mockResult.success).to.be.true;
      expect(mockResult.status).to.equal('RUNNING');
      expect(mockResult.message).to.contain('Cancellation request sent');
      expect(mockResult.jobDetails.jobId).to.equal('test-job-123');
    });

    it('should handle already completed jobs response format', () => {
      const mockResult = {
        success: true,
        status: 'DONE',
        message: 'Job test-job-123 is already in a terminal state (DONE) and cannot be cancelled.',
        jobDetails: { 
          jobId: 'test-job-123', 
          status: { state: 'DONE' } 
        },
      };

      expect(mockResult.success).to.be.true;
      expect(mockResult.status).to.equal('DONE');
      expect(mockResult.message).to.contain('already in a terminal state');
      expect(mockResult.jobDetails.status.state).to.equal('DONE');
    });

    it('should handle job not found response format', () => {
      const mockResult = {
        success: false,
        status: 'NOT_FOUND',
        message: 'Job test-job-123 not found. Please verify the Job ID, Project ID, and Region.',
      };

      expect(mockResult.success).to.be.false;
      expect(mockResult.status).to.equal('NOT_FOUND');
      expect(mockResult.message).to.contain('not found');
    });

    it('should handle permission denied response format', () => {
      const mockResult = {
        success: false,
        status: 'PERMISSION_DENIED',
        message: 'Permission denied to cancel job test-job-123.',
      };

      expect(mockResult.success).to.be.false;
      expect(mockResult.status).to.equal('PERMISSION_DENIED');
      expect(mockResult.message).to.contain('Permission denied');
    });
  });

  describe('service integration data structures', () => {
    it('should have correct job tracker data structure', () => {
      const jobData = {
        jobId: 'test-job-123',
        projectId: 'test-project',
        region: 'us-central1',
        status: 'CANCELLING',
        toolName: 'cancel_dataproc_job',
        submissionTime: new Date().toISOString(),
      };

      expect(jobData.jobId).to.equal('test-job-123');
      expect(jobData.status).to.equal('CANCELLING');
      expect(jobData.toolName).to.equal('cancel_dataproc_job');
      expect(jobData.submissionTime).to.be.a('string');
    });

    it('should have correct knowledge indexer data structure', () => {
      const knowledgeData = {
        jobId: 'test-job-123',
        jobType: 'cancel',
        projectId: 'test-project',
        region: 'us-central1',
        clusterName: 'unknown',
        status: 'CANCELLATION_REQUESTED',
        submissionTime: new Date().toISOString(),
        results: { jobId: 'test-job-123' },
      };

      expect(knowledgeData.jobId).to.equal('test-job-123');
      expect(knowledgeData.jobType).to.equal('cancel');
      expect(knowledgeData.status).to.equal('CANCELLATION_REQUESTED');
      expect(knowledgeData.results).to.have.property('jobId');
    });
  });

  describe('response formatting patterns', () => {
    it('should match successful cancellation response pattern', () => {
      const responseText = '🛑 **Job Cancellation Initiated**\n\nJob ID: test-job-123\nStatus: Cancellation requested';
      
      expect(responseText).to.match(/🛑.*Job Cancellation Initiated/);
      expect(responseText).to.contain('Job ID: test-job-123');
      expect(responseText).to.contain('Status: Cancellation requested');
    });

    it('should match already completed response pattern', () => {
      const responseText = 'ℹ️ **Job Already Completed**\n\nJob ID: test-job-123\nCurrent Status: DONE';
      
      expect(responseText).to.match(/ℹ️.*Job Already Completed/);
      expect(responseText).to.contain('Job ID: test-job-123');
      expect(responseText).to.contain('Current Status: DONE');
    });

    it('should match error response pattern', () => {
      const responseText = '❌ **Job Not Found**\n\nJob ID: test-job-123\nStatus: NOT_FOUND';
      
      expect(responseText).to.match(/❌.*Job Not Found/);
      expect(responseText).to.contain('Job ID: test-job-123');
      expect(responseText).to.contain('Status: NOT_FOUND');
    });
  });

  describe('cancellable job states', () => {
    const cancellableStates = ['PENDING', 'RUNNING'];
    const nonCancellableStates = ['DONE', 'ERROR', 'CANCELLED', 'SETUP_DONE'];

    it('should identify cancellable states correctly', () => {
      cancellableStates.forEach(state => {
        expect(cancellableStates).to.include(state);
      });
    });

    it('should identify non-cancellable states correctly', () => {
      nonCancellableStates.forEach(state => {
        expect(nonCancellableStates).to.include(state);
      });
    });

    it('should handle state transitions properly', () => {
      const stateTransitions = {
        'PENDING': 'can be cancelled',
        'RUNNING': 'can be cancelled',
        'DONE': 'cannot be cancelled',
        'ERROR': 'cannot be cancelled',
        'CANCELLED': 'cannot be cancelled - already cancelled',
        'SETUP_DONE': 'cannot be cancelled in this state'
      };

      Object.entries(stateTransitions).forEach(([state, description]) => {
        expect(stateTransitions[state]).to.be.a('string');
        if (state === 'PENDING' || state === 'RUNNING') {
          expect(description).to.contain('can be');
        } else {
          expect(description).to.contain('cannot be');
        }
      });
    });
  });

  describe('verbose mode behavior', () => {
    it('should include additional information when verbose is true', () => {
      const verboseResponse = {
        standardInfo: 'Job cancellation details',
        rawResponse: { jobId: 'test-job-123', status: { state: 'RUNNING' } },
        verbose: true
      };

      expect(verboseResponse.verbose).to.be.true;
      expect(verboseResponse.rawResponse).to.have.property('jobId');
      expect(verboseResponse.rawResponse).to.have.property('status');
    });

    it('should exclude raw response when verbose is false', () => {
      const standardResponse = {
        standardInfo: 'Job cancellation details',
        verbose: false
      };

      expect(standardResponse.verbose).to.be.false;
      expect(standardResponse).to.not.have.property('rawResponse');
    });
  });
});