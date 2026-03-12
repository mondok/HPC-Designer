import { HardwareComponent, ComponentCategory } from '../types/components';
import { gpuDatabase } from './gpus';
import { cpuDatabase } from './cpus';
import { nicDatabase, dpuDatabase, switchDatabase, cableDatabase } from './networking';
import { storageDatabase, memoryDatabase, pcieSwitchDatabase } from './storage';

export const allComponents: HardwareComponent[] = [
  ...gpuDatabase,
  ...cpuDatabase,
  ...nicDatabase,
  ...dpuDatabase,
  ...switchDatabase,
  ...cableDatabase,
  ...storageDatabase,
  ...memoryDatabase,
  ...pcieSwitchDatabase,
];

export function getComponentById(id: string): HardwareComponent | undefined {
  return allComponents.find((c) => c.id === id);
}

export function getComponentsByCategory(category: ComponentCategory): HardwareComponent[] {
  return allComponents.filter((c) => c.category === category);
}

export function searchComponents(query: string): HardwareComponent[] {
  const q = query.toLowerCase();
  return allComponents.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.vendor.toLowerCase().includes(q) ||
      c.useCases.some((u) => u.includes(q))
  );
}

export const categoryLabels: Record<ComponentCategory, string> = {
  gpu: 'GPUs',
  cpu: 'CPUs',
  nic: 'Network Adapters (NICs)',
  dpu: 'DPUs (BlueField)',
  switch: 'Switches',
  cable: 'Cables & Interconnects',
  storage: 'Storage (NVMe)',
  memory: 'System Memory',
  rack: 'Racks',
  server: 'Servers',
  pcie_switch: 'PCIe Switches',
};

export const categoryIcons: Record<ComponentCategory, string> = {
  gpu: 'Cpu',
  cpu: 'CircuitBoard',
  nic: 'Network',
  dpu: 'Shield',
  switch: 'GitBranch',
  cable: 'Cable',
  storage: 'HardDrive',
  memory: 'MemoryStick',
  rack: 'Server',
  server: 'Monitor',
  pcie_switch: 'Workflow',
};

export { gpuDatabase, cpuDatabase, nicDatabase, dpuDatabase, switchDatabase, cableDatabase, storageDatabase, memoryDatabase, pcieSwitchDatabase };
