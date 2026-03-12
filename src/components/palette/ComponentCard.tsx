import { useState } from 'react';
import { HardwareComponent, GPUComponent, CPUComponent, NICComponent } from '../../types/components';
import { useDesignStore } from '../../store/designStore';
import { Info, GripVertical, Zap, MemoryStick, Cpu, Network } from 'lucide-react';

interface Props {
  component: HardwareComponent;
}

function getQuickSpecs(comp: HardwareComponent): string[] {
  const specs: string[] = [];
  if (comp.category === 'gpu') {
    const g = comp as GPUComponent;
    specs.push(`${g.memoryGB}GB ${g.memoryType}`);
    specs.push(`${g.tdpWatts}W TDP`);
    specs.push(`PCIe ${g.pcieGen.replace('gen', 'Gen')} ${g.pcieLanes}`);
    if (g.nvlinkSupport) specs.push(`NVLink ${g.nvlinkBandwidthGBps} GB/s`);
    specs.push(`FP16: ${g.fp16TFLOPS} TFLOPS`);
  } else if (comp.category === 'cpu') {
    const c = comp as CPUComponent;
    specs.push(`${c.cores} cores / ${c.threads} threads`);
    specs.push(`${c.baseClockGHz}-${c.boostClockGHz} GHz`);
    specs.push(`PCIe ${c.pcieGen.replace('gen', 'Gen')} × ${c.pcieLanes} lanes`);
    specs.push(`${c.memoryChannels}ch ${c.memoryType}`);
  } else if (comp.category === 'nic') {
    const n = comp as NICComponent;
    specs.push(`${n.totalBandwidthGbps} Gbps total`);
    specs.push(`${n.ports} × ${n.speedPerPort.replace('gbe', ' GbE')}`);
    specs.push(n.rdmaSupport ? 'RDMA ✓' : 'No RDMA');
    specs.push(n.protocols.join(', ').toUpperCase());
  } else if (comp.category === 'dpu') {
    const d = comp as any;
    specs.push(`${d.armCores} Arm cores`);
    specs.push(`${d.totalBandwidthGbps} Gbps`);
    if (d.networkOffload) specs.push('Network offload');
    if (d.storageOffload) specs.push('Storage offload');
  } else if (comp.category === 'switch') {
    const s = comp as any;
    specs.push(`${s.ports} ports × ${s.speedPerPort.replace('gbe', ' GbE')}`);
    specs.push(`${s.switchType === 'infiniband' ? 'InfiniBand' : 'Ethernet'}`);
    specs.push(`${s.latencyNs}ns latency`);
    if (s.pfcSupport) specs.push('PFC ✓ (lossless)');
  } else if (comp.category === 'storage') {
    const st = comp as any;
    specs.push(`${st.capacityTB} TB`);
    specs.push(`Read: ${st.readBandwidthGBps} GB/s`);
    specs.push(`PCIe ${st.pcieGen.replace('gen', 'Gen')}`);
  } else if (comp.category === 'memory') {
    const m = comp as any;
    specs.push(`${m.capacityGB} GB`);
    specs.push(`${m.speedMHz} MHz`);
    specs.push(`${m.bandwidthGBps} GB/s`);
    if (m.eccSupport) specs.push('ECC ✓');
  } else if (comp.category === 'cable') {
    const cb = comp as any;
    specs.push(`${cb.speed.replace('gbe', ' Gbps')}`);
    specs.push(`${cb.lengthMeters}m`);
    specs.push(cb.cableType.toUpperCase());
  } else if (comp.category === 'pcie_switch') {
    const ps = comp as any;
    specs.push(`PCIe ${ps.pcieGen.replace('gen', 'Gen')}`);
    specs.push(`${ps.upstreamPorts} up / ${ps.downstreamPorts} down`);
    specs.push(`${ps.totalLanes} lanes`);
  }
  return specs;
}

function getCertBadgeColor(status: string): string {
  if (status === 'nvidia_certified') return 'bg-nvidia-green/20 text-nvidia-green border-nvidia-green/30';
  if (status === 'nvidia_compatible') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

function getCertLabel(status: string): string {
  if (status === 'nvidia_certified') return 'NVIDIA Certified';
  if (status === 'nvidia_compatible') return 'Compatible';
  return 'Reference';
}

export function ComponentCard({ component }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const setDraggedComponent = useDesignStore((s) => s.setDraggedComponent);

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/hpc-component', JSON.stringify(component));
    event.dataTransfer.effectAllowed = 'move';
    setDraggedComponent(component);
  };

  const onDragEnd = () => {
    setDraggedComponent(null);
  };

  const specs = getQuickSpecs(component);

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="component-card bg-nvidia-darker border border-slate-700 rounded-lg p-2.5 hover:border-nvidia-green/50 group"
      >
        <div className="flex items-start gap-2">
          <GripVertical className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0 group-hover:text-nvidia-green" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-xs font-medium text-slate-200 truncate">{component.name}</h3>
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
                className="flex-shrink-0 p-0.5 rounded hover:bg-slate-700"
              >
                <Info className="w-3.5 h-3.5 text-slate-400 hover:text-nvidia-green" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{component.description}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {specs.slice(0, 3).map((spec, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                  {spec}
                </span>
              ))}
            </div>
            <div className="mt-1.5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getCertBadgeColor(component.certificationStatus)}`}>
                {getCertLabel(component.certificationStatus)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showTooltip && (
        <div
          className="absolute left-full top-0 ml-2 z-50 w-80 bg-nvidia-dark border border-slate-600 rounded-lg shadow-2xl p-4"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <h3 className="text-sm font-semibold text-nvidia-green mb-1">{component.name}</h3>
          <p className="text-xs text-slate-300 mb-3">{component.vendor}</p>

          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">What This Does</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{component.educationalNote}</p>
          </div>

          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Key Specifications</h4>
            <div className="grid grid-cols-2 gap-1">
              {specs.map((spec, i) => (
                <span key={i} className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded">
                  {spec}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Use Cases</h4>
            <div className="flex flex-wrap gap-1">
              {component.useCases.map((uc, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 bg-nvidia-green/10 text-nvidia-green rounded">
                  {uc.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className={`text-[10px] px-2 py-1 rounded border inline-block ${getCertBadgeColor(component.certificationStatus)}`}>
            {getCertLabel(component.certificationStatus)}
          </div>

          {component.documentationUrl && (
            <div className="mt-2">
              <a
                href={component.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-nvidia-accent hover:underline"
              >
                View NVIDIA Documentation →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
