import { Node, Edge } from '@xyflow/react';
import { getComponentById } from './index';

export interface ReferenceArchitecture {
  id: string;
  name: string;
  description: string;
  designRationale: string;
  workloadType: string;
  layer: string;
  tags: string[];
  nodes: Node[];
  edges: Edge[];
}

function makeNode(compId: string, x: number, y: number, suffix: string = ''): Node | null {
  const comp = getComponentById(compId);
  if (!comp) return null;
  const id = `${compId}-ref-${suffix || Date.now()}`;
  return {
    id,
    type: 'hardware',
    position: { x, y },
    data: { component: comp, label: comp.name },
  };
}

function makeEdge(sourceId: string, targetId: string, label?: string): Edge {
  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: true,
    label,
    style: { stroke: '#76B900', strokeWidth: 2 },
  };
}

export function buildReferenceArchitectures(): ReferenceArchitecture[] {
  const archs: ReferenceArchitecture[] = [];

  // 1. DGX H100 Server (8x H100 SXM + 2x Sapphire Rapids + ConnectX-7)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const gpuIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const n = makeNode('gpu-h100-sxm', 50 + (i % 4) * 220, 50 + Math.floor(i / 4) * 200, `h100-${i}`);
      if (n) { nodes.push(n); gpuIds.push(n.id); }
    }
    const cpu1 = makeNode('cpu-xeon-emr', 160, 500, 'cpu1');
    const cpu2 = makeNode('cpu-xeon-emr', 600, 500, 'cpu2');
    if (cpu1) nodes.push(cpu1);
    if (cpu2) nodes.push(cpu2);
    const nic1 = makeNode('nic-cx7-400g', 100, 680, 'nic1');
    const nic2 = makeNode('nic-cx7-400g', 350, 680, 'nic2');
    const nic3 = makeNode('nic-cx7-400g', 600, 680, 'nic3');
    const nic4 = makeNode('nic-cx7-400g', 850, 680, 'nic4');
    [nic1, nic2, nic3, nic4].forEach(n => { if (n) nodes.push(n); });
    const mem1 = makeNode('mem-ddr5-64', 160, 850, 'mem1');
    const mem2 = makeNode('mem-ddr5-64', 600, 850, 'mem2');
    if (mem1) nodes.push(mem1);
    if (mem2) nodes.push(mem2);
    // GPU to CPU connections
    gpuIds.slice(0, 4).forEach(gid => { if (cpu1) edges.push(makeEdge(gid, cpu1.id, 'PCIe Gen5 x16')); });
    gpuIds.slice(4, 8).forEach(gid => { if (cpu2) edges.push(makeEdge(gid, cpu2.id, 'PCIe Gen5 x16')); });
    if (cpu1 && nic1) edges.push(makeEdge(cpu1.id, nic1.id, 'PCIe Gen5'));
    if (cpu1 && nic2) edges.push(makeEdge(cpu1.id, nic2.id, 'PCIe Gen5'));
    if (cpu2 && nic3) edges.push(makeEdge(cpu2.id, nic3.id, 'PCIe Gen5'));
    if (cpu2 && nic4) edges.push(makeEdge(cpu2.id, nic4.id, 'PCIe Gen5'));
    if (cpu1 && mem1) edges.push(makeEdge(cpu1.id, mem1.id, 'DDR5'));
    if (cpu2 && mem2) edges.push(makeEdge(cpu2.id, mem2.id, 'DDR5'));

    archs.push({
      id: 'dgx-h100',
      name: 'DGX H100 (8-GPU)',
      description: '8x H100 SXM GPUs with NVLink, dual Xeon CPUs, 4x ConnectX-7 400G NICs. The gold standard for large-scale LLM training.',
      designRationale: '**Why 8 GPUs?** LLM training uses tensor parallelism across GPUs within a node. 8 GPUs is the sweet spot — NVLink connects all 8 at 900 GB/s, far faster than PCIe. **Why SXM?** SXM form factor provides NVLink connectivity; PCIe GPUs cannot use NVLink. **Why 4 NICs?** Distributed training requires high inter-node bandwidth for gradient synchronization. 4x 400G = 1.6 Tbps total, preventing the network from becoming the bottleneck during data-parallel training. **Why dual CPUs?** Each CPU handles 4 GPUs worth of PCIe lanes and data preprocessing (tokenization, batching).',
      workloadType: 'llm_training',
      layer: 'server',
      tags: ['DGX', 'H100', 'NVLink', 'LLM Training'],
      nodes,
      edges,
    });
  }

  // 2. HGX H200 Server
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const gpuIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const n = makeNode('gpu-h200-sxm', 50 + (i % 4) * 220, 50 + Math.floor(i / 4) * 200, `h200-${i}`);
      if (n) { nodes.push(n); gpuIds.push(n.id); }
    }
    const cpu1 = makeNode('cpu-xeon-emr', 160, 500, 'cpu1');
    const cpu2 = makeNode('cpu-xeon-emr', 600, 500, 'cpu2');
    if (cpu1) nodes.push(cpu1);
    if (cpu2) nodes.push(cpu2);
    const nic1 = makeNode('nic-cx7-400g', 100, 680, 'nic1');
    const nic2 = makeNode('nic-cx7-400g', 600, 680, 'nic2');
    if (nic1) nodes.push(nic1);
    if (nic2) nodes.push(nic2);
    gpuIds.slice(0, 4).forEach(gid => { if (cpu1) edges.push(makeEdge(gid, cpu1.id, 'PCIe Gen5 x16')); });
    gpuIds.slice(4, 8).forEach(gid => { if (cpu2) edges.push(makeEdge(gid, cpu2.id, 'PCIe Gen5 x16')); });
    if (cpu1 && nic1) edges.push(makeEdge(cpu1.id, nic1.id, 'PCIe Gen5'));
    if (cpu2 && nic2) edges.push(makeEdge(cpu2.id, nic2.id, 'PCIe Gen5'));

    archs.push({
      id: 'hgx-h200',
      name: 'HGX H200 (8-GPU)',
      description: '8x H200 SXM GPUs with 141GB HBM3e each. Optimized for memory-bound LLM inference with 1.4x H100 memory bandwidth.',
      designRationale: '**Why H200 over H100?** The H200 has 141GB HBM3e vs 80GB HBM3 on H100. Larger models (70B+) fit entirely in GPU memory without offloading, dramatically reducing inference latency. **Why does memory matter?** LLM inference is memory-bandwidth-bound — the KV cache grows with context length. H200\'s 4.8 TB/s bandwidth serves longer contexts faster. **Why 8 GPUs for inference?** Large models (70B-405B parameters) must be split across GPUs via tensor parallelism. 8x 141GB = 1.1TB total GPU memory, enough for 405B models with room for KV cache.',
      workloadType: 'llm_inference',
      layer: 'server',
      tags: ['HGX', 'H200', 'HBM3e', 'Inference'],
      nodes,
      edges,
    });
  }

  // 3. Grace Hopper Superchip
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const gh = makeNode('cpu-grace', 300, 50, 'grace');
    const gpu = makeNode('gpu-h100-sxm', 300, 250, 'gh-h100');
    const nic = makeNode('nic-cx7-400g', 300, 450, 'gh-nic');
    const mem = makeNode('mem-ddr5-64', 50, 150, 'gh-mem');
    if (gh) nodes.push(gh);
    if (gpu) nodes.push(gpu);
    if (nic) nodes.push(nic);
    if (mem) nodes.push(mem);
    if (gh && gpu) edges.push(makeEdge(gh.id, gpu.id, 'NVLink-C2C 900 GB/s'));
    if (gpu && nic) edges.push(makeEdge(gpu.id, nic.id, 'PCIe Gen5'));
    if (gh && mem) edges.push(makeEdge(gh.id, mem.id, 'LPDDR5X'));

    archs.push({
      id: 'grace-hopper',
      name: 'Grace Hopper Superchip',
      description: 'NVIDIA Grace CPU + H100 GPU connected via NVLink-C2C at 900 GB/s. Unified memory architecture eliminates PCIe bottleneck for HPC workloads.',
      designRationale: '**Why NVLink-C2C instead of PCIe?** Traditional servers connect CPU↔GPU via PCIe Gen5 at ~64 GB/s. NVLink-C2C provides 900 GB/s — 14x faster. This matters for HPC workloads where data constantly moves between CPU and GPU memory. **Why Grace CPU?** Grace is Arm-based with 72 cores optimized for memory bandwidth per watt (LPDDR5X). HPC codes like fluid dynamics and weather modeling need high memory bandwidth, not just clock speed. **Why a single GPU?** Many HPC applications are memory-bound, not compute-bound. One H100 with unified CPU+GPU memory via C2C outperforms 4 PCIe GPUs that are starved for data.',
      workloadType: 'hpc',
      layer: 'server',
      tags: ['Grace Hopper', 'NVLink-C2C', 'Superchip'],
      nodes,
      edges,
    });
  }

  // 4. 4-GPU PCIe Inference Server
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const gpuIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const n = makeNode('gpu-l40s', 50 + i * 220, 50, `l40s-${i}`);
      if (n) { nodes.push(n); gpuIds.push(n.id); }
    }
    const cpu = makeNode('cpu-xeon-spr', 300, 250, 'cpu');
    if (cpu) nodes.push(cpu);
    const nic = makeNode('nic-cx7-100g', 300, 430, 'nic');
    if (nic) nodes.push(nic);
    const ssd = makeNode('storage-nvme-7.68', 550, 430, 'ssd');
    if (ssd) nodes.push(ssd);
    const mem = makeNode('mem-ddr5-64', 50, 430, 'mem');
    if (mem) nodes.push(mem);
    gpuIds.forEach(gid => { if (cpu) edges.push(makeEdge(gid, cpu.id, 'PCIe Gen4 x16')); });
    if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen4'));
    if (cpu && ssd) edges.push(makeEdge(cpu.id, ssd.id, 'PCIe Gen4 x4'));
    if (cpu && mem) edges.push(makeEdge(cpu.id, mem.id, 'DDR5'));

    archs.push({
      id: 'inference-4gpu-l40s',
      name: '4x L40S Inference Server',
      description: '4x L40S GPUs on PCIe Gen4 for multi-model inference. Cost-effective for serving multiple smaller models concurrently.',
      designRationale: '**Why L40S instead of H100?** L40S costs ~1/3 of an H100 and has 48GB GDDR6X — enough for 7B-13B models per GPU. For inference (not training), the compute requirements are lower. **Why 4 GPUs?** Each GPU serves a different model or multiple instances of the same model. 4x L40S can serve 4-8 models concurrently. **Why PCIe?** Inference doesn\'t need NVLink — there\'s minimal GPU-to-GPU communication. PCIe Gen4 x16 provides sufficient bandwidth for loading model weights and returning results. **Cost advantage:** ~$30K for 4x L40S vs ~$120K for 4x H100, with inference throughput within 2x for most models.',
      workloadType: 'inference',
      layer: 'server',
      tags: ['L40S', 'Inference', 'PCIe', 'Multi-model'],
      nodes,
      edges,
    });
  }

  // 5. Edge Inference Node (L4)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const gpu1 = makeNode('gpu-l4', 50, 50, 'l4-0');
    const gpu2 = makeNode('gpu-l4', 300, 50, 'l4-1');
    const cpu = makeNode('cpu-xeon-spr', 175, 250, 'cpu');
    const nic = makeNode('nic-cx6dx-100g', 175, 430, 'nic');
    if (gpu1) nodes.push(gpu1);
    if (gpu2) nodes.push(gpu2);
    if (cpu) nodes.push(cpu);
    if (nic) nodes.push(nic);
    if (gpu1 && cpu) edges.push(makeEdge(gpu1.id, cpu.id, 'PCIe Gen4 x16'));
    if (gpu2 && cpu) edges.push(makeEdge(gpu2.id, cpu.id, 'PCIe Gen4 x16'));
    if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen4'));

    archs.push({
      id: 'edge-l4',
      name: 'Edge Inference (2x L4)',
      description: '2x L4 low-power GPUs (72W each) for edge inference. Small form factor, ideal for video analytics and real-time NLP at the edge.',
      designRationale: '**Why L4?** At only 72W TDP, the L4 fits in standard PCIe slots without extra power connectors — perfect for space/power-constrained edge locations. **Why edge?** Processing data locally avoids sending video streams to the cloud (bandwidth cost, latency, privacy). A retail store or factory can run inference on-site. **Why 2 GPUs?** One GPU handles the primary workload (e.g., object detection), the second provides redundancy or runs a secondary model. **What can it run?** Each L4 handles ~30 simultaneous 1080p video streams for object detection, or real-time NLP for customer-facing applications.',
      workloadType: 'inference',
      layer: 'server',
      tags: ['L4', 'Edge', 'Low Power', '72W'],
      nodes,
      edges,
    });
  }

  // 6. InfiniBand Cluster (4 nodes + leaf switch)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const sw = makeNode('switch-qm9700', 350, 50, 'ib-spine');
    if (sw) nodes.push(sw);
    for (let i = 0; i < 4; i++) {
      const nic = makeNode('nic-cx7-400g', 50 + i * 220, 280, `cluster-nic-${i}`);
      if (nic && sw) {
        nodes.push(nic);
        edges.push(makeEdge(sw.id, nic.id, 'NDR 400G InfiniBand'));
      }
    }

    archs.push({
      id: 'ib-cluster-4node',
      name: '4-Node InfiniBand Cluster',
      description: '4 server nodes connected via Quantum-2 NDR switch at 400Gbps per port. Fat-tree topology for all-to-all GPU communication during distributed training.',
      designRationale: '**Why InfiniBand?** IB provides native RDMA with sub-microsecond latency and credit-based flow control (inherently lossless). Distributed training uses allreduce operations that are latency-sensitive. **Why NDR 400G?** During data-parallel training, each node must exchange gradients with every other node every iteration. 400Gbps ensures gradient sync doesn\'t bottleneck training throughput. **Why a single switch?** 4 nodes fit on one leaf switch. This is a non-blocking topology — every node gets full 400Gbps to every other node simultaneously. Scale beyond ~32 nodes requires a spine-leaf fabric.',
      workloadType: 'llm_training',
      layer: 'cluster',
      tags: ['InfiniBand', 'NDR', 'Quantum-2', 'Fat-tree'],
      nodes,
      edges,
    });
  }

  // 7. RoCE Ethernet Cluster (Spectrum-4) — 4 server nodes
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Top-of-Rack Spectrum-4 switch
    const sw = makeNode('switch-sn5600', 350, 50, 'roce-sw');
    if (sw) nodes.push(sw);
    // 4 server nodes, each with GPU + CPU + NIC
    for (let i = 0; i < 4; i++) {
      const xOff = 50 + i * 240;
      const gpu = makeNode('gpu-h100-pcie', xOff, 500, `roce-gpu-${i}`);
      const cpu = makeNode('cpu-xeon-emr', xOff, 350, `roce-cpu-${i}`);
      const nic = makeNode('nic-cx6dx-100g', xOff, 200, `roce-nic-${i}`);
      if (gpu) nodes.push(gpu);
      if (cpu) nodes.push(cpu);
      if (nic) nodes.push(nic);
      // NIC ↔ Switch
      if (nic && sw) edges.push(makeEdge(sw.id, nic.id, 'RoCEv2 100G'));
      // CPU ↔ NIC
      if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen4'));
      // GPU ↔ CPU
      if (gpu && cpu) edges.push(makeEdge(gpu.id, cpu.id, 'PCIe Gen5 x16'));
    }

    archs.push({
      id: 'roce-cluster',
      name: 'RoCE Ethernet Cluster (4-Node)',
      description: 'Four GPU servers connected via a Spectrum-4 ToR switch using RoCEv2 with PFC for lossless RDMA over Ethernet. Good balance of cost and performance for medium-scale training.',
      designRationale: '**Why Ethernet instead of InfiniBand?** Ethernet switches cost 30-50% less than IB, and most data center teams already know Ethernet. For clusters under 32 nodes, the performance gap is manageable. **Why RoCE?** RoCEv2 adds RDMA capability to Ethernet, achieving latencies close to IB (~1-2μs vs 0.6μs). **What\'s PFC?** Priority Flow Control makes Ethernet lossless — required for RDMA. Without PFC, packet drops cause RDMA failures. **Why one GPU per node?** This is a cost-effective configuration for DL training with data parallelism — each node trains on a different batch and synchronizes gradients via all-reduce over the RoCE fabric. **Tradeoff:** Easier to integrate with existing Ethernet infrastructure, but requires careful PFC/ECN tuning to avoid congestion storms at scale.',
      workloadType: 'dl_training',
      layer: 'cluster',
      tags: ['RoCE', 'Ethernet', 'Spectrum-4', 'PFC', 'Lossless'],
      nodes,
      edges,
    });
  }

  // 8. BlueField DPU Secure Cluster
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const sw = makeNode('switch-sn5600', 300, 50, 'bf-sw');
    if (sw) nodes.push(sw);
    const dpu1 = makeNode('dpu-bf3', 100, 280, 'bf3-0');
    const dpu2 = makeNode('dpu-bf3', 500, 280, 'bf3-1');
    if (dpu1) nodes.push(dpu1);
    if (dpu2) nodes.push(dpu2);
    const gpu1 = makeNode('gpu-h100-pcie', 100, 480, 'bf-gpu-0');
    const gpu2 = makeNode('gpu-h100-pcie', 500, 480, 'bf-gpu-1');
    if (gpu1) nodes.push(gpu1);
    if (gpu2) nodes.push(gpu2);
    if (sw && dpu1) edges.push(makeEdge(sw.id, dpu1.id, '400G Ethernet'));
    if (sw && dpu2) edges.push(makeEdge(sw.id, dpu2.id, '400G Ethernet'));
    if (dpu1 && gpu1) edges.push(makeEdge(dpu1.id, gpu1.id, 'PCIe Gen5'));
    if (dpu2 && gpu2) edges.push(makeEdge(dpu2.id, gpu2.id, 'PCIe Gen5'));

    archs.push({
      id: 'bluefield-secure',
      name: 'BlueField-3 Secure AI Cluster',
      description: 'BlueField-3 DPUs offload networking, security, and storage. Zero-trust architecture with hardware-isolated data plane for multi-tenant AI.',
      designRationale: '**Why DPUs?** In multi-tenant environments, the host CPU can\'t be trusted — a compromised VM could sniff network traffic. The BlueField DPU runs its own Arm OS and handles all networking in hardware, isolated from the host. **What does it offload?** OVS switching, IPsec encryption, firewall rules, NVMe-oF storage — all in hardware at line rate (400Gbps). This frees CPU cores for application workloads. **Why for AI?** Cloud providers and enterprises sharing GPU pools need tenant isolation. DPUs provide this without performance overhead, unlike software-based network virtualization.',
      workloadType: 'inference',
      layer: 'cluster',
      tags: ['BlueField', 'DPU', 'Zero-Trust', 'Multi-tenant'],
      nodes,
      edges,
    });
  }

  // 9. Grace CPU Superchip (Dual Grace)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const grace1 = makeNode('cpu-grace', 100, 50, 'grace-0');
    const grace2 = makeNode('cpu-grace', 500, 50, 'grace-1');
    const nic = makeNode('nic-cx7-400g', 300, 250, 'grace-nic');
    const mem1 = makeNode('mem-ddr5-64', 100, 250, 'grace-mem-0');
    const mem2 = makeNode('mem-ddr5-64', 500, 250, 'grace-mem-1');
    if (grace1) nodes.push(grace1);
    if (grace2) nodes.push(grace2);
    if (nic) nodes.push(nic);
    if (mem1) nodes.push(mem1);
    if (mem2) nodes.push(mem2);
    if (grace1 && grace2) edges.push(makeEdge(grace1.id, grace2.id, 'NVLink-C2C'));
    if (grace1 && nic) edges.push(makeEdge(grace1.id, nic.id, 'PCIe Gen5'));
    if (grace1 && mem1) edges.push(makeEdge(grace1.id, mem1.id, 'LPDDR5X'));
    if (grace2 && mem2) edges.push(makeEdge(grace2.id, mem2.id, 'LPDDR5X'));

    archs.push({
      id: 'grace-superchip',
      name: 'Grace CPU Superchip (Dual)',
      description: 'Dual NVIDIA Grace CPUs connected via NVLink-C2C. 144 Arm cores, designed for HPC workloads with high memory bandwidth per watt.',
      designRationale: '**Why dual Grace?** Two Grace CPUs connected via NVLink-C2C share a unified memory space with 1TB/s bandwidth. This is ideal for memory-bandwidth-bound HPC codes (CFD, weather simulation, genomics). **Why Arm?** Grace\'s Arm Neoverse V2 cores deliver higher performance-per-watt than x86 for HPC workloads. A 144-core dual-socket system runs at ~500W vs ~700W for equivalent Xeon. **Where does this fit?** CPU-only HPC workloads that don\'t need GPUs — molecular dynamics pre/post-processing, climate modeling, bioinformatics pipelines.',
      workloadType: 'hpc',
      layer: 'server',
      tags: ['Grace', 'Arm', 'NVLink-C2C', 'HPC'],
      nodes,
      edges,
    });
  }

  // 10. PCIe Switch Topology (GPU expansion)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const pcieSw = makeNode('pcie-switch-gen5', 300, 50, 'pcie-sw');
    if (pcieSw) nodes.push(pcieSw);
    for (let i = 0; i < 4; i++) {
      const gpu = makeNode('gpu-h100-pcie', 50 + i * 200, 280, `pcie-gpu-${i}`);
      if (gpu && pcieSw) {
        nodes.push(gpu);
        edges.push(makeEdge(pcieSw.id, gpu.id, 'PCIe Gen5 x16'));
      }
    }
    const cpu = makeNode('cpu-xeon-emr', 300, 480, 'pcie-cpu');
    if (cpu && pcieSw) {
      nodes.push(cpu);
      edges.push(makeEdge(cpu.id, pcieSw.id, 'PCIe Gen5 x16 (upstream)'));
    }

    archs.push({
      id: 'pcie-switch-4gpu',
      name: 'PCIe Switch 4-GPU Topology',
      description: 'PCIe Gen5 switch fanning out to 4x H100 PCIe GPUs from a single CPU upstream port. Demonstrates how PCIe switches expand limited CPU PCIe lanes.',
      designRationale: '**The problem:** A CPU has limited PCIe lanes (typically 80-128). Each GPU needs x16 lanes. With 4+ GPUs plus NICs, NVMe, and other devices, you run out of lanes. **The solution:** A PCIe switch takes one x16 upstream link and fans out to multiple downstream ports. All 4 GPUs share the upstream bandwidth. **Tradeoff:** Total bandwidth to CPU is limited by the upstream link. GPU↔GPU traffic through the switch is full speed, but GPU↔CPU traffic is shared. **When to use:** When you need more GPUs than the CPU has direct PCIe lanes for, and GPU-to-GPU P2P traffic is more important than GPU-to-CPU traffic.',
      workloadType: 'dl_training',
      layer: 'pcie',
      tags: ['PCIe Switch', 'GPU Expansion', 'Fan-out'],
      nodes,
      edges,
    });
  }

  // 11. T4 Inference Fleet
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    for (let i = 0; i < 4; i++) {
      const gpu = makeNode('gpu-t4', 50 + i * 200, 50, `t4-${i}`);
      if (gpu) nodes.push(gpu);
    }
    const cpu = makeNode('cpu-xeon-spr', 300, 250, 't4-cpu');
    if (cpu) nodes.push(cpu);
    const nic = makeNode('nic-cx6dx-100g', 100, 430, 't4-nic');
    const ssd = makeNode('storage-nvme-3.84', 500, 430, 't4-ssd');
    if (nic) nodes.push(nic);
    if (ssd) nodes.push(ssd);
    nodes.filter(n => (n.data?.component as any)?.category === 'gpu').forEach(g => {
      if (cpu) edges.push(makeEdge(g.id, cpu.id, 'PCIe Gen3 x16'));
    });
    if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen4'));
    if (cpu && ssd) edges.push(makeEdge(cpu.id, ssd.id, 'PCIe Gen4 x4'));

    archs.push({
      id: 't4-inference-fleet',
      name: 'T4 Inference Fleet (4-GPU)',
      description: '4x T4 GPUs (70W each) for high-density inference. Popular in cloud instances (AWS G4dn). Best $/inference for batch workloads.',
      designRationale: '**Why T4?** At 70W and 16GB, the T4 is the most power/cost-efficient GPU for batch inference. It fits in any standard server without extra power infrastructure. **Why 4 GPUs?** Dense packing: a 2U server with 4x T4s handles 4 independent model instances. At $2-3K per T4, the total GPU cost is under $12K. **Best for:** Batch inference (not real-time) — image classification, NLP text processing, recommendation scoring. Each T4 handles hundreds of inferences per second for ResNet-50 or BERT-base. **Cloud equivalent:** This is essentially what AWS G4dn.12xlarge provides.',
      workloadType: 'inference',
      layer: 'server',
      tags: ['T4', 'Cloud', 'Low Power', 'Batch Inference'],
      nodes,
      edges,
    });
  }

  // 12. Spine-Leaf IB Fabric
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const spine1 = makeNode('switch-qm9700', 200, 50, 'spine-0');
    const spine2 = makeNode('switch-qm9700', 600, 50, 'spine-1');
    if (spine1) nodes.push(spine1);
    if (spine2) nodes.push(spine2);
    for (let i = 0; i < 4; i++) {
      const leaf = makeNode('switch-qm9700', 50 + i * 250, 300, `leaf-${i}`);
      if (leaf) {
        nodes.push(leaf);
        if (spine1) edges.push(makeEdge(spine1.id, leaf.id, 'NDR 400G'));
        if (spine2) edges.push(makeEdge(spine2.id, leaf.id, 'NDR 400G'));
      }
    }

    archs.push({
      id: 'spine-leaf-ib',
      name: 'Spine-Leaf InfiniBand Fabric',
      description: '2 spine + 4 leaf Quantum-2 switches forming a non-blocking fat-tree. Standard topology for 32-128 node GPU clusters with full bisection bandwidth.',
      designRationale: '**Why spine-leaf?** A flat single-switch topology maxes out at ~32 nodes (one switch\'s port count). Spine-leaf scales to hundreds of nodes while maintaining non-blocking bandwidth. **How it works:** Every leaf switch connects to every spine switch. Traffic between any two leaf switches traverses exactly one spine hop — predictable latency. **Why non-blocking matters:** During allreduce in distributed training, every node talks to every other node simultaneously. Blocking (oversubscribed) fabrics cause congestion and slow training. **Scaling:** 2 spines × 4 leaves with 64-port switches supports ~128 nodes. Add more spines for more bisection bandwidth.',
      workloadType: 'llm_training',
      layer: 'network',
      tags: ['Spine-Leaf', 'Fat-tree', 'Non-blocking', 'InfiniBand'],
      nodes,
      edges,
    });
  }

  // =====================================================
  // BUSINESS-FOCUSED REFERENCE ARCHITECTURES
  // =====================================================

  // 13. LLM Training Cluster (e.g., GPT/LLaMA-scale)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // 2 spine switches
    const spine1 = makeNode('switch-qm9700', 300, 0, 'llm-spine-0');
    const spine2 = makeNode('switch-qm9700', 700, 0, 'llm-spine-1');
    if (spine1) nodes.push(spine1);
    if (spine2) nodes.push(spine2);
    // 4 leaf switches
    const leafIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const leaf = makeNode('switch-qm9700', 100 + i * 280, 180, `llm-leaf-${i}`);
      if (leaf) {
        nodes.push(leaf);
        leafIds.push(leaf.id);
        if (spine1) edges.push(makeEdge(spine1.id, leaf.id, 'NDR 400G'));
        if (spine2) edges.push(makeEdge(spine2.id, leaf.id, 'NDR 400G'));
      }
    }
    // 8 server nodes (2 per leaf), each with 8x H100 + NICs
    for (let l = 0; l < 4; l++) {
      for (let s = 0; s < 2; s++) {
        const idx = l * 2 + s;
        const baseX = 30 + l * 280;
        const y = 380 + s * 200;
        const gpu = makeNode('gpu-h100-sxm', baseX, y, `llm-gpu8-${idx}`);
        const nic = makeNode('nic-cx7-400g', baseX + 140, y, `llm-nic-${idx}`);
        if (gpu) nodes.push(gpu);
        if (nic) {
          nodes.push(nic);
          if (gpu) edges.push(makeEdge(gpu.id, nic.id, 'PCIe Gen5'));
          if (leafIds[l]) edges.push(makeEdge(leafIds[l], nic.id, 'NDR 400G IB'));
        }
      }
    }

    archs.push({
      id: 'biz-llm-training',
      name: 'LLM Training Cluster (GPT/LLaMA-scale)',
      description: 'Full-scale LLM training infrastructure: 8 DGX-class nodes (64 H100 GPUs total) connected via a 2-tier InfiniBand fat-tree. Supports 70B+ parameter model training with 3D parallelism (data + tensor + pipeline). Budget: ~$2-4M. Typical customers: AI labs, large enterprises building foundation models.',
      designRationale: '**Why 64 GPUs for LLM training?** A 70B parameter model requires ~140GB in FP16 just for weights, plus optimizer states (3x), gradients, and activations. Training uses 3D parallelism: tensor parallel across 8 GPUs in a node (NVLink), data parallel across nodes (InfiniBand), and pipeline parallel for memory. **Why InfiniBand fat-tree?** Data parallelism requires allreduce of gradients every training step. With 8 nodes doing allreduce simultaneously, you need full bisection bandwidth — a fat-tree provides this. **ROI justification:** Training a 70B model from scratch takes ~1M GPU-hours. At $2/GPU-hour cloud pricing, that\'s $2M. Owning the cluster pays for itself in 1-2 training runs, plus you retain data sovereignty.',
      workloadType: 'llm_training',
      layer: 'cluster',
      tags: ['LLM Training', 'GPT', 'LLaMA', 'Foundation Models', '64 GPUs', 'InfiniBand', 'Fat-tree'],
      nodes,
      edges,
    });
  }

  // 14. Self-Hosted LLM Inference (Enterprise RAG/Chatbot)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const sw = makeNode('switch-sn5600', 400, 0, 'inf-sw');
    if (sw) nodes.push(sw);
    // 3 inference servers with H200s for maximum context window
    for (let i = 0; i < 3; i++) {
      const gpu1 = makeNode('gpu-h200-sxm', 50 + i * 320, 200, `inf-h200a-${i}`);
      const gpu2 = makeNode('gpu-h200-sxm', 50 + i * 320, 360, `inf-h200b-${i}`);
      const cpu = makeNode('cpu-xeon-emr', 170 + i * 320, 280, `inf-cpu-${i}`);
      const nic = makeNode('nic-cx7-200g', 170 + i * 320, 140, `inf-nic-${i}`);
      const ssd = makeNode('nvme-gen4-8tb', 50 + i * 320, 500, `inf-ssd-${i}`);
      if (gpu1) nodes.push(gpu1);
      if (gpu2) nodes.push(gpu2);
      if (cpu) nodes.push(cpu);
      if (nic) nodes.push(nic);
      if (ssd) nodes.push(ssd);
      if (gpu1 && cpu) edges.push(makeEdge(gpu1.id, cpu.id, 'PCIe Gen5 x16'));
      if (gpu2 && cpu) edges.push(makeEdge(gpu2.id, cpu.id, 'PCIe Gen5 x16'));
      if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen5'));
      if (cpu && ssd) edges.push(makeEdge(cpu.id, ssd.id, 'NVMe Gen4'));
      if (sw && nic) edges.push(makeEdge(sw.id, nic.id, 'RoCEv2 200G'));
    }

    archs.push({
      id: 'biz-self-hosted-llm',
      name: 'Self-Hosted LLM Inference (Enterprise)',
      description: '3-node cluster for hosting 70B-parameter LLMs (LLaMA, Mixtral, internal fine-tuned models) with H200 GPUs for 141GB HBM3e per GPU. Serves enterprise chatbots, code assistants, and document Q&A. Supports 100+ concurrent users. Each node has NVMe storage for model weights and RAG vector indexes. Budget: ~$500K-$1M.',
      designRationale: '**Why self-host?** Enterprise data (legal docs, code, financials) can\'t leave the premises. Self-hosted LLMs provide GPT-4-class capabilities with full data control. **Why H200?** A 70B model in FP16 needs ~140GB. Two H200s (2×141GB) fit the entire model with room for large KV caches (long context windows). **Why 3 nodes?** High availability: 2 active + 1 standby. Load balancer routes requests across nodes. If one fails, remaining nodes handle traffic. **Why NVMe?** Model weights (140GB+) must load from disk on restart. NVMe at 7 GB/s loads the model in ~20 seconds vs minutes on SATA. Also stores RAG vector indexes for sub-millisecond retrieval. **Cost vs cloud:** At 100+ concurrent users, self-hosted breaks even vs API pricing in 6-12 months.',
      workloadType: 'llm_inference',
      layer: 'cluster',
      tags: ['LLM Inference', 'Self-Hosted', 'Enterprise', 'RAG', 'Chatbot', 'H200'],
      nodes,
      edges,
    });
  }

  // 15. RAG Pipeline Server (Retrieval-Augmented Generation)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Inference GPUs
    const gpu1 = makeNode('gpu-l40s', 50, 50, 'rag-l40s-0');
    const gpu2 = makeNode('gpu-l40s', 270, 50, 'rag-l40s-1');
    const gpu3 = makeNode('gpu-l40s', 490, 50, 'rag-l40s-2');
    const gpu4 = makeNode('gpu-l40s', 710, 50, 'rag-l40s-3');
    [gpu1, gpu2, gpu3, gpu4].forEach(g => { if (g) nodes.push(g); });
    // CPU
    const cpu = makeNode('cpu-xeon-emr', 350, 230, 'rag-cpu');
    if (cpu) nodes.push(cpu);
    // Storage for vector DB + documents
    const ssd1 = makeNode('nvme-gen4-8tb', 100, 400, 'rag-ssd-0');
    const ssd2 = makeNode('nvme-gen4-8tb', 350, 400, 'rag-ssd-1');
    if (ssd1) nodes.push(ssd1);
    if (ssd2) nodes.push(ssd2);
    // Memory
    const mem = makeNode('mem-ddr5-128gb-4800', 600, 400, 'rag-mem');
    if (mem) nodes.push(mem);
    // NIC
    const nic = makeNode('nic-cx6dx-100g', 600, 230, 'rag-nic');
    if (nic) nodes.push(nic);
    // Edges
    [gpu1, gpu2, gpu3, gpu4].forEach(g => { if (g && cpu) edges.push(makeEdge(g.id, cpu.id, 'PCIe Gen5 x16')); });
    if (cpu && ssd1) edges.push(makeEdge(cpu.id, ssd1.id, 'NVMe Gen4 x4'));
    if (cpu && ssd2) edges.push(makeEdge(cpu.id, ssd2.id, 'NVMe Gen4 x4'));
    if (cpu && mem) edges.push(makeEdge(cpu.id, mem.id, 'DDR5'));
    if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen5'));

    archs.push({
      id: 'biz-rag-pipeline',
      name: 'RAG Pipeline Server',
      description: 'Single-server RAG architecture: 4x L40S GPUs for embedding generation + LLM inference, large NVMe storage for vector database (Milvus/Weaviate/pgvector) and document corpus, 128GB+ RAM for in-memory caching. Ideal for enterprise knowledge bases, legal document search, internal wikis. Budget: ~$80-120K.',
      designRationale: '**What is RAG?** Retrieval-Augmented Generation grounds LLM responses in your actual documents, reducing hallucinations. The pipeline: embed query → search vector DB → retrieve context → feed to LLM → generate answer. **Why L40S?** Each L40S handles both embedding generation (fast, uses ~10% of GPU) and LLM inference (the bottleneck). 48GB GDDR6X fits a 7-13B model per GPU. 4 GPUs serve 4 parallel inference requests. **Why large NVMe?** Vector databases grow fast — 1M documents ≈ 10-50GB of embeddings. Plus you store the raw documents for retrieval. 16TB gives room for millions of documents. **Why 128GB+ RAM?** Hot vector indexes are cached in RAM for sub-millisecond retrieval. The vector DB performance depends heavily on RAM-to-index size ratio.',
      workloadType: 'llm_inference',
      layer: 'server',
      tags: ['RAG', 'Vector DB', 'Knowledge Base', 'L40S', 'Document Search', 'Embeddings'],
      nodes,
      edges,
    });
  }

  // 16. Multi-Tenant AI-as-a-Service Platform
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Front-end Ethernet switch
    const ethSw = makeNode('switch-sn5600', 400, 0, 'aiaas-eth-sw');
    if (ethSw) nodes.push(ethSw);
    // DPU-secured inference nodes for multi-tenancy
    for (let i = 0; i < 4; i++) {
      const dpu = makeNode('dpu-bf3', 50 + i * 240, 180, `aiaas-dpu-${i}`);
      const gpu = makeNode('gpu-l40s', 50 + i * 240, 380, `aiaas-gpu-${i}`);
      const cpu = makeNode('cpu-xeon-spr', 160 + i * 240, 280, `aiaas-cpu-${i}`);
      if (dpu) nodes.push(dpu);
      if (gpu) nodes.push(gpu);
      if (cpu) nodes.push(cpu);
      if (ethSw && dpu) edges.push(makeEdge(ethSw.id, dpu.id, '400G Ethernet'));
      if (dpu && cpu) edges.push(makeEdge(dpu.id, cpu.id, 'PCIe Gen5'));
      if (gpu && cpu) edges.push(makeEdge(gpu.id, cpu.id, 'PCIe Gen5 x16'));
    }

    archs.push({
      id: 'biz-ai-as-a-service',
      name: 'Multi-Tenant AI-as-a-Service Platform',
      description: '4-node platform for hosting multiple AI models for different customers/teams. BlueField-3 DPUs provide hardware-isolated networking per tenant (zero-trust). Each node runs containerized model serving (Triton). Supports SLAs per tenant with GPU MIG partitioning. Budget: ~$200-400K. Typical: MSPs, cloud providers, large enterprises sharing GPU pools.',
      designRationale: '**Why multi-tenant?** Enterprises have multiple teams (marketing ML, fraud detection, customer support AI) all needing GPU resources. A shared platform avoids each team buying dedicated hardware. **Why BlueField DPUs?** In shared environments, network security is critical. DPUs enforce tenant isolation at the hardware level — one team\'s traffic can\'t be seen by another, even if the host OS is compromised. **Why MIG?** Multi-Instance GPU partitions an L40S into up to 7 isolated GPU slices. Each tenant gets guaranteed compute and memory, with hardware-level isolation. No noisy-neighbor problems. **Why Triton?** NVIDIA Triton Inference Server handles model versioning, batching, and multi-framework support (PyTorch, TensorFlow, ONNX) — essential for serving diverse models from different teams.',
      workloadType: 'inference',
      layer: 'cluster',
      tags: ['AI-as-a-Service', 'Multi-Tenant', 'BlueField', 'Zero-Trust', 'Triton', 'MIG'],
      nodes,
      edges,
    });
  }

  // 17. Real-Time Video Analytics (Smart City / Retail)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Edge switch
    const sw = makeNode('switch-sn3700', 300, 0, 'video-sw');
    if (sw) nodes.push(sw);
    // Edge inference nodes with L4 GPUs (low power)
    for (let i = 0; i < 6; i++) {
      const gpu = makeNode('gpu-l4', 30 + i * 150, 200, `video-l4-${i}`);
      const nic = makeNode('nic-cx6lx-25g', 30 + i * 150, 350, `video-nic-${i}`);
      if (gpu) nodes.push(gpu);
      if (nic) nodes.push(nic);
      if (gpu && nic) edges.push(makeEdge(gpu.id, nic.id, 'PCIe Gen4'));
      if (sw && nic) edges.push(makeEdge(sw.id, nic.id, '25G Ethernet'));
    }
    // Central aggregation server
    const aggGpu = makeNode('gpu-l40', 350, 480, 'video-agg-gpu');
    const aggCpu = makeNode('cpu-xeon-spr', 550, 480, 'video-agg-cpu');
    const aggNic = makeNode('nic-cx6dx-100g', 450, 600, 'video-agg-nic');
    if (aggGpu) nodes.push(aggGpu);
    if (aggCpu) nodes.push(aggCpu);
    if (aggNic) nodes.push(aggNic);
    if (aggGpu && aggCpu) edges.push(makeEdge(aggGpu.id, aggCpu.id, 'PCIe Gen4 x16'));
    if (aggCpu && aggNic) edges.push(makeEdge(aggCpu.id, aggNic.id, 'PCIe Gen4'));
    if (sw && aggNic) edges.push(makeEdge(sw.id, aggNic.id, '100G Ethernet'));

    archs.push({
      id: 'biz-video-analytics',
      name: 'Real-Time Video Analytics (Smart City/Retail)',
      description: '6 edge L4 nodes for camera-side inference (object detection, license plate, facial recognition) + 1 central L40 aggregation server. Each L4 handles 8-16 camera streams at 30fps. 25G Ethernet backhaul. Typical: smart city surveillance, retail loss prevention, warehouse safety. Budget: ~$40-80K.',
      designRationale: '**Why edge processing?** Sending raw 1080p video streams to the cloud requires ~5 Mbps per camera. 100 cameras = 500 Mbps constant upload — expensive and high-latency. Edge inference processes locally and sends only metadata (bounding boxes, alerts). **Why L4?** At 72W and single-slot PCIe, the L4 fits in ruggedized edge enclosures without special cooling. It handles 8-16 simultaneous camera streams using NVIDIA DeepStream. **Why a central aggregation server?** Edge nodes detect objects; the central L40 server correlates across cameras (tracking a person across multiple views), stores video evidence, and runs more complex analytics. **Why 25G Ethernet?** Metadata from edge nodes is small (<1 Mbps per camera), but occasional video clip uploads and model updates need headroom. 25G is future-proof and cost-effective.',
      workloadType: 'inference',
      layer: 'cluster',
      tags: ['Video Analytics', 'Edge', 'Smart City', 'Retail', 'L4', 'DeepStream', 'Low Power'],
      nodes,
      edges,
    });
  }

  // 18. Autonomous Vehicle Training Pipeline
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Training GPUs (A100 SXM for mixed precision)
    const gpuIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const gpu = makeNode('gpu-a100-sxm', 50 + (i % 4) * 220, 50 + Math.floor(i / 4) * 180, `av-gpu-${i}`);
      if (gpu) { nodes.push(gpu); gpuIds.push(gpu.id); }
    }
    const cpu1 = makeNode('cpu-epyc-genoa', 200, 430, 'av-cpu-0');
    const cpu2 = makeNode('cpu-epyc-genoa', 640, 430, 'av-cpu-1');
    if (cpu1) nodes.push(cpu1);
    if (cpu2) nodes.push(cpu2);
    // Massive NVMe storage for sensor data
    const ssd1 = makeNode('nvme-gen4-8tb', 50, 590, 'av-ssd-0');
    const ssd2 = makeNode('nvme-gen4-8tb', 250, 590, 'av-ssd-1');
    const ssd3 = makeNode('nvme-gen4-8tb', 450, 590, 'av-ssd-2');
    const ssd4 = makeNode('nvme-gen4-8tb', 650, 590, 'av-ssd-3');
    [ssd1, ssd2, ssd3, ssd4].forEach(s => { if (s) nodes.push(s); });
    const nic1 = makeNode('nic-cx7-400g', 100, 750, 'av-nic-0');
    const nic2 = makeNode('nic-cx7-400g', 550, 750, 'av-nic-1');
    if (nic1) nodes.push(nic1);
    if (nic2) nodes.push(nic2);
    // Edges
    gpuIds.slice(0, 4).forEach(gid => { if (cpu1) edges.push(makeEdge(gid, cpu1.id, 'PCIe Gen4 x16')); });
    gpuIds.slice(4, 8).forEach(gid => { if (cpu2) edges.push(makeEdge(gid, cpu2.id, 'PCIe Gen4 x16')); });
    if (cpu1 && ssd1) edges.push(makeEdge(cpu1.id, ssd1.id, 'NVMe Gen4'));
    if (cpu1 && ssd2) edges.push(makeEdge(cpu1.id, ssd2.id, 'NVMe Gen4'));
    if (cpu2 && ssd3) edges.push(makeEdge(cpu2.id, ssd3.id, 'NVMe Gen4'));
    if (cpu2 && ssd4) edges.push(makeEdge(cpu2.id, ssd4.id, 'NVMe Gen4'));
    if (cpu1 && nic1) edges.push(makeEdge(cpu1.id, nic1.id, 'PCIe Gen4'));
    if (cpu2 && nic2) edges.push(makeEdge(cpu2.id, nic2.id, 'PCIe Gen4'));

    archs.push({
      id: 'biz-av-training',
      name: 'Autonomous Vehicle Training Pipeline',
      description: '8x A100 SXM training server with massive NVMe storage (32TB+) for sensor data (LiDAR point clouds, camera footage, radar). Dual EPYC CPUs for data preprocessing. Trains perception, prediction, and planning models. Used with NVIDIA DRIVE Sim for scenario generation. Budget: ~$300-500K per node.',
      designRationale: '**Why so much storage?** A single AV test drive generates ~1TB/hour of sensor data (6 cameras + LiDAR + radar). Fleet data grows to petabytes. Training needs fast local access to this data — 4x 8TB NVMe SSDs at 28 GB/s combined read. **Why A100 SXM?** AV perception models (3D object detection, lane segmentation) are compute-heavy. A100s provide the mixed-precision (TF32/FP16) throughput needed. 80GB HBM2e fits large point cloud batches. **Why dual EPYC?** Sensor data preprocessing (point cloud voxelization, camera undistortion, data augmentation) is CPU-intensive. 128 EPYC cores handle preprocessing at GPU training speed. **Why this matters:** AV companies like Waymo and Cruise run thousands of these nodes. Each training run improves the self-driving model\'s safety metrics.',
      workloadType: 'dl_training',
      layer: 'server',
      tags: ['Autonomous Vehicles', 'DRIVE Sim', 'Sensor Fusion', 'A100', 'Storage-Heavy', 'Self-Driving'],
      nodes,
      edges,
    });
  }

  // 19. Drug Discovery / Molecular Simulation
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const spine = makeNode('switch-qm9700', 400, 0, 'drug-spine');
    if (spine) nodes.push(spine);
    // 4 Grace Hopper nodes for molecular dynamics
    for (let i = 0; i < 4; i++) {
      const grace = makeNode('cpu-grace', 50 + i * 240, 200, `drug-grace-${i}`);
      const gpu = makeNode('gpu-h100-sxm', 50 + i * 240, 380, `drug-h100-${i}`);
      const nic = makeNode('nic-cx7-400g', 150 + i * 240, 290, `drug-nic-${i}`);
      if (grace) nodes.push(grace);
      if (gpu) nodes.push(gpu);
      if (nic) nodes.push(nic);
      if (grace && gpu) edges.push(makeEdge(grace.id, gpu.id, 'NVLink-C2C 900 GB/s'));
      if (grace && nic) edges.push(makeEdge(grace.id, nic.id, 'PCIe Gen5'));
      if (spine && nic) edges.push(makeEdge(spine.id, nic.id, 'NDR 400G IB'));
    }

    archs.push({
      id: 'biz-drug-discovery',
      name: 'Drug Discovery / Molecular Simulation',
      description: '4-node Grace Hopper cluster for computational chemistry and molecular dynamics (GROMACS, AMBER, NAMD). NVLink-C2C eliminates PCIe bottleneck for memory-bound simulations. InfiniBand for multi-node MD runs. Also supports AI-driven drug screening with BioNeMo. Budget: ~$400-700K. Typical: pharma, biotech, research hospitals.',
      designRationale: '**Why Grace Hopper?** Molecular dynamics (MD) simulations constantly exchange data between CPU (neighbor lists, force calculations) and GPU (integration, PME). NVLink-C2C at 900 GB/s eliminates the PCIe bottleneck that limits MD performance on traditional servers. **Why InfiniBand?** Multi-node MD simulations partition the molecular system across nodes. Atoms near partition boundaries must exchange forces every timestep (~2fs). Low-latency IB keeps simulation speed high. **Why 4 nodes?** A typical drug candidate screening runs hundreds of MD simulations in parallel. 4 Grace Hopper nodes handle 4 independent simulations or one large simulation of a protein-drug complex (~1M atoms). **BioNeMo angle:** Beyond classical MD, AI-driven approaches (protein folding, generative chemistry) run on the same hardware, making this a versatile platform for the full drug discovery pipeline.',
      workloadType: 'hpc',
      layer: 'cluster',
      tags: ['Drug Discovery', 'Molecular Dynamics', 'Grace Hopper', 'BioNeMo', 'Pharma', 'HPC'],
      nodes,
      edges,
    });
  }

  // 20. Recommendation System Training (E-Commerce / Streaming)
  {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Rec sys needs lots of CPU memory + GPU
    const gpu1 = makeNode('gpu-a100-sxm', 50, 50, 'rec-gpu-0');
    const gpu2 = makeNode('gpu-a100-sxm', 270, 50, 'rec-gpu-1');
    const gpu3 = makeNode('gpu-a100-sxm', 490, 50, 'rec-gpu-2');
    const gpu4 = makeNode('gpu-a100-sxm', 710, 50, 'rec-gpu-3');
    [gpu1, gpu2, gpu3, gpu4].forEach(g => { if (g) nodes.push(g); });
    const cpu = makeNode('cpu-epyc-genoa', 350, 230, 'rec-cpu');
    if (cpu) nodes.push(cpu);
    // Massive memory for embedding tables
    const mem1 = makeNode('mem-ddr5-128gb-4800', 50, 400, 'rec-mem-0');
    const mem2 = makeNode('mem-ddr5-128gb-4800', 250, 400, 'rec-mem-1');
    const mem3 = makeNode('mem-ddr5-128gb-4800', 450, 400, 'rec-mem-2');
    const mem4 = makeNode('mem-ddr5-128gb-4800', 650, 400, 'rec-mem-3');
    [mem1, mem2, mem3, mem4].forEach(m => { if (m) nodes.push(m); });
    // Fast storage for feature store
    const ssd = makeNode('nvme-gen5-4tb', 350, 550, 'rec-ssd');
    if (ssd) nodes.push(ssd);
    const nic = makeNode('nic-cx7-200g', 600, 230, 'rec-nic');
    if (nic) nodes.push(nic);
    // Edges
    [gpu1, gpu2, gpu3, gpu4].forEach(g => { if (g && cpu) edges.push(makeEdge(g.id, cpu.id, 'PCIe Gen4 x16')); });
    [mem1, mem2, mem3, mem4].forEach(m => { if (m && cpu) edges.push(makeEdge(cpu.id, m.id, 'DDR5 12ch')); });
    if (cpu && ssd) edges.push(makeEdge(cpu.id, ssd.id, 'NVMe Gen5 x4'));
    if (cpu && nic) edges.push(makeEdge(cpu.id, nic.id, 'PCIe Gen5'));

    archs.push({
      id: 'biz-recsys-training',
      name: 'Recommendation System Training (E-Commerce)',
      description: '4x A100 + EPYC Genoa with 512GB+ RAM for training deep learning recommendation models (DLRM, Wide&Deep, Two-Tower). Embedding tables require massive CPU memory. NVMe feature store for training data. Typical: e-commerce product recommendations, streaming content suggestions, ad ranking. Budget: ~$200-350K.',
      designRationale: '**Why so much CPU memory?** Recommendation models have massive embedding tables — one embedding per product, user, or feature. A large e-commerce site with 100M products and 1B users has embedding tables exceeding 100GB. These live in CPU memory and are looked up for each training sample. **Why A100?** The neural network portion (MLP layers) runs on GPU. A100\'s HBM2e handles the high-bandwidth embedding lookups that spill from CPU. **Why EPYC Genoa?** 12 memory channels and support for 1.5TB+ RAM. More channels = more memory bandwidth for random embedding lookups. **Why NVMe feature store?** Training data for RecSys includes user interaction logs (clicks, purchases, dwell time) — terabytes of tabular data. NVMe provides the ~7 GB/s read speed needed to feed the training pipeline without I/O stalls. **Business impact:** A 1% improvement in recommendation quality = millions in revenue for large e-commerce platforms.',
      workloadType: 'dl_training',
      layer: 'server',
      tags: ['RecSys', 'DLRM', 'E-Commerce', 'Streaming', 'Embeddings', 'Feature Store'],
      nodes,
      edges,
    });
  }

  return archs;
}
