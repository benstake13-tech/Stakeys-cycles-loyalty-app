import { describe, it, expect } from 'vitest';
import {
  buildCatalogue,
  filterCatalogue,
  filterByCategory,
  findEntry,
  cleanModelName,
  inferModelCategory,
  normKey,
  entryConditionRange,
} from './src/data/offerCatalogue';
import type { OfferPriceEntry } from './src/context/OfferPriceBook';

const entry = (over: Partial<OfferPriceEntry>): OfferPriceEntry => ({
  id: over.id ?? 'e1',
  brand: over.brand ?? '',
  model: over.model ?? '',
  category: over.category,
  basePrice: over.basePrice ?? 100,
  conditionPrices: over.conditionPrices,
  updatedAt: over.updatedAt ?? new Date().toISOString(),
});

describe('offerCatalogue helpers', () => {
  it('cleans the trailing descriptor from a model name', () => {
    expect(cleanModelName('Marlin (Mountain)')).toBe('Marlin');
    expect(cleanModelName('FX 1 / 2 / 3 (Hybrid Commuter)')).toBe('FX 1 / 2 / 3');
    expect(cleanModelName('KQi2 Pro')).toBe('KQi2 Pro');
  });

  it('normalises brand/model keys the same way the valuation engine does', () => {
    expect(normKey('FX 1 / 2 / 3')).toBe('fx123');
    expect(normKey('Segway / Ninebot')).toBe(normKey('segway ninebot'));
  });

  it('builds a catalogue of real brands with curated models', () => {
    const cat = buildCatalogue([]);
    expect(cat.length).toBeGreaterThan(50);
    const trek = cat.find((b) => b.name === 'Trek');
    expect(trek).toBeTruthy();
    expect(trek!.hasCuratedModels).toBe(true);
    // Escape hatches ("Other Trek Model") are filtered out of the model list.
    expect(trek!.models.some((m) => /other/i.test(m.name))).toBe(false);
    expect(trek!.models.some((m) => m.name === 'Marlin')).toBe(true);
  });

  it('marks a model priced when the book has a matching row', () => {
    const book = [entry({ brand: 'Trek', model: 'Marlin', basePrice: 210 })];
    const trek = buildCatalogue(book).find((b) => b.name === 'Trek')!;
    const marlin = trek.models.find((m) => m.name === 'Marlin')!;
    expect(marlin.entry?.basePrice).toBe(210);
    expect(trek.pricedModels).toBe(1);
  });

  it('matches a price row ignoring case and punctuation', () => {
    const book = [entry({ brand: 'trek', model: 'fx 1 / 2 / 3', basePrice: 120 })];
    expect(findEntry(book, 'Trek', 'FX 1 / 2 / 3')?.basePrice).toBe(120);
  });

  it('exposes a brand-wide row as brandEntry', () => {
    const book = [entry({ brand: 'Giant', model: '', basePrice: 150 })];
    const giant = buildCatalogue(book).find((b) => b.name === 'Giant')!;
    expect(giant.brandEntry?.basePrice).toBe(150);
  });

  it('filters by a model-name query', () => {
    const cat = buildCatalogue([]);
    const hits = filterCatalogue(cat, 'marlin');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((b) => b.models.every((m) => /marlin/i.test(m.name)))).toBe(true);
  });

  it('filters by category, keeping scooter makers for e-scooters', () => {
    const cat = buildCatalogue([]);
    const scooters = filterByCategory(cat, 'electric_scooter');
    expect(scooters.some((b) => b.name === 'Xiaomi')).toBe(true);
    expect(scooters.some((b) => b.name === 'Trek')).toBe(false);
  });

  it('infers a sensible category for a model', () => {
    expect(inferModelCategory('Trek', 'Marlin (Mountain)')).toBe('cycle');
    expect(inferModelCategory('Trek', 'Rail (Electric Mountain)')).toBe('ebike');
    expect(inferModelCategory('Trek', 'Precaliber (Kids)')).toBe('cargo');
    expect(inferModelCategory('Xiaomi', 'Mi M365 (Original)')).toBe('electric_scooter');
  });

  it('summarises explicit condition prices as a range', () => {
    const priced = entry({
      brand: 'Carrera',
      model: 'Vengeance',
      basePrice: 35,
      conditionPrices: { poor: { price: 10 }, fair: { price: 20 }, good: { price: 30, maxPrice: 40 } },
    });
    expect(entryConditionRange(priced)).toBe('£10–£40');
    expect(entryConditionRange(entry({ basePrice: 100 }))).toBeNull();
  });

  it('shows the condition range on a priced catalogue model', () => {
    const book = [
      entry({
        brand: 'Carrera',
        model: 'Vengeance',
        basePrice: 35,
        conditionPrices: { poor: { price: 10 }, fair: { price: 20 }, good: { price: 30, maxPrice: 40 } },
      }),
    ];
    const carrera = buildCatalogue(book).find((b) => b.name === 'Carrera')!;
    const vengeance = carrera.models.find((m) => m.name === 'Vengeance')!;
    expect(vengeance.conditionRange).toBe('£10–£40');
  });
});
