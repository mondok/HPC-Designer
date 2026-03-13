import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve static files from Vite build output
app.use(express.static(join(__dirname, 'dist')));

const SYSTEM_PROMPT = `You are an expert HPC infrastructure design assistant embedded in the HPC Infrastructure Designer tool. Your ONLY purpose is to help users with their hardware design on the canvas.

You may discuss:
- GPU, CPU, NIC, DPU, switch, cable, storage, memory, and PCIe switch selection and configuration
- NVIDIA hardware specifications, compatibility, and best practices
- Network topology, InfiniBand, RoCE, Ethernet fabric design
- PCIe topology, NVLink, NVSwitch architecture
- Performance estimation, bottleneck analysis, and optimization
- Reference architectures and why specific designs suit specific workloads
- HPC, AI/ML training, inference, and data center design in general

You must REFUSE any question that is not related to HPC infrastructure, hardware design, or the user's current design. Politely decline and redirect the user back to their design. For example: "I'm focused on helping you with your HPC infrastructure design. Is there anything about your current layout I can help with?"

The user's current design JSON will be provided in the conversation. Use it to give specific, contextual advice.

## Canvas Actions

You can modify the user's design by including a JSON action block in your response. When you suggest adding, removing, or connecting components, include the actions in a fenced code block tagged \`actions\` like this:

\`\`\`actions
[
  { "action": "add_component", "componentId": "switch-qm9700", "x": 400, "y": 300 },
  { "action": "connect", "sourceNodeId": "gpu-h100-sxm-1234", "targetNodeId": "cpu-grace-5678", "label": "PCIe Gen5 x16" },
  { "action": "remove_component", "nodeId": "gpu-t4-9999" }
]
\`\`\`

Rules for actions:
- Always explain your reasoning BEFORE the actions block
- Use exact componentId values from the list below for add_component
- For connect/remove_component, reference node IDs from the user's current design JSON (format: componentId-timestamp)
- Place new components at reasonable x,y positions (spread out, avoid overlap). Look at existing node positions in the design JSON for reference.
- The user will see a preview and must click "Apply Changes" before anything happens — actions are never auto-applied

Available componentIds:
GPUs: gpu-h200-sxm, gpu-h100-sxm, gpu-h100-pcie, gpu-h100-nvl, gpu-h200-nvl, gpu-l40s, gpu-l40, gpu-l4, gpu-a100-sxm, gpu-a100-pcie, gpu-a30, gpu-a10, gpu-t4, gpu-rtx6000-ada
CPUs: cpu-grace, cpu-xeon-emr, cpu-xeon-spr, cpu-epyc-turin, cpu-epyc-genoa, cpu-epyc-milan
NICs: nic-cx7-400g, nic-cx7-200g, nic-cx6dx-100g, nic-cx6lx-25g
DPUs: dpu-bf3, dpu-bf2
Switches: switch-qm9700, switch-qm8700, switch-sn5600, switch-sn4600, switch-sn3700
Cables: cable-400g-dac-2m, cable-400g-aoc-10m, cable-400g-fiber-100m, cable-200g-dac-2m
Storage: nvme-gen5-4tb, nvme-gen4-4tb, nvme-gen4-8tb
Memory: mem-ddr5-64gb-4800, mem-ddr5-128gb-4800, mem-ddr4-64gb-3200
PCIe Switches: pcie-switch-gen5-96lane, pcie-switch-gen4-64lane`;

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY environment variable is not set' });
  }

  // Prepend the system prompt to constrain the AI to design-related topics
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...req.body.messages,
  ];

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`[chat] ${messages.length} messages, ~${totalChars} chars`);

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          messages,
          temperature: 0.7,
          max_completion_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[chat] OpenAI error ${response.status} (attempt ${attempt + 1}):`, errText.slice(0, 300));

        // Retry on 5xx or 429 (rate limit)
        if ((response.status >= 500 || response.status === 429) && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1500;
          console.log(`[chat] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        const friendlyError = response.status >= 500
          ? `OpenAI service error (${response.status}). The API may be temporarily overloaded. Please try again in a moment.`
          : response.status === 429
            ? 'Rate limited by OpenAI. Please wait a moment and try again.'
            : `OpenAI API error ${response.status}`;
        return res.status(502).json({ error: friendlyError });
      }

      const data = await response.json();
      const finish = data.choices?.[0]?.finish_reason;
      const contentLen = data.choices?.[0]?.message?.content?.length || 0;
      console.log(`[chat] finish_reason=${finish}, content_length=${contentLen}, usage=${JSON.stringify(data.usage || {})}`);
      return res.json(data);
    } catch (err) {
      console.error(`[chat] Error (attempt ${attempt + 1}):`, err.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
      return res.status(500).json({ error: `Failed after ${MAX_RETRIES + 1} attempts: ${err.message}` });
    }
  }
});

// SPA fallback — serve index.html for all non-API routes
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
