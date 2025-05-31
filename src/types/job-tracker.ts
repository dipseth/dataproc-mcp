export interface TrackedJobInfo {
  jobId: string;
  toolName: string;
  submissionTime: string;
  status: string; // e.g., PENDING, RUNNING, DONE, ERROR
  lastUpdated: string;
  resultsCached?: boolean;
  projectId: string;
  region: string;
  clusterName: string;
  duration?: number; // Duration in milliseconds for completed jobs
}

export interface JobTrackerConfig {
  // Configuration options for the job tracker, if any (e.g., max jobs to track)
}

export interface EnhancedJobTrackerConfig extends JobTrackerConfig {
  maxTrackedJobs?: number;
  autoCleanupInterval?: number;
  enableMetrics?: boolean;
}

export interface JobMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  autoUpdateJobs: number;
  averageJobDuration?: number;
}
