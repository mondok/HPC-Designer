import { Node } from '@xyflow/react';
import { GPUComponent, NICComponent, PerformanceEstimate, WorkloadType } from '../types/components';

const MODEL_BENCHMARKS: Record<string, { paramsBillion: number; tokensPerSecPerGpu: Record<string, number>; trainingTokensBillion: number }> = {
  'GPT-3 175B': {
    paramsBillion: 175,
    tokensPerSecPerGpu: {
      'gpu-h200-sxm': 4200,
      'gpu-h100-sxm': 3200,
      'gpu-h100-pcie': 2400,
      'gpu-a100-sxm': 1600,
      'gpu-a100-pcie': 1200,
    },
    trainingTokensBillion: 300,
  },
  'LLaMA 70B': {
    paramsBillion: 70,
    tokensPerSecPerGpu: {
      'gpu-h200-sxm': 8500,
      'gpu-h100-sxm': 6400,
      'gpu-h100-pcie': 4800,
      'gpu-a100-sxm': 3200,
      'gpu-a100-pcie': 2400,
    },
    trainingTokensBillion: 2000,
  },
  'BERT-Large': {
    paramsBillion: 0.34,
    tokensPerSecPerGpu: {
      'gpu-h200-sxm': 95000,
      'gpu-h100-sxm': 72000,
      'gpu-h100-pcie': 54000,
      'gpu-l40s': 36000,
      'gpu-a100-sxm': 45000,
      'gpu-a100-pcie': 34000,
    },
    trainingTokensBillion: 3.3,
  },
  'ResNet-50': {
    paramsBillion: 0.025,
    tokensPerSecPerGpu: {
      'gpu-h200-sxm': 18000,
      'gpu-h100-sxm': 14000,
      'gpu-h100-pcie': 10500,
      'gpu-l40s': 7200,
      'gpu-a100-sxm': 8800,
      'gpu-a100-pcie': 6600,
      'gpu-l4': 3000,
      'gpu-t4': 1800,
    },
    trainingTokensBillion: 0.0012,
  },
};

const INFERENCE_BENCHMARKS: Record<string, { latencyMsPerGpu: Record<string, number>; throughputPerGpu: Record<string, number> }> = {
  'LLaMA 70B Inference': {
    latencyMsPerGpu: {
      'gpu-h200-sxm': 18,
      'gpu-h100-sxm': 24,
      'gpu-h100-pcie': 32,
      'gpu-h100-nvl': 26,
      'gpu-h200-nvl': 20,
      'gpu-a100-sxm': 45,
    },
    throughputPerGpu: {
      'gpu-h200-sxm': 3800,
      'gpu-h100-sxm': 2900,
      'gpu-h100-pcie': 2100,
      'gpu-h100-nvl': 2700,
      'gpu-h200-nvl': 3500,
      'gpu-a100-sxm': 1400,
    },
  },
  'GPT-3 175B Inference': {
    latencyMsPerGpu: {
      'gpu-h200-sxm': 35,
      'gpu-h100-sxm': 48,
      'gpu-h100-pcie': 65,
      'gpu-h200-nvl': 40,
    },
    throughputPerGpu: {
      'gpu-h200-sxm': 1800,
      'gpu-h100-sxm': 1300,
      'gpu-h100-pcie': 900,
      'gpu-h200-nvl': 1600,
    },
  },
  'BERT-Large Inference': {
    latencyMsPerGpu: {
      'gpu-h200-sxm': 0.8,
      'gpu-h100-sxm': 1.0,
      'gpu-h100-pcie': 1.3,
      'gpu-l40s': 1.8,
      'gpu-l4': 3.5,
      'gpu-t4': 5.2,
      'gpu-a100-sxm': 1.5,
      'gpu-a100-pcie': 1.9,
    },
    throughputPerGpu: {
      'gpu-h200-sxm': 42000,
      'gpu-h100-sxm': 32000,
      'gpu-h100-pcie': 24000,
      'gpu-l40s': 16000,
      'gpu-l4': 8000,
      'gpu-t4': 5000,
      'gpu-a100-sxm': 21000,
      'gpu-a100-pcie': 16000,
    },
  },
};

function detectBottleneck(
  gpus: GPUComponent[],
  nics: NICComponent[],
  numNodes: number,
  totalMemoryGB: number,
  totalGpuMemoryGB: number
): { bottleneck: PerformanceEstimate['bottleneck']; description: string } {
  if (gpus.length === 0) {
    return { bottleneck: 'compute', description: 'No GPUs configured. Add GPUs to enable AI workloads.' };
  }

  const totalNicBw = nics.reduce((sum, n) => sum + n.totalBandwidthGbps, 0);
  const totalGpuBw = gpus.reduce((sum, g) => sum + g.memoryBandwidthGBps, 0);

  if (numNodes > 1 && totalNicBw < 200) {
    return {
      bottleneck: 'network',
      description: `Network bandwidth (${totalNicBw} Gbps) is below the 200 Gbps minimum for multi-node workloads. All-reduce operations during distributed training will be bottlenecked. Add higher-speed NICs (ConnectX-7 400G recommended).`,
    };
  }

  if (totalMemoryGB < totalGpuMemoryGB * 2) {
    return {
      bottleneck: 'memory',
      description: `System memory (${totalMemoryGB} GB) is less than 2x GPU memory (${totalGpuMemoryGB} GB). Data loading from host memory to GPU will be constrained. Add more DIMMs to reach at least ${totalGpuMemoryGB * 2} GB.`,
    };
  }

  const hasNvlink = gpus.some((g) => g.nvlinkSupport);
  if (gpus.length > 1 && !hasNvlink) {
    return {
      bottleneck: 'pcie',
      description: `Multiple GPUs without NVLink — GPU-to-GPU communication goes over PCIe, which is significantly slower. For training workloads, consider SXM GPUs with NVLink (900 GB/s) instead of PCIe (64 GB/s Gen5 x16).`,
    };
  }

  return { bottleneck: undefined, description: '' };
}

export function estimatePerformance(
  nodes: Node[],
  workloadType: WorkloadType,
  numNodes: number = 1
): PerformanceEstimate[] {
  const estimates: PerformanceEstimate[] = [];
  const gpuNodes = nodes.filter((n) => n.data?.component?.category === 'gpu');
  const nicNodes = nodes.filter((n) => n.data?.component?.category === 'nic');
  const memNodes = nodes.filter((n) => n.data?.component?.category === 'memory');

  if (gpuNodes.length === 0) return estimates;

  const gpus = gpuNodes.map((n) => n.data.component as GPUComponent);
  const nics = nicNodes.map((n) => n.data.component as NICComponent);
  const totalGpus = gpus.length * numNodes;
  const primaryGpu = gpus[0];
  const totalMemGB = memNodes.reduce((s, n) => s + ((n.data?.component as any)?.capacityGB || 0), 0);
  const totalGpuMemGB = gpus.reduce((s, g) => s + g.memoryGB, 0);

  const { bottleneck, description } = detectBottleneck(gpus, nics, numNodes, totalMemGB, totalGpuMemGB);

  const scalingEff = numNodes === 1 ? 1.0 : numNodes <= 4 ? 0.92 : numNodes <= 16 ? 0.85 : numNodes <= 64 ? 0.78 : 0.72;

  if (workloadType === 'llm_training' || workloadType === 'dl_training') {
    for (const [modelName, bench] of Object.entries(MODEL_BENCHMARKS)) {
      const toksPerSec = bench.tokensPerSecPerGpu[primaryGpu.id] || bench.tokensPerSecPerGpu['gpu-a100-pcie'] || 1000;
      const totalToksPerSec = toksPerSec * totalGpus * scalingEff;
      const totalTokens = bench.trainingTokensBillion * 1e9;
      const trainingHours = totalTokens / totalToksPerSec / 3600;

      estimates.push({
        workload: workloadType,
        modelName,
        trainingTimeHours: Math.round(trainingHours * 10) / 10,
        tokensPerSecond: Math.round(totalToksPerSec),
        scalingEfficiency: Math.round(scalingEff * 100),
        bottleneck,
        bottleneckDescription: description,
      });
    }
  }

  if (workloadType === 'llm_inference' || workloadType === 'inference') {
    for (const [modelName, bench] of Object.entries(INFERENCE_BENCHMARKS)) {
      const latency = bench.latencyMsPerGpu[primaryGpu.id] || 50;
      const throughput = bench.throughputPerGpu[primaryGpu.id] || 1000;
      const totalThroughput = throughput * totalGpus * (numNodes > 1 ? 0.95 : 1.0);

      estimates.push({
        workload: workloadType,
        modelName,
        inferenceLatencyMs: latency,
        inferenceThroughput: Math.round(totalThroughput),
        scalingEfficiency: Math.round(scalingEff * 100),
        bottleneck,
        bottleneckDescription: description,
      });
    }
  }

  if (estimates.length === 0) {
    const bench = MODEL_BENCHMARKS['ResNet-50'];
    const toks = bench.tokensPerSecPerGpu[primaryGpu.id] || 2000;
    estimates.push({
      workload: workloadType,
      modelName: 'ResNet-50 (reference)',
      imagesPerSecond: Math.round(toks * totalGpus * scalingEff),
      scalingEfficiency: Math.round(scalingEff * 100),
      bottleneck,
      bottleneckDescription: description,
    });
  }

  return estimates;
}
