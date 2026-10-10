import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Ticket,
  Save,
  AlertCircle,
  Clock,
  Percent,
  Trophy,
} from 'lucide-react';
import { ScratchCardConfig, ScratchPrize } from '../types/bikeShop';
import {
  DEFAULT_SCRATCH_CARD,
  normalizeScratchCard,
  scratchPrizeProbability,
} from '../utils/scratchCardHelper';

interface ScratchCardEditorModalProps {
  config: ScratchCardConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<ScratchCardConfig>) => void;
}

const REWARD_TYPES: ScratchPrize['rewardType'][] = [
  'stamp',
  'ticket',
  'points',
  'discount',
  'merch',
  'service',
];

const REWARD_TYPE_LABELS: Record<ScratchPrize['rewardType'], string> = {
  stamp: 'Loyalty Stamp(s)',
  ticket: 'Prize Draw Ticket',
  points: 'Store Points',
  discount: 'Discount',
  merch: 'Merchandise',
  service: 'Shop Service',
};

export const ScratchCardEditorModal: React.FC<ScratchCardEditorModalProps> = ({
  config,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(config.title);
  const [cooldownHours, setCooldownHours] = useState(config.cooldownHours ?? 168);
  const [ticketCost, setTicketCost] = useState(config.ticketCost ?? 0);
  const [prizes, setPrizes] = useState<ScratchPrize[]>(
    JSON.parse(JSON.stringify(config.prizes))
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const updatePrize = (index: number, field: keyof ScratchPrize, value: any) => {
    setPrizes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addPrize = () => {
    if (prizes.length >= 12) {
      setError('Maximum 12 prizes per scratch card.');
      return;
    }
    const newPrize: ScratchPrize = {
      id: `scratch-prize-${Date.now()}`,
      label: 'Free Bike Water Bottle',
      weight: 10,
      rewardType: 'merch',
      rewardValue: "Stakey's Purist Bottle",
    };
    setPrizes((prev) => [...prev, newPrize]);
    setError(null);
  };

  const removePrize = (index: number) => {
    if (prizes.length <= 1) {
      setError('A scratch card needs at least one prize.');
      return;
    }
    setPrizes((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Please provide a card title.');
      return;
    }
    if (prizes.length < 1) {
      setError('Add at least one prize.');
      return;
    }
    for (let i = 0; i < prizes.length; i++) {
      if (!prizes[i].label.trim()) {
        setError(`Prize #${i + 1} is missing a label.`);
        return;
      }
      if (!(prizes[i].weight > 0)) {
        setError(`Prize #${i + 1} needs a weight greater than 0 so it can be won.`);
        return;
      }
    }

    const normalized = normalizeScratchCard({
      title: title.trim(),
      cooldownHours: Math.max(0, Number(cooldownHours) || 0),
      ticketCost: Math.max(0, Number(ticketCost) || 0),
      prizes,
    });
    onSave(normalized);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Customize Scratch Card</h2>
              <p className="text-xs text-neutral-400">
                Set the title, cooldown and hidden prize table. Odds are the prize
                weight divided by the total of all weights.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-neutral-400 font-semibold mb-1.5">Card Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stakey's Golden Scratch Card"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Cooldown Between Plays
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-2 text-neutral-500 text-[11px]">hours</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-1">0 = unlimited plays.</p>
            </div>

            <div>
              <label className="block text-neutral-400 font-semibold mb-1.5 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5" />
                Ticket Cost
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={ticketCost}
                onChange={(e) => setTicketCost(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Prize table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Hidden Prizes ({prizes.length})
                </h3>
                <p className="text-[11px] text-neutral-400">
                  A rider always wins one of these when they scratch the card.
                </p>
              </div>
              <button
                onClick={addPrize}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Prize</span>
              </button>
            </div>

            <div className="space-y-3">
              {prizes.map((prize, idx) => {
                const pct = Math.round(scratchPrizeProbability(prize, prizes) * 100);
                return (
                  <div
                    key={prize.id || idx}
                    className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2.5"
                  >
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                      <span className="w-6 text-neutral-500 font-mono font-bold text-center shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={prize.label}
                          onChange={(e) => updatePrize(idx, 'label', e.target.value)}
                          placeholder="Prize label (e.g. Free Inner Tube)"
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="w-40">
                        <select
                          value={prize.rewardType}
                          onChange={(e) => updatePrize(idx, 'rewardType', e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-300 focus:outline-none focus:border-emerald-500"
                        >
                          {REWARD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {REWARD_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1">
                          <span className="text-[10px] text-neutral-500">Wt:</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={prize.weight}
                            onChange={(e) =>
                              updatePrize(idx, 'weight', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full bg-transparent text-white font-mono text-[11px] focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => removePrize(idx)}
                        disabled={prizes.length <= 1}
                        className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                        title="Remove prize"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-9">
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {pct}% chance
                      </span>

                      {prize.rewardType === 'stamp' && (
                        <label className="flex items-center gap-1.5 text-neutral-400">
                          Stamps
                          <input
                            type="number"
                            min="1"
                            value={prize.stampsAmount ?? 1}
                            onChange={(e) =>
                              updatePrize(idx, 'stampsAmount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-14 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </label>
                      )}
                      {prize.rewardType === 'ticket' && (
                        <label className="flex items-center gap-1.5 text-neutral-400">
                          Tickets
                          <input
                            type="number"
                            min="1"
                            value={prize.ticketAmount ?? 1}
                            onChange={(e) =>
                              updatePrize(idx, 'ticketAmount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-14 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </label>
                      )}
                      {prize.rewardType === 'points' && (
                        <label className="flex items-center gap-1.5 text-neutral-400">
                          Points
                          <input
                            type="number"
                            min="1"
                            value={prize.pointsAmount ?? 50}
                            onChange={(e) =>
                              updatePrize(idx, 'pointsAmount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-20 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </label>
                      )}
                      {(prize.rewardType === 'discount' ||
                        prize.rewardType === 'merch' ||
                        prize.rewardType === 'service') && (
                        <input
                          type="text"
                          value={prize.rewardValue ?? ''}
                          onChange={(e) => updatePrize(idx, 'rewardValue', e.target.value)}
                          placeholder="Voucher description shown to the rider"
                          className="flex-1 min-w-[200px] bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-neutral-200 focus:outline-none focus:border-emerald-500"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <button
            onClick={() => {
              setTitle(DEFAULT_SCRATCH_CARD.title);
              setCooldownHours(DEFAULT_SCRATCH_CARD.cooldownHours);
              setTicketCost(DEFAULT_SCRATCH_CARD.ticketCost);
              setPrizes(JSON.parse(JSON.stringify(DEFAULT_SCRATCH_CARD.prizes)));
              setError(null);
            }}
            className="px-3.5 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Prizes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
