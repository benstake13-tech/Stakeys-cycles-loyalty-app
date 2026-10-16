import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MacOSDock } from './src/components/staff/MacOSDock';

const apps = [{ id: 'customers', label: 'Members' }, { id: 'settings', label: 'Settings' }];
function setup() {
  const onSelectTab = vi.fn();
  const onSelectApp = vi.fn();
  const view = render(<div className="hidden" aria-hidden="true"><MacOSDock activeTab="till" onSelectTab={onSelectTab} moreApps={apps} onSelectApp={onSelectApp} /></div>);
  const nav = screen.getByRole('navigation', { name: 'Staff dock' });
  return { ...view, nav, onSelectTab, onSelectApp };
}

describe('staff macOS dock', () => {
  it('stays visible outside hidden or transformed page containers with seven labelled destinations', () => {
    const { nav } = setup();
    expect(nav.parentElement).toBe(document.body);
    expect(within(nav).getAllByRole('button').length).toBe(7);
    expect(within(nav).getByRole('button', { name: 'Till' }).getAttribute('aria-current')).toBe('page');
  });
  it('opens More Apps without navigating away and opens the selected tool', () => {
    const { nav, onSelectTab, onSelectApp } = setup();
    const more = within(nav).getByRole('button', { name: 'More Apps' });
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(onSelectTab).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('region', { name: 'More apps drawer' })).getByRole('button', { name: 'Settings' }));
    expect(onSelectApp).toHaveBeenCalledWith('settings');
    expect(screen.queryByRole('region', { name: 'More apps drawer' })).toBeNull();
    expect(document.activeElement).toBe(more);
  });
  it('uses the same drawer action for Ctrl+7 and dismisses on outside tap', () => {
    const { onSelectTab } = setup();
    fireEvent.keyDown(window, { ctrlKey: true, key: '7' });
    expect(screen.getByRole('region', { name: 'More apps drawer' })).toBeTruthy();
    expect(onSelectTab).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: 'More apps drawer' })).toBeNull();
  });
  it('focuses the active destination, wraps arrows, and restores prior focus on Escape', () => {
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
    fireEvent.keyDown(more, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Members' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(more);
    fireEvent.keyDown(more, { key: 'Escape' });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
  it('routes primary shortcuts, respects text fields and modal dialogs, and removes listeners on unmount', () => {
    const { onSelectTab, unmount } = setup();
    fireEvent.keyDown(window, { ctrlKey: true, key: '3' });
    expect(onSelectTab).toHaveBeenCalledWith('till');
    onSelectTab.mockClear();
    const input = document.createElement('input'); document.body.append(input);
    fireEvent.keyDown(input, { ctrlKey: true, key: '4' });
    expect(onSelectTab).not.toHaveBeenCalled();
    const dialog = document.createElement('div'); dialog.setAttribute('aria-modal', 'true'); document.body.append(dialog);
    fireEvent.keyDown(window, { ctrlKey: true, key: '4' });
    expect(onSelectTab).not.toHaveBeenCalled();
    dialog.remove(); input.remove(); unmount();
    fireEvent.keyDown(window, { ctrlKey: true, key: '4' });
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});
