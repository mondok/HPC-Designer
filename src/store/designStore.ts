import { create } from 'zustand';
import { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges, Connection, addEdge } from '@xyflow/react';
import { DesignLayer, HardwareComponent, ValidationResult, WorkloadType, SimulationParams, SimulationResults } from '../types/components';
import { DEFAULT_SIMULATION_PARAMS, runSimulation } from '../utils/simulation';

export interface DesignState {
  currentLayer: DesignLayer;
  breadcrumbs: { layer: DesignLayer; label: string; nodeId?: string }[];
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedComponent: HardwareComponent | null;
  validationResults: ValidationResult[];
  workloadType: WorkloadType;
  configName: string;
  showPerformancePanel: boolean;
  showValidationPanel: boolean;
  draggedComponent: HardwareComponent | null;
  simulationMode: boolean;
  simulationPaused: boolean;
  simulationParams: SimulationParams;
  simulationResults: SimulationResults | null;

  setCurrentLayer: (layer: DesignLayer) => void;
  pushBreadcrumb: (layer: DesignLayer, label: string, nodeId?: string) => void;
  popBreadcrumbTo: (index: number) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedComponent: (component: HardwareComponent | null) => void;
  setValidationResults: (results: ValidationResult[]) => void;
  setWorkloadType: (type: WorkloadType) => void;
  setConfigName: (name: string) => void;
  togglePerformancePanel: () => void;
  toggleValidationPanel: () => void;
  setDraggedComponent: (component: HardwareComponent | null) => void;
  drillDown: (nodeId: string, layer: DesignLayer, label: string) => void;
  setSimulationMode: (on: boolean) => void;
  setSimulationPaused: (paused: boolean) => void;
  setSimulationParams: (params: SimulationParams) => void;
  setSimulationResults: (results: SimulationResults | null) => void;
  exportToJSON: () => string;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

export const useDesignStore = create<DesignState>((set, get) => ({
  currentLayer: 'multi_site',
  breadcrumbs: [{ layer: 'multi_site', label: 'Multi-Site View' }],
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedComponent: null,
  validationResults: [],
  workloadType: 'llm_training',
  configName: 'New Design',
  showPerformancePanel: false,
  showValidationPanel: true,
  draggedComponent: null,
  simulationMode: false,
  simulationPaused: false,
  simulationParams: DEFAULT_SIMULATION_PARAMS,
  simulationResults: null,

  setCurrentLayer: (layer) => set({ currentLayer: layer }),

  pushBreadcrumb: (layer, label, nodeId) =>
    set((state) => ({
      breadcrumbs: [...state.breadcrumbs, { layer, label, nodeId }],
      currentLayer: layer,
    })),

  popBreadcrumbTo: (index) =>
    set((state) => ({
      breadcrumbs: state.breadcrumbs.slice(0, index + 1),
      currentLayer: state.breadcrumbs[index].layer,
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as Node[],
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  onConnect: (connection) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#76B900', strokeWidth: 2 },
        },
        state.edges
      ),
    })),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedComponent: (component) => set({ selectedComponent: component }),
  setValidationResults: (results) => set({ validationResults: results }),
  setWorkloadType: (type) => set({ workloadType: type }),
  setConfigName: (name) => set({ configName: name }),
  togglePerformancePanel: () => set((state) => ({ showPerformancePanel: !state.showPerformancePanel })),
  toggleValidationPanel: () => set((state) => ({ showValidationPanel: !state.showValidationPanel })),
  setDraggedComponent: (component) => set({ draggedComponent: component }),

  setSimulationMode: (on) => {
    if (on) {
      // Eagerly compute results so animation starts immediately
      const { nodes, edges, simulationParams } = get();
      const results = runSimulation(nodes, edges, simulationParams);
      set({ simulationMode: true, simulationPaused: false, simulationResults: results });
    } else {
      set({ simulationMode: false, simulationResults: null });
    }
  },
  setSimulationPaused: (paused) => set({ simulationPaused: paused }),
  setSimulationParams: (params) => set({ simulationParams: params }),
  setSimulationResults: (results) => set({ simulationResults: results }),

  drillDown: (nodeId, layer, label) => {
    const state = get();
    set({
      breadcrumbs: [...state.breadcrumbs, { layer, label, nodeId }],
      currentLayer: layer,
      selectedNodeId: null,
      nodes: [],
      edges: [],
    });
  },

  exportToJSON: () => {
    const state = get();
    const config = {
      name: state.configName,
      workloadType: state.workloadType,
      currentLayer: state.currentLayer,
      nodes: state.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: state.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
      })),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(config, null, 2);
  },

  saveToLocalStorage: () => {
    const json = get().exportToJSON();
    const name = get().configName;
    const saved = JSON.parse(localStorage.getItem('hpc_designs') || '{}');
    saved[name] = json;
    localStorage.setItem('hpc_designs', JSON.stringify(saved));
  },

  loadFromLocalStorage: () => {
    const saved = localStorage.getItem('hpc_designs');
    if (saved) {
      const designs = JSON.parse(saved);
      const keys = Object.keys(designs);
      if (keys.length > 0) {
        const config = JSON.parse(designs[keys[0]]);
        set({
          configName: config.name,
          workloadType: config.workloadType,
          nodes: config.nodes || [],
          edges: config.edges || [],
        });
      }
    }
  },
}));
