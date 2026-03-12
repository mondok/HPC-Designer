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

The user's current design JSON will be provided in the conversation. Use it to give specific, contextual advice.`;

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
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
