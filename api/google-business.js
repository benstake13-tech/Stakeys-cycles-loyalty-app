/**
 * Vercel serverless function — Google Business Profile proxy.
 *
 * Mirrors server.ts `/api/google-business`. Calls the Business Profile API
 * server-to-server so `GOOGLE_BUSINESS_API_KEY` never reaches the browser. The
 * upstream JSON is passed straight through on success; a clear error is
 * returned when the key is missing or the API call fails.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_BUSINESS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  try {
    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts?alt=json&key=${apiKey}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Failed to fetch business data' });
  }
}
