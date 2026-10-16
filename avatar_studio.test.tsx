import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarEditorModal } from './src/components/AvatarEditorModal';
import { CLOTHING_OPTIONS, FaceAvatar, getDeterministicConfig, parseConfigString } from './src/components/FaceAvatar';

const original = { ...getDeterministicConfig('Ben'), clothing: 'collar' as const, prop: 'none' as const };
const openEditor = (onSave = vi.fn()) => {
  const view = render(<AvatarEditorModal name="Ben" currentConfigString={JSON.stringify(original)} onSave={onSave} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clothing' }));
  return { ...view, onSave };
};

describe('Avatar wardrobe studio', () => {
  it('filters visual wardrobe cards and saves a new costume and prop without changing the face', () => {
    const { onSave } = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Costumes' }));
    expect(screen.queryByRole('button', { name: 'Workshop Chef' })).toBeNull();
    const outfit = screen.getByRole('button', { name: 'Orbit Explorer' });
    expect(outfit.querySelector('svg')).toBeTruthy();
    fireEvent.click(outfit);
    fireEvent.click(screen.getByRole('button', { name: 'Magic wand' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Avatar' }));
    expect(parseConfigString(onSave.mock.calls[0][0], 'Ben')).toEqual({ ...original, clothing: 'astronaut', prop: 'wand' });
  });

  it('undoes and redoes complete edits, discards the redo path after a new edit, and compares without saving the old look', () => {
    const { onSave } = openEditor();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Workshop Chef' }));
    fireEvent.click(undo);
    expect(screen.getByRole('button', { name: "Stakey's Polo Shirt" }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(redo);
    expect(screen.getByRole('button', { name: 'Workshop Chef' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(undo);
    fireEvent.click(screen.getByRole('button', { name: 'Pumpkin Patch' }));
    expect((redo as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Compare original' }));
    const dialog = screen.getByRole('dialog');
    const hero = within(dialog).getAllByRole('img', { name: "Ben's avatar" })[0];
    expect(hero.querySelector('[aria-label="Stakey\'s Polo Shirt"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Avatar' }));
    expect(JSON.parse(onSave.mock.calls[0][0]).clothing).toBe('pumpkin');
  });

  it('allows reset to be undone and hides colour controls for fixed-colour uniforms', () => {
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Cycle Paramedic' }));
    expect(screen.queryByText('Clothing Color')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Cycle Paramedic' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('traps keyboard focus, closes on Escape without applying, and restores focus and page scrolling', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const previousOverflow = document.body.style.overflow;
    const { unmount } = render(<AvatarEditorModal name="Ben" onClose={onClose} onSave={onSave} />);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Apply Avatar' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close avatar editor' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe(previousOverflow);
    trigger.remove();
  });

  it('renders distinct artwork for every new outfit and preserves it through reload', () => {
    const paths = new Set<string>();
    for (const option of CLOTHING_OPTIONS.slice(15)) {
      const config = { ...original, clothing: option.id };
      const parsed = parseConfigString(JSON.stringify(config), 'Someone else');
      expect(parsed).toEqual(config);
      const { container, unmount } = render(<FaceAvatar seed="Ben" config={parsed} />);
      const clothing = container.querySelector(`g[aria-label="${option.name}"]`)!;
      expect(clothing).toBeTruthy();
      paths.add(clothing.innerHTML);
      unmount();
    }
    expect(paths.size).toBe(8);
  });
});
