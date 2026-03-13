import { Node, Edge } from '@xyflow/react';
import {
  SimulationParams,
  SimulationResults,
  EdgeFlow,
  NodeUtilization,
  AggregateMetrics,
  BottleneckLink,
  GPUComponent,
  NICComponent,
  CPUComponent,
  StorageComponent,
  MemoryComponent,
  ComponentCategory,
} from '../types/components';

interface ComponentNode {
  nodeId: string;
  component: {
    id: string;
    name: string;
    category: ComponentCategory;
    [key: string]: any;
  };
}

function extractComponents(nodes: Node[]): ComponentNode[] {
  return nodes
    .filter((n) => (n.data as any)?.component)
    .map((n) => ({
      nodeId: n.id,
      component: (n.data as any).component,
    }));
}

function getByCategory(comps: ComponentNode[], cat: ComponentCategory): ComponentNode[] {
  return comps.filter((c) => c.component.category === cat);
}

// Bandwidth constants (GB/s)
const PCIE_BW: Record<string, number> = {
  gen5: 64, // x16
  gen4: 32,
  gen3: 16,
};

function getPcieBw(comp: any): number {
  const gen = comp.pcieGen || 'gen4';
  return PCIE_BW[gen] || 32;
}

function getNvlinkBw(gpu: GPUComponent): number {
  if (!gpu.nvlinkSupport) return 0;
  return gpu.nvlinkBandwidthGBps || 0;
}

// ─── Training simulation ───────────────────────────────────────────

function simulateTraining(
  comps: ComponentNode[],
  edges: Edge[],
  params: SimulationParams
): SimulationResults {
  const gpus = getByCategory(comps, 'gpu');
  const nics = getByCategory(comps, 'nic');
  const cpus = getByCategory(comps, 'cpu');
  const storage = getByCategory(comps, 'storage');
  const memory = getByCategory(comps, 'memory');

  const tp = params.training;
  const numGpus = gpus.length || 1;
  const modelBytes = tp.modelSizeBillion * 1e9 * 4; // fp32 = 4 bytes per param
  const activationBytes = tp.batchSize * tp.modelSizeBillion * 1e9 * 2 * 0.001; // simplified
  const gradientBytes = modelBytes; // same size as model

  // GPU compute time per step (seconds)
  const primaryGpu = gpus[0]?.component as GPUComponent | undefined;
  const gpuTflops = primaryGpu?.fp16TFLOPS || 100;
  const flopsPerStep = tp.modelSizeBillion * 1e9 * tp.batchSize * 6; // ~6 FLOPs per param per token
  const computeTimeSec = flopsPerStep / (gpuTflops * 1e12 * numGpus);

  // NVLink / PCIe GPU-to-GPU comm (tensor parallelism all-reduce)
  const hasNvlink = primaryGpu?.nvlinkSupport || false;
  const nvlinkBw = hasNvlink ? getNvlinkBw(primaryGpu!) : 0;
  const pcieBw = primaryGpu ? getPcieBw(primaryGpu) : 32;
  const gpuCommBw = hasNvlink ? nvlinkBw : pcieBw;
  const tensorCommBytes = (modelBytes / tp.tensorParallelism) * 2; // ring all-reduce
  const tensorCommTimeSec = tp.tensorParallelism > 1 ? tensorCommBytes / (gpuCommBw * 1e9) : 0;

  // Network all-reduce (data parallelism)
  const primaryNic = nics[0]?.component as NICComponent | undefined;
  const nicBwGbps = primaryNic?.totalBandwidthGbps || 0;
  const nicBwGBps = nicBwGbps / 8;
  const dataParallelCommBytes = gradientBytes / tp.dataParallelism * 2; // ring
  const networkCommTimeSec = tp.dataParallelism > 1 && nicBwGBps > 0
    ? dataParallelCommBytes / (nicBwGBps * 1e9)
    : 0;

  // Storage: data loading
  const primaryStorage = storage[0]?.component as StorageComponent | undefined;
  const storageReadBw = primaryStorage?.readBandwidthGBps || 3;
  const batchDataGB = (tp.batchSize * 0.001); // ~1MB per sample
  const dataLoadTimeSec = batchDataGB / storageReadBw;

  // Total step time
  const totalStepTimeSec = computeTimeSec + tensorCommTimeSec + networkCommTimeSec + dataLoadTimeSec / tp.gradientAccumulationSteps;

  // Utilization calculations
  const gpuComputeUtil = Math.min(1, computeTimeSec / totalStepTimeSec);
  const networkUtil = totalStepTimeSec > 0 ? Math.min(1, networkCommTimeSec / totalStepTimeSec) : 0;
  const storageUtil = totalStepTimeSec > 0 ? Math.min(1, dataLoadTimeSec / tp.gradientAccumulationSteps / totalStepTimeSec) : 0;

  // Memory pressure
  const gpuMemGB = primaryGpu?.memoryGB || 80;
  const totalGpuMemGB = gpuMemGB * numGpus;
  const modelMemGB = modelBytes / 1e9;
  const optimizerMemGB = modelMemGB * 3; // Adam: params + momentum + variance
  const activationMemGB = activationBytes / 1e9;
  const totalMemNeeded = (modelMemGB + optimizerMemGB) / tp.tensorParallelism + activationMemGB;
  const memoryPressure = Math.min(1, totalMemNeeded / totalGpuMemGB);

  // Throughput
  const tokensPerSec = tp.batchSize / totalStepTimeSec;
  const stepsForEpoch = 1000; // reference
  const timeToTrainHours = (stepsForEpoch * totalStepTimeSec) / 3600;

  // Build edge flows
  const edgeFlows: EdgeFlow[] = edges.map((e) => {
    const srcComp = comps.find((c) => c.nodeId === e.source);
    const tgtComp = comps.find((c) => c.nodeId === e.target);
    if (!srcComp || !tgtComp) {
      return { edgeId: e.id, bandwidthGBps: 0, utilization: 0, dataType: 'activation' as const, active: false };
    }

    const srcCat = srcComp.component.category;
    const tgtCat = tgtComp.component.category;

    // GPU <-> GPU: tensor parallelism gradient sync
    if (srcCat === 'gpu' && tgtCat === 'gpu') {
      return {
        edgeId: e.id,
        bandwidthGBps: gpuCommBw,
        utilization: tp.tensorParallelism > 1 ? Math.min(1, tensorCommTimeSec / totalStepTimeSec) : 0.05,
        dataType: 'gradient' as const,
        active: true,
      };
    }

    // GPU <-> CPU: PCIe data movement
    if ((srcCat === 'gpu' && tgtCat === 'cpu') || (srcCat === 'cpu' && tgtCat === 'gpu')) {
      return {
        edgeId: e.id,
        bandwidthGBps: pcieBw,
        utilization: Math.min(1, (dataLoadTimeSec / tp.gradientAccumulationSteps) / totalStepTimeSec + 0.1),
        dataType: 'activation' as const,
        active: true,
      };
    }

    // CPU <-> NIC or NIC <-> Switch: network traffic
    if ((srcCat === 'nic' || tgtCat === 'nic') || (srcCat === 'switch' || tgtCat === 'switch')) {
      return {
        edgeId: e.id,
        bandwidthGBps: nicBwGBps,
        utilization: networkUtil,
        dataType: 'gradient' as const,
        active: tp.dataParallelism > 1,
      };
    }

    // Storage <-> CPU: data loading
    if ((srcCat === 'storage' && tgtCat === 'cpu') || (srcCat === 'cpu' && tgtCat === 'storage')) {
      return {
        edgeId: e.id,
        bandwidthGBps: storageReadBw,
        utilization: storageUtil,
        dataType: 'data_load' as const,
        active: true,
      };
    }

    // Default: low utilization
    return {
      edgeId: e.id,
      bandwidthGBps: pcieBw,
      utilization: 0.05,
      dataType: 'activation' as const,
      active: true,
    };
  });

  // Build node utilizations
  const nodeUtils: NodeUtilization[] = comps.map((c) => {
    const cat = c.component.category;
    switch (cat) {
      case 'gpu':
        return { nodeId: c.nodeId, computeUtil: gpuComputeUtil, memoryUtil: memoryPressure, ioUtil: 0, category: cat };
      case 'cpu':
        return { nodeId: c.nodeId, computeUtil: 0.15, memoryUtil: 0.2, ioUtil: storageUtil, category: cat };
      case 'nic':
        return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: networkUtil, category: cat };
      case 'switch':
        return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: networkUtil * 0.8, category: cat };
      case 'storage':
        return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: storageUtil, category: cat };
      case 'memory':
        return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: memoryPressure * 0.6, ioUtil: 0, category: cat };
      default:
        return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: 0, category: cat };
    }
  });

  // Detect bottleneck
  const bottleneckChain: BottleneckLink[] = [];
  const timings = [
    { type: 'compute' as const, time: computeTimeSec, desc: `GPU compute: ${(computeTimeSec * 1000).toFixed(1)}ms/step` },
    { type: 'pcie' as const, time: tensorCommTimeSec, desc: `Tensor parallel comm (${hasNvlink ? 'NVLink' : 'PCIe'}): ${(tensorCommTimeSec * 1000).toFixed(1)}ms` },
    { type: 'network' as const, time: networkCommTimeSec, desc: `Data parallel all-reduce: ${(networkCommTimeSec * 1000).toFixed(1)}ms` },
    { type: 'storage' as const, time: dataLoadTimeSec / tp.gradientAccumulationSteps, desc: `Data loading: ${(dataLoadTimeSec / tp.gradientAccumulationSteps * 1000).toFixed(1)}ms/step` },
  ].sort((a, b) => b.time - a.time);

  const worstTiming = timings[0];
  bottleneckChain.push({
    type: worstTiming.type,
    description: worstTiming.desc,
    utilization: Math.min(1, worstTiming.time / totalStepTimeSec),
  });

  const aggregateMetrics: AggregateMetrics = {
    throughput: Math.round(tokensPerSec),
    throughputUnit: 'tokens/sec',
    gpuUtilPercent: Math.round(gpuComputeUtil * 100),
    memoryPressurePercent: Math.round(memoryPressure * 100),
    networkUtilPercent: Math.round(networkUtil * 100),
    storageIOUtilPercent: Math.round(storageUtil * 100),
    timeToTrainHours: Math.round(timeToTrainHours * 10) / 10,
    bottleneck: worstTiming.type,
    bottleneckDescription: worstTiming.desc,
  };

  return {
    edgeFlows,
    nodeUtils,
    aggregateMetrics,
    bottleneckChain,
    activePaths: edgeFlows.filter((e) => e.active).map((e) => e.edgeId),
  };
}

// ─── Inference simulation ──────────────────────────────────────────

function simulateInference(
  comps: ComponentNode[],
  edges: Edge[],
  params: SimulationParams
): SimulationResults {
  const gpus = getByCategory(comps, 'gpu');
  const nics = getByCategory(comps, 'nic');
  const storage = getByCategory(comps, 'storage');

  const ip = params.inference;
  const numGpus = gpus.length || 1;

  const primaryGpu = gpus[0]?.component as GPUComponent | undefined;
  const gpuTflops = primaryGpu?.fp16TFLOPS || 100;
  const gpuMemGB = primaryGpu?.memoryGB || 80;

  // Per-token generation time
  const flopsPerToken = 2 * ip.sequenceLength * 1e6; // simplified
  const tokenGenTimeSec = flopsPerToken / (gpuTflops * 1e12);
  const tokensPerSecPerGpu = 1 / tokenGenTimeSec;
  const totalThroughput = tokensPerSecPerGpu * numGpus;

  // KV cache memory
  const kvCachePerReq = ip.sequenceLength * 2 * 128 * 80 / 1e9; // simplified: layers * heads * dim
  const maxConcurrent = Math.floor((gpuMemGB * 0.5) / Math.max(kvCachePerReq, 0.001));
  const actualConcurrent = Math.min(maxConcurrent, ip.requestRateQps);
  const memoryPressure = Math.min(1, (actualConcurrent * kvCachePerReq) / (gpuMemGB * numGpus));

  // Latency
  const computeLatencyMs = ip.sequenceLength * tokenGenTimeSec * 1000;
  const queueLatencyMs = ip.requestRateQps > totalThroughput ? (ip.requestRateQps - totalThroughput) * 0.5 : 0;
  const p50LatencyMs = computeLatencyMs + queueLatencyMs;
  const p99LatencyMs = p50LatencyMs * 1.8;

  // NIC utilization (serving responses)
  const primaryNic = nics[0]?.component as NICComponent | undefined;
  const nicBwGBps = (primaryNic?.totalBandwidthGbps || 100) / 8;
  const responseDataRate = (ip.requestRateQps * ip.sequenceLength * 4) / 1e9;
  const networkUtil = Math.min(1, responseDataRate / nicBwGBps);

  const gpuUtil = Math.min(1, ip.requestRateQps / totalThroughput);

  // Storage (model loading - low during serving)
  const storageUtil = 0.05;

  const pcieBw = primaryGpu ? getPcieBw(primaryGpu) : 32;

  const edgeFlows: EdgeFlow[] = edges.map((e) => {
    const srcComp = comps.find((c) => c.nodeId === e.source);
    const tgtComp = comps.find((c) => c.nodeId === e.target);
    if (!srcComp || !tgtComp) {
      return { edgeId: e.id, bandwidthGBps: 0, utilization: 0, dataType: 'inference_request' as const, active: false };
    }
    const srcCat = srcComp.component.category;
    const tgtCat = tgtComp.component.category;

    if (srcCat === 'gpu' && tgtCat === 'gpu') {
      return { edgeId: e.id, bandwidthGBps: getNvlinkBw(primaryGpu!) || pcieBw, utilization: gpuUtil * 0.3, dataType: 'activation' as const, active: true };
    }
    if ((srcCat === 'gpu' && tgtCat === 'cpu') || (srcCat === 'cpu' && tgtCat === 'gpu')) {
      return { edgeId: e.id, bandwidthGBps: pcieBw, utilization: gpuUtil * 0.4, dataType: 'inference_request' as const, active: true };
    }
    if (srcCat === 'nic' || tgtCat === 'nic' || srcCat === 'switch' || tgtCat === 'switch') {
      return { edgeId: e.id, bandwidthGBps: nicBwGBps, utilization: networkUtil, dataType: 'inference_request' as const, active: true };
    }
    return { edgeId: e.id, bandwidthGBps: pcieBw, utilization: 0.05, dataType: 'inference_request' as const, active: true };
  });

  const nodeUtils: NodeUtilization[] = comps.map((c) => {
    const cat = c.component.category;
    switch (cat) {
      case 'gpu': return { nodeId: c.nodeId, computeUtil: gpuUtil, memoryUtil: memoryPressure, ioUtil: 0, category: cat };
      case 'cpu': return { nodeId: c.nodeId, computeUtil: 0.1, memoryUtil: 0.15, ioUtil: networkUtil, category: cat };
      case 'nic': return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: networkUtil, category: cat };
      case 'switch': return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: networkUtil * 0.7, category: cat };
      case 'storage': return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: storageUtil, category: cat };
      default: return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: 0, category: cat };
    }
  });

  const bottleneckType = gpuUtil > networkUtil && gpuUtil > memoryPressure ? 'compute'
    : memoryPressure > networkUtil ? 'memory'
      : 'network';

  const bottleneckChain: BottleneckLink[] = [{
    type: bottleneckType,
    description: bottleneckType === 'compute'
      ? `GPU compute at ${Math.round(gpuUtil * 100)}% utilization`
      : bottleneckType === 'memory'
        ? `KV-cache memory pressure at ${Math.round(memoryPressure * 100)}%`
        : `Network at ${Math.round(networkUtil * 100)}% utilization`,
    utilization: Math.max(gpuUtil, memoryPressure, networkUtil),
  }];

  return {
    edgeFlows,
    nodeUtils,
    aggregateMetrics: {
      throughput: Math.round(ip.requestRateQps),
      throughputUnit: 'qps',
      gpuUtilPercent: Math.round(gpuUtil * 100),
      memoryPressurePercent: Math.round(memoryPressure * 100),
      networkUtilPercent: Math.round(networkUtil * 100),
      storageIOUtilPercent: Math.round(storageUtil * 100),
      p50LatencyMs: Math.round(p50LatencyMs * 10) / 10,
      p99LatencyMs: Math.round(p99LatencyMs * 10) / 10,
      bottleneck: bottleneckType,
      bottleneckDescription: bottleneckChain[0].description,
    },
    bottleneckChain,
    activePaths: edgeFlows.filter((e) => e.active).map((e) => e.edgeId),
  };
}

// ─── Storage I/O simulation ────────────────────────────────────────

function simulateStorageIO(
  comps: ComponentNode[],
  edges: Edge[],
  params: SimulationParams
): SimulationResults {
  const gpus = getByCategory(comps, 'gpu');
  const storage = getByCategory(comps, 'storage');
  const nics = getByCategory(comps, 'nic');

  const sio = params.storageIO;
  const numGpus = gpus.length || 1;

  const primaryGpu = gpus[0]?.component as GPUComponent | undefined;
  const gpuMemGB = primaryGpu?.memoryGB || 80;
  const modelSizeGB = params.training.modelSizeBillion * 4; // fp32

  // Storage bandwidth
  const totalStorageReadBw = storage.reduce((sum, s) => sum + ((s.component as StorageComponent).readBandwidthGBps || 3), 0) || 3;
  const totalStorageWriteBw = storage.reduce((sum, s) => sum + ((s.component as StorageComponent).writeBandwidthGBps || 2), 0) || 2;

  // Dataset read throughput
  const dataReadGBps = Math.min(totalStorageReadBw, sio.prefetchBuffers * 2);
  const datasetReadTimeSec = sio.datasetSizeGB / dataReadGBps;

  // Checkpoint write
  const checkpointSizeGB = modelSizeGB * 3; // model + optimizer
  const checkpointWriteTimeSec = checkpointSizeGB / totalStorageWriteBw;
  const checkpointOverhead = checkpointWriteTimeSec / (sio.checkpointIntervalSteps * 0.1); // fraction of training

  const storageReadUtil = Math.min(1, dataReadGBps / totalStorageReadBw);
  const storageWriteUtil = Math.min(1, checkpointOverhead);
  const storageUtil = Math.max(storageReadUtil, storageWriteUtil);

  const pcieBw = primaryGpu ? getPcieBw(primaryGpu) : 32;
  const pcieUtil = Math.min(1, dataReadGBps / pcieBw);

  const primaryNic = nics[0]?.component as NICComponent | undefined;
  const nicBwGBps = (primaryNic?.totalBandwidthGbps || 100) / 8;

  const edgeFlows: EdgeFlow[] = edges.map((e) => {
    const srcComp = comps.find((c) => c.nodeId === e.source);
    const tgtComp = comps.find((c) => c.nodeId === e.target);
    if (!srcComp || !tgtComp) {
      return { edgeId: e.id, bandwidthGBps: 0, utilization: 0, dataType: 'data_load' as const, active: false };
    }
    const srcCat = srcComp.component.category;
    const tgtCat = tgtComp.component.category;

    if ((srcCat === 'storage' && tgtCat === 'cpu') || (srcCat === 'cpu' && tgtCat === 'storage')) {
      return { edgeId: e.id, bandwidthGBps: totalStorageReadBw, utilization: storageUtil, dataType: 'data_load' as const, active: true };
    }
    if ((srcCat === 'gpu' && tgtCat === 'cpu') || (srcCat === 'cpu' && tgtCat === 'gpu')) {
      return { edgeId: e.id, bandwidthGBps: pcieBw, utilization: pcieUtil, dataType: 'data_load' as const, active: true };
    }
    if ((srcCat === 'gpu' && tgtCat === 'gpu')) {
      return { edgeId: e.id, bandwidthGBps: getNvlinkBw(primaryGpu!) || pcieBw, utilization: 0.1, dataType: 'activation' as const, active: true };
    }
    if (srcCat === 'nic' || tgtCat === 'nic' || srcCat === 'switch' || tgtCat === 'switch') {
      return { edgeId: e.id, bandwidthGBps: nicBwGBps, utilization: 0.05, dataType: 'checkpoint' as const, active: checkpointOverhead > 0.01 };
    }
    return { edgeId: e.id, bandwidthGBps: pcieBw, utilization: 0.02, dataType: 'data_load' as const, active: true };
  });

  const nodeUtils: NodeUtilization[] = comps.map((c) => {
    const cat = c.component.category;
    switch (cat) {
      case 'gpu': return { nodeId: c.nodeId, computeUtil: 0.1, memoryUtil: 0.2, ioUtil: pcieUtil, category: cat };
      case 'cpu': return { nodeId: c.nodeId, computeUtil: 0.2, memoryUtil: 0.3, ioUtil: storageUtil, category: cat };
      case 'storage': return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: storageUtil, category: cat };
      case 'nic': return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: 0.05, category: cat };
      default: return { nodeId: c.nodeId, computeUtil: 0, memoryUtil: 0, ioUtil: 0, category: cat };
    }
  });

  const bottleneckType = storageUtil > pcieUtil ? 'storage' : 'pcie';
  const bottleneckChain: BottleneckLink[] = [{
    type: bottleneckType,
    description: bottleneckType === 'storage'
      ? `Storage I/O at ${Math.round(storageUtil * 100)}% (read: ${dataReadGBps.toFixed(1)} GB/s, checkpoint: ${checkpointWriteTimeSec.toFixed(1)}s)`
      : `PCIe transfer at ${Math.round(pcieUtil * 100)}% utilization`,
    utilization: Math.max(storageUtil, pcieUtil),
  }];

  return {
    edgeFlows,
    nodeUtils,
    aggregateMetrics: {
      throughput: Math.round(dataReadGBps * 1000) / 1000,
      throughputUnit: 'GB/s read',
      gpuUtilPercent: 10,
      memoryPressurePercent: 20,
      networkUtilPercent: 5,
      storageIOUtilPercent: Math.round(storageUtil * 100),
      bottleneck: bottleneckType,
      bottleneckDescription: bottleneckChain[0].description,
    },
    bottleneckChain,
    activePaths: edgeFlows.filter((e) => e.active).map((e) => e.edgeId),
  };
}

// ─── Main entry point ──────────────────────────────────────────────

export function runSimulation(
  nodes: Node[],
  edges: Edge[],
  params: SimulationParams
): SimulationResults {
  const comps = extractComponents(nodes);

  if (comps.length === 0) {
    return {
      edgeFlows: [],
      nodeUtils: [],
      aggregateMetrics: {
        throughput: 0,
        throughputUnit: '-',
        gpuUtilPercent: 0,
        memoryPressurePercent: 0,
        networkUtilPercent: 0,
        storageIOUtilPercent: 0,
      },
      bottleneckChain: [],
      activePaths: [],
    };
  }

  switch (params.activeTab) {
    case 'training':
      return simulateTraining(comps, edges, params);
    case 'inference':
      return simulateInference(comps, edges, params);
    case 'storage':
      return simulateStorageIO(comps, edges, params);
    default:
      return simulateTraining(comps, edges, params);
  }
}

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  activeTab: 'training',
  training: {
    modelSizeBillion: 7,
    batchSize: 32,
    tensorParallelism: 1,
    dataParallelism: 1,
    pipelineParallelism: 1,
    gradientAccumulationSteps: 1,
  },
  inference: {
    requestRateQps: 100,
    sequenceLength: 2048,
    kvCacheSizeGB: 2,
  },
  storageIO: {
    checkpointIntervalSteps: 1000,
    datasetSizeGB: 100,
    prefetchBuffers: 4,
  },
};
