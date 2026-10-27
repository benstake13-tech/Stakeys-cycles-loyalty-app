import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import { BikeIssuesChecklist } from './src/components/BikeIssuesChecklist';
import { BIKE_ISSUES_CATEGORIES } from './src/data/bikeIssuesCatalog';

afterEach(cleanup);
function Checklist() {
  const [ids, setIds] = useState<string[]>([]);
  return <BikeIssuesChecklist selectedIssueIds={ids} onChange={setIds} otherNotes="" onOtherNotesChange={() => {}} />;
}
describe('compact issue selection', () => {
  it('starts with category headings and keeps selections when a category closes', () => {
    const { container } = render(<Checklist />);
    const categories = Array.from(container.querySelectorAll('details'));
    expect(categories.length).toBe(BIKE_ISSUES_CATEGORIES.length);
    expect(categories.every(d => !d.open)).toBe(true);
    const first = categories[0];
    first.open = true;
    fireEvent(first, new Event('toggle'));
    fireEvent.click(screen.getByLabelText(BIKE_ISSUES_CATEGORIES[0].items[0].label, { exact: false }));
    first.open = false;
    fireEvent(first, new Event('toggle'));
    expect(screen.getByText('1 Issue Selected')).toBeTruthy();
  });
  it('reveals matching symptoms immediately when searching', () => {
    const { container } = render(<Checklist />);
    const issue = BIKE_ISSUES_CATEGORIES[0].items[0];
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: issue.label } });
    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByLabelText(issue.label, { exact: false })).toBeTruthy();
  });
});
