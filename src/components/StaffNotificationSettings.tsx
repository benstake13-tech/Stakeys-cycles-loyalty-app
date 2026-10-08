import React from 'react';
import { Bell, Mail, Eye, BellRing } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  NOTIFICATION_EVENTS,
  describeChannels,
  isEventMuted,
  type NotificationChannels,
} from '../utils/notificationPreferences';

const CHANNEL_META: Array<{ key: keyof NotificationChannels; label: string; icon: React.ReactNode }> = [
  { key: 'visual', label: 'Visual', icon: <Eye className="w-3.5 h-3.5" /> },
  { key: 'email', label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
  { key: 'push', label: 'Push', icon: <BellRing className="w-3.5 h-3.5" /> },
];

const AUDIENCE_LABEL: Record<string, string> = {
  staff: 'Workshop',
  customer: 'Customer',
  both: 'Both',
};

/**
 * The staff-managed notification matrix. Every workshop event can be routed to
 * any combination of Visual (the in-app bell), Email and Push. Changes save to
 * the shared app_settings row so every staff terminal stays in step.
 */
export const StaffNotificationSettings: React.FC = () => {
  const { notificationPreferences, setNotificationChannel, setNotificationEventEnabled } = useShop();

  return (
    <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Bell className="w-5 h-5 text-emerald-400" />
            Notification Routing
          </div>
          <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
            Choose how each workshop event reaches you. <strong className="text-neutral-200">Visual</strong> shows it in
            the notification bell, <strong className="text-neutral-200">Email</strong> sends it to the workshop inbox,
            and <strong className="text-neutral-200">Push</strong> alerts staff phones via OneSignal.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {NOTIFICATION_EVENTS.map((event) => {
          const channels = notificationPreferences[event.id];
          const muted = isEventMuted(notificationPreferences, event.id);
          return (
            <div
              key={event.id}
              className={`rounded-xl border p-3.5 transition-colors ${
                muted ? 'border-neutral-800/70 bg-neutral-950/40' : 'border-neutral-800 bg-neutral-950'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{event.label}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {AUDIENCE_LABEL[event.audience] || event.audience}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">{describeChannels(channels)}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{event.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {CHANNEL_META.map(({ key, label, icon }) => {
                    const on = channels[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNotificationChannel(event.id, key, !on)}
                        aria-pressed={on}
                        title={`${label} ${on ? 'on' : 'off'}`}
                        className={`pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          on
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        {icon}
                        <span>{label}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setNotificationEventEnabled(event.id, muted)}
                    title={muted ? 'Enable all channels' : 'Mute this event'}
                    className={`pressable ml-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      muted
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        : 'bg-rose-950/40 border-rose-900/60 text-rose-300 hover:text-rose-200'
                    }`}
                  >
                    {muted ? 'Enable' : 'Mute'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-neutral-500">
        Tip: the bell always lists recent activity that has Visual switched on. Muting an event only stops it being
        routed; the underlying data is never affected.
      </p>
    </div>
  );
};
