// server.js
const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

// JanitorAI will hit this as your "custom OpenAI-compatible" endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
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

// Optional: expose model list
app.get('/v1/models', async (req, res) => {
  const r = await fetch(`${NVIDIA_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` },
  });
  res.status(r.status).json(await r.json());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
