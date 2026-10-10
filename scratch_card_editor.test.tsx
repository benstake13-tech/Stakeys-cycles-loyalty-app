import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ScratchCardEditorModal } from './src/components/ScratchCardEditorModal';
import { DEFAULT_SCRATCH_CARD } from './src/utils/scratchCardHelper';

describe('ScratchCardEditorModal', () => {
  it('renders the title, prizes and computed odds', () => {
    const { container } = render(
      <ScratchCardEditorModal
        config={DEFAULT_SCRATCH_CARD}
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Customize Scratch Card');
    expect(container.textContent).toContain(`Hidden Prizes (${DEFAULT_SCRATCH_CARD.prizes.length})`);
    expect(container.textContent).toContain('30% chance');
  });

  it('adds a prize row when Add Prize is clicked', () => {
    const { container, getByText } = render(
      <ScratchCardEditorModal
        config={DEFAULT_SCRATCH_CARD}
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    fireEvent.click(getByText('Add Prize'));
    expect(container.textContent).toContain(
      `Hidden Prizes (${DEFAULT_SCRATCH_CARD.prizes.length + 1})`
    );
  });

  it('saves a normalized config when the card title is cleared to whitespace', () => {
    const onSave = vi.fn();
    const { container, getByText } = render(
      <ScratchCardEditorModal
        config={DEFAULT_SCRATCH_CARD}
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
      />
    );
    const title = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(title, { target: { value: '  ' } });
    // Blank title is a validation error, not a save.
    fireEvent.click(getByText('Save Prizes'));
    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Please provide a card title');
  });

  it('emits a normalized payload on save', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(
      <ScratchCardEditorModal
        config={DEFAULT_SCRATCH_CARD}
        isOpen
        onClose={onClose}
        onSave={onSave}
      />
    );
    fireEvent.click(getByText('Save Prizes'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.title).toBe(DEFAULT_SCRATCH_CARD.title);
    expect(payload.prizes).toHaveLength(DEFAULT_SCRATCH_CARD.prizes.length);
    expect(onClose).toHaveBeenCalled();
  });
});
