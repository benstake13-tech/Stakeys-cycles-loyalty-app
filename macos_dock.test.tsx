import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MacOSDock } from './src/components/staff/MacOSDock';

function setup() {
  const onSelectTab = vi.fn();
  const onOpenApps = vi.fn();
  const view = render(<div className="hidden" aria-hidden="true"><MacOSDock activeTab="till" onSelectTab={onSelectTab} onOpenApps={onOpenApps} /></div>);
  const nav = screen.getByRole('navigation', { name: 'Staff dock' });
  return { ...view, nav, onSelectTab, onOpenApps };
}

describe('desktop macOS dock', () => {
  it('stays outside page containers with seven labelled destinations and an active indicator', () => {
    const { nav } = setup();
    expect(nav.parentElement).toBe(document.body);
    expect(within(nav).getAllByRole('button').length).toBe(7);
    expect(within(nav).getByRole('button', { name: 'Till' }).getAttribute('aria-current')).toBe('page');
  });
  it('opens the app drawer by click, Ctrl+7 and ArrowDown without changing tools', () => {
    const { nav, onSelectTab, onOpenApps } = setup();
    const more = within(nav).getByRole('button', { name: 'More Apps' });
    fireEvent.click(more);
    fireEvent.keyDown(window, { ctrlKey: true, key: '7' });
    fireEvent.keyDown(more, { key: 'ArrowDown' });
    expect(onOpenApps).toHaveBeenCalledTimes(3);
    expect(onSelectTab).not.toHaveBeenCalled();
  });
  it('tracks the pointer smoothly, affects neighbours and avoids repeated layout reads', async () => {
    const { nav } = setup();
    const buttons = within(nav).getAllByRole('button');
    const measurements = buttons.map((button, i) => vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 50 + i * 70, width: 70 } as DOMRect));
    fireEvent.mouseEnter(nav);
    fireEvent.mouseMove(nav, { clientX: 225 }); // Centre of Till.
    const scale = (index: number) => Number((buttons[index].querySelector('.stakeys-dock-icon') as HTMLElement).style.transform.match(/scale\(([^)]+)\)/)?.[1] || 1);
    await waitFor(() => expect(scale(2)).toBeGreaterThan(1.17));
    expect(scale(2)).toBeLessThanOrEqual(1.2);
    expect(scale(1)).toBeGreaterThan(scale(0));
    expect(scale(1)).toBeLessThan(scale(2));
    fireEvent.mouseMove(nav, { clientX: 365 }); // Move towards Stock.
    await waitFor(() => expect(scale(4)).toBeGreaterThan(scale(2)));
    expect(measurements.every(measure => measure.mock.calls.length === 1)).toBe(true);
    fireEvent.mouseLeave(nav);
    await waitFor(() => expect(scale(4)).toBeCloseTo(1, 2));
  });
  it('focuses the active destination, wraps arrows and restores prior focus on Escape', () => {
    const outside = document.createElement('button'); document.body.append(outside); outside.focus();
    const { nav } = setup();
    fireEvent.keyDown(window, { metaKey: true, key: 'k' });
    const till = within(nav).getByRole('button', { name: 'Till' });
    expect(document.activeElement).toBe(till);
    fireEvent.keyDown(till, { key: 'Home' });
    const home = within(nav).getByRole('button', { name: 'Home' });
    expect(document.activeElement).toBe(home);
    fireEvent.keyDown(home, { key: 'ArrowLeft' });
    const more = within(nav).getByRole('button', { name: 'More Apps' });
    expect(document.activeElement).toBe(more);
    fireEvent.keyDown(more, { key: 'Escape' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
  it('routes primary shortcuts, respects text fields and modal dialogs, and removes listeners on unmount', () => {
    const { onSelectTab, unmount } = setup();
    fireEvent.keyDown(window, { ctrlKey: true, key: '3' });
    expect(onSelectTab).toHaveBeenCalledWith('till'); onSelectTab.mockClear();
    const input = document.createElement('input'); document.body.append(input);
    fireEvent.keyDown(input, { ctrlKey: true, key: '4' }); expect(onSelectTab).not.toHaveBeenCalled();
    const dialog = document.createElement('div'); dialog.setAttribute('aria-modal', 'true'); document.body.append(dialog);
    fireEvent.keyDown(window, { ctrlKey: true, key: '4' }); expect(onSelectTab).not.toHaveBeenCalled();
    dialog.remove(); input.remove(); unmount();
    fireEvent.keyDown(window, { ctrlKey: true, key: '4' }); expect(onSelectTab).not.toHaveBeenCalled();
  });
});
