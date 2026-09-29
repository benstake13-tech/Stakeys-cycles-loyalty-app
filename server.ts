import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  // Gemini API Route
  app.post('/api/gemini/scan-bike', async (req, res) => {
    // Implementation in next turn to save quota
    res.status(501).json({ error: 'Not implemented' });
  });

  app.listen(3000, () => console.log('Server running on port 3000'));
}

startServer();
