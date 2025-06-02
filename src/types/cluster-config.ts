/**
 * Type definitions for Dataproc cluster configuration
 * Based on Google Cloud Dataproc v1 API
 */

export interface ClusterConfig {
  configBucket?: string;
  tempBucket?: string;
  gceClusterConfig?: GceClusterConfig;
  masterConfig?: InstanceGroupConfig;
  workerConfig?: InstanceGroupConfig;
  secondaryWorkerConfig?: InstanceGroupConfig;
  softwareConfig?: SoftwareConfig;
  lifecycleConfig?: LifecycleConfig;
  encryptionConfig?: EncryptionConfig;
  autoscalingConfig?: AutoscalingConfig;
  securityConfig?: SecurityConfig;
  endpointConfig?: EndpointConfig;
  metastoreConfig?: MetastoreConfig;
  initializationActions?: InitializationAction[];
  dataprocMetricConfig?: DataprocMetricConfig;
  auxiliaryNodeGroups?: AuxiliaryNodeGroup[];
}

export interface GceClusterConfig {
  zoneUri?: string;
  networkUri?: string;
  subnetworkUri?: string;
  internalIpOnly?: boolean;
  serviceAccount?: string;
  serviceAccountScopes?: string[];
  tags?: string[];
  metadata?: Record<string, string>;
  reservationAffinity?: ReservationAffinity;
  nodeGroupAffinity?: NodeGroupAffinity;
  privateIpv6GoogleAccess?: string;
  shieldedInstanceConfig?: ShieldedInstanceConfig;
}

export interface InstanceGroupConfig {
  numInstances?: number;
  instanceNames?: string[];
  imageUri?: string;
  machineTypeUri?: string;
  diskConfig?: DiskConfig;
  isPreemptible?: boolean;
  preemptibility?: string;
  managedGroupConfig?: ManagedGroupConfig;
  accelerators?: Accelerator[];
  minCpuPlatform?: string;
}

export interface DiskConfig {
  bootDiskType?: string;
  bootDiskSizeGb?: number;
  numLocalSsds?: number;
  localSsdInterface?: string;
}

export interface ManagedGroupConfig {
  instanceTemplateName?: string;
  instanceGroupManagerName?: string;
}

export interface Accelerator {
  acceleratorType?: string;
  acceleratorCount?: number;
}

export interface SoftwareConfig {
  imageVersion?: string;
  properties?: Record<string, string>;
  optionalComponents?: string[];
}

export interface LifecycleConfig {
  idleDeleteTtl?: string;
  autoDeleteTime?: string;
  autoDeleteTtl?: string;
  idleStartTime?: string;
}

export interface EncryptionConfig {
  gcePdKmsKeyName?: string;
}

export interface AutoscalingConfig {
  policyUri?: string;
}

export interface SecurityConfig {
  kerberosConfig?: KerberosConfig;
  identityConfig?: IdentityConfig;
}

export interface KerberosConfig {
  enableKerberos?: boolean;
  rootPrincipalPassword?: string;
  kmsKey?: string;
  keyPasswordUri?: string;
  keystoreUri?: string;
  truststoreUri?: string;
  keystorePasswordUri?: string;
  truststorePasswordUri?: string;
  crossRealmTrustRealm?: string;
  crossRealmTrustKdc?: string;
  crossRealmTrustAdminServer?: string;
  crossRealmTrustSharedPassword?: string;
  kdcDbKey?: string;
  tgtLifetimeHours?: number;
  realm?: string;
}

export interface IdentityConfig {
  userServiceAccountMapping?: Record<string, string>;
}

export interface EndpointConfig {
  httpPorts?: Record<string, string>;
  enableHttpPortAccess?: boolean;
}

export interface MetastoreConfig {
  dataprocMetastoreService?: string;
}

export interface InitializationAction {
  executableFile?: string;
  executionTimeout?: string;
}

export interface ReservationAffinity {
  consumeReservationType?: string;
  key?: string;
  values?: string[];
}

export interface NodeGroupAffinity {
  nodeGroupUri?: string;
}

export interface ShieldedInstanceConfig {
  enableSecureBoot?: boolean;
  enableVtpm?: boolean;
  enableIntegrityMonitoring?: boolean;
}

export interface ClusterOperationMetadata {
  clusterName?: string;
  clusterUuid?: string;
  status?: ClusterOperationStatus;
  statusHistory?: ClusterOperationStatus[];
  operationType?: string;
  description?: string;
  labels?: Record<string, string>;
  warnings?: string[];
  doneTime?: string;
  createTime?: string;
}

export interface ClusterOperationStatus {
  state?: string;
  innerState?: string;
  details?: string;
  stateStartTime?: string;
}

export interface DataprocMetricConfig {
  metrics?: Metric[];
}

export interface Metric {
  metricSource?: string;
  metricOverrides?: string[];
}

export interface AuxiliaryNodeGroup {
  nodeGroup?: NodeGroup;
  nodeGroupId?: string;
}

export interface NodeGroup {
  name?: string;
  roles?: string[];
  nodeGroupConfig?: InstanceGroupConfig;
  labels?: Record<string, string>;
}
