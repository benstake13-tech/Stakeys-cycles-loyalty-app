import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home } from 'lucide-react';
import { StaffNavigation } from './src/components/staff/StaffNavigation';
import { STAFF_DESKTOP_QUERY, useStaffDisplayMode } from './src/hooks/useStaffDisplayMode';

function environment(initial: boolean) {
  let desktop = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === STAFF_DESKTOP_QUERY ? desktop : false,
    media: query, onchange: null,
    addEventListener: (_: string, callback: () => void) => { if (query === STAFF_DESKTOP_QUERY) listeners.add(callback); },
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback),
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  })));
  return { setDesktop: (value: boolean) => act(() => { desktop = value; listeners.forEach(listener => listener()); }), listeners };
}
const apps = [
  { id: 'home', label: 'Home', hint: 'Overview', icon: Home },
  { id: 'till', label: 'Till', hint: 'Counter checkout', icon: Home },
  { id: 'settings', label: 'Settings', hint: 'Preferences', icon: Home },
];
function Workspace() {
  const mode = useStaffDisplayMode();
  const [active, setActive] = useState('home');
  const [open, setOpen] = useState(false);
  return <><h1>{active} workspace</h1><p>{mode} mode</p>
    <StaffNavigation mode={mode} activeTab={active === 'till' ? 'till' : 'home'} activeApp={active} apps={apps} drawerOpen={open}
      onOpenDrawer={() => setOpen(true)} onCloseDrawer={() => setOpen(false)} onSelectTab={setActive} onSelectApp={setActive} />
  </>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('automatic staff display modes', () => {
  it('uses only the app drawer on phones and routes selected tools without a dock', () => {
    environment(false); render(<Workspace />);
    expect(screen.queryByRole('navigation', { name: 'Staff dock' })).toBeNull();
    const phone = screen.getByRole('navigation', { name: 'Staff phone navigation' });
    expect(within(phone).getAllByRole('button').length).toBe(1);
    fireEvent.click(within(phone).getByRole('button', { name: 'Open staff apps' }));
    const drawer = screen.getByRole('dialog', { name: 'All apps' });
    expect(drawer.className).toContain('staff-app-drawer--phone');
    expect(within(drawer).getByRole('heading', { name: 'Workspace' })).toBeTruthy();
    expect(within(drawer).getByRole('heading', { name: 'Workshop' })).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Till' }));
    expect(screen.getByRole('heading', { name: 'till workspace' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Staff dock' })).toBeNull();
  });
  it('switches modes live while preserving the active tool and removes desktop shortcuts on phone', () => {
    const media = environment(true); const { unmount } = render(<Workspace />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Staff dock' })).getByRole('button', { name: 'Till' }));
    media.setDesktop(false);
    expect(screen.getByRole('heading', { name: 'till workspace' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Staff dock' })).toBeNull();
    fireEvent.keyDown(window, { ctrlKey: true, key: '1' });
    expect(screen.getByRole('heading', { name: 'till workspace' })).toBeTruthy();
    media.setDesktop(true);
    expect(screen.queryByRole('navigation', { name: 'Staff phone navigation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Till' }).getAttribute('aria-current')).toBe('page');
    unmount(); expect(media.listeners.size).toBe(0);
  });
  it('keeps the open drawer and search during a mode change and restores focus to the new launcher', () => {
    const media = environment(true); render(<Workspace />);
    const more = screen.getByRole('button', { name: 'More Apps' }); more.focus(); fireEvent.click(more);
    const drawer = screen.getByRole('dialog');
    fireEvent.change(within(drawer).getByRole('textbox'), { target: { value: 'pref' } });
    media.setDesktop(false);
    expect((within(drawer).getByRole('textbox') as HTMLInputElement).value).toBe('pref');
    expect(within(drawer).getByRole('button', { name: 'Settings' })).toBeTruthy();
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open staff apps' }));
  });
  it('keeps a wide touch-only device in phone mode and does not autofocus its keyboard', () => {
    environment(false); render(<Workspace />);
    expect(window.innerWidth).toBeGreaterThanOrEqual(900);
    expect(screen.getByText('phone mode')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open staff apps' }));
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(STAFF_DESKTOP_QUERY).toContain('any-pointer: fine');
  });
  it('traps modal focus, filters by hints, clears search and restores page scrolling', () => {
    environment(false); render(<Workspace />);
    const trigger = screen.getByRole('button', { name: 'Open staff apps' }); trigger.focus(); fireEvent.click(trigger);
    const drawer = screen.getByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.change(within(drawer).getByRole('textbox'), { target: { value: 'not-an-app' } });
    expect(within(drawer).getByText(/No apps match/)).toBeTruthy();
    const clear = within(drawer).getByRole('button', { name: 'Clear search' }); clear.focus();
    fireEvent.keyDown(clear, { key: 'Tab' });
    expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Close app drawer' }));
    fireEvent.click(clear);
    fireEvent.change(within(drawer).getByRole('textbox'), { target: { value: 'checkout' } });
    expect(within(drawer).getByRole('button', { name: 'Till' })).toBeTruthy();
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });
});
