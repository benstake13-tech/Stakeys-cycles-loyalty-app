import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CustomerRepairReportView } from './src/components/CustomerRepairReportView';
import { normaliseRepairReport } from './src/utils/customerRepairReport';
afterEach(cleanup);
const report = normaliseRepairReport({ summary: 'Brake pad identification needed', findings: [{ component: 'Brake pads', source: 'possible', observation: 'Pad shape needs confirmation', replacement: { part: 'Brake pad', markings: 'Example <code>', searchQuery: 'brake pad <code> & fit', compatibilityChecks: ['Caliper model and pad shape'] } }], systems: [] }, { bike: 'Bike', notes: 'Squeals', symptoms: [], photos: [], answers: {}, safetyConcern: false });
describe('staff photo report reader', () => {
  it('provides an encoded search lead while keeping fit and price unverified', () => {
    render(<CustomerRepairReportView report={report} allowPartsSearch/>);
    expect(screen.getByRole('link', { name: 'Search replacement candidates' }).getAttribute('href')).toBe('https://www.google.com/search?q=brake%20pad%20%3Ccode%3E%20%26%20fit');
    expect(screen.getByText(/Staff must confirm fit/)).toBeTruthy();
  });
  it('does not render arbitrary URLs or broken stored report objects', () => {
    const view = render(<CustomerRepairReportView report={{ ...report, photos: [{ id: 'bad', label: 'Bad URL', dataUrl: 'javascript:alert(1)' }] }}/>);
    expect(screen.queryByRole('img')).toBeNull();
    view.rerender(<CustomerRepairReportView report={{ version: 1 } as any}/>);
    expect(screen.getByText(/could not be displayed/)).toBeTruthy();
  });
});
