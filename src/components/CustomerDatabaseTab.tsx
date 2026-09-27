import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Wrench,
  Bike,
  Sparkles,
  Ticket,
  Award,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  Copy,
  Check,
  Edit3,
  RotateCcw,
  Zap,
  Shield,
  Layers,
  ChevronRight,
  X,
  SlidersHorizontal,
  Trash2,
  Minus,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, StampLog } from '../types/bikeShop';
import { canCustomerReceiveStampToday } from '../api/firebaseService';
import { StakeysLogo } from './StakeysLogo';

interface CustomerDatabaseTabProps {
  onSelectForScanner?: (customer: UserProfile) => void;
}

export const CustomerDatabaseTab: React.FC<CustomerDatabaseTabProps> = ({
  onSelectForScanner,
}) => {
  const {
    currentUser,
    users,
    stampLogs,
    addStamp,
    updateCustomerMerits,
    createCustomerByStaff,
    deleteCustomerAccount,
    adjustCustomerStamps,
  } = useShop();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reward_ready' | 'has_tickets' | 'has_bikes' | 'eligible_today'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stamps_desc' | 'tickets_desc' | 'merits_desc' | 'membership'>('name');

  // Modals
  const [editingCustomer, setEditingCustomer] = useState<UserProfile | null>(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Action toast / feedback
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const staffId = currentUser?.uid || 'staff-stakey';

  // Only customers in database
  const customers = useMemo(() => {
    return users.filter((u) => u.role === 'customer');
  }, [users]);

  // Total metrics
  const totalStamps = customers.reduce((sum, c) => sum + (c.stamps || 0), 0);
  const totalTickets = customers.reduce((sum, c) => sum + (c.tickets || 0), 0);
  const totalMerits = customers.reduce((sum, c) => sum + (c.merits || 0), 0);
  const rewardReadyCount = customers.filter((c) => (c.stamps || 0) >= 10).length;

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return customers.filter((cust) => {
      // Search matching
      const matchesSearch =
        !q ||
        cust.displayName.toLowerCase().includes(q) ||
        cust.email.toLowerCase().includes(q) ||
        cust.membershipNumber.toLowerCase().includes(q) ||
        (cust.phoneNumber && cust.phoneNumber.toLowerCase().includes(q)) ||
        (cust.bikes && cust.bikes.some((b) => `${b.brand} ${b.model}`.toLowerCase().includes(q)));

      if (!matchesSearch) return false;

      // Filter matching
      if (statusFilter === 'reward_ready') {
        return (cust.stamps || 0) >= 10;
      }
      if (statusFilter === 'has_tickets') {
        return (cust.tickets || 0) > 0;
      }
      if (statusFilter === 'has_bikes') {
        return cust.bikes && cust.bikes.length > 0;
      }
      if (statusFilter === 'eligible_today') {
        return canCustomerReceiveStampToday(cust).allowed;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'stamps_desc') {
        return (b.stamps || 0) - (a.stamps || 0);
      }
      if (sortBy === 'tickets_desc') {
        return (b.tickets || 0) - (a.tickets || 0);
      }
      if (sortBy === 'merits_desc') {
        return (b.merits || 0) - (a.merits || 0);
      }
      if (sortBy === 'membership') {
        return a.membershipNumber.localeCompare(b.membershipNumber);
      }
      return 0;
    });
  }, [customers, searchQuery, statusFilter, sortBy]);

  const handleCopyId = (memId: string) => {
    navigator.clipboard.writeText(memId);
    setCopiedId(memId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickAddStamp = async (cust: UserProfile) => {
    const res = await addStamp(cust.uid, staffId, true);
    setFeedback({
      success: res.success,
      message: res.message,
    });
  };

  const handleQuickAddTicket = async (cust: UserProfile) => {
    const res = await updateCustomerMerits(cust.uid, staffId, {
      tickets: (cust.tickets || 0) + 1,
      staffNote: 'Quick +1 Prize Draw ticket awarded by staff',
    });
    setFeedback({
      success: res.success,
      message: res.message,
    });
  };

  const handleQuickMinusStamp = async (cust: UserProfile) => {
    if ((cust.stamps || 0) <= 0) return;
    const res = await adjustCustomerStamps(cust.uid, -1, 'Staff manual correction: -1 stamp');
    setFeedback({
      success: res.success,
      message: res.message,
    });
  };

  const handleDeleteCustomer = async (cust: UserProfile) => {
    if (confirm(`Are you sure you want to delete customer account "${cust.displayName}" (${cust.membershipNumber})? This cannot be undone.`)) {
      const res = await deleteCustomerAccount(cust.uid);
      setFeedback({
        success: res.success,
        message: res.message,
      });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Banner & Metrics Bar */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1.5">
            <Users className="w-4 h-4 text-[#05C147]" />
            <span className="font-semibold tracking-wider uppercase">Staff Till &amp; Directory</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Manual Merit Controls</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight">
            Customer Directory &amp; Merits Database
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Locate registered customer records, inspect loyalty cards, and manually adjust visit stamps, prize draw tickets, and store merits.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewCustomerModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/15 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register Walk-In Customer</span>
        </button>
      </div>

      {/* Aggregate Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0d1015] border border-neutral-800/80 rounded-xl p-4">
          <div className="text-[11px] font-medium text-neutral-400">Total Customers</div>
          <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {customers.length}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Active passes</div>
        </div>

        <div className="bg-[#0d1015] border border-neutral-800/80 rounded-xl p-4">
          <div className="text-[11px] font-medium text-neutral-400">Active Stamps</div>
          <div className="font-mono text-2xl font-bold text-[#05C147] tabular-nums mt-1">
            {totalStamps}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">In circulation</div>
        </div>

        <div className="bg-[#0d1015] border border-neutral-800/80 rounded-xl p-4">
          <div className="text-[11px] font-medium text-neutral-400">Prize Tickets</div>
          <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
            {totalTickets}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Draw entries</div>
        </div>

        <div className="bg-[#0d1015] border border-neutral-800/80 rounded-xl p-4">
          <div className="text-[11px] font-medium text-neutral-400">Full Cards (10/10)</div>
          <div className="font-mono text-2xl font-bold text-purple-400 tabular-nums mt-1">
            {rewardReadyCount}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Reward ready</div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            feedback.success
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search, Filter & Controls Bar */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, member ID (e.g. STK-839201), phone, or bike..."
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#05C147] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-neutral-900">All Customers</option>
                <option value="reward_ready" className="bg-neutral-900">Reward Ready (10 Stamps)</option>
                <option value="has_tickets" className="bg-neutral-900">Has Prize Tickets</option>
                <option value="has_bikes" className="bg-neutral-900">Has Garage Bikes</option>
                <option value="eligible_today" className="bg-neutral-900">Eligible for Stamp Today</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="name" className="bg-neutral-900">Sort by Name</option>
                <option value="stamps_desc" className="bg-neutral-900">Most Stamps</option>
                <option value="tickets_desc" className="bg-neutral-900">Most Tickets</option>
                <option value="merits_desc" className="bg-neutral-900">Most Merits</option>
                <option value="membership" className="bg-neutral-900">Member ID</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Query Status Indicator */}
        <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1">
          <span>
            Showing <strong className="text-white">{filteredCustomers.length}</strong> of{' '}
            <strong className="text-neutral-300">{customers.length}</strong> customer records
          </span>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Customer Records Table / Card Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-12 text-center">
          <Users className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Customers Found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
            No customer accounts matched your search "{searchQuery}".
          </p>
          <button
            type="button"
            onClick={() => setShowNewCustomerModal(true)}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
          >
            Create New Customer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((cust) => {
            const rateStatus = canCustomerReceiveStampToday(cust);
            const stamps = cust.stamps || 0;
            const tickets = cust.tickets || 0;
            const merits = cust.merits || 0;
            const bikes = cust.bikes || [];

            return (
              <div
                key={cust.uid}
                className="bg-[#0d1015] border border-neutral-800 hover:border-neutral-700/80 rounded-2xl p-5 sm:p-6 transition-all shadow-md group flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
              >
                {/* Left: Customer Identity & Contact */}
                <div className="flex items-start gap-4 min-w-[280px]">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-emerald-500/30 flex items-center justify-center font-bold text-sm text-emerald-400 shadow-md shrink-0">
                    {cust.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm sm:text-base">
                        {cust.displayName}
                      </span>

                      {/* Click to Copy Member ID */}
                      <button
                        type="button"
                        onClick={() => handleCopyId(cust.membershipNumber)}
                        title="Click to copy member ID"
                        className="font-mono text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>{cust.membershipNumber}</span>
                        {copiedId === cust.membershipNumber ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-emerald-400/60" />
                        )}
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 text-neutral-300">
                        <Mail className="w-3 h-3 text-neutral-500" />
                        {cust.email}
                      </span>
                      {cust.phoneNumber && (
                        <span className="flex items-center gap-1 text-neutral-400">
                          <Phone className="w-3 h-3 text-neutral-500" />
                          {cust.phoneNumber}
                        </span>
                      )}
                    </div>

                    {/* Registered Bikes */}
                    {bikes.length > 0 && (
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 pt-0.5">
                        <Bike className="w-3.5 h-3.5 text-neutral-500" />
                        <span>
                          {bikes.map((b) => `${b.brand} ${b.model}`).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle: Merits & Loyalty Balances */}
                <div className="flex flex-wrap items-center gap-4 bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800/80">
                  {/* Stamps Metric */}
                  <div className="text-left min-w-[100px]">
                    <div className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                      Visit Stamps
                    </div>
                    <div className="font-mono text-lg font-bold text-white flex items-baseline gap-1 mt-0.5">
                      <span className={stamps >= 10 ? 'text-purple-400' : 'text-[#05C147]'}>
                        {stamps}
                      </span>
                      <span className="text-xs text-neutral-500">/10</span>
                      {stamps >= 10 && (
                        <span className="text-[10px] text-purple-400 font-bold ml-1">
                          REWARD
                        </span>
                      )}
                    </div>
                    {/* 10-stamp miniature progress pips */}
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-1.5 rounded-sm ${
                            i < stamps
                              ? stamps >= 10
                                ? 'bg-purple-400'
                                : 'bg-[#05C147]'
                              : 'bg-neutral-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-8 bg-neutral-800 hidden sm:block" />

                  {/* Prize Draw Tickets */}
                  <div className="text-left min-w-[80px]">
                    <div className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider flex items-center gap-1">
                      <Ticket className="w-3 h-3 text-amber-400" />
                      <span>Tickets</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-amber-400 tabular-nums mt-0.5">
                      {tickets}
                    </div>
                    <div className="text-[10px] text-neutral-500">Draw entries</div>
                  </div>

                  <div className="w-px h-8 bg-neutral-800 hidden sm:block" />

                  {/* Store Merits */}
                  <div className="text-left min-w-[80px]">
                    <div className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>Merits</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                      {merits}
                    </div>
                    <div className="text-[10px] text-neutral-500">Loyalty pts</div>
                  </div>

                  <div className="w-px h-8 bg-neutral-800 hidden sm:block" />

                  {/* Stamp Rate Limit Status */}
                  <div className="text-left">
                    <div className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                      Stamp Status
                    </div>
                    <div className="text-xs font-semibold mt-0.5">
                      {rateStatus.allowed ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Eligible Today
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1" title={rateStatus.reason}>
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Stamped Today
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
                  {/* Manual Merit & Profile Editor */}
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(cust)}
                    className="px-3 py-2 rounded-xl bg-neutral-850 hover:bg-neutral-800 border border-neutral-700/80 hover:border-emerald-500/50 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Edit Merits</span>
                  </button>

                  {/* Quick +1 Stamp */}
                  <button
                    type="button"
                    onClick={() => handleQuickAddStamp(cust)}
                    title="Add 1 visit stamp right now"
                    className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-500 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>+1 Stamp</span>
                  </button>

                  {/* Quick -1 Stamp */}
                  <button
                    type="button"
                    onClick={() => handleQuickMinusStamp(cust)}
                    disabled={(cust.stamps || 0) <= 0}
                    title="Correct accidental stamp (-1 stamp)"
                    className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  {/* Quick +1 Ticket */}
                  <button
                    type="button"
                    onClick={() => handleQuickAddTicket(cust)}
                    title="Add 1 prize draw ticket"
                    className="px-2.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-amber-500/30 hover:border-amber-500 text-amber-400 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>+1</span>
                  </button>

                  {/* Delete Customer Account */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(cust)}
                    title="Delete customer loyalty account"
                    className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/60 hover:border-rose-700 text-rose-400 hover:text-rose-200 text-xs transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Send to Scanner */}
                  {onSelectForScanner && (
                    <button
                      type="button"
                      onClick={() => onSelectForScanner(cust)}
                      title="Load this customer into till scanner"
                      className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white text-xs transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Merits Editor Modal */}
      {editingCustomer && (
        <EditMeritsModal
          customer={editingCustomer}
          staffId={staffId}
          onClose={() => setEditingCustomer(null)}
          onSuccess={(updated, msg) => {
            setFeedback({ success: true, message: msg });
            setEditingCustomer(null);
          }}
          customerAuditLogs={stampLogs.filter((l) => l.customerId === editingCustomer.uid)}
        />
      )}

      {/* New Customer Walk-in Modal */}
      {showNewCustomerModal && (
        <NewCustomerModal
          staffId={staffId}
          onClose={() => setShowNewCustomerModal(false)}
          onSuccess={(newCust, msg) => {
            setFeedback({ success: true, message: msg });
            setShowNewCustomerModal(false);
          }}
        />
      )}
    </div>
  );
};

/* ========================================================================= */
/* EDIT MERITS & PROFILE MODAL                                               */
/* ========================================================================= */
interface EditMeritsModalProps {
  customer: UserProfile;
  staffId: string;
  onClose: () => void;
  onSuccess: (updated: UserProfile, message: string) => void;
  customerAuditLogs: StampLog[];
}

const EditMeritsModal: React.FC<EditMeritsModalProps> = ({
  customer,
  staffId,
  onClose,
  onSuccess,
  customerAuditLogs,
}) => {
  const { updateCustomerMerits } = useShop();

  // Form State
  const [stamps, setStamps] = useState<number>(customer.stamps || 0);
  const [tickets, setTickets] = useState<number>(customer.tickets || 0);
  const [merits, setMerits] = useState<number>(customer.merits || 0);

  const [displayName, setDisplayName] = useState(customer.displayName);
  const [email, setEmail] = useState(customer.email);
  const [phoneNumber, setPhoneNumber] = useState(customer.phoneNumber || '');

  const [resetRateLimit, setResetRateLimit] = useState(false);
  const [resetSpinCooldown, setResetSpinCooldown] = useState(false);
  const [staffNote, setStaffNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (stamps < 0 || stamps > 10) {
      setError('Visit stamps must be between 0 and 10.');
      return;
    }
    if (tickets < 0) {
      setError('Prize tickets cannot be negative.');
      return;
    }
    if (merits < 0) {
      setError('Store merits cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateCustomerMerits(customer.uid, staffId, {
        stamps,
        tickets,
        merits,
        displayName: displayName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        resetDailyRateLimit: resetRateLimit,
        resetSpinCooldown: resetSpinCooldown,
        staffNote: staffNote.trim() || undefined,
      });

      if (res.success && res.customer) {
        onSuccess(res.customer, res.message);
      } else {
        setError(res.message || 'Failed to update merits.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating merits.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-neutral-900 border border-neutral-700/90 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-900 border border-emerald-500/40 text-emerald-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Manual Merit Adjustment</span>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                  {customer.membershipNumber}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Adjusting balances for <strong className="text-neutral-200">{customer.displayName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Merits & Loyalty Balances */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 sm:p-5 space-y-5">
            <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              <span>Loyalty Merits &amp; Balances</span>
            </h4>

            {/* Visit Stamps (0 - 10) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#05C147]" />
                  <span>Visit Stamps (0 to 10)</span>
                </label>
                <span className="font-mono text-xs text-neutral-400">
                  Current in pass: <strong className="text-white">{stamps} / 10</strong>
                </span>
              </div>

              {/* 10-Stamp Interactive Visualizer */}
              <div className="grid grid-cols-10 gap-1.5 mb-3 bg-neutral-900/80 p-2.5 rounded-xl border border-neutral-800">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStamps(i + 1)}
                    className={`h-8 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      i < stamps
                        ? stamps >= 10
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-[#05C147] text-neutral-950 shadow-md'
                        : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {/* Stamp Controls & Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden bg-neutral-900">
                  <button
                    type="button"
                    onClick={() => setStamps((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 text-sm font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={stamps}
                    onChange={(e) => setStamps(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                    className="w-12 text-center bg-transparent text-white font-mono text-xs font-bold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setStamps((prev) => Math.min(10, prev + 1))}
                    className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStamps(0)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-semibold cursor-pointer"
                >
                  Reset (0)
                </button>
                <button
                  type="button"
                  onClick={() => setStamps(10)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                >
                  Full Card (10 - Eligible for £40 Service)
                </button>
              </div>
            </div>

            {/* Collected Service Vouchers */}
            {customer.serviceVouchers && customer.serviceVouchers.length > 0 && (
              <div className="pt-2 border-t border-neutral-850">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5 mb-2">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Collected Service Vouchers &amp; Rewards</span>
                </label>
                <div className="space-y-1.5">
                  {customer.serviceVouchers.map((v) => (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white block">{v.title}</span>
                        <span className="text-[11px] text-neutral-400">
                          {v.terms || 'Eligible for £40 service (labour only, parts not included)'}
                        </span>
                        <span className="font-mono text-emerald-400 text-[11px] block">
                          Code: {v.code}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          v.status === 'available'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prize Draw Tickets */}
            <div className="pt-2 border-t border-neutral-850">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prize Draw Tickets / Merits</span>
                </label>
                <span className="font-mono text-xs text-amber-400 tabular-nums">
                  {tickets} Tickets
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden bg-neutral-900">
                  <button
                    type="button"
                    onClick={() => setTickets((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 text-sm font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={tickets}
                    onChange={(e) => setTickets(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 text-center bg-transparent text-white font-mono text-xs font-bold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTickets((prev) => prev + 1)}
                    className="px-3 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 text-sm font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTickets((prev) => prev + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer"
                >
                  +1 Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setTickets((prev) => prev + 5)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-[11px] font-semibold cursor-pointer"
                >
                  +5 Tickets
                </button>
                <button
                  type="button"
                  onClick={() => setTickets(0)}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-[11px] font-semibold cursor-pointer"
                >
                  Clear (0)
                </button>
              </div>
            </div>

            {/* Store Loyalty Merits / Points */}
            <div className="pt-2 border-t border-neutral-850">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Store Loyalty Merits (Bonus Points)</span>
                </label>
                <span className="font-mono text-xs text-emerald-400 tabular-nums">
                  {merits} pts
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={merits}
                  onChange={(e) => setMerits(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setMerits((prev) => prev + 50)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                >
                  +50 Merits
                </button>
                <button
                  type="button"
                  onClick={() => setMerits((prev) => prev + 100)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                >
                  +100 Merits
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Rate Limit & Cooldown Overrides */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Cooldown &amp; Till Overrides</span>
            </h4>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-neutral-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={resetRateLimit}
                  onChange={(e) => setResetRateLimit(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-[#05C147] focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>
                  <strong>Clear Today's Stamp Rate Limit</strong> (allows customer to receive an extra stamp immediately today)
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-neutral-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={resetSpinCooldown}
                  onChange={(e) => setResetSpinCooldown(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-700 text-[#05C147] focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>
                  <strong>Reset Weekly Prize Wheel Cooldown</strong> (permits customer to spin the roulette wheel right now)
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Profile Contact Details */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Customer Contact Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +44 7911 123456"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Audit Trail Note */}
          <div>
            <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
              Staff Adjustment Reason (Audit Log)
            </label>
            <input
              type="text"
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              placeholder="e.g. Counter purchase bonus, goodwill credit for service delay, or till correction"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Section 5: Recent Audit History for this customer */}
          {customerAuditLogs.length > 0 && (
            <div className="pt-2">
              <h5 className="text-[11px] font-mono uppercase text-neutral-400 tracking-wider mb-2">
                Recent Audit Trail ({customerAuditLogs.length} entries)
              </h5>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {customerAuditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-300 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-semibold text-white">{log.note || log.action}</span>
                      <div className="text-[10px] text-neutral-500">
                        By {log.staffName || 'Staff'} · {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {log.stampsAfter !== undefined && (
                      <span className="font-mono text-emerald-400 shrink-0">
                        {log.stampsAfter} stamps
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Merit Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* REGISTER NEW WALK-IN CUSTOMER MODAL                                       */
/* ========================================================================= */
interface NewCustomerModalProps {
  staffId: string;
  onClose: () => void;
  onSuccess: (newCust: UserProfile, message: string) => void;
}

const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  staffId,
  onClose,
  onSuccess,
}) => {
  const { createCustomerByStaff } = useShop();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [initialStamps, setInitialStamps] = useState<number>(1);
  const [initialTickets, setInitialTickets] = useState<number>(0);
  const [initialMerits, setInitialMerits] = useState<number>(50);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim() || !email.trim()) {
      setError('Please provide customer name and email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCustomerByStaff(
        {
          displayName: displayName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim() || undefined,
          stamps: initialStamps,
          tickets: initialTickets,
          merits: initialMerits,
        },
        staffId
      );

      if (res.success && res.customer) {
        onSuccess(res.customer, res.message);
      } else {
        setError(res.message || 'Failed to create customer pass.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating pass.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-neutral-900 border border-neutral-700/90 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-900 border border-emerald-500/40 text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Register Walk-in Customer</h3>
              <p className="text-xs text-neutral-400">Creates digital pass at the till</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRegister} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Customer Full Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sam Davies"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sam.davies@example.com"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +44 7911 234567"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800">
            <div>
              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                Start Stamps
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={initialStamps}
                onChange={(e) => setInitialStamps(parseInt(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                Start Tickets
              </label>
              <input
                type="number"
                min="0"
                value={initialTickets}
                onChange={(e) => setInitialTickets(parseInt(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                Start Merits
              </label>
              <input
                type="number"
                min="0"
                value={initialMerits}
                onChange={(e) => setInitialMerits(parseInt(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Pass...' : 'Create Customer Pass'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
