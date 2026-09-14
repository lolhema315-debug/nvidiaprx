// server.js
const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

// Maps friendly/common model names (as sent by Janitor AI) to actual
// Nvidia NIM model identifiers. Extend this as needed.
const MODELS = {
  'gpt-4': 'moonshotai/kimi-k3',
  'gpt-3.5-turbo': 'mistralai/mistral-7b-instruct-v0.2',
  'claude': 'nvidia/nemotron-4-340b-instruct',
  'llama': 'moonshotai/kimi-k3',
  'mistral': 'mistralai/mistral-nemo-12b-instruct',
};

const DEFAULT_MODEL = 'meta/llama-2-70b-chat';

// JanitorAI will hit this as your "custom OpenAI-compatible" endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    // Map the requested model name to the actual Nvidia model identifier.
    const nvidiaModel = MODELS[req.body.model] || req.body.model || DEFAULT_MODEL;
    req.body.model = nvidiaModel;

    const nvidiaRes = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use YOUR NVIDIA API key, set as an env var — never hardcode it
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    // Stream support (JanitorAI usually requests stream: true)
    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      for await (const chunk of nvidiaRes.body) {
        res.write(chunk);
      }
      res.end();
    } else {
      const data = await nvidiaRes.json();
      res.status(nvidiaRes.status).json(data);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
});

// Expose the friendly model map so Janitor AI can see available options,
// in an OpenAI-compatible /v1/models shape.
app.get('/v1/models', (req, res) => {
  const data = Object.keys(MODELS).map((id) => ({
    id,
    object: 'model',
    owned_by: 'nvidia-proxy',
    nvidia_model: MODELS[id],
  }));
  res.json({ object: 'list', data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
