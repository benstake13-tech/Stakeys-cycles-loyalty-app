import React from 'react';
import { Bike, CalendarDays, LogOut, ShieldCheck, Tag, Wrench, UserRoundX } from 'lucide-react';
import { APP_EDITION } from '../appEdition';
import { UserProfile } from '../types/bikeShop';
import { CustomerPortal } from './CustomerPortal';
import { StaffPortal } from './StaffPortal';
import { BookingPortal } from './BookingPortal';
import { PromotionsCarousel } from './PromotionsCarousel';
import { WinnerAnnouncementBanner } from './WinnerAnnouncementBanner';
import { StakeysLogo } from './StakeysLogo';
import { ThemeToggle } from './ThemeToggle';

type CustomerScreen = 'customer' | 'booking' | 'promotions';

interface MobileEditionShellProps {
  currentUser: UserProfile;
  logoutUser: () => void;
  theme: string;
  activeTab: CustomerScreen;
  setActiveTab: (tab: CustomerScreen) => void;
}

/**
 * Two distinct Android products share backend and components, not entrypoints.
 * Real authorization still happens in Supabase; edition routing is presentation only.
 */
export const MobileEditionShell: React.FC<MobileEditionShellProps> = ({
  currentUser,
  logoutUser,
  theme,
  activeTab,
  setActiveTab,
}) => {
  const isStaff = currentUser.role === 'staff' || currentUser.role === 'admin';
  const isStaffEdition = APP_EDITION === 'staff';
  const authorized = isStaffEdition ? isStaff : !isStaff;
  const isDark = theme === 'dark';

  const tabs: { id: CustomerScreen; label: string; icon: React.ElementType }[] = [
    { id: 'customer', label: 'My garage', icon: Bike },
    { id: 'booking', label: 'Book repair', icon: CalendarDays },
    { id: 'promotions', label: 'Offers', icon: Tag },
  ];

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0a1012] text-white flex items-center justify-center p-8">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-[#10191a] p-8 text-center space-y-4">
          <UserRoundX className="h-10 w-10 mx-auto text-amber-400" />
          <h1 className="font-display font-bold text-xl">This is the {isStaffEdition ? 'staff' : 'customer'} app</h1>
          <p className="text-sm text-neutral-300">This account needs the matching Stakey's Cycles app to continue.</p>
          <button type="button" onClick={logoutUser} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-neutral-950">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-['Plus_Jakarta_Sans',sans-serif] ${isDark ? 'bg-[#090e11] text-white' : 'bg-slate-50 text-neutral-900'}`}>
      <WinnerAnnouncementBanner />
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${isDark ? 'bg-[#090e11]/95 border-white/10' : 'bg-white/95 border-neutral-200'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[70px] flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl border border-emerald-500/35 bg-[#121e19]">
              <StakeysLogo className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <div className={`font-display text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>STAKEY'S <span className="text-emerald-400">CYCLES</span></div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                {isStaffEdition ? 'Workshop staff' : 'Your loyalty club'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle showLabel={false} />
            <button type="button" onClick={logoutUser} aria-label="Sign out" title="Sign out"
              className="h-10 w-10 rounded-xl flex items-center justify-center border border-white/10 bg-neutral-800/60 text-neutral-300 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-emerald-400">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-28 sm:pb-12">
        {isStaffEdition ? (
          <>
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Staff terminal · {currentUser.displayName}
            </div>
            <StaffPortal />
          </>
        ) : (
          <>
            {activeTab === 'customer' && <CustomerPortal />}
            {activeTab === 'booking' && <BookingPortal />}
            {activeTab === 'promotions' && <PromotionsCarousel />}
          </>
        )}
      </main>

      {!isStaffEdition && (
        <nav aria-label="Customer app navigation"
          className={`fixed z-50 inset-x-0 bottom-0 border-t backdrop-blur-xl pb-[env(safe-area-inset-bottom)] ${isDark ? 'border-white/10 bg-[#0b1414]/95' : 'border-neutral-200 bg-white/95'}`}>
          <div className="max-w-xl mx-auto grid grid-cols-3 gap-1 px-3 py-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const selected = activeTab === id;
              return (
                <button type="button" key={id} onClick={() => setActiveTab(id)} aria-current={selected ? 'page' : undefined}
                  className={`min-h-14 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${selected ? 'bg-emerald-500/15 text-emerald-400' : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {isStaffEdition && (
        <footer className="border-t border-white/10 text-center text-[11px] text-neutral-500 p-4 flex items-center justify-center gap-2">
          <Wrench className="h-3.5 w-3.5" /> Authorized Stakey's Cycles workshop access
        </footer>
      )}
    </div>
  );
};
