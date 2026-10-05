const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const metrics = [
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function defaultDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // Exclude today, which may be incomplete.
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function googleFetch(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    console.error("Google API request failed", response.status, await response.text());
    throw new Error(`Google API request failed (${response.status})`);
  }
  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    return json({
      error: "Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN as Edge Function secrets.",
    }, 503);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const defaults = defaultDateRange();
    const startDate = body.startDate ?? defaults.startDate;
    const endDate = body.endDate ?? defaults.endDate;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      return json({ error: "Provide valid startDate and endDate values in YYYY-MM-DD format." }, 400);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) {
      console.error("Google OAuth token refresh failed", tokenResponse.status, await tokenResponse.text());
      return json({ error: "Could not refresh Google authorization. Check the Google OAuth secrets and consent." }, 502);
    }
    const { access_token: accessToken } = await tokenResponse.json();
    if (typeof accessToken !== "string") return json({ error: "Google did not return an access token." }, 502);

    const accountsResult = await googleFetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      accessToken,
    );
    const accounts = Array.isArray(accountsResult.accounts) ? accountsResult.accounts : [];
    const locations: Array<{ name: string; title?: string; accountName: string }> = [];

    for (const account of accounts) {
      if (typeof account.name !== "string") continue;
      const params = new URLSearchParams({ readMask: "name,title,storeCode", pageSize: "100" });
      let pageToken: string | undefined;
      do {
        if (pageToken) params.set("pageToken", pageToken);
        const page = await googleFetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`,
          accessToken,
        );
        for (const loc of Array.isArray(page.locations) ? page.locations : []) {
          if (typeof loc.name === "string") {
            locations.push({ name: loc.name, title: loc.title, accountName: account.name });
          }
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    }

    const locationResults = [];
    const totals: Record<string, number> = Object.fromEntries(metrics.map((metric) => [metric, 0]));

    for (const location of locations) {
      const locationId = location.name.replace(/^locations\//, "");
      const result = await googleFetch(
        `https://businessprofileperformance.googleapis.com/v1/locations/${encodeURIComponent(locationId)}:fetchMultiDailyMetricsTimeSeries`,
        accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyMetrics: metrics,
            dailyRange: {
              startDate: {
                year: Number(startDate.slice(0, 4)),
                month: Number(startDate.slice(5, 7)),
                day: Number(startDate.slice(8, 10)),
              },
              endDate: {
                year: Number(endDate.slice(0, 4)),
                month: Number(endDate.slice(5, 7)),
                day: Number(endDate.slice(8, 10)),
              },
            },
          }),
        },
      );

      const locationMetrics: Record<string, Array<{ date: string; value: number }>> = {};
      for (const item of result.multiDailyMetricTimeSeries ?? []) {
        const series = item.dailyMetricTimeSeries;
        if (!series?.dailyMetric) continue;
        const metric = series.dailyMetric;
        const values = (series.timeSeries?.datedValues ?? []).map((entry: any) => {
          const date = entry.date;
          const dateString = date
            ? `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`
            : "";
          const value = Number(entry.value ?? 0);
          if (Number.isFinite(value) && metric in totals) totals[metric] += value;
          return { date: dateString, value: Number.isFinite(value) ? value : 0 };
        });
        locationMetrics[metric] = values;
      }
      locationResults.push({
        location: location.name,
        title: location.title ?? null,
        metrics: locationMetrics,
      });
    }

    return json({
      period: { startDate, endDate },
      totals,
      locations: locationResults,
      notes: [
        "Metrics are aggregated Google Business Profile interactions and impressions; they are not individual caller records or a call log.",
        "Search visibility is represented by desktop and mobile search impressions. Metric availability depends on Google's reporting for each location.",
      ],
    });
  } catch (error) {
    console.error("gbp-performance error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, 502);
  }
});