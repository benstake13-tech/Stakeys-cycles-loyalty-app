import postgres from 'npm:postgres@3.4.3';

const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
if (!databaseUrl) {
  throw new Error('SUPABASE_DB_URL is required');
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payloadText = await req.text();
    if (new TextEncoder().encode(payloadText).byteLength > 16_384) {
      return jsonResponse({ error: 'Payload too large' }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    if (
      typeof payload !== 'object' || payload === null ||
      (payload as Record<string, unknown>).type !== 'INSERT' ||
      (payload as Record<string, unknown>).schema !== 'public' ||
      (payload as Record<string, unknown>).table !== 'stamp_transactions'
    ) {
      return jsonResponse({ error: 'Unexpected webhook event' }, 400);
    }

    const record = (payload as Record<string, unknown>).record;
    if (
      typeof record !== 'object' || record === null ||
      typeof (record as Record<string, unknown>).id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        (record as Record<string, unknown>).id as string,
      )
    ) {
      return jsonResponse({ error: 'Invalid transaction record' }, 400);
    }

    const transactionId = (record as Record<string, unknown>).id as string;
    const [transaction] = await sql`
      SELECT id, user_id, amount, source, staff_id, reason, created_at
      FROM public.stamp_transactions
      WHERE id = ${transactionId}::uuid
      LIMIT 1
    `;

    if (!transaction) {
      // Do not accept caller-supplied transaction details; only process rows verified in Postgres.
      return jsonResponse({ accepted: true, logged: false }, 202);
    }

    await sql`
      INSERT INTO public.stamp_logs
        (id, user_id, amount, source, staff_id, reason, created_at)
      VALUES
        (${transaction.id}, ${transaction.user_id}, ${transaction.amount},
         ${transaction.source}, ${transaction.staff_id}, ${transaction.reason},
         ${transaction.created_at})
      ON CONFLICT (id) DO NOTHING
    `;

    console.info('stamp transaction logged', { transactionId });
    return jsonResponse({ accepted: true, logged: true }, 202);
  } catch (error) {
    console.error('stamp-log processing failed', error);
    return jsonResponse({ error: 'Processing failed' }, 500);
  }
});