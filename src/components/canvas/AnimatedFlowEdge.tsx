import { BaseEdge, EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { useDesignStore } from '../../store/designStore';

function utilColor(util: number): string {
  if (util < 0.5) return '#76B900'; // green
  if (util < 0.8) return '#F59E0B'; // yellow
  return '#EF4444'; // red
}

export function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const simulationResults = useDesignStore((s) => s.simulationResults);
  const paused = useDesignStore((s) => s.simulationPaused);
  const edgeFlow = simulationResults?.edgeFlows.find((f) => f.edgeId === id);

  const utilization = edgeFlow?.utilization ?? 0;
  const active = edgeFlow?.active ?? true;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = active ? utilColor(utilization) : '#334155';
  const strokeWidth = active ? 2 + utilization * 2 : 1;
  const opacity = active ? 0.6 + utilization * 0.4 : 0.2;

  // Number of particles
  const numParticles = active ? Math.max(1, Math.round(2 + utilization * 6)) : 0;
  const speed = 0.3 + utilization * 1.5;

  return (
    <>
      {/* Glow under-edge for high utilization */}
      {active && utilization > 0.5 && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: color,
            strokeWidth: strokeWidth + 4,
            opacity: 0.15,
            filter: 'blur(4px)',
          }}
        />
      )}

      {/* Base edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth,
          opacity,
          strokeDasharray: active ? undefined : '5 5',
        }}
      />

      {/* SVG animated particles */}
      {active && numParticles > 0 && !paused && (
        <g>
          {Array.from({ length: numParticles }).map((_, i) => (
            <circle
              key={i}
              r={2 + utilization * 1.5}
              fill={color}
              opacity={0.8}
            >
              <animateMotion
                dur={`${Math.max(1, 4 - speed * 1.5)}s`}
                repeatCount="indefinite"
                path={edgePath}
                begin={`${(i / numParticles) * (4 - speed * 1.5)}s`}
              />
            </circle>
          ))}
        </g>
      )}

      {/* Bandwidth label at midpoint */}
      {active && edgeFlow && utilization > 0.05 && (
        <text>
          <textPath
            href={`#${id}`}
            startOffset="50%"
            textAnchor="middle"
            style={{
              fontSize: '8px',
              fill: '#94A3B8',
              fontFamily: 'monospace',
            }}
            dy={-8}
          >
            {edgeFlow.bandwidthGBps.toFixed(0)} GB/s ({Math.round(utilization * 100)}%)
          </textPath>
        </text>
      )}
    </>
  );
}
