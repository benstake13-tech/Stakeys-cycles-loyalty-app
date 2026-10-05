const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");

const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = req.headers.get("Authorization");
  const apiKey = req.headers.get("apikey");
  if (!authorization?.startsWith("Bearer ") || !apiKey) {
    return jsonResponse({ error: "Sign-in is required" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  if (
    typeof body !== "object" || body === null ||
    typeof (body as Record<string, unknown>).wheel_id !== "string" ||
    ((body as Record<string, unknown>).wheel_id as string).length < 1 ||
    ((body as Record<string, unknown>).wheel_id as string).length > 200
  ) {
    return jsonResponse({ error: "A valid wheel_id is required" }, 400);
  }

  try {
    // Validate the bearer token with Supabase Auth; never trust a user_id from the request body.
    const userResponse = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: authorization },
    });
    if (!userResponse.ok) {
      return jsonResponse({ error: "Sign-in is required" }, 401);
    }
    const user = await userResponse.json();
    if (typeof user?.id !== "string") {
      return jsonResponse({ error: "Sign-in is required" }, 401);
    }

    // The database RPC chooses the weighted segment and inserts the spin using auth.uid().
    const spinResponse = await fetch(`${baseUrl}/rest/v1/rpc/spin_prize_wheel`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_wheel_id: (body as Record<string, string>).wheel_id,
      }),
    });

    if (!spinResponse.ok) {
      const detail = await spinResponse.text();
      console.error("spin_prize_wheel RPC failed", spinResponse.status, detail);
      return jsonResponse({ error: "Unable to complete this spin" }, 400);
    }

    const result = await spinResponse.text();
    return new Response(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("spin-wheel request failed", error);
    return jsonResponse({ error: "Unable to complete this spin" }, 500);
  }
});