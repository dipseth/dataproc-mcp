/**
 * Type definitions for MCP server responses
 */

export interface SuccessResponse {
  content: ResponseContent[];
  isError?: false;
}

export interface ErrorResponse {
  content: ResponseContent[];
  isError: true;
}

export type Response = SuccessResponse | ErrorResponse;

export interface ResponseContent {
  type: 'text' | 'json' | 'html' | 'markdown';
  text: string;
}

export interface ClusterListResponse {
  clusters: ClusterInfo[];
  nextPageToken?: string;
}

export interface ClusterInfo {
  projectId: string;
  clusterName: string;
  status: string;
  createTime: string;
  labels?: Record<string, string>;
  metrics?: ClusterMetrics;
  statusHistory?: ClusterStatus[];
  clusterUuid?: string;
}

export interface ClusterMetrics {
  hdfsMetrics?: Record<string, string>;
  yarnMetrics?: Record<string, string>;
}

export interface ClusterStatus {
  state: string;
  stateStartTime: string;
  detail?: string;
  substate?: string;
}

export interface QueryResultResponse {
  schema?: {
    fields: {
      name: string;
      type: string;
    }[];
  };
  rows: unknown[][];
  totalRows: number;
  nextPageToken?: string;
}

export interface QueryStatusResponse {
  state: string;
  details?: string;
  stateStartTime?: string;
  done: boolean;
  yarnApplications?: {
    name: string;
    state: string;
    progress: number;
    trackingUrl?: string;
  }[];
}
