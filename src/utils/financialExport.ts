/**
 * Branded financial deliverables.
 *
 * The financial reporting tab can hand money figures to an accountant in three
 * formats, and each one must read as an official Stakey's Cycles document rather
 * than a raw data dump:
 *
 *   - `financialLedgerCsvBranded` — a CSV with a title/metadata block, a KPI
 *     summary and `£#,##0.00` money cells.
 *   - `buildFinancialWorkbook` — an Excel (.xlsx) workbook with a styled header
 *     banner, a formula-driven KPI card block, a dark table header, zebra
 *     striping, currency number formats, auto-fitted columns and auto-filters.
 *   - `buildTaxSummaryPdf` — a branded PDF statement (letterhead, KPI cards,
 *     transaction table, footer with page numbers and compliance notes).
 *
 * ExcelJS and jsPDF are imported lazily inside the builders so the (large)
 * spreadsheet/PDF code only loads when someone actually exports, keeping it out
 * of the main bundle. Everything else here is pure and unit-testable.
 */
import {
  type FinancialChannel,
  type FinancialLedgerRow,
  type FinancialSummary,
  workshopPaymentLabel,
} from './financials';

export interface ExportBusiness {
  name: string;
  tagline: string;
  location: string;
  phone: string;
  email: string;
  vat: string;
  companyNo: string;
}

/** The public business identity stamped on every exported document. */
export const EXPORT_BUSINESS: ExportBusiness = {
  name: "Stakey's Cycles",
  tagline: 'Bicycle & Scooter Workshop · Repairs, Servicing & Parts',
  location: 'Salford, Greater Manchester M6 6QS',
  phone: '+44 7388 209102',
  email: 'workshop@stakeyscycles.co.uk',
  vat: 'GB 892 1049 82',
  companyNo: '—',
};

export interface FinancialExportMeta {
  business: ExportBusiness;
  /** e.g. '7 September 2026 – 7 October 2026'. */
  periodLabel: string;
  start: string;
  end: string;
  channelLabel: string;
  paymentLabel: string;
  /** Human timestamp, e.g. '6 October 2026 at 14:03'. */
  generatedAt: string;
  /** Optional PNG data URL of the brand logo (browser rasterises the SVG). */
  logoDataUrl?: string | null;
}

export interface KpiRow {
  label: string;
  value: number;
}

/** The five headline figures, in the order the tax summary presents them. */
export function taxSummaryKpis(summary: FinancialSummary): KpiRow[] {
  return [
    { label: 'Gross Income', value: summary.gross },
    { label: 'Net of VAT', value: summary.net },
    { label: 'VAT Collected', value: summary.vat },
    { label: 'Paid', value: summary.paid },
    { label: 'Outstanding', value: summary.unpaid },
  ];
}

/** `£#,##0.00` money string used across CSV cells and PDF tables. */
export function formatCurrency(n: number): string {
  return `£${(Number(n) || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Rasterises the brand logo (`/logo.svg`) to a PNG data URL so jsPDF/ExcelJS can
 * embed it. The source SVG is sized `width="100%"`, which an <img> rasterises at
 * a browser default (often 300×150) and would then stretch — so the markup is
 * fetched and given explicit square dimensions first. Returns null in a
 * non-DOM environment or on any failure; callers fall back to a vector mark.
 */
export async function loadLogoDataUrl(src = '/logo.svg', size = 256): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  let href = src;
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(src);
      if (res.ok) {
        let svg = await res.text();
        svg = svg.replace(/\swidth="[^"]*"/, ` width="${size}"`).replace(/\sheight="[^"]*"/, ` height="${size}"`);
        href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      }
    }
  } catch {
    href = src;
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Never let a stalled image load block an export indefinitely.
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return finish(null);
          ctx.drawImage(img, 0, 0, size, size);
          finish(canvas.toDataURL('image/png'));
        } catch {
          finish(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      img.src = href;
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/** The Excel/CSV currency format code. */
export const CURRENCY_NUM_FMT = '"£"#,##0.00';

export const LEDGER_COLUMNS = [
  'Reference',
  'Date',
  'Channel',
  'Customer',
  'Detail',
  'Payment',
  'Net',
  'VAT',
  'Total',
] as const;

export const TAX_COMPLIANCE_NOTES = [
  'Prepared on a completed-sale basis: till sales marked completed, workshop jobs with a signed-off invoice, and placed online orders.',
  'Quotes, declined and unsigned work are excluded from income.',
  'VAT is taken from the stored amount where present, otherwise derived from the sale rate; Net = Gross − VAT.',
  'Paid means settled at the point of sale; outstanding is invoiced or sold on account and still to be collected.',
];

const channelName = (c: FinancialChannel): string =>
  c === 'till' ? 'Till' : c === 'workshop' ? 'Workshop' : 'Online';

const paymentName = (r: FinancialLedgerRow): string => (r.paymentState === 'paid' ? 'Paid' : 'Unpaid');

export interface LedgerExportRow {
  id: string;
  date: string;
  channel: string;
  customer: string;
  detail: string;
  payment: string;
  method: string;
  net: number;
  vat: number;
  total: number;
}

/** Flatten the ledger into plain export rows (numbers kept numeric). */
export function ledgerExportRows(rows: FinancialLedgerRow[]): LedgerExportRow[] {
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    channel: channelName(r.channel),
    customer: r.customer,
    detail: r.detail,
    payment: paymentName(r),
    method: r.method ? workshopPaymentLabel(r.method) || r.method : '',
    net: r.net,
    vat: r.vat,
    total: r.total,
  }));
}

const csvCell = (value: string | number): string => {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvLine = (cells: (string | number)[]): string => cells.map(csvCell).join(',');

/**
 * Branded ledger CSV: a title/metadata block and KPI summary above the data, so
 * a plain-text import still reads as a Stakey's Cycles statement.
 */
export function financialLedgerCsvBranded(
  rows: FinancialLedgerRow[],
  summary: FinancialSummary,
  meta: FinancialExportMeta
): string {
  const lines: string[] = [
    csvLine([`${meta.business.name} — Financial & Tax Summary Report`]),
    csvLine(['Period', meta.periodLabel]),
    csvLine(['Date range', `${meta.start} to ${meta.end}`]),
    csvLine(['Channel filter', meta.channelLabel]),
    csvLine(['Payment filter', meta.paymentLabel]),
    csvLine(['Generated', meta.generatedAt]),
    csvLine(['Business address', meta.business.location]),
    csvLine(['VAT registration', meta.business.vat]),
    '',
  ];

  taxSummaryKpis(summary).forEach((k) => lines.push(csvLine([k.label, formatCurrency(k.value)])));
  lines.push('');

  lines.push(csvLine([...LEDGER_COLUMNS]));
  ledgerExportRows(rows).forEach((r) => {
    lines.push(
      csvLine([
        r.id,
        r.date,
        r.channel,
        r.customer,
        r.detail,
        r.payment,
        formatCurrency(r.net),
        formatCurrency(r.vat),
        formatCurrency(r.total),
      ])
    );
  });

  return lines.join('\r\n');
}

/**
 * Build the branded .xlsx workbook and return its bytes.
 *
 * Layout: a two-row brand banner, a metadata line, a formula-driven KPI card
 * block, then the transaction table with a dark header, zebra striping,
 * `£#,##0.00` money formats, auto-fitted columns and auto-filters.
 */
export async function buildFinancialWorkbook(
  rows: FinancialLedgerRow[],
  summary: FinancialSummary,
  meta: FinancialExportMeta
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs');
  const WorkbookCtor = ExcelJS.default ?? ExcelJS;
  const wb = new WorkbookCtor.Workbook();
  wb.creator = meta.business.name;
  wb.created = new Date();

  const ws = wb.addWorksheet('Financial & Tax Summary', {
    views: [],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const COLS = LEDGER_COLUMNS.length; // 9 → A..I
  const lastCol = String.fromCharCode(64 + COLS); // 'I'

  const darkFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B0F14' } } as const;
  const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF05C147' } } as const;
  const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } as const;
  const thin = { style: 'thin', color: { argb: 'FFD1D5DB' } } as const;
  const boxBorder = { top: thin, left: thin, bottom: thin, right: thin } as const;

  // 1–2. Brand banner.
  ws.mergeCells(`A1:${lastCol}1`);
  const title = ws.getCell('A1');
  title.value = `${meta.business.name.toUpperCase()}`;
  title.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  title.fill = darkFill;
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  if (meta.logoDataUrl) {
    try {
      const imageId = wb.addImage({ base64: meta.logoDataUrl, extension: 'png' });
      ws.addImage(imageId, { tl: { col: 7.6, row: 0.08 }, ext: { width: 26, height: 26 } });
    } catch {
      /* branding is best-effort; the text banner still stands */
    }
  }

  ws.mergeCells(`A2:${lastCol}2`);
  const subtitle = ws.getCell('A2');
  subtitle.value = 'Financial & Tax Summary Report';
  subtitle.font = { bold: true, size: 12, color: { argb: 'FF06231A' } };
  subtitle.fill = greenFill;
  subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;

  // 3–4. Metadata.
  ws.mergeCells(`A3:${lastCol}3`);
  const meta3 = ws.getCell('A3');
  meta3.value = `Period: ${meta.periodLabel}  ·  ${meta.start} to ${meta.end}   |   Channel: ${meta.channelLabel}   |   Payment: ${meta.paymentLabel}   |   Generated: ${meta.generatedAt}`;
  meta3.font = { size: 10, color: { argb: 'FF374151' } };
  meta3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  ws.mergeCells(`A4:${lastCol}4`);
  const meta4 = ws.getCell('A4');
  meta4.value = `${meta.business.location}  ·  ${meta.business.phone}  ·  ${meta.business.email}  ·  VAT Reg: ${meta.business.vat}`;
  meta4.font = { size: 10, color: { argb: 'FF6B7280' } };
  meta4.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  ws.getRow(5).height = 6;

  // 6. KPI card block header.
  ws.mergeCells(`A6:${lastCol}6`);
  const kpiHeading = ws.getCell('A6');
  kpiHeading.value = 'Key figures';
  kpiHeading.font = { bold: true, size: 11, color: { argb: 'FF0B0F14' } };
  kpiHeading.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const kpis = taxSummaryKpis(summary);
  const headerRow = 9;
  const dataFirst = headerRow + 1;
  const dataLast = headerRow + Math.max(rows.length, 1);

  kpis.forEach((k, i) => {
    const col = String.fromCharCode(65 + i); // A..E
    const label = ws.getCell(`${col}7`);
    label.value = k.label;
    label.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    label.fill = darkFill;
    label.alignment = { horizontal: 'center', vertical: 'middle' };
    label.border = boxBorder;
  });
  ws.getRow(7).height = 18;

  const moneyRange = (col: string) => `${col}${dataFirst}:${col}${dataLast}`;
  const kpiFormulas = [
    { f: `SUBTOTAL(109,${moneyRange('I')})`, r: summary.gross },
    { f: `SUBTOTAL(109,${moneyRange('G')})`, r: summary.net },
    { f: `SUBTOTAL(109,${moneyRange('H')})`, r: summary.vat },
    { f: `SUMIF(F${dataFirst}:F${dataLast},"Paid",${moneyRange('I')})`, r: summary.paid },
    { f: `SUMIF(F${dataFirst}:F${dataLast},"Unpaid",${moneyRange('I')})`, r: summary.unpaid },
  ];
  kpiFormulas.forEach((k, i) => {
    const col = String.fromCharCode(65 + i);
    const cell = ws.getCell(`${col}8`);
    cell.value = { formula: k.f, result: k.r };
    cell.numFmt = CURRENCY_NUM_FMT;
    cell.font = { bold: true, size: 11, color: { argb: 'FF05C147' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = boxBorder;
  });
  ws.getRow(8).height = 20;

  // 9. Table header.
  const headerCells = ws.getRow(headerRow);
  LEDGER_COLUMNS.forEach((name, i) => {
    const cell = headerCells.getCell(i + 1);
    cell.value = name;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = darkFill;
    cell.alignment = { vertical: 'middle', horizontal: i >= 6 ? 'right' : 'left' };
    cell.border = boxBorder;
  });
  headerCells.height = 18;

  // 10. Data rows with zebra striping and money formats.
  const exportRows = ledgerExportRows(rows);
  exportRows.forEach((r, idx) => {
    const row = ws.getRow(dataFirst + idx);
    const values: (string | number)[] = [r.id, r.date, r.channel, r.customer, r.detail, r.payment, r.net, r.vat, r.total];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 10, color: { argb: 'FF111827' } };
      cell.border = boxBorder;
      if (i >= 6) {
        cell.numFmt = CURRENCY_NUM_FMT;
        cell.alignment = { horizontal: 'right' };
      }
      if (idx % 2 === 1) cell.fill = zebraFill;
    });
  });

  // Totals row.
  const totalsRow = ws.getRow(dataLast + 1);
  totalsRow.getCell(1).value = 'Total';
  totalsRow.getCell(1).font = { bold: true, size: 10 };
  totalsRow.getCell(7).value = { formula: `SUBTOTAL(109,${moneyRange('G')})`, result: summary.net };
  totalsRow.getCell(8).value = { formula: `SUBTOTAL(109,${moneyRange('H')})`, result: summary.vat };
  totalsRow.getCell(9).value = { formula: `SUBTOTAL(109,${moneyRange('I')})`, result: summary.gross };
  [7, 8, 9].forEach((c) => {
    const cell = totalsRow.getCell(c);
    cell.numFmt = CURRENCY_NUM_FMT;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'right' };
    cell.border = boxBorder;
  });

  // Auto-filters over the table.
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: dataLast, column: COLS } };

  // Auto-fit column widths so nothing is clipped to ###.
  const widths = LEDGER_COLUMNS.map((name, i) => {
    let max = name.length;
    exportRows.forEach((r) => {
      const v = [r.id, r.date, r.channel, r.customer, r.detail, r.payment, r.net, r.vat, r.total][i];
      const len = i >= 6 ? formatCurrency(Number(v)).length : String(v ?? '').length;
      if (len > max) max = len;
    });
    return Math.min(Math.max(max + 2, 10), 44);
  });
  ws.columns.forEach((col, i) => {
    col.width = widths[i];
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Build the branded Tax Summary PDF and return its bytes.
 *
 * Uses the browser-rasterised logo when supplied; otherwise a vector brand mark
 * is drawn so the document is branded even without a rasteriser (e.g. tests).
 */
export async function buildTaxSummaryPdf(
  rows: FinancialLedgerRow[],
  summary: FinancialSummary,
  meta: FinancialExportMeta
): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;

  const drawLetterhead = () => {
    // Black brand band with a green underline, echoing the app header.
    doc.setFillColor(11, 15, 20);
    doc.rect(0, 0, pageW, 26, 'F');
    doc.setFillColor(5, 193, 71);
    doc.rect(0, 26, pageW, 1.6, 'F');

    // Logo (rasterised) or a vector shield fallback.
    if (meta.logoDataUrl) {
      try {
        doc.addImage(meta.logoDataUrl, 'PNG', margin, 4, 18, 18);
      } catch {
        drawVectorMark(margin, 4);
      }
    } else {
      drawVectorMark(margin, 4);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(meta.business.name.toUpperCase(), margin + 22, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(190, 200, 195);
    doc.text(meta.business.tagline, margin + 22, 18.5);

    doc.setTextColor(230, 235, 232);
    doc.setFontSize(8);
    const right = pageW - margin;
    doc.text(meta.business.location, right, 9, { align: 'right' });
    doc.text(`${meta.business.phone}  ·  ${meta.business.email}`, right, 13.5, { align: 'right' });
    doc.text(`VAT Reg: ${meta.business.vat}`, right, 18, { align: 'right' });
  };

  const drawVectorMark = (x: number, y: number) => {
    doc.setFillColor(5, 193, 71);
    doc.roundedRect(x, y, 18, 18, 3, 3, 'F');
    doc.setFillColor(11, 15, 20);
    doc.roundedRect(x + 2.2, y + 2.2, 13.6, 13.6, 2, 2, 'F');
    doc.setTextColor(5, 193, 71);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('SC', x + 9, y + 11.8, { align: 'center' });
  };

  drawLetterhead();

  // Document title + metadata.
  let cursorY = 36;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Financial & Tax Summary', margin, cursorY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`Period: ${meta.periodLabel}  (${meta.start} to ${meta.end})`, margin, cursorY + 5.5);
  doc.text(`Channel: ${meta.channelLabel}   ·   Payment: ${meta.paymentLabel}   ·   Generated: ${meta.generatedAt}`, margin, cursorY + 10);
  cursorY += 16;

  // KPI card block.
  const kpis = taxSummaryKpis(summary);
  const gap = 3;
  const cardW = (pageW - margin * 2 - gap * (kpis.length - 1)) / kpis.length;
  const cardH = 17;
  kpis.forEach((k, i) => {
    const x = margin + i * (cardW + gap);
    doc.setFillColor(11, 15, 20);
    doc.roundedRect(x, cursorY, cardW, cardH, 2, 2, 'F');
    doc.setTextColor(160, 170, 165);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(k.label.toUpperCase(), x + 3, cursorY + 6);
    doc.setTextColor(5, 193, 71);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(formatCurrency(k.value), x + 3, cursorY + 13.5);
  });
  cursorY += cardH + 6;

  // Transaction table.
  const body = ledgerExportRows(rows).map((r) => [
    r.id,
    r.date,
    r.channel,
    r.customer,
    r.detail,
    r.payment,
    formatCurrency(r.net),
    formatCurrency(r.vat),
    formatCurrency(r.total),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [[...LEDGER_COLUMNS]],
    body,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.6, lineColor: [209, 213, 219], lineWidth: 0.1, textColor: [17, 24, 39] },
    headStyles: { fillColor: [11, 15, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    margin: { left: margin, right: margin, top: 30, bottom: 22 },
    didDrawPage: (data: { pageNumber: number }) => {
      // Page 1 already carries the letterhead drawn above; redraw it on overflow.
      if (data.pageNumber > 1) drawLetterhead();
    },
  });

  // Footer on every page: page numbers, timestamp, compliance + contact.
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const y = doc.internal.pageSize.getHeight() - 12;
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 4, pageW - margin, y - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Generated ${meta.generatedAt}  ·  ${meta.business.name}, ${meta.business.location}  ·  VAT ${meta.business.vat}  ·  Prepared on a completed-sale basis; quotes excluded.`,
      margin,
      y
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, y, { align: 'right' });
  }

  const out = doc.output('arraybuffer');
  return out as ArrayBuffer;
}
