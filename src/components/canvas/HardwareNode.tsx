import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { HardwareComponent, GPUComponent, CPUComponent, NICComponent } from '../../types/components';
import { useDesignStore } from '../../store/designStore';
import { Cpu, CircuitBoard, Network, Shield, GitBranch, Cable, HardDrive, MemoryStick, Workflow, Server, MonitorDot, Maximize2 } from 'lucide-react';

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
  server: '#10B981',
  rack: '#6366F1',
};

function getCategoryIcon(category: string) {
  const size = 14;
  switch (category) {
    case 'gpu': return <Cpu size={size} />;
    case 'cpu': return <CircuitBoard size={size} />;
    case 'nic': return <Network size={size} />;
    case 'dpu': return <Shield size={size} />;
    case 'switch': return <GitBranch size={size} />;
    case 'cable': return <Cable size={size} />;
    case 'storage': return <HardDrive size={size} />;
    case 'memory': return <MemoryStick size={size} />;
    case 'pcie_switch': return <Workflow size={size} />;
    case 'server': return <Server size={size} />;
    default: return <MonitorDot size={size} />;
  }
}

function getShortSpec(comp: HardwareComponent): string {
  if (comp.category === 'gpu') {
    const g = comp as GPUComponent;
    return `${g.memoryGB}GB ${g.memoryType} | ${g.tdpWatts}W`;
  }
  if (comp.category === 'cpu') {
    const c = comp as CPUComponent;
    return `${c.cores}C/${c.threads}T | ${c.pcieLanes} PCIe lanes`;
  }
  if (comp.category === 'nic') {
    const n = comp as NICComponent;
    return `${n.totalBandwidthGbps}Gbps | ${n.protocols.includes('infiniband') ? 'IB' : 'Eth'}`;
  }
  if (comp.category === 'switch') {
    const s = comp as any;
    return `${s.ports}p × ${s.speedPerPort.replace('gbe', 'G')} | ${s.switchType === 'infiniband' ? 'IB' : 'Eth'}`;
  }
  if (comp.category === 'dpu') {
    const d = comp as any;
    return `${d.armCores} Arm | ${d.totalBandwidthGbps}Gbps`;
  }
  if (comp.category === 'storage') {
    const st = comp as any;
    return `${st.capacityTB}TB | ${st.readBandwidthGBps}GB/s read`;
  }
  if (comp.category === 'memory') {
    const m = comp as any;
    return `${m.capacityGB}GB | ${m.speedMHz}MHz`;
  }
  if (comp.category === 'cable') {
    const cb = comp as any;
    return `${cb.speed.replace('gbe', 'G')} | ${cb.lengthMeters}m ${cb.cableType.toUpperCase()}`;
  }
  if (comp.category === 'pcie_switch') {
    const ps = comp as any;
    return `${ps.totalLanes} lanes | ${ps.pcieGen.replace('gen', 'Gen')}`;
  }
  return '';
}

function HardwareNodeInner({ data, selected }: NodeProps) {
  const component = data.component as HardwareComponent;
  const drillDown = useDesignStore((s) => s.drillDown);
  const currentLayer = useDesignStore((s) => s.currentLayer);
  const color = CATEGORY_COLORS[component.category] || '#6B7280';
  const cat = component.category as string;
  const canDrillDown = cat === 'server' || (currentLayer === 'server' && cat === 'gpu');

  return (
    <div
      className={`rounded-lg border-2 shadow-lg min-w-[180px] transition-all ${
        selected ? 'shadow-xl ring-2 ring-offset-1 ring-offset-nvidia-darker' : ''
      }`}
      style={{
        borderColor: selected ? color : `${color}55`,
        backgroundColor: '#1A1A2E',
        boxShadow: selected ? `0 0 20px ${color}33` : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2"
        style={{ backgroundColor: color, borderColor: '#0F0F1A' }}
      />

      <div
        className="px-3 py-1.5 rounded-t-md flex items-center gap-2"
        style={{ backgroundColor: `${color}15` }}
      >
        <span style={{ color }}>{getCategoryIcon(component.category)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
          {component.category.replace('_', ' ')}
        </span>
        {canDrillDown && (
          <button
            onClick={() => {
              const nextLayer = component.category === 'server' ? 'pcie' : 'pcie';
              drillDown(component.id, nextLayer as any, component.name);
            }}
            className="ml-auto p-0.5 rounded hover:bg-white/10"
            title="Drill down into this component"
          >
            <Maximize2 size={10} style={{ color }} />
          </button>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="text-xs font-medium text-slate-200">{component.name}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{getShortSpec(component)}</div>
        {'nvlinkSupport' in component && (component as GPUComponent).nvlinkSupport && (
          <div className="mt-1">
            <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">
              NVLink
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2"
        style={{ backgroundColor: color, borderColor: '#0F0F1A' }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !border-2"
        style={{ backgroundColor: color, borderColor: '#0F0F1A' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !border-2"
        style={{ backgroundColor: color, borderColor: '#0F0F1A' }}
      />
    </div>
  );
}

export const HardwareNode = memo(HardwareNodeInner);
