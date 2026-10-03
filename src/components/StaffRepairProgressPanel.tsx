import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquarePlus,
  Send,
  Wrench,
} from 'lucide-react';
import { ServiceBooking, RepairStageId } from '../types/bikeShop';
import {
  REPAIR_STAGES,
  deriveRepairStage,
  nextRepairStage,
  repairProgressPercent,
  repairStageIndex,
} from '../utils/repairProgress';

interface StaffRepairProgressPanelProps {
  booking: ServiceBooking;
  isDark?: boolean;
  onSetStage: (
    stage: RepairStageId,
    options?: { note?: string; estimateReadyAt?: string | null }
  ) => Promise<{ success: boolean; message?: string }>;
  onAddNote: (note: string) => Promise<{ success: boolean; message?: string }>;
}

/**
 * Staff control for the customer-facing repair tracker. Lets the mechanic move
 * a repair along the workshop journey, set an estimated ready time and leave
 * notes that appear immediately on the customer's tracker.
 */
export const StaffRepairProgressPanel: React.FC<StaffRepairProgressPanelProps> = ({
  booking,
  onSetStage,
  onAddNote,
}) => {
  const currentStage = deriveRepairStage(booking);
  const currentIndex = repairStageIndex(currentStage);
  const nextStage = nextRepairStage(currentStage);
  const percent = repairProgressPercent(currentStage);

  const [note, setNote] = useState('');
  const [estimate, setEstimate] = useState(booking.estimateReadyAt?.slice(0, 16) || '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const events = booking.progressEvents || [];

  const run = async (fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fn();
      setFeedback(res.message || (res.success ? 'Saved' : 'Failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = () => {
    if (!nextStage) return;
    void run(() =>
      onSetStage(nextStage, {
        note: note.trim() || undefined,
        estimateReadyAt: estimate ? new Date(estimate).toISOString() : booking.estimateReadyAt ?? null,
      })
    );
    setNote('');
  };

  const handleJump = (stage: RepairStageId) => {
    void run(() =>
      onSetStage(stage, {
        note: note.trim() || undefined,
        estimateReadyAt: estimate ? new Date(estimate).toISOString() : booking.estimateReadyAt ?? null,
      })
    );
    setNote('');
  };

  const handleNote = () => {
    if (!note.trim()) return;
    void run(() => onAddNote(note));
    setNote('');
  };

  return (
    <div className="p-4 rounded-2xl bg-neutral-950/90 border border-emerald-500/25 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#05C147]" />
          <span className="font-bold text-white text-xs sm:text-sm">Customer Repair Tracker</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            {percent}% · {REPAIR_STAGES[currentIndex].short}
          </span>
        </div>
        <span className="text-[11px] text-neutral-400">
          Customers see this live on their Repairs tab.
        </span>
      </div>

      {/* Stage stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {REPAIR_STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleJump(stage.id)}
                title={`${stage.title} — ${stage.description}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                  isCurrent
                    ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                    : isDone
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600'
                }`}
              >
                {isDone ? (
                  <Check className="w-3 h-3" />
                ) : isCurrent ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
                {stage.short}
              </button>
              {idx < REPAIR_STAGES.length - 1 && (
                <div className={`h-px w-3 shrink-0 ${isDone ? 'bg-emerald-600' : 'bg-neutral-800'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Advance + estimate */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          type="button"
          disabled={busy || !nextStage}
          onClick={handleAdvance}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowRight className="w-4 h-4" />
          {nextStage ? `Advance to ${REPAIR_STAGES[repairStageIndex(nextStage)].short}` : 'Fully complete'}
        </button>

        <div className="flex items-center gap-2 flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2">
          <CalendarClock className="w-4 h-4 text-neutral-500 shrink-0" />
          <div className="flex-1">
            <label className="block text-[9px] uppercase tracking-wider text-neutral-500 font-mono">
              Estimated ready
            </label>
            <input
              type="datetime-local"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              className="w-full bg-transparent text-xs text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Note + quick actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional note for the customer (e.g. 'Waiting on a 11-speed chain — due Thursday')."
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
        />
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={handleNote}
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed self-stretch sm:self-end"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Add note only
        </button>
      </div>

      {feedback && (
        <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
          <Send className="w-3 h-3" /> {feedback}
        </div>
      )}

      {/* Workshop timeline */}
      {events.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Progress timeline ({events.length})
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {events.slice(0, 12).map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 p-2 rounded-lg bg-neutral-900/70 border border-neutral-800 text-[11px]"
              >
                <span className={`mt-0.5 shrink-0 ${ev.kind === 'note' ? 'text-sky-400' : 'text-[#05C147]'}`}>
                  {ev.kind === 'note' ? <MessageSquarePlus className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-200 truncate">{ev.label}</span>
                    <span className="font-mono text-[9px] text-neutral-500 shrink-0">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  {ev.note && <p className="text-neutral-400 mt-0.5 whitespace-pre-line">{ev.note}</p>}
                  {ev.createdBy && <span className="text-[9px] text-neutral-600">by {ev.createdBy}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
