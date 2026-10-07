import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';
import type { WebsiteContent } from './src/types/websiteContent';

const content: WebsiteContent = {
  ...JSON.parse(JSON.stringify(DEFAULT_WEBSITE_CONTENT)),
  heroTitle: 'Stakey’s Cycles',
  faqs: [
    { id: 'faq-1', section: 'repairs', q: 'Brake pads squealing?', a: 'Bring it in for a free check.' },
    { id: 'faq-2', section: 'general', q: 'Where are you based?', a: 'Askern, Doncaster.' },
  ],
  priceList: [
    { id: 'p-1', scope: 'bike', group: 'Servicing', item: 'Full service', desc: 'Strip and rebuild', price: '£60', note: '' },
  ],
  products: [
    { id: 'prod-1', name: 'Shimano brake pads', price: 9.99, category: 'Second hand parts', image: '', stock: 4 },
  ],
  socials: [{ id: 'soc-1', platform: 'Instagram', url: 'https://instagram.com/stakeys' }],
};

const updateWebsiteContent = vi.fn();

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => content,
  updateWebsiteContent: (patch: unknown) => updateWebsiteContent(patch),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ theme: 'dark' }),
}));

import { WebsiteContentManagerTab } from './src/components/WebsiteContentManagerTab';

beforeEach(() => {
  updateWebsiteContent.mockClear();
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('WebsiteContentManagerTab usability', () => {
  it('renders the main website sections', () => {
    render(<WebsiteContentManagerTab />);
    expect(screen.getByText('Marketing Website Manager')).toBeTruthy();
    expect(screen.getAllByText('Hero & Contact').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FAQs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Price List').length).toBeGreaterThan(0);
  });

  it('filters rows as the editor types in the search box', () => {
    render(<WebsiteContentManagerTab />);
    fireEvent.change(screen.getByLabelText('Search website content'), { target: { value: 'brake' } });
    expect(screen.getByText('Brake pads squealing?')).toBeTruthy();
    expect(screen.queryByText('Where are you based?')).toBeNull();
  });

  it('shows a no-match message when nothing matches the search', () => {
    render(<WebsiteContentManagerTab />);
    fireEvent.change(screen.getByLabelText('Search website content'), { target: { value: 'zzzzz' } });
    expect(screen.getByText(/No FAQs match/)).toBeTruthy();
  });

  it('reveals a collapsed row’s fields when its header is clicked', () => {
    render(<WebsiteContentManagerTab />);
    expect(screen.queryByLabelText('Question')).toBeNull();
    fireEvent.click(screen.getByText('Brake pads squealing?'));
    expect(screen.getByLabelText('Question')).toBeTruthy();
  });

  it('flags unsaved changes after an edit and publishes them', () => {
    render(<WebsiteContentManagerTab />);
    expect(screen.getAllByText('All changes published').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Hero title'), { target: { value: 'Stakey’s Cycles & Scooter' } });
    expect(screen.getAllByText('Unsaved changes').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('Publish Changes')[0]);
    expect(updateWebsiteContent).toHaveBeenCalledTimes(1);
    expect((updateWebsiteContent.mock.calls[0][0] as WebsiteContent).heroTitle).toBe('Stakey’s Cycles & Scooter');
  });

  it('discards edits back to the saved content', () => {
    render(<WebsiteContentManagerTab />);
    const input = screen.getByLabelText('Hero title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Temporary' } });
    expect(input.value).toBe('Temporary');
    fireEvent.click(screen.getByText('Discard changes'));
    expect((screen.getByLabelText('Hero title') as HTMLInputElement).value).toBe('Stakey’s Cycles');
    expect(updateWebsiteContent).not.toHaveBeenCalled();
  });

  it('switches to the Shop area and keeps product rows collapsible', () => {
    render(<WebsiteContentManagerTab />);
    fireEvent.click(screen.getByText('Shop & Stock'));
    expect(screen.getByText('Shimano brake pads')).toBeTruthy();
    fireEvent.click(screen.getByText('Shimano brake pads'));
    expect(screen.getByLabelText('Product name')).toBeTruthy();
  });
});
