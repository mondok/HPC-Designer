import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDesignStore } from '../../store/designStore';
import { HardwareNode } from './HardwareNode';
import { AnimatedFlowEdge } from './AnimatedFlowEdge';
import { HardwareComponent } from '../../types/components';
import { validateServerConfiguration } from '../../utils/validation';
import { Legend } from '../panels/Legend';
import { EdgeInfoPanel } from '../panels/EdgeInfoPanel';
import { NodeInfoPanel } from '../panels/NodeInfoPanel';

const nodeTypes = { hardware: HardwareNode };
const edgeTypes = { 'animated-flow': AnimatedFlowEdge };

export function DesignCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const nodes = useDesignStore((s) => s.nodes);
  const edges = useDesignStore((s) => s.edges);
  const onNodesChange = useDesignStore((s) => s.onNodesChange);
  const onEdgesChange = useDesignStore((s) => s.onEdgesChange);
  const onConnect = useDesignStore((s) => s.onConnect);
  const addNode = useDesignStore((s) => s.addNode);
  const setSelectedNodeId = useDesignStore((s) => s.setSelectedNodeId);
  const setSelectedComponent = useDesignStore((s) => s.setSelectedComponent);
  const setValidationResults = useDesignStore((s) => s.setValidationResults);
  const currentLayer = useDesignStore((s) => s.currentLayer);
  const simulationMode = useDesignStore((s) => s.simulationMode);

  useEffect(() => {
    const results = validateServerConfiguration(nodes, edges);
    setValidationResults(results);
  }, [nodes, edges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const data = event.dataTransfer.getData('application/hpc-component');
      if (!data) return;

      const component: HardwareComponent = JSON.parse(data);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${component.id}-${Date.now()}`,
        type: 'hardware',
        position,
        data: { component, label: component.name },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      setSelectedComponent(node.data?.component as HardwareComponent);
      setSelectedNode(node);
      setSelectedEdge(null);
    },
    [setSelectedNodeId, setSelectedComponent]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge);
      setSelectedNodeId(null);
      setSelectedComponent(null);
    },
    [setSelectedNodeId, setSelectedComponent]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedComponent(null);
    setSelectedEdge(null);
    setSelectedNode(null);
  }, [setSelectedNodeId, setSelectedComponent]);

  const layerLabels: Record<string, string> = {
    multi_site: 'Drag sites, clusters, and switches here to design your multi-site topology',
    cluster: 'Drag servers, switches, and cables to build your cluster',
    network: 'Design your network fabric: switches, NICs, and cabling',
    server: 'Drag GPUs, CPUs, NICs, memory, and storage to configure your server',
    pcie: 'Assign components to PCIe slots and configure the bus topology',
  };

  // When simulation is active, swap all edges to use the animated-flow edge type
  const displayEdges = useMemo(() => {
    if (!simulationMode) return edges;
    return edges.map((e) => ({
      ...e,
      type: 'animated-flow',
      animated: false, // our custom edge handles its own animation
    }));
  }, [edges, simulationMode]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: simulationMode ? 'animated-flow' : 'smoothstep',
          animated: !simulationMode,
          style: { stroke: '#76B900', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls className="!bg-nvidia-dark !border-slate-700" />
        <MiniMap
          nodeColor={(n) => {
            const cat = (n.data?.component as any)?.category;
            const colors: Record<string, string> = {
              gpu: '#76B900', cpu: '#3B82F6', nic: '#F59E0B', dpu: '#8B5CF6',
              switch: '#EC4899', storage: '#14B8A6', memory: '#06B6D4',
            };
            return colors[cat] || '#6B7280';
          }}
          style={{ backgroundColor: '#1A1A2E' }}
          maskColor="rgba(15, 15, 26, 0.7)"
        />
      </ReactFlow>

      <Legend />

      {selectedEdge && (
        <EdgeInfoPanel
          edge={selectedEdge}
          sourceNode={nodes.find((n) => n.id === selectedEdge.source)}
          targetNode={nodes.find((n) => n.id === selectedEdge.target)}
          onClose={() => setSelectedEdge(null)}
        />
      )}

      {selectedNode && !selectedEdge && (
        <NodeInfoPanel
          node={selectedNode}
          onClose={() => { setSelectedNode(null); setSelectedNodeId(null); setSelectedComponent(null); }}
        />
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4 opacity-20">⬡</div>
            <p className="text-slate-500 text-sm max-w-md">
              {layerLabels[currentLayer]}
            </p>
            <p className="text-slate-600 text-xs mt-2">
              Drag components from the left panel onto this canvas
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
