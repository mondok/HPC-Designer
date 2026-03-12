import { useState } from 'react';
import { Edge, Node } from '@xyflow/react';
import { HardwareComponent, GPUComponent, NICComponent, CPUComponent } from '../../types/components';
import { X, Zap, ArrowRightLeft, Gauge, Cable, Info } from 'lucide-react';

interface Props {
  edge: Edge;
  sourceNode: Node | undefined;
  targetNode: Node | undefined;
  onClose: () => void;
}

interface ConnectionInfo {
  protocol: string;
  transport: string;
  speed: string;
  latency: string;
  bandwidth: string;
  notes: string[];
}

function inferConnectionInfo(
  source: HardwareComponent | undefined,
  target: HardwareComponent | undefined,
  edgeLabel?: string
): ConnectionInfo {
  const info: ConnectionInfo = {
    protocol: 'Unknown',
    transport: 'Unknown',
    speed: 'Unknown',
    latency: 'Unknown',
    bandwidth: 'Unknown',
    notes: [],
  };

  if (!source || !target) return info;

  const cats = [source.category, target.category].sort().join('-');

  // GPU <-> CPU: PCIe
  if (cats.includes('cpu') && cats.includes('gpu')) {
    const gpu = (source.category === 'gpu' ? source : target) as GPUComponent;
    const cpu = (source.category === 'cpu' ? source : target) as CPUComponent;
    const gen = gpu.pcieGen;
    const genNum = gen.replace('gen', '');
    const genSpeed: Record<string, string> = { '3': '~16 GB/s x16', '4': '~32 GB/s x16', '5': '~64 GB/s x16' };
    const genLatency: Record<string, string> = { '3': '~700ns', '4': '~600ns', '5': '~500ns' };
    info.protocol = `PCIe Gen${genNum}`;
    info.transport = `PCIe x${gpu.pcieLanes} lanes`;
    info.speed = genSpeed[genNum] || `PCIe Gen${genNum}`;
    info.latency = genLatency[genNum] || '~500-700ns';
    info.bandwidth = genSpeed[genNum] || 'Varies';
    if (gpu.pcieGen !== cpu.pcieGen) {
      info.notes.push(`⚠️ PCIe generation mismatch: GPU is Gen${gpu.pcieGen.replace('gen', '')} but CPU is Gen${cpu.pcieGen.replace('gen', '')}. Link will negotiate down to the lower generation.`);
    }
    if (gpu.nvlinkSupport) {
      info.notes.push('💡 This GPU supports NVLink. For GPU-to-GPU traffic, NVLink provides much higher bandwidth than PCIe (up to 900 GB/s vs 64 GB/s).');
    }
    return info;
  }

  // GPU <-> GPU: NVLink or PCIe
  if (source.category === 'gpu' && target.category === 'gpu') {
    const g1 = source as GPUComponent;
    const g2 = target as GPUComponent;
    if (g1.nvlinkSupport && g2.nvlinkSupport) {
      info.protocol = 'NVLink';
      info.transport = 'NVLink (direct GPU-to-GPU)';
      info.speed = `${g1.nvlinkBandwidthGBps} GB/s bidirectional`;
      info.latency = '~1-2μs';
      info.bandwidth = `${g1.nvlinkBandwidthGBps} GB/s`;
      info.notes.push('NVLink provides direct GPU-to-GPU communication bypassing the PCIe bus entirely.');
      info.notes.push('Used for tensor parallelism in distributed training where GPUs must frequently exchange activations.');
    } else {
      info.protocol = 'PCIe (peer-to-peer)';
      info.transport = `PCIe Gen${g1.pcieGen.replace('gen', '')}`;
      info.speed = '~32 GB/s (Gen4) or ~64 GB/s (Gen5)';
      info.latency = '~2-5μs (higher than NVLink)';
      info.bandwidth = 'Limited by PCIe bus';
      info.notes.push('⚠️ GPU-to-GPU over PCIe is significantly slower than NVLink. Consider SXM GPUs for training workloads.');
    }
    return info;
  }

  // NIC <-> CPU or NIC <-> Switch
  if (cats.includes('nic')) {
    const nic = (source.category === 'nic' ? source : target) as NICComponent;
    const other = source.category === 'nic' ? target : source;

    if (nic.protocols.includes('infiniband')) {
      info.protocol = 'InfiniBand';
      info.transport = nic.rdmaSupport ? 'RDMA (kernel bypass)' : 'InfiniBand (standard)';
      info.speed = `${nic.totalBandwidthGbps} Gbps (${nic.ports}x ${nic.speedPerPort.replace('gbe', 'G')})`;
      info.latency = '~0.6μs (RDMA)';
      info.bandwidth = `${nic.totalBandwidthGbps} Gbps`;
      info.notes.push('InfiniBand uses credit-based flow control — inherently lossless.');
      info.notes.push('RDMA bypasses the kernel, enabling direct memory-to-memory transfers between nodes.');
    } else if (nic.roceSupport) {
      info.protocol = 'RoCEv2 (RDMA over Converged Ethernet)';
      info.transport = 'Ethernet with RDMA (kernel bypass)';
      info.speed = `${nic.totalBandwidthGbps} Gbps`;
      info.latency = '~1-2μs (with PFC enabled)';
      info.bandwidth = `${nic.totalBandwidthGbps} Gbps`;
      info.notes.push('RoCEv2 requires Priority Flow Control (PFC) on the switch for lossless operation.');
      info.notes.push('ECN (Explicit Congestion Notification) should be configured to prevent PFC storms.');
      if (other.category === 'switch') {
        const sw = other as any;
        if (!sw.pfcSupport) {
          info.notes.push('⚠️ Connected switch does NOT support PFC — RoCE will not be lossless!');
        }
      }
    } else {
      info.protocol = 'Ethernet';
      info.transport = 'Standard Ethernet (TCP/IP)';
      info.speed = `${nic.totalBandwidthGbps} Gbps`;
      info.latency = '~10-50μs (TCP)';
      info.bandwidth = `${nic.totalBandwidthGbps} Gbps`;
      info.notes.push('Standard TCP/IP without RDMA. Higher latency due to kernel network stack overhead.');
    }

    if (other.category === 'cpu') {
      const cpu = other as CPUComponent;
      info.notes.push(`NIC connects to CPU via PCIe Gen${cpu.pcieGen.replace('gen', '')} — ensure sufficient PCIe lanes are available.`);
    }
    return info;
  }

  // DPU connections
  if (cats.includes('dpu')) {
    const dpu = (source.category === 'dpu' ? source : target) as any;
    info.protocol = 'Ethernet + Hardware Offload';
    info.transport = 'DPU offloaded data plane';
    info.speed = `${dpu.totalBandwidthGbps} Gbps`;
    info.latency = '~1μs (hardware offload)';
    info.bandwidth = `${dpu.totalBandwidthGbps} Gbps`;
    info.notes.push('BlueField DPU offloads networking, security, and storage from the host CPU.');
    info.notes.push('Runs a separate Arm OS for infrastructure services (zero-trust isolation).');
    if (dpu.networkOffload) info.notes.push('Network offload: OVS, IPsec, TLS handled in hardware.');
    if (dpu.storageOffload) info.notes.push('Storage offload: NVMe-oF, virtio-blk handled in hardware.');
    return info;
  }

  // Switch <-> Switch
  if (source.category === 'switch' && target.category === 'switch') {
    const s1 = source as any;
    const s2 = target as any;
    const isIB = s1.switchType === 'infiniband' || s2.switchType === 'infiniband';
    info.protocol = isIB ? 'InfiniBand' : 'Ethernet';
    info.transport = isIB ? 'InfiniBand inter-switch link (ISL)' : 'Ethernet trunk/LAG';
    info.speed = `${Math.min(s1.totalBandwidthTbps || 99, s2.totalBandwidthTbps || 99)} Tbps fabric capacity`;
    info.latency = `${Math.max(s1.latencyNs || 0, s2.latencyNs || 0)}ns (switch-to-switch)`;
    info.bandwidth = info.speed;
    info.notes.push('Inter-switch links form the spine-leaf fabric backbone.');
    if (isIB) {
      info.notes.push('InfiniBand supports adaptive routing and in-network computing (SHARP).');
    } else {
      info.notes.push('Ethernet ISLs should use ECMP for load balancing across parallel links.');
    }
    return info;
  }

  // Memory <-> CPU
  if (cats.includes('memory') && cats.includes('cpu')) {
    const mem = (source.category === 'memory' ? source : target) as any;
    const cpu = (source.category === 'cpu' ? source : target) as CPUComponent;
    info.protocol = mem.memoryType?.toUpperCase() || 'DDR';
    info.transport = `${cpu.memoryChannels}-channel memory bus`;
    info.speed = `${mem.bandwidthGBps || '?'} GB/s per DIMM`;
    info.latency = `~${mem.memoryType?.includes('ddr5') ? '80-90ns' : '65-75ns'} CAS latency`;
    info.bandwidth = `${(mem.bandwidthGBps || 0) * cpu.memoryChannels} GB/s max (all channels)`;
    info.notes.push(`Populate all ${cpu.memoryChannels} channels for maximum bandwidth.`);
    if (mem.eccSupport) info.notes.push('ECC enabled — corrects single-bit errors, detects double-bit errors.');
    return info;
  }

  // Storage <-> CPU
  if (cats.includes('storage') && cats.includes('cpu')) {
    const stor = (source.category === 'storage' ? source : target) as any;
    info.protocol = `NVMe over PCIe Gen${stor.pcieGen?.replace('gen', '') || '4'}`;
    info.transport = `PCIe Gen${stor.pcieGen?.replace('gen', '') || '4'} x4`;
    info.speed = `Read: ${stor.readBandwidthGBps || '?'} GB/s, Write: ${stor.writeBandwidthGBps || '?'} GB/s`;
    info.latency = '~10-20μs (NVMe)';
    info.bandwidth = `${stor.readBandwidthGBps || '?'} GB/s read`;
    info.notes.push('NVMe SSDs connect directly via PCIe — no SATA/SAS controller overhead.');
    info.notes.push('For AI workloads, sequential read throughput matters most for dataset loading.');
    return info;
  }

  // PCIe Switch connections
  if (cats.includes('pcie_switch')) {
    const ps = (source.category === 'pcie_switch' ? source : target) as any;
    info.protocol = `PCIe Gen${ps.pcieGen?.replace('gen', '') || '5'}`;
    info.transport = `PCIe switch (${ps.upstreamPorts || '?'} upstream, ${ps.downstreamPorts || '?'} downstream)`;
    info.speed = `${ps.totalLanes || '?'} total PCIe lanes`;
    info.latency = '~100ns additional (switch hop)';
    info.bandwidth = `Shared across ${ps.downstreamPorts || '?'} downstream ports`;
    info.notes.push('PCIe switch adds one hop of latency but enables connecting more devices than CPU lanes allow.');
    info.notes.push('Bandwidth is shared — all downstream devices contend for the upstream link.');
    return info;
  }

  // Fallback: use edge label if available
  if (edgeLabel) {
    info.protocol = String(edgeLabel);
    info.transport = 'See label';
    info.speed = String(edgeLabel);
  }

  return info;
}

export function EdgeInfoPanel({ edge, sourceNode, targetNode, onClose }: Props) {
  const sourceComp = sourceNode?.data?.component as HardwareComponent | undefined;
  const targetComp = targetNode?.data?.component as HardwareComponent | undefined;
  const connInfo = inferConnectionInfo(sourceComp, targetComp, edge.label as string | undefined);

  return (
    <div className="absolute top-16 right-80 z-50 w-96 bg-nvidia-dark border border-slate-600 rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-2.5 bg-nvidia-darker border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-nvidia-green flex items-center gap-2">
          <ArrowRightLeft size={14} />
          Connection Details
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-700">
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Source and Target */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-slate-800 text-slate-200 rounded font-medium truncate max-w-[140px]">
            {sourceComp?.name || 'Unknown'}
          </span>
          <ArrowRightLeft size={12} className="text-nvidia-green flex-shrink-0" />
          <span className="px-2 py-1 bg-slate-800 text-slate-200 rounded font-medium truncate max-w-[140px]">
            {targetComp?.name || 'Unknown'}
          </span>
        </div>

        {/* Connection specs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Zap size={10} /> Protocol
            </div>
            <div className="text-xs font-medium text-slate-200">{connInfo.protocol}</div>
          </div>
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Cable size={10} /> Transport
            </div>
            <div className="text-xs font-medium text-slate-200">{connInfo.transport}</div>
          </div>
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Gauge size={10} /> Speed
            </div>
            <div className="text-xs font-medium text-slate-200">{connInfo.speed}</div>
          </div>
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Gauge size={10} /> Latency
            </div>
            <div className="text-xs font-medium text-slate-200">{connInfo.latency}</div>
          </div>
        </div>

        <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
          <div className="text-[10px] text-slate-400 mb-0.5">Effective Bandwidth</div>
          <div className="text-xs font-medium text-nvidia-green">{connInfo.bandwidth}</div>
        </div>

        {/* Educational notes */}
        {connInfo.notes.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Info size={10} /> Technical Notes
            </h4>
            {connInfo.notes.map((note, i) => (
              <p key={i} className="text-[11px] text-slate-300 leading-relaxed pl-2 border-l-2 border-slate-700">
                {note}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
