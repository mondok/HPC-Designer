import { useEffect, useCallback } from 'react';
import { Activity, Cpu, HardDrive, Network, MemoryStick, AlertTriangle, Clock, Zap, Play, Pause } from 'lucide-react';
import { useDesignStore } from '../../store/designStore';
import { runSimulation } from '../../utils/simulation';
import { SimulationParams, SimulationWorkloadTab } from '../../types/components';

function LogSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const displayValue = value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : String(value);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono">{displayValue}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step || 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-nvidia-green"
      />
    </div>
  );
}

function SelectSlider({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  const idx = options.indexOf(value);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={idx >= 0 ? idx : 0}
        onChange={(e) => onChange(options[Number(e.target.value)])}
        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-nvidia-green"
      />
    </div>
  );
}

function Gauge({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const barColor = value < 50 ? 'bg-green-500' : value < 80 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-lg font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full h-1 bg-slate-700 rounded-full mt-1">
        <div className={`h-1 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, icon }: { label: string; value: string | number; unit?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-nvidia-darker rounded p-2 border border-slate-700">
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-bold text-slate-200">{value}</span>
        {unit && <span className="text-[9px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

const TABS: { id: SimulationWorkloadTab; label: string }[] = [
  { id: 'training', label: 'Training' },
  { id: 'inference', label: 'Inference' },
  { id: 'storage', label: 'Storage I/O' },
];

export function SimulationPanel() {
  const nodes = useDesignStore((s) => s.nodes);
  const edges = useDesignStore((s) => s.edges);
  const params = useDesignStore((s) => s.simulationParams);
  const results = useDesignStore((s) => s.simulationResults);
  const setParams = useDesignStore((s) => s.setSimulationParams);
  const setResults = useDesignStore((s) => s.setSimulationResults);
  const paused = useDesignStore((s) => s.simulationPaused);
  const setPaused = useDesignStore((s) => s.setSimulationPaused);

  // Re-run simulation when params or graph change (unless paused)
  useEffect(() => {
    if (paused) return;
    const r = runSimulation(nodes, edges, params);
    setResults(r);
  }, [nodes, edges, params, paused, setResults]);

  const update = useCallback(
    (patch: Partial<SimulationParams>) => {
      setParams({ ...params, ...patch });
    },
    [params, setParams]
  );

  const updateTraining = useCallback(
    (patch: Partial<SimulationParams['training']>) => {
      setParams({ ...params, training: { ...params.training, ...patch } });
    },
    [params, setParams]
  );

  const updateInference = useCallback(
    (patch: Partial<SimulationParams['inference']>) => {
      setParams({ ...params, inference: { ...params.inference, ...patch } });
    },
    [params, setParams]
  );

  const updateStorageIO = useCallback(
    (patch: Partial<SimulationParams['storageIO']>) => {
      setParams({ ...params, storageIO: { ...params.storageIO, ...patch } });
    },
    [params, setParams]
  );

  const metrics = results?.aggregateMetrics;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Pause/play bar */}
      <div className="px-3 py-1 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-slate-500">
          {paused ? 'Paused' : 'Running'}
        </span>
        <button
          onClick={() => setPaused(!paused)}
          className={`p-1 rounded transition-colors flex items-center gap-1 text-[10px] ${
            paused
              ? 'bg-nvidia-green/20 text-nvidia-green hover:bg-nvidia-green/30'
              : 'hover:bg-slate-700 text-slate-400 hover:text-yellow-400'
          }`}
          title={paused ? 'Resume simulation' : 'Pause simulation'}
        >
          {paused ? <><Play size={10} /> Resume</> : <><Pause size={10} /> Pause</>}
        </button>
      </div>

      {paused && (
        <div className="px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
          <Pause size={10} className="text-yellow-400" />
          <span className="text-[10px] text-yellow-400 font-medium">Simulation paused — sliders won't update until resumed</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Workload tabs */}
        <div className="flex border-b border-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => update({ activeTab: tab.id })}
              className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                params.activeTab === tab.id
                  ? 'text-nvidia-green border-b-2 border-nvidia-green bg-nvidia-green/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sliders */}
        <div className="p-3 border-b border-slate-700">
          {params.activeTab === 'training' && (
            <>
              <LogSlider
                label="Model Size"
                value={params.training.modelSizeBillion}
                min={0.1}
                max={1000}
                step={0.1}
                unit="B params"
                onChange={(v) => updateTraining({ modelSizeBillion: v })}
              />
              <SelectSlider
                label="Batch Size"
                value={params.training.batchSize}
                options={[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]}
                onChange={(v) => updateTraining({ batchSize: v })}
              />
              <SelectSlider
                label="Tensor Parallelism"
                value={params.training.tensorParallelism}
                options={[1, 2, 4, 8]}
                onChange={(v) => updateTraining({ tensorParallelism: v })}
              />
              <SelectSlider
                label="Data Parallelism"
                value={params.training.dataParallelism}
                options={[1, 2, 4, 8, 16, 32, 64, 128, 256, 512]}
                onChange={(v) => updateTraining({ dataParallelism: v })}
              />
              <SelectSlider
                label="Pipeline Parallelism"
                value={params.training.pipelineParallelism}
                options={[1, 2, 4, 8]}
                onChange={(v) => updateTraining({ pipelineParallelism: v })}
              />
              <SelectSlider
                label="Gradient Accumulation"
                value={params.training.gradientAccumulationSteps}
                options={[1, 2, 4, 8, 16, 32, 64]}
                onChange={(v) => updateTraining({ gradientAccumulationSteps: v })}
              />
            </>
          )}

          {params.activeTab === 'inference' && (
            <>
              <LogSlider
                label="Request Rate"
                value={params.inference.requestRateQps}
                min={1}
                max={10000}
                step={1}
                unit="qps"
                onChange={(v) => updateInference({ requestRateQps: v })}
              />
              <SelectSlider
                label="Sequence Length"
                value={params.inference.sequenceLength}
                options={[128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]}
                onChange={(v) => updateInference({ sequenceLength: v })}
              />
              <div className="mb-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-slate-400">KV-Cache (auto)</span>
                  <span className="text-slate-200 font-mono">{params.inference.kvCacheSizeGB.toFixed(1)} GB</span>
                </div>
              </div>
            </>
          )}

          {params.activeTab === 'storage' && (
            <>
              <LogSlider
                label="Checkpoint Interval"
                value={params.storageIO.checkpointIntervalSteps}
                min={10}
                max={10000}
                step={10}
                unit="steps"
                onChange={(v) => updateStorageIO({ checkpointIntervalSteps: v })}
              />
              <LogSlider
                label="Dataset Size"
                value={params.storageIO.datasetSizeGB}
                min={1}
                max={100000}
                step={1}
                unit="GB"
                onChange={(v) => updateStorageIO({ datasetSizeGB: v })}
              />
              <SelectSlider
                label="Prefetch Buffers"
                value={params.storageIO.prefetchBuffers}
                options={[1, 2, 4, 8, 16]}
                onChange={(v) => updateStorageIO({ prefetchBuffers: v })}
              />
            </>
          )}
        </div>

        {/* Gauges */}
        {metrics && (
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Gauge
                label="GPU"
                value={metrics.gpuUtilPercent}
                icon={<Cpu size={10} className="text-nvidia-green" />}
                color="#76B900"
              />
              <Gauge
                label="Memory"
                value={metrics.memoryPressurePercent}
                icon={<MemoryStick size={10} className="text-cyan-400" />}
                color="#22D3EE"
              />
              <Gauge
                label="Network"
                value={metrics.networkUtilPercent}
                icon={<Network size={10} className="text-yellow-400" />}
                color="#F59E0B"
              />
              <Gauge
                label="Storage"
                value={metrics.storageIOUtilPercent}
                icon={<HardDrive size={10} className="text-teal-400" />}
                color="#14B8A6"
              />
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Throughput"
                value={metrics.throughput.toLocaleString()}
                unit={metrics.throughputUnit}
                icon={<Zap size={10} className="text-nvidia-green" />}
              />
              {metrics.timeToTrainHours != null && (
                <MetricCard
                  label="Time to Train"
                  value={metrics.timeToTrainHours > 24
                    ? `${(metrics.timeToTrainHours / 24).toFixed(1)}`
                    : `${metrics.timeToTrainHours.toFixed(1)}`}
                  unit={metrics.timeToTrainHours > 24 ? 'days' : 'hours'}
                  icon={<Clock size={10} className="text-blue-400" />}
                />
              )}
              {metrics.p50LatencyMs != null && (
                <MetricCard
                  label="P50 Latency"
                  value={metrics.p50LatencyMs.toFixed(1)}
                  unit="ms"
                  icon={<Clock size={10} className="text-blue-400" />}
                />
              )}
              {metrics.p99LatencyMs != null && (
                <MetricCard
                  label="P99 Latency"
                  value={metrics.p99LatencyMs.toFixed(1)}
                  unit="ms"
                  icon={<Clock size={10} className="text-red-400" />}
                />
              )}
            </div>

            {/* Bottleneck */}
            {metrics.bottleneck && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wide">Bottleneck: {metrics.bottleneck}</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">{metrics.bottleneckDescription}</p>
              </div>
            )}

            {/* Active data paths */}
            {results && results.bottleneckChain.length > 0 && (
              <div className="border-t border-slate-700 pt-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5">Pipeline Breakdown</p>
                <div className="space-y-1">
                  {results.bottleneckChain.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: link.utilization > 0.8 ? '#EF4444' : link.utilization > 0.5 ? '#F59E0B' : '#76B900' }}
                      />
                      <span className="text-slate-300">{link.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!metrics && (
          <div className="p-6 text-center">
            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-[10px] text-slate-500">Add components to the canvas to start the simulation</p>
          </div>
        )}
      </div>
    </div>
  );
}
