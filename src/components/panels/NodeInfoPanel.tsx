import { Node } from '@xyflow/react';
import { HardwareComponent, GPUComponent, CPUComponent, NICComponent } from '../../types/components';
import { X, Cpu, CircuitBoard, Network, Shield, GitBranch, Cable, HardDrive, MemoryStick, Workflow, ExternalLink } from 'lucide-react';

interface Props {
  node: Node;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  gpu: '#76B900',
  cpu: '#3B82F6',
  nic: '#F59E0B',
  dpu: '#8B5CF6',
  switch: '#EC4899',
  cable: '#6B7280',
  storage: '#14B8A6',
  memory: '#06B6D4',
  pcie_switch: '#D97706',
};

const CATEGORY_ICONS: Record<string, any> = {
  gpu: Cpu,
  cpu: CircuitBoard,
  nic: Network,
  dpu: Shield,
  switch: GitBranch,
  cable: Cable,
  storage: HardDrive,
  memory: MemoryStick,
  pcie_switch: Workflow,
};

function getKeySpecs(comp: HardwareComponent): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  const cat = comp.category;

  if (cat === 'gpu') {
    const g = comp as GPUComponent;
    specs.push({ label: 'Memory', value: `${g.memoryGB} GB ${g.memoryType.toUpperCase()}` });
    specs.push({ label: 'TDP', value: `${g.tdpWatts}W` });
    specs.push({ label: 'PCIe', value: `Gen${g.pcieGen.replace('gen', '')} x${g.pcieLanes}` });
    specs.push({ label: 'FP16', value: `${g.fp16TFLOPS} TFLOPS` });
    if (g.nvlinkSupport) specs.push({ label: 'NVLink', value: `${g.nvlinkBandwidthGBps} GB/s` });
    if (g.formFactor) specs.push({ label: 'Form Factor', value: g.formFactor.toUpperCase() });
  } else if (cat === 'cpu') {
    const c = comp as CPUComponent;
    specs.push({ label: 'Cores', value: `${c.cores} cores` });
    specs.push({ label: 'TDP', value: `${c.tdpWatts}W` });
    specs.push({ label: 'PCIe Lanes', value: `${c.pcieLanes} (Gen${c.pcieGen.replace('gen', '')})` });
    specs.push({ label: 'Memory', value: `${c.memoryChannels}ch ${c.maxMemoryGB} GB max` });
    specs.push({ label: 'Socket', value: c.socketType });
  } else if (cat === 'nic') {
    const n = comp as NICComponent;
    specs.push({ label: 'Speed', value: `${n.totalBandwidthGbps} Gbps` });
    specs.push({ label: 'Ports', value: `${n.ports}x ${n.speedPerPort}` });
    specs.push({ label: 'RDMA', value: n.rdmaSupport ? 'Yes' : 'No' });
    specs.push({ label: 'RoCE', value: n.roceSupport ? 'Yes' : 'No' });
    specs.push({ label: 'Protocols', value: n.protocols.join(', ') });
  } else {
    const entries = Object.entries(comp.specifications).slice(0, 6);
    entries.forEach(([k, v]) => specs.push({ label: k, value: String(v) }));
  }

  return specs;
}

export function NodeInfoPanel({ node, onClose }: Props) {
  const comp = node.data?.component as HardwareComponent | undefined;
  if (!comp) return null;

  const color = CATEGORY_COLORS[comp.category] || '#6B7280';
  const Icon = CATEGORY_ICONS[comp.category] || Cpu;

  return (
    <div className="absolute top-16 right-80 z-50 w-96 bg-nvidia-dark border border-slate-600 rounded-lg shadow-2xl overflow-hidden">
      <div
        className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between"
        style={{ backgroundColor: `${color}10` }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color }}>
          <Icon size={14} />
          {comp.name}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-700">
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Category + Vendor */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${color}20`, color }}>
            {comp.category.replace('_', ' ').toUpperCase()}
          </span>
          <span className="text-slate-400">{comp.vendor}</span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 leading-relaxed">{comp.educationalNote}</p>

        {/* Key specs */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Key Specifications</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {getKeySpecs(comp).map(({ label, value }) => (
              <div key={label} className="bg-nvidia-darker rounded px-2 py-1.5 border border-slate-700">
                <div className="text-[9px] text-slate-500">{label}</div>
                <div className="text-[11px] font-medium text-slate-200">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Use cases */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Use Cases</h4>
          <div className="flex flex-wrap gap-1">
            {comp.useCases.map((uc, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 bg-nvidia-green/10 text-nvidia-green rounded">
                {uc.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        {/* Certification Status */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Certification</h4>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
            comp.certificationStatus === 'nvidia_certified'
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : comp.certificationStatus === 'nvidia_compatible'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
          }`}>
            {comp.certificationStatus.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        {/* Documentation link */}
        {comp.documentationUrl && (
          <a
            href={comp.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-nvidia-accent hover:underline"
          >
            <ExternalLink size={10} /> NVIDIA Documentation
          </a>
        )}
      </div>
    </div>
  );
}
