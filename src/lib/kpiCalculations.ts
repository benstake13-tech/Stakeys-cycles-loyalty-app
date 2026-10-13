/** KPI calculations: monetary values are integer pence, never floating-point pounds.
 * This module does not infer missing source records or VAT registration.
 */
export type Sale = { id: string; status: 'completed'|'voided'|'pending'; totalPence: number; refundPence?: number; staffId?: string; completedAt: string };
export type Target = { metric: 'net_sales_pence'|'completed_transactions'; value: number };
export type Metric = { actual: number; target: number; remaining: number; percent: number; status: 'achieved'|'exceeded'|'behind' };
const finiteNonnegative = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function summariseSales(sales: readonly Sale[]) {
  const seen = new Set<string>();
  let netSalesPence = 0, completedTransactions = 0;
  for (const sale of sales) {
    if (seen.has(sale.id)) continue;
    seen.add(sale.id);
    if (sale.status !== 'completed') continue;
    if (!finiteNonnegative(sale.totalPence) || !finiteNonnegative(sale.refundPence ?? 0) || (sale.refundPence ?? 0) > sale.totalPence) {
      throw new Error('Invalid completed sale amount or refund');
    }
    netSalesPence += sale.totalPence - (sale.refundPence ?? 0);
    completedTransactions++;
  }
  if (!Number.isSafeInteger(netSalesPence)) throw new Error('Sales total exceeds safe integer range');
  return { netSalesPence, completedTransactions };
}
export function compareTarget(actual: number, target: number): Metric {
  if (!finiteNonnegative(actual) || !Number.isSafeInteger(target) || target <= 0) throw new Error('Invalid KPI target');
  const percent = actual / target * 100;
  return { actual, target, remaining: Math.max(0, target - actual), percent,
    status: actual > target ? 'exceeded' : actual === target ? 'achieved' : 'behind' };
}
