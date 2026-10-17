import React from 'react';

export type StakeysIconName = 'home' | 'garage' | 'booking' | 'offers' | 'rewards' | 'help' | 'account' | 'apps' | 'search' | 'admin' | 'website' | 'sales' | 'workshop' | 'inventory' | 'settings';

const paths: Record<StakeysIconName, React.ReactNode> = {
  home: <><path d="m3 11 9-7 9 7"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/><circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none"/></>,
  garage: <><circle cx="7" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m7 17 4-8 4 8H7Zm4-8h4l3 8m-7-8-2-3h4"/></>,
  booking: <><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="M8 2v4m8-4v4M3 9h18m-12 4 2 2 4-4"/></>,
  offers: <><path d="M20.5 13 13 20.5 3.5 11V3.5H11l9.5 9.5Z"/><circle cx="8" cy="8" r="1.4"/><path d="m12 15 3-3m-2.5-.5h.01m2 4h.01"/></>,
  rewards: <><path d="M6 4h12v17l-6-3.5L6 21V4Z"/><path d="m12 7 1.2 2.5 2.8.4-2 1.9.5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-1.9 2.8-.4L12 7Z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.5 1.2c-.8 1.2-2.2 1.4-2.2 3m0 3h.01"/></>,
  account: <><circle cx="12" cy="8" r="3.5"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="m16 6 1.2 1.2L20 4.5"/></>,
  apps: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  admin: <><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  website: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18"/></>,
  sales: <><path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4m-18 5 9 4 9-4"/></>,
  workshop: <><path d="M14.5 5.5a5 5 0 0 0-6.3 6.3L3 17l4 4 5.2-5.2a5 5 0 0 0 6.3-6.3l-3 3-4-4 3-3Z"/></>,
  inventory: <><path d="m3 7 9 5 9-5-9-5-9 5Z"/><path d="M3 7v10l9 5 9-5V7m-9 5v10"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.8Z" transform="translate(-1 -1)"/></>,
};

/** Original Stakeys navigation pictograms: crisp custom line work for dock and drawer. */
export const StakeysAppIcon: React.FC<{ name: StakeysIconName; size?: number; className?: string }> = ({ name, size = 24, className }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>
);

/** A separate, modified login mark: a wheel and rising road inside a custom ST monogram. */
export const StakeysLoginMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 128 128" aria-label="Stakeys Cycles mark" role="img" className={className} fill="none">
    <defs><linearGradient id="stakeys-mark-green" x1="22" y1="12" x2="105" y2="118" gradientUnits="userSpaceOnUse"><stop stopColor="#B4FFCE"/><stop offset=".52" stopColor="#05C147"/><stop offset="1" stopColor="#008C3B"/></linearGradient></defs>
    <path d="M64 5 115 24v35c0 30-20 51-51 64C33 110 13 89 13 59V24L64 5Z" fill="#08120D" stroke="url(#stakeys-mark-green)" strokeWidth="4"/>
    <path d="M37 43c0-7 6-12 16-12 7 0 13 2 18 6l-7 9c-3-2-7-4-11-4-3 0-5 1-5 3 0 6 24 3 24 19 0 9-8 14-19 14-8 0-16-3-21-8l8-9c4 3 9 5 14 5 3 0 5-1 5-3 0-6-22-4-22-20Z" fill="url(#stakeys-mark-green)"/>
    <path d="m36 94 13-20m0 20 14-20m0 20 15-20m0 20 15-20" stroke="url(#stakeys-mark-green)" strokeWidth="3" strokeLinecap="round" opacity=".76"/>
    <circle cx="38" cy="101" r="8" stroke="url(#stakeys-mark-green)" strokeWidth="3"/><circle cx="91" cy="101" r="8" stroke="url(#stakeys-mark-green)" strokeWidth="3"/>
  </svg>
);
