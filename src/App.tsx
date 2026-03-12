import { useCallback, useState, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useDesignStore } from './store/designStore';
import { ComponentPalette } from './components/palette/ComponentPalette';
import { DesignCanvas } from './components/canvas/DesignCanvas';
import { ValidationPanel } from './components/panels/ValidationPanel';
import { AIChatPanel } from './components/panels/AIChatPanel';
import { DesignLayer, WorkloadType } from './types/components';
import { buildReferenceArchitectures, ReferenceArchitecture } from './data/referenceArchitectures';
import {
  ChevronRight,
  Download,
  Upload,
  Save,
  BarChart3,
  ShieldCheck,
  Layers,
  Trash2,
  Bot,
  BookOpen,
  X,
  Github,
} from 'lucide-react';

const LAYER_LABELS: Record<DesignLayer, string> = {
  multi_site: 'Multi-Site Topology',
  cluster: 'Cluster Design',
  network: 'Network Fabric',
  server: 'Server Configuration',
  pcie: 'PCIe Topology',
};

const WORKLOAD_LABELS: Record<WorkloadType, string> = {
  llm_training: 'LLM Training',
  llm_inference: 'LLM Inference',
  hpc: 'HPC',
  dl_training: 'Deep Learning Training',
  inference: 'Inference',
  rendering: 'Rendering',
  vdi: 'VDI',
  omniverse: 'Omniverse',
  analytics: 'Analytics',
};

function Breadcrumbs() {
  const breadcrumbs = useDesignStore((s) => s.breadcrumbs);
  const popBreadcrumbTo = useDesignStore((s) => s.popBreadcrumbTo);

  return (
    <div className="flex items-center gap-1 text-xs">
      {breadcrumbs.map((bc, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600" />}
          <button
            onClick={() => popBreadcrumbTo(i)}
            className={`px-2 py-0.5 rounded transition-colors ${
              i === breadcrumbs.length - 1
                ? 'text-nvidia-green font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {bc.label}
          </button>
        </div>
      ))}
    </div>
  );
}

function PropertiesPanel() {
  const selectedComponent = useDesignStore((s) => s.selectedComponent);

  if (!selectedComponent) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Properties</h2>
        <p className="text-xs text-slate-500">
          Select a component on the canvas to view its properties and configuration options.
        </p>
        <div className="mt-6 p-3 bg-nvidia-darker rounded-lg border border-slate-700">
          <h3 className="text-xs font-medium text-nvidia-green mb-2">Quick Tips</h3>
          <ul className="text-[10px] text-slate-400 space-y-1.5">
            <li>• Drag components from the left palette onto the canvas</li>
            <li>• Connect components by dragging between their ports</li>
            <li>• Invalid connections will show red warnings</li>
            <li>• Hover the ℹ️ icon on any component to learn what it does</li>
            <li>• Use the layer selector to switch between design levels</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-nvidia-green mb-1">{selectedComponent.name}</h2>
      <p className="text-[10px] text-slate-400 mb-3">{selectedComponent.vendor} • {selectedComponent.category.replace('_', ' ').toUpperCase()}</p>

      <div className="mb-4">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">About This Component</h3>
        <p className="text-xs text-slate-300 leading-relaxed">{selectedComponent.educationalNote}</p>
      </div>

      <div className="mb-4">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Specifications</h3>
        <div className="space-y-1">
          {Object.entries(selectedComponent.specifications).map(([key, val]) => (
            <div key={key} className="flex justify-between text-[10px]">
              <span className="text-slate-400">{key}</span>
              <span className="text-slate-200 font-medium">{String(val)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Use Cases</h3>
        <div className="flex flex-wrap gap-1">
          {selectedComponent.useCases.map((uc, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-nvidia-green/10 text-nvidia-green rounded">
              {uc.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {selectedComponent.documentationUrl && (
        <a
          href={selectedComponent.documentationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-nvidia-accent hover:underline mb-4"
        >
          View NVIDIA Documentation →
        </a>
      )}
    </div>
  );
}

function DesignRationalePanel({ arch, onDismiss }: { arch: ReferenceArchitecture; onDismiss: () => void }) {
  return (
    <div className="border-b border-slate-700 bg-gradient-to-b from-nvidia-green/5 to-transparent flex-shrink-0 max-h-[50%] overflow-y-auto">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold text-nvidia-green uppercase tracking-wide flex items-center gap-1.5">
            <BookOpen size={11} />
            Why This Design Works
          </h3>
          <button onClick={onDismiss} className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300">
            <X size={12} />
          </button>
        </div>
        <p className="text-[10px] font-medium text-slate-300 mb-2">{arch.name}</p>
        <div className="text-[10px] text-slate-400 leading-relaxed space-y-2 [&_strong]:text-slate-200 [&_strong]:font-semibold">
          {arch.designRationale.split('**').map((part, i) =>
            i % 2 === 1
              ? <strong key={i}>{part}</strong>
              : <span key={i}>{part}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PerformancePanel() {
  const showPerformancePanel = useDesignStore((s) => s.showPerformancePanel);
  const nodes = useDesignStore((s) => s.nodes);
  const workloadType = useDesignStore((s) => s.workloadType);

  if (!showPerformancePanel) return null;

  const gpuCount = nodes.filter((n: any) => n.data?.component?.category === 'gpu').length;
  const nicCount = nodes.filter((n: any) => n.data?.component?.category === 'nic').length;
  const cpuCount = nodes.filter((n: any) => n.data?.component?.category === 'cpu').length;

  return (
    <div className="border-t border-slate-700 bg-nvidia-dark p-3">
      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
        Performance Estimate
      </h3>
      {gpuCount === 0 ? (
        <p className="text-[10px] text-slate-500">Add GPUs to see performance estimates</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="text-[10px] text-slate-400">GPUs</div>
            <div className="text-lg font-bold text-nvidia-green">{gpuCount}</div>
          </div>
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="text-[10px] text-slate-400">CPUs</div>
            <div className="text-lg font-bold text-blue-400">{cpuCount}</div>
          </div>
          <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="text-[10px] text-slate-400">NICs</div>
            <div className="text-lg font-bold text-yellow-400">{nicCount}</div>
          </div>
          <div className="col-span-3 bg-nvidia-darker rounded p-2 border border-slate-700">
            <div className="text-[10px] text-slate-400">Workload Target</div>
            <div className="text-xs font-medium text-slate-200 mt-0.5">
              {WORKLOAD_LABELS[workloadType]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceArchitectureModal({ archs, onLoad, onClose }: { archs: ReferenceArchitecture[]; onLoad: (arch: ReferenceArchitecture) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-nvidia-dark border border-slate-700 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-bold text-nvidia-green flex items-center gap-2">
            <BookOpen size={16} />
            Reference Architectures
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {archs.map((arch) => (
            <div key={arch.id} className="bg-nvidia-darker border border-slate-700 rounded-lg p-4 hover:border-nvidia-green/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-200">{arch.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{arch.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {arch.tags.map((tag, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 bg-nvidia-green/10 text-nvidia-green rounded">{tag}</span>
                    ))}
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded">{arch.layer}</span>
                  </div>
                </div>
                <button
                  onClick={() => onLoad(arch)}
                  className="flex-shrink-0 px-3 py-1.5 bg-nvidia-green text-black text-xs font-semibold rounded hover:bg-nvidia-green/90 transition-colors"
                >
                  Load
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const currentLayer = useDesignStore((s) => s.currentLayer);
  const setCurrentLayer = useDesignStore((s) => s.setCurrentLayer);
  const workloadType = useDesignStore((s) => s.workloadType);
  const setWorkloadType = useDesignStore((s) => s.setWorkloadType);
  const configName = useDesignStore((s) => s.configName);
  const setConfigName = useDesignStore((s) => s.setConfigName);
  const togglePerformancePanel = useDesignStore((s) => s.togglePerformancePanel);
  const toggleValidationPanel = useDesignStore((s) => s.toggleValidationPanel);
  const exportToJSON = useDesignStore((s) => s.exportToJSON);
  const saveToLocalStorage = useDesignStore((s) => s.saveToLocalStorage);
  const setNodes = useDesignStore((s) => s.setNodes);
  const setEdges = useDesignStore((s) => s.setEdges);

  const [showAIChat, setShowAIChat] = useState(false);
  const [showRefArchs, setShowRefArchs] = useState(false);
  const [activeArch, setActiveArch] = useState<ReferenceArchitecture | null>(null);
  const [showRationale, setShowRationale] = useState(true);
  const referenceArchitectures = useMemo(() => buildReferenceArchitectures(), []);

  const handleLoadArch = useCallback((arch: ReferenceArchitecture) => {
    setConfigName(arch.name);
    setCurrentLayer(arch.layer as DesignLayer);
    setNodes(arch.nodes);
    setEdges(arch.edges);
    setActiveArch(arch);
    setShowRationale(true);
    setShowRefArchs(false);
  }, [setConfigName, setCurrentLayer, setNodes, setEdges]);

  const handleExport = useCallback(() => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportToJSON, configName]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const config = JSON.parse(ev.target?.result as string);
          setConfigName(config.name || 'Imported Design');
          setNodes(config.nodes || []);
          setEdges(config.edges || []);
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setConfigName, setNodes, setEdges]);

  const handleClear = useCallback(() => {
    if (confirm('Clear all components from the canvas?')) {
      setNodes([]);
      setEdges([]);
      setActiveArch(null);
    }
  }, [setNodes, setEdges]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-nvidia-darker">
        {/* Top toolbar */}
        <header className="h-12 bg-nvidia-dark border-b border-slate-700 flex items-center px-4 gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-nvidia-green rounded flex items-center justify-center">
              <Layers className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-bold text-slate-200">HPC Designer</span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <input
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            className="bg-transparent text-sm text-slate-300 border-b border-transparent hover:border-slate-600 focus:border-nvidia-green focus:outline-none px-1 py-0.5 w-40"
          />

          <div className="h-6 w-px bg-slate-700" />

          <Breadcrumbs />

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <select
              value={currentLayer}
              onChange={(e) => setCurrentLayer(e.target.value as DesignLayer)}
              className="text-[10px] bg-nvidia-darker border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-nvidia-green"
            >
              {Object.entries(LAYER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={workloadType}
              onChange={(e) => setWorkloadType(e.target.value as WorkloadType)}
              className="text-[10px] bg-nvidia-darker border border-slate-600 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-nvidia-green"
            >
              {Object.entries(WORKLOAD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowRefArchs(true)}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Reference Architectures"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${showAIChat ? 'text-nvidia-green bg-slate-700/50' : 'text-slate-400 hover:text-nvidia-green'}`}
              title="AI Design Assistant"
            >
              <Bot className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-slate-700 mx-0.5" />

            <button
              onClick={togglePerformancePanel}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Toggle Performance Panel"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={toggleValidationPanel}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Toggle Validation Panel"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => { saveToLocalStorage(); }}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Save to Local Storage"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Export JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleImport}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-nvidia-green transition-colors"
              title="Import JSON"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          <ComponentPalette />

          <div className="flex-1 flex flex-col">
            <DesignCanvas />
            <PerformancePanel />
            <ValidationPanel />
          </div>

          {!showAIChat && (
            <div className="w-72 bg-nvidia-dark border-l border-slate-700 flex flex-col overflow-hidden">
              {activeArch && showRationale && <DesignRationalePanel arch={activeArch} onDismiss={() => setShowRationale(false)} />}
              {activeArch && !showRationale && (
                <button
                  onClick={() => setShowRationale(true)}
                  className="w-full px-4 py-2 border-b border-slate-700 flex items-center gap-1.5 text-[10px] text-nvidia-green hover:bg-nvidia-green/5 transition-colors"
                >
                  <BookOpen size={11} />
                  Show Design Rationale
                </button>
              )}
              <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
              </div>
            </div>
          )}
          {showAIChat && <AIChatPanel onClose={() => setShowAIChat(false)} />}
        </div>

        {/* Footer */}
        <footer className="h-7 bg-nvidia-dark border-t border-slate-700 flex items-center justify-end px-4 flex-shrink-0">
          <a
            href="https://github.com/mondok/HPC-Designer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Github size={12} />
            Open Source on GitHub
          </a>
        </footer>

        {showRefArchs && (
          <ReferenceArchitectureModal
            archs={referenceArchitectures}
            onLoad={handleLoadArch}
            onClose={() => setShowRefArchs(false)}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
