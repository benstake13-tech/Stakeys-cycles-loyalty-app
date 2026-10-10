import React from 'react';
import { CalendarClock, CheckCircle2, AlertTriangle, HelpCircle, Wrench, Bike as BikeIcon } from 'lucide-react';
import { CustomerBike } from '../types/bikeShop';
import { buildCareSchedule, overallCareStatus, CareScheduleEntry } from '../utils/bikeCare';

interface CareSchedulePanelProps {
  bikes: CustomerBike[];
  /** Book a service, pre-selecting the bike. */
  onBookBike: (bikeId: string) => void;
}

const STATUS_META: Record<CareScheduleEntry['status'], { label: string; wrap: string; icon: React.ReactNode }> = {
  overdue: {
    label: 'Overdue',
    wrap: 'border-rose-500/40 bg-rose-950/20 text-rose-200',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
  },
  due: {
    label: 'Due soon',
    wrap: 'border-amber-500/40 bg-amber-950/20 text-amber-200',
    icon: <CalendarClock className="w-3.5 h-3.5 text-amber-400" />,
  },
  ok: {
    label: 'Up to date',
    wrap: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  },
  unknown: {
    label: 'No history',
    wrap: 'border-neutral-700 bg-neutral-900/40 text-neutral-300',
    icon: <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />,
  },
};

function dueLabel(entry: CareScheduleEntry): string {
  if (entry.status === 'unknown' || entry.daysUntilDue === null) return 'Add a service date to track this';
  if (entry.daysUntilDue < 0) return `${Math.abs(entry.daysUntilDue)} day${Math.abs(entry.daysUntilDue) === 1 ? '' : 's'} overdue`;
  if (entry.daysUntilDue === 0) return 'Due today';
  return `Due in ${entry.daysUntilDue} day${entry.daysUntilDue === 1 ? '' : 's'}`;
}

/**
 * Per-bike care plan: the recommended service intervals derived from each
 * bike's last service date and category, with a one-tap booking action.
 */
export const CareSchedulePanel: React.FC<CareSchedulePanelProps> = ({ bikes, onBookBike }) => {
  return (
    <div className="space-y-6" data-testid="care-schedule">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-emerald-400" /> Care Schedule
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Recommended service intervals for each ride, based on its last workshop visit. Book straight from here.
        </p>
      </div>

      {bikes.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
          <BikeIcon className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">No bikes to schedule yet</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Add a bike to your garage and we'll build a care plan around its service history.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {bikes.map((bike) => {
            const entries = buildCareSchedule(bike);
            const overall = overallCareStatus(entries);
            const meta = STATUS_META[overall];
            return (
              <div key={bike.id} className="rounded-2xl border border-neutral-800 bg-[#0d1015] overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                      {bike.categoryLabel || bike.category}
                    </div>
                    <div className="font-display font-bold text-white">{bike.brand} {bike.model}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {bike.lastServiceDate ? `Last serviced ${bike.lastServiceDate}` : 'No service history yet'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${meta.wrap}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onBookBike(bike.id)}
                      className="px-3.5 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Book this service
                    </button>
                  </div>
                </div>

                <ul className="divide-y divide-neutral-800/70">
                  {entries.map((e) => {
                    const m = STATUS_META[e.status];
                    return (
                      <li key={e.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${m.wrap}`}>
                            {m.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-100">{e.label}</div>
                            <div className="text-xs text-neutral-500 truncate">{e.detail}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-mono font-semibold ${e.status === 'overdue' ? 'text-rose-300' : e.status === 'due' ? 'text-amber-300' : e.status === 'ok' ? 'text-emerald-300' : 'text-neutral-500'}`}>
                            {dueLabel(e)}
                          </div>
                          {e.dueDate && (
                            <div className="text-[10px] font-mono text-neutral-500">
                              next: {e.dueDate.toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CareSchedulePanel;
