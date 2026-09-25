import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Ticket,
  Save,
  RotateCcw,
  Palette,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PrizeWheel, PrizeWheelSegment } from '../types/bikeShop';
import { INITIAL_PRIZE_WHEELS } from '../data/initialData';

interface WheelEditorModalProps {
  wheel: PrizeWheel;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWheel: Partial<PrizeWheel>) => void;
}

const PRESET_COLORS = [
  '#05C147', // emerald
  '#0ea5e9', // sky blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#eab308', // gold
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#ef4444', // red
  '#14b8a6', // teal
];

export const WheelEditorModal: React.FC<WheelEditorModalProps> = ({
  wheel,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(wheel.title);
  const [ticketCost, setTicketCost] = useState(wheel.ticketCost ?? 1);
  const [segments, setSegments] = useState<PrizeWheelSegment[]>(
    JSON.parse(JSON.stringify(wheel.segments))
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateSegment = (
    index: number,
    field: keyof PrizeWheelSegment,
    value: any
  ) => {
    setSegments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddSegment = () => {
    if (segments.length >= 12) {
      setError('Maximum 12 segments permitted for clear wheel visibility.');
      return;
    }
    const color = PRESET_COLORS[segments.length % PRESET_COLORS.length];
    const newSeg: PrizeWheelSegment = {
      id: `seg-${Date.now()}`,
      label: 'Free Bike Water Bottle',
      color,
      probability: 0.15,
      prizeId: `prize-custom-${Date.now()}`,
      rewardType: 'merch',
      rewardValue: "Stakey's Purist Bottle",
    };
    setSegments((prev) => [...prev, newSeg]);
    setError(null);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 2) {
      setError('A prize wheel must have at least 2 segments.');
      return;
    }
    setSegments((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleResetToDefaults = () => {
    const defaultWheel = INITIAL_PRIZE_WHEELS[0];
    setTitle(defaultWheel.title);
    setTicketCost(defaultWheel.ticketCost ?? 1);
    setSegments(JSON.parse(JSON.stringify(defaultWheel.segments)));
    setError(null);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setError('Please provide a wheel title.');
      return;
    }
    if (segments.length < 2) {
      setError('Wheel requires at least 2 segments.');
      return;
    }
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].label.trim()) {
        setError(`Segment #${i + 1} is missing a label.`);
        return;
      }
    }

    onSave({
      title: title.trim(),
      ticketCost: Math.max(0, Number(ticketCost) || 0),
      segments,
      updatedAt: new Date(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Customize Prize Wheel</h2>
              <p className="text-xs text-neutral-400">
                Edit segments, colors, reward categories, and ticket costs.
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* General Wheel Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-neutral-400 font-semibold mb-1.5">
                Wheel Display Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stakey's Golden Gear Wheel"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-neutral-400 font-semibold mb-1.5 flex items-center justify-between">
                <span>Cost Per Spin</span>
                <span className="text-[10px] text-emerald-400 font-mono">TICKETS</span>
              </label>
              <div className="relative">
                <Ticket className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={ticketCost}
                  onChange={(e) => setTicketCost(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Segments Management */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-white text-sm">
                  Wheel Segments ({segments.length})
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Each segment corresponds to a prize slice on the roulette wheel.
                </p>
              </div>

              <button
                onClick={handleAddSegment}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Segment</span>
              </button>
            </div>

            <div className="space-y-3">
              {segments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col md:flex-row items-stretch md:items-center gap-3"
                >
                  {/* Segment Index & Color Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-neutral-500 font-mono font-bold text-center">
                      #{idx + 1}
                    </span>
                    <div className="relative group">
                      <input
                        type="color"
                        value={seg.color}
                        onChange={(e) => handleUpdateSegment(idx, 'color', e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      />
                    </div>
                  </div>

                  {/* Label */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={seg.label}
                      onChange={(e) => handleUpdateSegment(idx, 'label', e.target.value)}
                      placeholder="Prize Label (e.g. +1 Draw Ticket)"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Reward Type */}
                  <div className="w-32">
                    <select
                      value={seg.rewardType || 'ticket'}
                      onChange={(e) => handleUpdateSegment(idx, 'rewardType', e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-neutral-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ticket">Ticket Entry</option>
                      <option value="discount">Discount %</option>
                      <option value="merch">Merchandise</option>
                      <option value="service">Shop Service</option>
                    </select>
                  </div>

                  {/* Probability / Weight */}
                  <div className="w-24">
                    <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1">
                      <span className="text-[10px] text-neutral-500">Prob:</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0.01"
                        max="1"
                        value={seg.probability}
                        onChange={(e) =>
                          handleUpdateSegment(
                            idx,
                            'probability',
                            parseFloat(e.target.value) || 0.1
                          )
                        }
                        className="w-full bg-transparent text-white font-mono text-[11px] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleRemoveSegment(idx)}
                    disabled={segments.length <= 2}
                    className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
                    title="Remove segment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <button
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
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
              <span>Save & Apply Wheel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
