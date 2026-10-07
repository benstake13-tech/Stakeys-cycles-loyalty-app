import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildFinancialLedger,
  summarizeLedger,
} from './src/utils/financials';
import {
  financialLedgerCsvBranded,
  buildFinancialWorkbook,
  buildTaxSummaryPdf,
  taxSummaryKpis,
  formatCurrency,
  ledgerExportRows,
  CURRENCY_NUM_FMT,
  EXPORT_BUSINESS,
  type FinancialExportMeta,
} from './src/utils/financialExport';

const range = { start: '2026-10-01', end: '2026-10-31' };

const ledger = buildFinancialLedger({
  sales: [
    {
      id: 'sale-1',
      saleNumber: 'SALE-2026-0001',
      customerName: 'Ada Rider',
      items: [{ name: 'Inner tube' }],
      createdAt: '2026-10-05T10:00:00.000Z',
      status: 'completed',
      grandTotal: 60,
      vatAmount: 10,
      paymentMethod: 'card',
    },
  ],
  bookings: [
    {
      id: 'bk-1',
      customerName: 'Grace Hopper',
      serviceTitle: 'Full Service',
      vehicleModel: 'Trek FX 2',
      status: 'completed',
      preferredDate: '2026-10-06',
      invoice: { invoiceNumber: 'INV-1', completedAt: '2026-10-06T12:00:00Z', grandTotal: 120, vatAmount: 20, paymentStatus: 'paid_card' },
    },
  ],
  orders: [
    { id: 'abcdef123456', customer_name: 'Alan Turing', items: [{ name: 'Bell', qty: 1, price: 24 }], total: 24, created_at: '2026-10-07T09:00:00.000Z' },
  ],
  ...range,
});

const summary = summarizeLedger(ledger);

const meta: FinancialExportMeta = {
  business: EXPORT_BUSINESS,
  periodLabel: '1 – 31 October 2026',
  start: '2026-10-01',
  end: '2026-10-31',
  channelLabel: 'All channels',
  paymentLabel: 'All',
  generatedAt: '6 October 2026 at 14:03',
  logoDataUrl: null,
};

describe('financial export — pure helpers', () => {
  it('formats money as £#,##0.00', () => {
    expect(formatCurrency(1234.5)).toBe('£1,234.50');
    expect(formatCurrency(0)).toBe('£0.00');
    expect(formatCurrency(20)).toBe('£20.00');
  });

  it('lists the five tax-summary KPIs in order', () => {
    expect(taxSummaryKpis(summary).map((k) => k.label)).toEqual([
      'Gross Income',
      'Net of VAT',
      'VAT Collected',
      'Paid',
      'Outstanding',
    ]);
  });

  it('flattens ledger rows into export rows with channel/payment labels', () => {
    const rows = ledgerExportRows(ledger);
    expect(rows[0]).toHaveProperty('total');
    expect(rows.map((r) => r.channel)).toContain('Workshop');
    expect(rows.every((r) => r.payment === 'Paid' || r.payment === 'Unpaid')).toBe(true);
  });
});

describe('branded CSV', () => {
  it('leads with a branded title/metadata block and KPI summary', () => {
    const csv = financialLedgerCsvBranded(ledger, summary, meta);
    expect(csv).toContain("Stakey's Cycles — Financial & Tax Summary Report");
    expect(csv).toContain('Period,1 – 31 October 2026');
    expect(csv).toContain('VAT registration,GB 892 1049 82');
    expect(csv).toContain('Gross Income,£204.00');
    expect(csv).toContain('VAT Collected,£30.00');
    // Data table header + a real row still present.
    expect(csv).toContain('Reference,Date,Channel,Customer,Detail,Payment,Net,VAT,Total');
    expect(csv).toContain('SALE-2026-0001');
    // Money cells are formatted, not raw floats.
    expect(csv).toContain('£60.00');
  });
});

describe('branded Excel workbook', () => {
  it('builds a styled workbook with banner, KPI formulas, zebra rows and auto-filter', async () => {
    const bytes = await buildFinancialWorkbook(ledger, summary, meta);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);
    const ws = wb.getWorksheet('Financial & Tax Summary')!;
    expect(ws).toBeTruthy();

    // Title banner.
    expect(String(ws.getCell('A1').value)).toContain("STAKEY'S CYCLES");
    expect(String(ws.getCell('A2').value)).toContain('Financial & Tax Summary Report');
    expect(String(ws.getCell('A3').value)).toContain('Period: 1 – 31 October 2026');

    // KPI labels + formula cells.
    expect(ws.getCell('A7').value).toBe('Gross Income');
    expect(ws.getCell('E7').value).toBe('Outstanding');
    const grossFormula = ws.getCell('A8').value as { formula?: string };
    expect(grossFormula.formula).toContain('SUBTOTAL');
    const outstandingFormula = ws.getCell('E8').value as { formula?: string };
    expect(outstandingFormula.formula).toContain('SUMIF');
    expect(ws.getCell('A8').numFmt).toBe(CURRENCY_NUM_FMT);

    // Header row is dark-filled with white bold text.
    const headerRow = ws.getRow(9);
    expect(headerRow.getCell(1).value).toBe('Reference');
    expect(headerRow.getCell(1).fill).toBeTruthy();
    expect(headerRow.getCell(1).font?.bold).toBe(true);

    // Data rows carry currency formats + zebra striping on alternate rows.
    const firstData = ws.getRow(10);
    expect(firstData.getCell(9).numFmt).toBe(CURRENCY_NUM_FMT);
    const secondData = ws.getRow(11);
    expect(secondData.getCell(1).fill).toBeTruthy();

    // Auto-filter + sensible widths.
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getColumn(5).width).toBeGreaterThan(10);
  });

  it('embeds the brand logo in the header banner when supplied', async () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const bytes = await buildFinancialWorkbook(ledger, summary, { ...meta, logoDataUrl: png });
    const raw = new TextDecoder('latin1').decode(new Uint8Array(bytes));
    expect(raw).toContain('xl/media');
  });
});

describe('branded Tax Summary PDF', () => {
  it('produces a real PDF document', async () => {
    const bytes = await buildTaxSummaryPdf(ledger, summary, meta);
    const head = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(head).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(1500);
  });

  it('embeds the brand, KPI cards, compliance footer and page numbers', async () => {
    const bytes = await buildTaxSummaryPdf(ledger, summary, meta);
    // Compress is disabled, so the text operators are readable in the raw bytes.
    const raw = new TextDecoder('latin1').decode(new Uint8Array(bytes));
    const strings = raw.match(/\((?:\\.|[^()\\])*\)/g) || [];
    const text = strings.map((s) => s.slice(1, -1)).join(' ');
    expect(text).toContain('Financial & Tax Summary');
    expect(text).toContain("STAKEY'S CYCLES");
    expect(text).toContain('GROSS INCOME');
    expect(text).toContain('OUTSTANDING');
    expect(text).toContain('Page 1 of 1');
    expect(text).toContain('VAT Reg');
    expect(text).toContain('Salford, Greater Manchester M6 6QS');
    // The transaction table carries real reference numbers.
    expect(text).toContain('SALE-2026-0001');
  });
});
