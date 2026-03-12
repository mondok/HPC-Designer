import { useState } from 'react';
import { Cpu, CircuitBoard, Network, Shield, GitBranch, Cable, HardDrive, MemoryStick, Workflow, ChevronDown, ChevronUp } from 'lucide-react';

const LEGEND_ITEMS = [
  { label: 'GPU', color: '#76B900', icon: Cpu },
  { label: 'CPU', color: '#3B82F6', icon: CircuitBoard },
  { label: 'NIC', color: '#F59E0B', icon: Network },
  { label: 'DPU', color: '#8B5CF6', icon: Shield },
  { label: 'Switch', color: '#EC4899', icon: GitBranch },
  { label: 'Cable', color: '#6B7280', icon: Cable },
  { label: 'Storage', color: '#14B8A6', icon: HardDrive },
  { label: 'Memory', color: '#06B6D4', icon: MemoryStick },
  { label: 'PCIe Switch', color: '#D97706', icon: Workflow },
];

export function Legend() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-nvidia-dark/95 backdrop-blur border border-slate-700 rounded-lg shadow-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-700/30 rounded-lg transition-colors"
      >
        <h4 className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Component Legend</h4>
        {expanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronUp size={12} className="text-slate-500" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 grid grid-cols-3 gap-x-4 gap-y-1">
          {LEGEND_ITEMS.map(({ label, color, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <Icon size={10} style={{ color }} className="flex-shrink-0" />
              <span className="text-[10px] text-slate-300 whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
