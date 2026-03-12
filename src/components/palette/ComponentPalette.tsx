import { useState, useMemo } from 'react';
import { ComponentCategory, HardwareComponent } from '../../types/components';
import { allComponents, categoryLabels } from '../../data';
import { useDesignStore } from '../../store/designStore';
import { ComponentCard } from './ComponentCard';
import { Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';

const CATEGORY_ORDER: ComponentCategory[] = [
  'gpu', 'cpu', 'nic', 'dpu', 'switch', 'cable', 'storage', 'memory', 'pcie_switch',
];

export function ComponentPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['gpu', 'cpu', 'nic'])
  );
  const currentLayer = useDesignStore((s) => s.currentLayer);

  const layerCategories: Record<string, ComponentCategory[]> = {
    multi_site: ['server', 'switch', 'cable'],
    cluster: ['server', 'switch', 'cable', 'nic'],
    network: ['switch', 'cable', 'nic', 'dpu'],
    server: ['gpu', 'cpu', 'nic', 'dpu', 'storage', 'memory', 'pcie_switch'],
    pcie: ['gpu', 'nic', 'dpu', 'storage', 'pcie_switch'],
  };

  const relevantCategories = layerCategories[currentLayer] || CATEGORY_ORDER;

  const filteredComponents = useMemo(() => {
    let comps = allComponents.filter((c) => relevantCategories.includes(c.category));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      comps = comps.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.vendor.toLowerCase().includes(q)
      );
    }
    return comps;
  }, [searchQuery, currentLayer]);

  const groupedComponents = useMemo(() => {
    const groups: Record<string, HardwareComponent[]> = {};
    for (const comp of filteredComponents) {
      if (!groups[comp.category]) groups[comp.category] = [];
      groups[comp.category].push(comp);
    }
    return groups;
  }, [filteredComponents]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="w-72 bg-nvidia-dark border-r border-slate-700 flex flex-col h-full">
      <div className="p-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-nvidia-green mb-2 uppercase tracking-wide">
          Components
        </h2>
        <div className="relative">
          <Search className="absolute left-2 top-2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-nvidia-darker border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nvidia-green"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {CATEGORY_ORDER.filter((cat) => groupedComponents[cat]?.length > 0).map((cat) => (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-slate-300 hover:text-nvidia-green rounded transition-colors"
            >
              <span className="flex items-center gap-2">
                {expandedCategories.has(cat) ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                {categoryLabels[cat]}
              </span>
              <span className="text-xs text-slate-500">{groupedComponents[cat].length}</span>
            </button>
            {expandedCategories.has(cat) && (
              <div className="ml-2 space-y-1">
                {groupedComponents[cat].map((comp) => (
                  <ComponentCard key={comp.id} component={comp} />
                ))}
              </div>
            )}
          </div>
        ))}
        {Object.keys(groupedComponents).length === 0 && (
          <p className="text-sm text-slate-500 text-center mt-8">
            No components match your search.
          </p>
        )}
      </div>
    </div>
  );
}
