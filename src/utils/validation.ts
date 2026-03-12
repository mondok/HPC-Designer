import { Node, Edge } from '@xyflow/react';
import { ValidationResult, HardwareComponent, GPUComponent, CPUComponent, NICComponent } from '../types/components';
import { getComponentById } from '../data';

export function validateConnection(
  sourceNode: Node,
  targetNode: Node,
  _edges: Edge[]
): ValidationResult | null {
  const sourceComp = sourceNode.data?.component as HardwareComponent | undefined;
  const targetComp = targetNode.data?.component as HardwareComponent | undefined;

  if (!sourceComp || !targetComp) return null;

  if (sourceComp.incompatibleWith.includes(targetComp.id) ||
      targetComp.incompatibleWith.includes(sourceComp.id)) {
    return {
      valid: false,
      severity: 'error',
      message: `${sourceComp.name} is incompatible with ${targetComp.name}`,
      explanation: `These components cannot be connected. Check PCIe generation, protocol, or form factor compatibility.`,
      suggestion: `Review the compatible components list for each device.`,
      affectedComponents: [sourceComp.id, targetComp.id],
    };
  }

  if (sourceComp.category === 'nic' && targetComp.category === 'switch') {
    return validateNicToSwitch(sourceComp as NICComponent, targetComp);
  }
  if (sourceComp.category === 'switch' && targetComp.category === 'nic') {
    return validateNicToSwitch(targetComp as NICComponent, sourceComp);
  }

  if (sourceComp.category === 'gpu' && targetComp.category === 'cpu') {
    return validateGpuToCpu(sourceComp as GPUComponent, targetComp as CPUComponent);
  }
  if (sourceComp.category === 'cpu' && targetComp.category === 'gpu') {
    return validateGpuToCpu(targetComp as GPUComponent, sourceComp as CPUComponent);
  }

  return {
    valid: true,
    severity: 'success',
    message: `Connection valid`,
    explanation: `${sourceComp.name} and ${targetComp.name} are compatible.`,
    affectedComponents: [sourceComp.id, targetComp.id],
  };
}

function validateNicToSwitch(nic: NICComponent, sw: HardwareComponent): ValidationResult {
  const switchComp = sw as any;

  if (switchComp.switchType === 'infiniband' && !nic.protocols.includes('infiniband')) {
    return {
      valid: false,
      severity: 'error',
      message: `${nic.name} does not support InfiniBand`,
      explanation: `This NIC is Ethernet-only and cannot connect to an InfiniBand switch. InfiniBand and Ethernet are different network technologies with incompatible physical and protocol layers. You cannot mix them in the same fabric.`,
      suggestion: `Use a ConnectX-7 with VPI (Virtual Protocol Interconnect) support, or switch to an Ethernet switch with RoCE for RDMA.`,
      documentationUrl: 'https://docs.nvidia.com/networking/',
      affectedComponents: [nic.id, sw.id],
    };
  }

  if (switchComp.switchType === 'ethernet' && !nic.protocols.includes('ethernet') && !nic.protocols.includes('roce')) {
    return {
      valid: false,
      severity: 'error',
      message: `${nic.name} cannot connect to Ethernet switch`,
      explanation: `Protocol mismatch between NIC and switch.`,
      suggestion: `Use an Ethernet-capable NIC like ConnectX-6 Dx or ConnectX-7.`,
      affectedComponents: [nic.id, sw.id],
    };
  }

  return {
    valid: true,
    severity: 'success',
    message: `${nic.name} ↔ ${sw.name} connection valid`,
    explanation: `Protocol and speed are compatible.`,
    affectedComponents: [nic.id, sw.id],
  };
}

function validateGpuToCpu(gpu: GPUComponent, cpu: CPUComponent): ValidationResult {
  if (!gpu.compatibleWith.includes(cpu.id) && !cpu.compatibleWith?.includes(gpu.id)) {
    return {
      valid: false,
      severity: 'error',
      message: `${gpu.name} is not certified with ${cpu.name}`,
      explanation: `This GPU/CPU combination is not in the NVIDIA certification matrix. The GPU may require a newer PCIe generation or platform than this CPU supports.`,
      suggestion: `Check the NVIDIA certification guide for compatible CPU/GPU combinations.`,
      documentationUrl: 'https://docs.nvidia.com/certification-programs/latest/nvidia-certified-configuration-guide.html',
      affectedComponents: [gpu.id, cpu.id],
    };
  }

  const gpuPcieGenNum = parseInt(gpu.pcieGen.replace('gen', ''));
  const cpuPcieGenNum = parseInt(cpu.pcieGen.replace('gen', ''));
  if (gpuPcieGenNum > cpuPcieGenNum) {
    return {
      valid: false,
      severity: 'warning',
      message: `PCIe generation mismatch: ${gpu.name} is Gen${gpuPcieGenNum}, ${cpu.name} is Gen${cpuPcieGenNum}`,
      explanation: `The GPU requires PCIe Gen${gpuPcieGenNum} but the CPU only supports Gen${cpuPcieGenNum}. The GPU will work but at reduced bandwidth — PCIe Gen${cpuPcieGenNum} provides half the bandwidth of Gen${gpuPcieGenNum} per lane. This will bottleneck GPU-to-host and GPU-to-NIC data transfers.`,
      suggestion: `Use a CPU with PCIe Gen${gpuPcieGenNum} support (e.g., ${gpuPcieGenNum >= 5 ? 'Intel Emerald Rapids or AMD Turin' : 'Intel Sapphire Rapids or AMD Genoa'}).`,
      affectedComponents: [gpu.id, cpu.id],
    };
  }

  return {
    valid: true,
    severity: 'success',
    message: `${gpu.name} ↔ ${cpu.name} connection valid`,
    explanation: `PCIe generation and certification are compatible.`,
    affectedComponents: [gpu.id, cpu.id],
  };
}

export function validateServerConfiguration(nodes: Node[], edges: Edge[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const gpuNodes = nodes.filter((n) => n.data?.component?.category === 'gpu');
  const cpuNodes = nodes.filter((n) => n.data?.component?.category === 'cpu');
  const nicNodes = nodes.filter((n) => n.data?.component?.category === 'nic');
  const memNodes = nodes.filter((n) => n.data?.component?.category === 'memory');

  if (gpuNodes.length > 0 && cpuNodes.length === 0) {
    results.push({
      valid: false,
      severity: 'error',
      message: 'GPUs require at least one CPU',
      explanation: 'Every GPU server needs at least one CPU. The CPU provides PCIe root ports that GPUs connect to, manages system memory, and runs the host OS and drivers.',
      suggestion: 'Add an NVIDIA Grace, Intel Xeon, or AMD EPYC CPU.',
      affectedComponents: gpuNodes.map((n) => n.data?.component?.id).filter(Boolean) as string[],
    });
  }

  if (cpuNodes.length > 0 && gpuNodes.length > 0) {
    const cpu = cpuNodes[0].data?.component as CPUComponent;
    const totalGpus = gpuNodes.length;
    const minCores = totalGpus * 6;
    const totalCpuCores = cpuNodes.reduce((sum, n) => sum + ((n.data?.component as CPUComponent)?.cores || 0), 0);

    if (totalCpuCores < minCores) {
      results.push({
        valid: false,
        severity: 'warning',
        message: `Insufficient CPU cores: ${totalCpuCores} cores for ${totalGpus} GPUs`,
        explanation: `NVIDIA certification requires minimum 6 physical CPU cores per GPU. You have ${totalCpuCores} cores for ${totalGpus} GPUs (need ${minCores}).`,
        suggestion: `Add more CPU sockets or use CPUs with more cores.`,
        affectedComponents: [...cpuNodes.map((n) => n.data?.component?.id), ...gpuNodes.map((n) => n.data?.component?.id)].filter(Boolean) as string[],
      });
    }

    if (cpuNodes.length === 1 && totalGpus > 2) {
      results.push({
        valid: false,
        severity: 'warning',
        message: 'Single CPU socket with multiple GPUs',
        explanation: 'NVIDIA certification recommends minimum 2 CPU sockets. GPUs should be balanced across CPU sockets and PCIe root ports for optimal performance. A single socket creates a NUMA bottleneck — all GPU traffic flows through one memory controller.',
        suggestion: 'Add a second CPU socket for balanced PCIe topology.',
        affectedComponents: cpuNodes.map((n) => n.data?.component?.id).filter(Boolean) as string[],
      });
    }
  }

  if (gpuNodes.length > 0 && memNodes.length > 0) {
    const totalGpuMemory = gpuNodes.reduce((sum, n) => sum + ((n.data?.component as GPUComponent)?.memoryGB || 0), 0);
    const totalSysMemory = memNodes.reduce((sum, n) => sum + ((n.data?.component as any)?.capacityGB || 0), 0);

    if (totalSysMemory < totalGpuMemory * 2) {
      results.push({
        valid: false,
        severity: 'warning',
        message: `Insufficient system memory: ${totalSysMemory}GB for ${totalGpuMemory}GB GPU memory`,
        explanation: `NVIDIA certification requires minimum 2x total GPU memory in system RAM. You have ${totalSysMemory}GB system memory but need at least ${totalGpuMemory * 2}GB (2x ${totalGpuMemory}GB GPU memory).`,
        suggestion: `Add more memory DIMMs to reach at least ${totalGpuMemory * 2}GB.`,
        affectedComponents: memNodes.map((n) => n.data?.component?.id).filter(Boolean) as string[],
      });
    }
  }

  if (nicNodes.length > 0) {
    const hasRoce = nicNodes.some((n) => (n.data?.component as NICComponent)?.roceSupport);
    const switchNodes = nodes.filter((n) => n.data?.component?.category === 'switch');
    const ethernetSwitches = switchNodes.filter((n) => (n.data?.component as any)?.switchType === 'ethernet');

    if (hasRoce && ethernetSwitches.length > 0) {
      const hasPfc = ethernetSwitches.every((n) => (n.data?.component as any)?.pfcSupport);
      if (!hasPfc) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'RoCE requires lossless Ethernet (PFC)',
          explanation: 'RDMA over Converged Ethernet (RoCE) requires a lossless network. This is achieved through Priority Flow Control (PFC) — a mechanism that pauses traffic on specific priority queues when switch buffers fill up. Without PFC, packet drops cause RDMA retransmissions that destroy performance. ECN (Explicit Congestion Notification) works alongside PFC to proactively signal senders to slow down before buffers overflow.',
          suggestion: 'Use NVIDIA Spectrum switches with PFC and ECN enabled.',
          documentationUrl: 'https://docs.nvidia.com/networking/',
          affectedComponents: [...nicNodes, ...ethernetSwitches].map((n) => n.data?.component?.id).filter(Boolean) as string[],
        });
      }
    }
  }

  if (results.length === 0 && nodes.length > 1) {
    results.push({
      valid: true,
      severity: 'success',
      message: 'Configuration looks good',
      explanation: 'No issues detected with the current component selection.',
      affectedComponents: [],
    });
  }

  return results;
}

export function validateClusterNetwork(nodes: Node[], edges: Edge[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const ibSwitches = nodes.filter((n) => (n.data?.component as any)?.switchType === 'infiniband');
  const ethSwitches = nodes.filter((n) => (n.data?.component as any)?.switchType === 'ethernet');

  if (ibSwitches.length > 0 && ethSwitches.length > 0) {
    const ibEdges = edges.filter((e) =>
      ibSwitches.some((s) => s.id === e.source || s.id === e.target)
    );
    const ethEdges = edges.filter((e) =>
      ethSwitches.some((s) => s.id === e.source || s.id === e.target)
    );
    const ibConnectedNodes = new Set(ibEdges.flatMap((e) => [e.source, e.target]));
    const ethConnectedNodes = new Set(ethEdges.flatMap((e) => [e.source, e.target]));

    const overlap = [...ibConnectedNodes].filter((id) => ethConnectedNodes.has(id));
    const overlapNonSwitch = overlap.filter(
      (id) => !ibSwitches.some((s) => s.id === id) && !ethSwitches.some((s) => s.id === id)
    );

    if (overlapNonSwitch.length > 0) {
      results.push({
        valid: false,
        severity: 'warning',
        message: 'Nodes connected to both InfiniBand and Ethernet fabrics',
        explanation: 'While servers can have both InfiniBand and Ethernet NICs, the compute fabric (GPU-to-GPU traffic) should use only one protocol. Mixing InfiniBand and Ethernet for the same traffic creates complexity and potential performance issues. Typically one fabric handles compute traffic and the other handles management or storage.',
        suggestion: 'Separate compute fabric (InfiniBand or RoCE) from management/storage Ethernet.',
        affectedComponents: overlapNonSwitch,
      });
    }
  }

  return results;
}
