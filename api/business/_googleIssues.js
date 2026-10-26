const APPROVAL_URL = 'https://support.google.com/business/contact/api_default';
const SERVICES = new Set(['mybusinessaccountmanagement.googleapis.com', 'mybusinessbusinessinformation.googleapis.com', 'businessprofileperformance.googleapis.com']);

/** Keep diagnostic metadata useful without returning arbitrary upstream data. */
export function describeGoogleIssue(data, status) {
  const details = data?.error?.details || [];
  const quotaMetadata = details.find(detail => detail?.metadata?.quota_limit_value != null)?.metadata || {};
  const context = details.find(detail => detail?.metadata?.service || detail?.metadata?.consumer)?.metadata || {};
  const metadata = { ...context, ...quotaMetadata };
  const raw = quotaMetadata.quota_limit_value;
  const quotaLimit = raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
  const project = String(metadata.consumer || '').match(/(?:projects\/|project_number:)(\d+)/)?.[1] || '900853061623';
  const service = SERVICES.has(metadata.service) ? metadata.service : 'mybusinessaccountmanagement.googleapis.com';
  const quotaUrl = `https://console.cloud.google.com/apis/api/${service}/quotas?project=${project}`;
  if (Number(status) === 429 || /quota exceeded|resource.exhausted/i.test(String(data?.error?.message || ''))) {
    if (quotaLimit === 0) return {
      code: 'GOOGLE_ACCESS_NOT_APPROVED', title: 'Google API access approval required', quotaLimit,
      message: `Google reports a zero-request quota for project ${project}. Apply for Basic API Access for this project. The Business Profile API is available at no charge; this is an access approval requirement.`,
      actionLabel: 'Request Basic API Access', actionUrl: APPROVAL_URL, quotaUrl,
    };
    return {
      code: 'GOOGLE_QUOTA_LIMIT', title: 'Google API quota is blocking the report', quotaLimit,
      message: quotaLimit == null
        ? `Check the Requests per minute quota for project ${project}. If it is 0, request Basic API Access; if it is above 0, review request usage and allow the limit window to reset. This error does not by itself mean a paid plan is needed.`
        : `Google reports a limit of ${quotaLimit} requests per minute for project ${project}. Its request limit has been reached. The app will retry automatically and retain any saved figures.`,
      actionLabel: 'Check Google API quota', actionUrl: quotaUrl, quotaUrl,
    };
  }
  if (details.some(detail => detail?.reason === 'SERVICE_DISABLED') || /has not been used.*or it is disabled/i.test(String(data?.error?.message || ''))) return {
    code: 'GOOGLE_API_DISABLED', title: 'Enable the Google Business APIs', quotaLimit: null,
    message: `Google account authorisation is saved, but an API is disabled for project ${project}. Enable Account Management, Business Information and Business Profile Performance in this Google Cloud project.`,
    actionLabel: 'Open Google API settings', actionUrl: quotaUrl, quotaUrl,
  };
  return null;
}
