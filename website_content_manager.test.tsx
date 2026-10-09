import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
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

  it('picks a single website section with the tile picker', () => {
    render(<WebsiteContentManagerTab />);
    const picker = screen.getByTestId('cms-section-picker');
    expect(within(picker).getByTestId('cms-section-all').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(picker).getByTestId('cms-section-faqs'));
    expect(screen.getByTestId('cms-section-faqs').getAttribute('aria-pressed')).toBe('true');
    // The focused section is shown; the others are hidden.
    expect(screen.getByText('Brake pads squealing?')).toBeTruthy();
    expect(screen.queryByLabelText('Hero title')).toBeNull();
  });

  it('validates contact fields inline and blocks publishing until fixed', () => {
    render(<WebsiteContentManagerTab />);
    expect(screen.queryByTestId('cms-validation-summary')).toBeNull();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByTestId('cms-validation-summary')).toBeTruthy();
    expect((screen.getAllByText('Publish Changes')[0] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hello@stakeys.test' } });
    expect(screen.queryByTestId('cms-validation-summary')).toBeNull();
  });

  it('guards an area switch when there are unsaved edits', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WebsiteContentManagerTab />);
    fireEvent.change(screen.getByLabelText('Hero title'), { target: { value: 'Temporary' } });

    fireEvent.click(screen.getByText('Shop & Stock'));
    // Declined the confirm → still on the website area.
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByLabelText('Hero title')).toBeTruthy();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('Shop & Stock'));
    expect(screen.queryByLabelText('Hero title')).toBeNull();
    confirmSpy.mockRestore();
  });
});
