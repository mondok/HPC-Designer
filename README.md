# HPC Infrastructure Designer

**[Try it live →](https://hpc-designer.onrender.com/)**

An interactive, visual design tool for building and exploring high-performance computing (HPC) and AI infrastructure. Drag-and-drop NVIDIA GPUs, CPUs, NICs, DPUs, switches, cables, storage, and memory onto a canvas, connect them, and get real-time validation, performance estimates, and AI-powered design assistance.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Features

### Drag-and-Drop Canvas
- Drag hardware components from the left palette onto a React Flow canvas
- Connect components by dragging between ports
- Pan, zoom, and organize your design freely
- Click any component or connection to see detailed info

### Component Database
Comprehensive specs for real NVIDIA and partner hardware:

| Category | Examples |
|----------|----------|
| **GPUs** | H200 SXM, H100 SXM/PCIe/NVL, L40S, L40, L4, A100, A30, A10, T4, RTX 6000 Ada |
| **CPUs** | NVIDIA Grace, Intel Xeon (Emerald/Sapphire Rapids), AMD EPYC (Turin/Genoa/Milan) |
| **NICs** | ConnectX-7 400G/200G, ConnectX-6 Dx 100G, ConnectX-6 Lx 25G |
| **DPUs** | BlueField-3, BlueField-2 |
| **Switches** | Quantum-2 QM9700/QM8700 (InfiniBand), Spectrum-4 SN5600, SN4600, SN3700 (Ethernet) |
| **Cables** | 400G DAC/AOC/Fiber, 200G DAC |
| **Storage** | NVMe Gen5/Gen4 SSDs (4TB, 8TB) |
| **Memory** | DDR5 64GB/128GB, DDR4 64GB |
| **PCIe Switches** | Gen5 96-lane, Gen4 64-lane |

### 20 Reference Architectures
Pre-built designs you can load with one click, spanning both hardware-focused and business-focused use cases:

**Hardware Reference Designs:**
1. DGX H100 (8-GPU)
2. HGX H200 (8-GPU)
3. Grace Hopper Superchip
4. 4x L40S Inference Server
5. Edge Inference (2x L4)
6. 4-Node InfiniBand Cluster
7. RoCE Ethernet Cluster (4-Node)
8. BlueField-3 Secure AI Cluster
9. Grace CPU Superchip (Dual)
10. PCIe Switch 4-GPU Topology
11. T4 Inference Fleet (4-GPU)
12. Spine-Leaf InfiniBand Fabric

**Business-Focused Designs:**
13. LLM Training Cluster (GPT/LLaMA-scale) — 64 H100s, IB fat-tree
14. Self-Hosted LLM Inference (Enterprise) — H200s for chatbots & RAG
15. RAG Pipeline Server — L40S + vector DB storage
16. Multi-Tenant AI-as-a-Service — BlueField DPUs for zero-trust isolation
17. Real-Time Video Analytics (Smart City/Retail) — Edge L4 nodes
18. Autonomous Vehicle Training Pipeline — A100s + massive NVMe
19. Drug Discovery / Molecular Simulation — Grace Hopper cluster
20. Recommendation System Training (E-Commerce) — A100s + high-memory EPYC

Each reference architecture includes a **"Why This Design Works"** rationale panel explaining component choices, tradeoffs, cost estimates, and business justification.

### Design Validation
Real-time validation checks for:
- PCIe generation compatibility between connected components
- RDMA and RoCE requirements for network configurations
- CPU core count adequacy for GPU counts
- Memory sizing relative to GPU memory
- Fabric protocol consistency across the cluster

### AI Design Assistant
An integrated chat panel powered by OpenAI that:
- Receives the full design JSON as context
- Answers questions about your architecture
- Suggests optimizations and identifies potential issues
- Renders responses in formatted Markdown

### Additional UI Features
- **Color-coded legend** — collapsible, shows category colors and icons
- **Node info panel** — click any component for specs, use cases, certifications, docs links
- **Edge info panel** — click any connection for protocol, transport, speed, latency details
- **Performance estimates** — GPU/CPU/NIC counts and workload targeting
- **Layer selector** — switch between Server, Cluster, Network, PCIe design views
- **Export/Import** — save and load designs as JSON
- **LocalStorage persistence** — auto-saves your work

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite 5 |
| **Canvas** | @xyflow/react (React Flow) 12 |
| **State** | Zustand 4 |
| **Styling** | TailwindCSS 3.4 (NVIDIA-themed dark mode) |
| **Icons** | Lucide React |
| **UI Primitives** | Radix UI |
| **Markdown** | react-markdown |
| **API Proxy** | Express 5 |
| **AI** | OpenAI API (GPT) |

---

## Getting Started

### Prerequisites
- **Node.js** 18+ (uses native `fetch`)
- **npm** 9+
- **OpenAI API Key** (optional — only needed for the AI chat feature)

### Installation

```bash
git clone <repo-url>
cd hpc_design
npm install
```

### Running in Development

**Frontend only** (no AI chat):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

**Frontend + AI backend**:
```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-...

# Start both servers
npm run dev:all
```
- Frontend: [http://localhost:5173](http://localhost:5173)
- API proxy: [http://localhost:3001](http://localhost:3001)

Or run them separately in two terminals:
```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

### Building for Production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
hpc_design/
├── index.html                  # Entry HTML
├── server.js                   # Express API proxy for OpenAI
├── package.json
├── vite.config.ts              # Vite config with API proxy
├── tailwind.config.js          # NVIDIA-themed Tailwind config
├── tsconfig.json
├── postcss.config.js
├── public/
│   └── favicon.svg             # App favicon (green layers icon)
└── src/
    ├── main.tsx                # React entry point
    ├── index.css               # Global styles + Tailwind imports
    ├── App.tsx                 # Main layout, toolbar, properties panel,
    │                           #   performance panel, ref arch modal,
    │                           #   design rationale panel
    ├── types/
    │   └── components.ts       # TypeScript interfaces for all HPC components,
    │                           #   design layers, validation, config
    ├── data/
    │   ├── index.ts            # Combined component index + utilities
    │   ├── gpus.ts             # GPU component database
    │   ├── cpus.ts             # CPU component database
    │   ├── networking.ts       # NIC, DPU, switch, cable databases
    │   ├── storage.ts          # NVMe, memory, PCIe switch databases
    │   └── referenceArchitectures.ts  # 20 pre-built architectures
    ├── store/
    │   └── designStore.ts      # Zustand store (nodes, edges, UI state,
    │                           #   save/load, export/import)
    ├── utils/
    │   ├── validation.ts       # Real-time design validation engine
    │   └── performance.ts      # Performance estimation + bottleneck detection
    └── components/
        ├── canvas/
        │   ├── DesignCanvas.tsx    # React Flow canvas with drag-drop,
        │   │                       #   node/edge click handlers
        │   └── HardwareNode.tsx    # Custom node renderer with category styling
        ├── palette/
        │   ├── ComponentPalette.tsx  # Left sidebar component browser
        │   └── ComponentCard.tsx    # Individual draggable component card
        └── panels/
            ├── AIChatPanel.tsx      # AI assistant with Markdown rendering
            ├── EdgeInfoPanel.tsx    # Connection detail popup
            ├── NodeInfoPanel.tsx    # Component detail popup
            ├── Legend.tsx           # Collapsible color-coded legend
            └── ValidationPanel.tsx  # Validation results display
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | OpenAI API key for the AI chat assistant. If not set, the chat feature will show an error but the rest of the app works normally. |

### OpenAI Model

The AI chat uses `gpt-5.4` by default. To change the model, edit `server.js`:

```js
model: 'gpt-5.4',           // Change to 'gpt-4o', 'gpt-4o-mini', etc.
max_completion_tokens: 2000, // Adjust response length
```

### Vite Proxy

In development, the Vite dev server proxies `/api` requests to the Express backend on port 3001. This is configured in `vite.config.ts` and means the frontend calls `/api/chat` without needing to know the backend port.

---

## Usage Guide

### Designing from Scratch
1. Select a **design layer** (Server, Cluster, Network, PCIe) from the top toolbar
2. Choose a **workload type** (LLM Training, Inference, HPC, etc.)
3. Drag components from the **left palette** onto the canvas
4. Connect components by dragging from one node's handle to another
5. Check the **validation panel** for compatibility issues
6. Click components or connections for detailed information

### Using Reference Architectures
1. Click the **📖 Reference Architectures** button in the toolbar
2. Browse the 20 pre-built designs — filter by tags or category
3. Click **Load** to place the architecture on the canvas
4. Read the **"Why This Design Works"** rationale in the right sidebar
5. Modify the architecture to suit your needs

### Using the AI Assistant
1. Click the **🤖 AI Assistant** button in the toolbar
2. Ask questions about your current design
3. The AI receives the full design JSON as context and can explain component choices, suggest improvements, or identify bottlenecks

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).
