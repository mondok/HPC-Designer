export type ComponentCategory =
  | 'gpu'
  | 'cpu'
  | 'nic'
  | 'dpu'
  | 'switch'
  | 'cable'
  | 'storage'
  | 'memory'
  | 'rack'
  | 'server'
  | 'pcie_switch';

export type PCIeGeneration = 'gen3' | 'gen4' | 'gen5';
export type PCIeLanes = 'x4' | 'x8' | 'x16';
export type FormFactor = 'pcie' | 'sxm' | 'oam' | 'u2' | 'm2' | 'edsff';
export type NetworkProtocol = 'infiniband' | 'ethernet' | 'roce' | 'vpi';
export type NetworkSpeed = '10gbe' | '25gbe' | '50gbe' | '100gbe' | '200gbe' | '400gbe' | '800gbe';
export type GPUArchitecture = 'hopper' | 'ada_lovelace' | 'ampere' | 'turing' | 'blackwell';
export type WorkloadType = 'llm_training' | 'llm_inference' | 'hpc' | 'dl_training' | 'inference' | 'rendering' | 'vdi' | 'omniverse' | 'analytics';
export type DeploymentLocation = 'data_center' | 'edge' | 'industrial_edge' | 'workstation' | 'vdi';

export interface BaseComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  vendor: string;
  description: string;
  educationalNote: string;
  useCases: string[];
  certificationStatus: 'nvidia_certified' | 'nvidia_compatible' | 'reference';
  specifications: Record<string, string | number | boolean>;
  compatibleWith: string[];
  incompatibleWith: string[];
  documentationUrl?: string;
  imageUrl?: string;
}

export interface GPUComponent extends BaseComponent {
  category: 'gpu';
  architecture: GPUArchitecture;
  memoryGB: number;
  memoryType: string;
  memoryBandwidthGBps: number;
  tdpWatts: number;
  formFactor: FormFactor;
  pcieGen: PCIeGeneration;
  pcieLanes: PCIeLanes;
  nvlinkSupport: boolean;
  nvlinkBandwidthGBps?: number;
  fp64TFLOPS?: number;
  fp32TFLOPS: number;
  tf32TFLOPS?: number;
  fp16TFLOPS: number;
  int8TOPS?: number;
  migSupport: boolean;
  migPartitions?: number;
  maxGPUsPerServer: number;
}

export interface CPUComponent extends BaseComponent {
  category: 'cpu';
  platform: 'grace' | 'xeon' | 'epyc';
  generation: string;
  cores: number;
  threads: number;
  baseClockGHz: number;
  boostClockGHz: number;
  tdpWatts: number;
  pcieGen: PCIeGeneration;
  pcieLanes: number;
  memoryChannels: number;
  maxMemoryGB: number;
  memoryType: string;
  socketType: string;
  numaNodes: number;
}

export interface NICComponent extends BaseComponent {
  category: 'nic';
  series: string;
  ports: number;
  speedPerPort: NetworkSpeed;
  totalBandwidthGbps: number;
  protocols: NetworkProtocol[];
  rdmaSupport: boolean;
  roceSupport: boolean;
  sriov: boolean;
  sriovVFs: number;
  pcieGen: PCIeGeneration;
  pcieLanes: PCIeLanes;
  pfcSupport: boolean;
  ecnSupport: boolean;
  dpuCapability: boolean;
}

export interface DPUComponent extends BaseComponent {
  category: 'dpu';
  series: string;
  armCores: number;
  networkPorts: number;
  speedPerPort: NetworkSpeed;
  totalBandwidthGbps: number;
  protocols: NetworkProtocol[];
  rdmaSupport: boolean;
  pcieGen: PCIeGeneration;
  pcieLanes: PCIeLanes;
  cryptoAcceleration: boolean;
  storageOffload: boolean;
  networkOffload: boolean;
}

export interface SwitchComponent extends BaseComponent {
  category: 'switch';
  switchType: 'infiniband' | 'ethernet';
  ports: number;
  speedPerPort: NetworkSpeed;
  totalBandwidthTbps: number;
  latencyNs: number;
  pfcSupport: boolean;
  layer: 'leaf' | 'spine' | 'core' | 'tor' | 'aggregation';
  managedPorts: number;
  asicChip: string;
}

export interface CableComponent extends BaseComponent {
  category: 'cable';
  cableType: 'dac' | 'aoc' | 'fiber';
  connectorType: 'qsfp_dd' | 'osfp' | 'qsfp56' | 'qsfp28' | 'sfp28';
  speed: NetworkSpeed;
  lengthMeters: number;
  protocols: NetworkProtocol[];
}

export interface StorageComponent extends BaseComponent {
  category: 'storage';
  storageType: 'nvme' | 'ssd' | 'hdd';
  capacityTB: number;
  pcieGen: PCIeGeneration;
  formFactor: FormFactor;
  readBandwidthGBps: number;
  writeBandwidthGBps: number;
  iops: number;
}

export interface MemoryComponent extends BaseComponent {
  category: 'memory';
  memoryType: 'ddr4' | 'ddr5' | 'hbm2e' | 'hbm3';
  capacityGB: number;
  speedMHz: number;
  bandwidthGBps: number;
  eccSupport: boolean;
}

export interface PCIeSwitchComponent extends BaseComponent {
  category: 'pcie_switch';
  pcieGen: PCIeGeneration;
  upstreamPorts: number;
  downstreamPorts: number;
  totalLanes: number;
}

export type HardwareComponent =
  | GPUComponent
  | CPUComponent
  | NICComponent
  | DPUComponent
  | SwitchComponent
  | CableComponent
  | StorageComponent
  | MemoryComponent
  | PCIeSwitchComponent;

export type DesignLayer = 'multi_site' | 'cluster' | 'network' | 'server' | 'pcie';

export interface ValidationResult {
  valid: boolean;
  severity: 'error' | 'warning' | 'info' | 'success';
  message: string;
  explanation: string;
  suggestion?: string;
  documentationUrl?: string;
  affectedComponents: string[];
}

export interface PerformanceEstimate {
  workload: WorkloadType;
  modelName: string;
  trainingTimeHours?: number;
  tokensPerSecond?: number;
  imagesPerSecond?: number;
  inferenceLatencyMs?: number;
  inferenceThroughput?: number;
  scalingEfficiency?: number;
  bottleneck?: 'compute' | 'memory' | 'network' | 'storage' | 'pcie';
  bottleneckDescription?: string;
}

export interface DesignConfiguration {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  currentLayer: DesignLayer;
  sites: SiteNode[];
  workloadType: WorkloadType;
  validationResults: ValidationResult[];
  performanceEstimates: PerformanceEstimate[];
}

export interface SiteNode {
  id: string;
  name: string;
  location: DeploymentLocation;
  clusters: ClusterNode[];
}

export interface ClusterNode {
  id: string;
  name: string;
  servers: ServerNode[];
  switches: string[];
  cables: string[];
  networkTopology: 'leaf_spine' | 'fat_tree' | 'rail_optimized';
}

export interface ServerNode {
  id: string;
  name: string;
  cpus: string[];
  gpus: string[];
  nics: string[];
  dpus: string[];
  storage: string[];
  memory: string[];
  pcieSwitches: string[];
  pcieTopology: PCIeSlot[];
}

export interface PCIeSlot {
  id: string;
  slotNumber: number;
  generation: PCIeGeneration;
  lanes: PCIeLanes;
  cpuSocket: number;
  rootPort: number;
  pcieSwitchId?: string;
  occupiedBy?: string;
  componentType?: ComponentCategory;
}

// Simulation types

export type SimulationWorkloadTab = 'training' | 'inference' | 'storage';

export interface TrainingParams {
  modelSizeBillion: number;
  batchSize: number;
  tensorParallelism: number;
  dataParallelism: number;
  pipelineParallelism: number;
  gradientAccumulationSteps: number;
}

export interface InferenceParams {
  requestRateQps: number;
  sequenceLength: number;
  kvCacheSizeGB: number;
}

export interface StorageIOParams {
  checkpointIntervalSteps: number;
  datasetSizeGB: number;
  prefetchBuffers: number;
}

export interface SimulationParams {
  activeTab: SimulationWorkloadTab;
  training: TrainingParams;
  inference: InferenceParams;
  storageIO: StorageIOParams;
}

export type FlowDataType = 'gradient' | 'activation' | 'data_load' | 'inference_request' | 'checkpoint';

export interface EdgeFlow {
  edgeId: string;
  bandwidthGBps: number;
  utilization: number;
  dataType: FlowDataType;
  active: boolean;
}

export interface NodeUtilization {
  nodeId: string;
  computeUtil: number;
  memoryUtil: number;
  ioUtil: number;
  category: ComponentCategory;
}

export interface SimulationResults {
  edgeFlows: EdgeFlow[];
  nodeUtils: NodeUtilization[];
  aggregateMetrics: AggregateMetrics;
  bottleneckChain: BottleneckLink[];
  activePaths: string[];
}

export interface AggregateMetrics {
  throughput: number;
  throughputUnit: string;
  gpuUtilPercent: number;
  memoryPressurePercent: number;
  networkUtilPercent: number;
  storageIOUtilPercent: number;
  timeToTrainHours?: number;
  p50LatencyMs?: number;
  p99LatencyMs?: number;
  bottleneck?: 'compute' | 'memory' | 'network' | 'storage' | 'pcie';
  bottleneckDescription?: string;
}

export interface BottleneckLink {
  edgeId?: string;
  nodeId?: string;
  type: 'compute' | 'memory' | 'network' | 'storage' | 'pcie';
  description: string;
  utilization: number;
}
