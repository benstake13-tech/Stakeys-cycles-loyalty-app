import React, { useState } from 'react';
import { DatabaseZap, ShieldCheck, Server, KeyRound, HardDriveDownload } from 'lucide-react';
import { ServiceStatusBadge } from './ServiceStatusBadge';
import { BackendRepairModal } from './BackendRepairModal';
import { StaffAccountsSetupModal } from './StaffAccountsSetupModal';
import { useShop } from '../context/ShopContext';

/**
 * Backend & Supabase console.
 *
 * All of the connection banners, schema-drift visuals and setup actions used to
 * sit at the top of the Staff Station where they competed with the day-to-day
 * till/booking work. They now live here, in their own tab, so admin tooling is
 * available on demand instead of always on screen.
 */
export const StaffBackendTab: React.FC = () => {
  const { serviceStatus } = useShop();
  const [isBackendRepairOpen, setIsBackendRepairOpen] = useState(false);
  const [isStaffAccountsSetupOpen, setIsStaffAccountsSetupOpen] = useState(false);

  const online = serviceStatus.isOnline;

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
              <span className="text-sky-400 font-semibold tracking-wider uppercase">Backend Console</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>{online ? 'Connected' : 'Setup required'}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Server className="w-7 h-7 text-sky-400" /> Supabase &amp; Database
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Connection health, schema audit and repair tooling. Kept out of the day-to-day workstation so it
              never distracts front-desk or bench work — everything backend lives here.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setIsBackendRepairOpen(true)}
            className="pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-400 to-fuchsia-500 text-neutral-950 text-xs font-bold shadow-md shadow-sky-500/20 cursor-pointer"
            title="Audit the live schema, re-link the app bridge and copy the one-shot sync & repair SQL — then reconnect"
          >
            <DatabaseZap className="w-4 h-4" />
            <span>Sync &amp; Repair Backend</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStaffAccountsSetupOpen(true)}
            className="pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-neutral-950 text-xs font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
            title="Install the staff-account functions from the migration SQL"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Set Up Staff Accounts</span>
          </button>
        </div>
      </div>

      {/* Live connection banner + modal (Supabase / PocketBase status) */}
      <ServiceStatusBadge variant="full" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound className="w-4 h-4 text-emerald-400" /> Credentials
          </div>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            The project URL and anon API key are stored on this device and used to reach Supabase directly.
            Use <strong className="text-neutral-200">Connect &amp; Setup SQL</strong> in the banner above to
            change them or copy the one-shot setup script.
          </p>
        </div>

        <div className="bg-[#0e1217] border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <HardDriveDownload className="w-4 h-4 text-amber-400" /> Schema drift
          </div>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            When the live database is missing a column the app writes, features fail silently. Run
            <strong className="text-neutral-200"> Sync &amp; Repair Backend</strong> to audit the schema and
            generate the repair SQL, then run the Test Bench to confirm each feature.
          </p>
        </div>
      </div>

      {isBackendRepairOpen && <BackendRepairModal onClose={() => setIsBackendRepairOpen(false)} />}
      {isStaffAccountsSetupOpen && (
        <StaffAccountsSetupModal onClose={() => setIsStaffAccountsSetupOpen(false)} />
      )}
    </div>
  );
};
