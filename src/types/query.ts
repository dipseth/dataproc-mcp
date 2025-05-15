/**
 * Type definitions for Hive query operations
 */

export interface HiveQueryConfig {
  query: string;
  scriptVariables?: Record<string, string>;
  properties?: Record<string, string>;
  continueOnFailure?: boolean;
  queryList?: HiveQueryList;
  jarFileUris?: string[];
}

export interface HiveQueryList {
  queries?: string[];
}

export interface QueryOptions {
  timeoutMs?: number;
  parameters?: Record<string, string>;
  properties?: Record<string, string>;
}

export interface QueryJob {
  reference: {
    projectId: string;
    jobId: string;
  };
  placement: {
    clusterName: string;
  };
  hiveJob?: HiveJob;
  status?: JobStatus;
  statusHistory?: JobStatus[];
  yarnApplications?: YarnApplication[];
  driverOutputResourceUri?: string;
  driverControlFilesUri?: string;
  labels?: Record<string, string>;
  scheduling?: JobScheduling;
  jobUuid?: string;
  done?: boolean;
  submitted?: string;
  driverSchedulingConfig?: DriverSchedulingConfig;
}

export interface HiveJob {
  queryList?: HiveQueryList;
  queryFileUri?: string;
  continueOnFailure?: boolean;
  scriptVariables?: Record<string, string>;
  properties?: Record<string, string>;
  jarFileUris?: string[];
}

export interface JobStatus {
  state?: JobState;
  details?: string;
  stateStartTime?: string;
  substate?: JobSubstate;
}

export enum JobState {
  STATE_UNSPECIFIED = "STATE_UNSPECIFIED",
  PENDING = "PENDING",
  SETUP_DONE = "SETUP_DONE",
  RUNNING = "RUNNING",
  CANCEL_PENDING = "CANCEL_PENDING",
  CANCEL_STARTED = "CANCEL_STARTED",
  CANCELLED = "CANCELLED",
  DONE = "DONE",
  ERROR = "ERROR",
  ATTEMPT_FAILURE = "ATTEMPT_FAILURE"
}

export enum JobSubstate {
  UNSPECIFIED = "UNSPECIFIED",
  SUBMITTED = "SUBMITTED",
  QUEUED = "QUEUED",
  STALE_STATUS = "STALE_STATUS"
}

export interface YarnApplication {
  name?: string;
  state?: string;
  progress?: number;
  trackingUrl?: string;
}

export interface JobScheduling {
  maxFailuresPerHour?: number;
  maxFailuresTotal?: number;
}

export interface DriverSchedulingConfig {
  memoryMb?: number;
  vcores?: number;
}

export interface QueryResult {
  schema?: QuerySchema;
  rows?: QueryRow[];
  totalRows?: number;
  pageToken?: string;
}

export interface QuerySchema {
  fields?: SchemaField[];
}

export interface SchemaField {
  name?: string;
  type?: string;
  mode?: string;
  description?: string;
}

export interface QueryRow {
  values?: any[];
}