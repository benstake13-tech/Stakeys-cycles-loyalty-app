import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FaceAvatar, getDeterministicConfig, parseConfigString } from './src/components/FaceAvatar';
import { AvatarEditorModal } from './src/components/AvatarEditorModal';

describe('FaceAvatar Programmatic Logic', () => {
  it('generates a stable deterministic configuration based on seed names', () => {
    const config1 = getDeterministicConfig('Alex Morgan');
    const config2 = getDeterministicConfig('Alex Morgan');
    const config3 = getDeterministicConfig('Sam Smith');

    expect(config1).toEqual(config2);
    expect(config1.backdrop).toBeDefined();
    expect(config1.skinTone).toBeDefined();
    expect(config1.hairStyle).toBeDefined();
    expect(config3).not.toEqual(config1); // Different seed should result in a different avatar
  });

  it('correctly parses plain colors as fallbacks or parses JSON configurations', () => {
    const fallbackColor = '#05C147';
    const configFromHex = parseConfigString(fallbackColor, 'Alex');
    expect(configFromHex.backdrop).toBe('emerald'); // Legacy default color mapped to emerald backdrop

    const customJson = JSON.stringify({
      backdrop: 'sunset',
      skinTone: 'porcelain',
      hairStyle: 'pompadour',
      hairColor: 'onyx',
      facialHair: 'none',
      eyesStyle: 'kind',
      expression: 'smile',
      glasses: 'sporty_cycling',
      accessory: 'earbuds',
      clothing: 'dungarees',
      clothingColor: '#05C147',
    });

    const configFromJson = parseConfigString(customJson, 'Alex');
    expect(configFromJson.backdrop).toBe('sunset');
    expect(configFromJson.hairStyle).toBe('pompadour');
    expect(configFromJson.glasses).toBe('sporty_cycling');
  });
});

describe('FaceAvatar Component Rendering', () => {
  it('renders the SVG face avatar with the computed elements', () => {
    const { container } = render(
      <FaceAvatar seed="Alex Morgan" size={48} className="test-class" />
    );
    const svgElement = container.querySelector('svg');
    expect(svgElement).toBeTruthy();
    expect(svgElement!.getAttribute('width')).toBe('48');
    expect(svgElement!.getAttribute('height')).toBe('48');
    expect(svgElement!.classList.contains('test-class')).toBe(true);

    // Check that we have definitions and a backdrop rect
    const rect = container.querySelector('rect');
    expect(rect).toBeTruthy();
  });
});

describe('AvatarEditorModal Customization', () => {
  it('renders the editor with category tabs and updates attributes', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <AvatarEditorModal
        name="Alex Morgan"
        currentConfigString="#05C147"
        onSave={handleSave}
        onClose={handleClose}
      />
    );

    // Verify header details are visible
    expect(screen.getByText('Customize Face Avatar')).toBeTruthy();
    expect(screen.getByText('Design a personalized high-quality face for Alex Morgan')).toBeTruthy();

    // Verify option tabs exist
    expect(screen.getByText('Backdrop')).toBeTruthy();
    expect(screen.getByText('Hair & Skin')).toBeTruthy();
    expect(screen.getByText('Face & Gear')).toBeTruthy();
    expect(screen.getByText('Clothing')).toBeTruthy();

    // Tap Randomize button
    const randomizeBtn = screen.getByText(/Randomize/);
    expect(randomizeBtn).toBeTruthy();
    fireEvent.click(randomizeBtn);

    // Tap Apply Avatar to trigger save
    const applyBtn = screen.getByText('Apply Avatar');
    expect(applyBtn).toBeTruthy();
    fireEvent.click(applyBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedConfig = JSON.parse(handleSave.mock.calls[0][0]);
    expect(savedConfig.backdrop).toBeDefined();
    expect(savedConfig.skinTone).toBeDefined();
  });
});
