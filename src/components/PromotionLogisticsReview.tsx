import React from 'react';
import type { AdvisorAction } from '../utils/promotionAdvisor';
import { CAMPAIGN_GOALS, type LogisticsInputs, evaluatePromotionLogistics } from '../utils/promotionLogistics';

const field = 'mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white';
const gbp = (n: number) => `£${n.toFixed(2)}`;

export function PromotionLogisticsReview({action, input, result, onChange}: {
  action: AdvisorAction;
  input: LogisticsInputs;
  result: ReturnType<typeof evaluatePromotionLogistics>;
  onChange: (next: LogisticsInputs) => void;
}) {
  const number = (key: keyof LogisticsInputs, label: string, step = '1') => <label className="text-xs text-neutral-300">{label}<input className={field} aria-label={label} type="number" min="0" step={step} value={typeof input[key] === 'number' ? input[key] as number : ''} onChange={e => onChange({...input, [key]: e.target.value === '' ? undefined : Number(e.target.value), reviewed: false})}/></label>;
  return <section data-testid="promotion-logistics" className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-950/10 p-4 text-sm text-neutral-200">
    <h4 className="font-bold text-white">Staff logistics review · {CAMPAIGN_GOALS[action.objective || 'workshop']}</h4>
    <p className="text-xs">{action.audienceDescription || 'Confirm the customer’s needs and budget.'} {action.priceBasis}</p>
    <p className="text-xs text-amber-200">This publishes a quote-led brief with its audience and service or product restrictions. Each customer needs a written quote. The suggested discount stays an estimate and cannot become a general checkout code.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {number('quantity', 'Planned uptake limit')}
      {number('available', action.objective === 'stock' ? 'Confirmed available units' : 'Confirmed available slots for these dates')}
      {action.offerPriceGbp !== undefined && <>
        {number('unitCostGbp', 'Full variable cost per redemption (£, excluding recoverable VAT)', '0.01')}
        {number('vatPct', 'VAT included in selling price (%)', '0.01')}
        {number('campaignCostGbp', 'Fixed campaign spend (£, excluding recoverable VAT)', '0.01')}
        {number('minimumContributionGbp', 'Minimum contribution per redemption (£)', '0.01')}
      </>}
    </div>
    {action.offerPriceGbp === undefined ? <p className="text-xs">No priced offer: revenue, profit and break-even are unknown until an individual quote is costed. Approval covers an invitation to discuss work only.</p> : <p className="text-xs">Selling estimate: {gbp(action.offerPriceGbp)}. Enter zero explicitly where applicable. Use costs on the same VAT basis; include staff time, parts, payment fees and fulfilment.</p>}
    {result.unitContributionGbp !== undefined && <dl className="grid gap-2 text-xs sm:grid-cols-3"><div><dt>Contribution per redemption</dt><dd>{gbp(result.unitContributionGbp)}</dd></div><div><dt>Contribution at planned uptake</dt><dd>{result.campaignContributionGbp === undefined ? 'Unknown' : gbp(result.campaignContributionGbp)}</dd></div><div><dt>Break-even redemptions</dt><dd>{result.breakEvenUnits ?? 'Not achievable'}</dd></div></dl>}
    <p className="text-xs text-neutral-400">These are scenarios at your uptake limit, not demand predictions or net profit. Check actual results against a comparable prior period. Cost inputs stay in this review session.</p>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={input.reviewed} onChange={e => onChange({...input, reviewed:e.target.checked})}/>I checked customer fit, the full quote process, costs and availability for these dates. I will check remaining slots or stock before accepting each quote.</label>
    {result.blockers.length > 0 && <ul data-testid="logistics-blockers" className="list-disc space-y-1 pl-4 text-xs text-amber-200">{result.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
    <p className="text-xs"><strong>Measure:</strong> {action.successMetric || 'Record enquiries, accepted quotes and completed paid work.'}</p>
  </section>;
}
