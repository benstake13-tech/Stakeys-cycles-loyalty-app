// Shared by Vercel and local Express. Google credentials remain caller-owned.
export async function googleInsights(apiPath, params, authHeader) {
  const read = async (url) => {
    const response = await fetch(url, { headers: authHeader });
    return { status: response.status, data: await response.json() };
  };
  if (apiPath === 'accounts') {
    const accounts = [], locations = [];
    let pageToken = '';
    do {
      const url = new URL('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const result = await read(url.toString());
      if (result.status !== 200) return result;
      accounts.push(...(result.data.accounts || []));
      pageToken = result.data.nextPageToken || '';
    } while (pageToken);
    for (const account of accounts) {
      if (!/^accounts\/[\w-]+$/.test(account.name || '')) continue;
      let next = '';
      do {
        const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
        url.searchParams.set('readMask', 'name,title');
        url.searchParams.set('pageSize', '100');
        if (next) url.searchParams.set('pageToken', next);
        const result = await read(url.toString());
        if (result.status !== 200) return result;
        locations.push(...(result.data.locations || []));
        next = result.data.nextPageToken || '';
      } while (next);
    }
    return { status: 200, data: { accounts, locations } };
  }
  if (apiPath !== 'performance') return { status: 400, data: { error: 'Unknown google path' } };
  const location = params.location;
  if (!/^locations\/[\w-]+$/.test(location || '')) return { status: 400, data: { error: 'Select a valid Google Business location.' } };
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const names = {
    calls: 'CALL_CLICKS', websiteClicks: 'WEBSITE_CLICKS', directionRequests: 'BUSINESS_DIRECTION_REQUESTS',
    searchDesktop: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', searchMobile: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    mapsDesktop: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', mapsMobile: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    bookings: 'BUSINESS_BOOKINGS', messagingClicks: 'MESSAGING_CLICKS',
  };
  const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries`);
  Object.values(names).forEach(name => url.searchParams.append('dailyMetrics', name));
  for (const [key, date] of [['startDate', start], ['endDate', end]]) {
    url.searchParams.set(`dailyRange.${key}.year`, String(date.getUTCFullYear()));
    url.searchParams.set(`dailyRange.${key}.month`, String(date.getUTCMonth() + 1));
    url.searchParams.set(`dailyRange.${key}.day`, String(date.getUTCDate()));
  }
  const result = await read(url.toString());
  if (result.status !== 200) return result;
  const sums = {};
  for (const group of result.data.multiDailyMetricTimeSeries || []) {
    for (const series of group.dailyMetricTimeSeries || []) {
      const values = series.timeSeries?.datedValues || [];
      if (!values.length) continue;
      sums[series.dailyMetric] = (sums[series.dailyMetric] || 0) + values.reduce((total, row) => total + Number(row.value || 0), 0);
    }
  }
  const metrics = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, sums[name] ?? null]));
  const sum = (...keys) => keys.every(key => metrics[key] != null) ? keys.reduce((n, key) => n + metrics[key], 0) : null;
  metrics.searchViews = sum('searchDesktop', 'searchMobile');
  metrics.mapsViews = sum('mapsDesktop', 'mapsMobile');
  metrics.profileViews = sum('searchViews', 'mapsViews');
  return { status: 200, data: { metrics, hasData: Object.keys(sums).length > 0, period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) } } };
}
