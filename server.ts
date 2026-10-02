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

  // Google Business API Proxy Route
  app.get('/api/google-business', async (req, res) => {
    // API Key retrieved from server environment
    const apiKey = process.env.GOOGLE_BUSINESS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key not configured' });
    }

    try {
      // Proxy the request to the Google Business API using the API Key
      const response = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/accounts?alt=json&key=${apiKey}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Proxy Error:', error);
      res.status(500).json({ error: 'Failed to fetch business data' });
    }
  });

  app.listen(3000, () => console.log('Server running on port 3000'));
}

startServer();
