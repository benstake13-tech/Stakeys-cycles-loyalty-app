import React, { useState } from 'react';
import {
  Award,
  Bike,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Wrench,
  Zap,
  ArrowRight,
  Shield,
  Sparkles,
  Flame,
  CheckCircle2,
  TrendingUp,
  Info,
  FileText,
  Activity,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { SegmentedTabs, SegmentedTab } from './SegmentedTabs';

import { StampCard } from './StampCard';
import { BookingPortal } from './BookingPortal';
import { WeeklyPrizeWheel } from './WeeklyPrizeWheel';
import { RepairInvoiceModal } from './RepairInvoiceModal';
import { CustomerRepairTracker } from './CustomerRepairTracker';
import { AiBikeIdentifier } from './AiBikeIdentifier';
import { MembershipPassCard } from './MembershipPassCard';
import { VehicleCategory, CustomerBike, ServiceBooking } from '../types/bikeShop';
import {
  POPULAR_BIKE_BRANDS,
  BRAND_MODELS_MAP,
  BIKE_CATEGORY_OPTIONS,
} from '../data/bikeCatalog';
import { scrapeBikeStockSpecs } from '../utils/bikeScraperService';

interface CustomerPortalProps {
  onStaffScanCustomer?: (membershipNumber: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onStaffScanCustomer }) => {
  const {
    currentUser,
    bookings,
    addCustomerBike,
    removeCustomerBike,
    saveBikeScrapedSpecs,
  } = useShop();

  const [activeTab, setActiveTab] = useState<'garage' | 'wheel' | 'booking' | 'bookings' | 'repairs' | 'stamps'>('garage');

  const [selectedBikeForBooking, setSelectedBikeForBooking] = useState<string | undefined>(undefined);
  const [viewingBikeSpecs, setViewingBikeSpecs] = useState<CustomerBike | null>(null);
  const [viewingCustomerInvoice, setViewingCustomerInvoice] = useState<ServiceBooking | null>(null);

  // Modal for adding a new bike to profile
  const [isAddBikeModalOpen, setIsAddBikeModalOpen] = useState(false);
  const [isAiIdentifierOpen, setIsAiIdentifierOpen] = useState(false);
  const [newBikeCategory, setNewBikeCategory] = useState<VehicleCategory>('cycle');
  const [newBikeBrand, setNewBikeBrand] = useState('Trek');
  const [newBikeModel, setNewBikeModel] = useState('FX 1 / 2 / 3 (Hybrid Commuter)');
  const [newBikeCustomModel, setNewBikeCustomModel] = useState('');
  const [newBikeColour, setNewBikeColour] = useState('');
  const [newBikeNotes, setNewBikeNotes] = useState('');
  const [isSavingBike, setIsSavingBike] = useState(false);

  // Guard: If not authenticated, return null AFTER declaring all hooks
  if (!currentUser) return null;

  // Scoped strictly to this customer
  const customerBikes = currentUser.bikes || [];
  const customerBookings = bookings.filter(
    (b) =>
      b.customerId === currentUser.uid ||
      b.customerEmail.toLowerCase() === currentUser.email.toLowerCase() ||
      (b.membershipNumber && b.membershipNumber === currentUser.membershipNumber)
  );


  const customerTabs: SegmentedTab<'garage' | 'wheel' | 'booking' | 'bookings' | 'repairs' | 'stamps'>[] = [
    { id: 'garage', label: `My Garage (${customerBikes.length})`, icon: Bike, tone: 'emerald', hint: 'Your registered bikes' },
    { id: 'wheel', label: 'Prize Wheel', icon: Sparkles, tone: 'amber', hint: 'Spin the weekly prize wheel' },
    { id: 'booking', label: 'Book Service', icon: Wrench, tone: 'emerald', hint: 'Book a workshop slot' },
    { id: 'repairs', label: `Repairs (${customerBookings.length})`, icon: Activity, tone: 'emerald', hint: 'Live repair progress tracker' },
    { id: 'bookings', label: `Bookings (${customerBookings.length})`, icon: Calendar, tone: 'emerald', hint: 'Your service bookings' },
    { id: 'stamps', label: `Loyalty Pass ${currentUser.stamps || 0}/10`, icon: Award, tone: 'emerald', hint: 'Your stamp card' },
  ];

  const handleStartBookingForBike = (bikeId: string) => {
    setSelectedBikeForBooking(bikeId);
    setActiveTab('booking');
  };

  const handleSaveNewBike = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBike(true);
    try {
      const finalModel =
        newBikeModel.includes('Other') && newBikeCustomModel.trim()
          ? newBikeCustomModel.trim()
          : newBikeModel;

      const catObj = BIKE_CATEGORY_OPTIONS.find((c) => c.id === newBikeCategory);

      const created = await addCustomerBike({
        category: newBikeCategory,
        categoryLabel: catObj ? catObj.title.split(' ')[0] : 'Bicycle',
        brand: newBikeBrand,
        model: finalModel,
        colour: newBikeColour.trim() || undefined,
        frameSizeOrNotes: newBikeNotes.trim() || undefined,
        healthStatus: 'healthy',
      });

      // Automatically scrape OEM stock parts for the customer's bike
      try {
        const scraped = await scrapeBikeStockSpecs(newBikeBrand, finalModel, undefined, newBikeCategory);
        if (scraped && created && created.id) {
          await saveBikeScrapedSpecs(currentUser.uid, created.id, scraped);
        }
      } catch {
        // ignore
      }

      setIsAddBikeModalOpen(false);
      setNewBikeColour('');
      setNewBikeNotes('');
      setNewBikeCustomModel('');
    } catch {
      // ignore
    } finally {
      setIsSavingBike(false);
    }
  };

  const getBikeImage = (category: VehicleCategory) => {
    if (category === 'electric_scooter') {
      return '/images/scooter_performance_studio_1790159785831.jpg';
    }
    return '/images/bike_precision_gravel_studio_1790159773368.jpg';
  };

  return (
    <div className="space-y-8 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. FRONT AND CENTRE: DIGITAL MEMBER PASS & BARCODE */}
      <MembershipPassCard user={currentUser} />

      {/* Editorial Hero Banner with High-Resolution Workshop Scrim */}
      <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-[#0d1015] shadow-2xl">
        {/* Background Workshop Image Asset */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_workshop_craftsmanship_1790159761910.jpg"
            alt="Stakey's cycle and scooter workshop atelier"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-30 filter saturate-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#090b0e] via-[#090b0e]/85 to-[#090b0e]/40" />
        </div>

        {/* Content Box */}
        <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            {/* Unboxed Zero-Pill Metadata */}
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-2">
              <span className="text-emerald-400 font-semibold tracking-wider uppercase">
                Member ID {currentUser.membershipNumber}
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>Workshop Atelier</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>Cytech Certified</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight text-balance">
              Welcome back, {currentUser.displayName}
            </h1>
            <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
              Your registered bikes, scheduled workshop repairs, and digital loyalty pass in one place.
            </p>
          </div>

          {/* Clean Tabular Figures Metrics Panel */}
          <div className="flex items-center gap-4 bg-[#090b0e]/80 backdrop-blur-md px-5 py-3.5 rounded-xl border border-neutral-800 shrink-0">
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">
                {customerBikes.length}
              </div>
              <div className="text-[11px] text-neutral-400 font-medium">Garage Bikes</div>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-[#05C147] tabular-nums">
                {currentUser.stamps || 0}<span className="text-xs text-neutral-500 font-normal">/10</span>
              </div>
              <div className="text-[11px] text-neutral-400 font-medium">Visit Stamps</div>
            </div>
            <div className="h-8 w-px bg-neutral-800" />
            <div className="text-left">
              <div className="font-mono text-2xl font-bold text-white tabular-nums">
                {customerBookings.length}
              </div>
              <div className="text-[11px] text-neutral-400 font-medium">Bookings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Stamps Alert Callout */}
      {(currentUser.stamps || 0) >= 10 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950 via-[#0d1e13] to-neutral-900 border-2 border-[#05C147] shadow-[0_0_20px_rgba(5,193,71,0.25)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-sm block">10/10 Stamps Full · Reward Ready to Collect!</span>
              <span className="text-xs text-emerald-200">
                You are eligible for a £40 service (labour only, parts not included).
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('wheel')}
            className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-md"
          >
            Press to Collect Reward
          </button>
        </div>
      )}

      {/* Primary section navigation */}
      <SegmentedTabs
        tabs={customerTabs}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Customer sections"
      />

      {/* TAB 1: MY REGISTERED BIKES (GARAGE) */}
      {activeTab === 'garage' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                My Registered Bikes &amp; Rides
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Every vehicle you add or service is recorded here with diagnostic health and quick 1-click booking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAiIdentifierOpen(true)}
                className="pressable px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Identify Bike with AI</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddBikeModalOpen(true)}
                className="pressable px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Manually</span>
              </button>
            </div>
          </div>

          {/* List of Bikes */}
          {customerBikes.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
                <Bike className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto">
                <h3 className="font-display text-base font-bold text-white">Your garage is currently empty</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Add your bike now or book a service — your ride details will be saved to your profile automatically.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBikeModalOpen(true)}
                  className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Add Your Bike
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('booking')}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Book Workshop Service
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {customerBikes.map((bike) => (
                <div
                  key={bike.id}
                  className="group rounded-2xl border border-neutral-800/80 hover:border-neutral-700 bg-[#0d1015] overflow-hidden transition-all shadow-lg flex flex-col justify-between"
                >
                  {/* Vehicle Studio Photography Showcase */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900">
                    <img
                      src={getBikeImage(bike.category)}
                      alt={`${bike.brand} ${bike.model}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1015] via-transparent to-black/20" />

                    {/* Unboxed Metadata in Overlay */}
                    <div className="absolute top-3 left-3 text-xs text-neutral-300 font-mono bg-black/60 backdrop-blur-md px-2.5 py-1 rounded">
                      <span>{bike.categoryLabel || bike.category.toUpperCase()}</span>
                    </div>

                    <div className="absolute top-3 right-3 text-xs">
                      {bike.healthStatus === 'in_workshop' ? (
                        <span className="text-sky-400 font-medium flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          In Workshop
                        </span>
                      ) : bike.healthStatus === 'due_service' ? (
                        <span className="text-amber-400 font-medium flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Service Recommended
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-medium flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Ready to Ride
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {bike.brand}
                      </div>
                      <h3 className="font-display text-lg font-bold text-white mt-0.5">
                        {bike.model}
                      </h3>

                      {/* Unboxed Details with Typographic Separators */}
                      <div className="mt-3 text-xs text-neutral-400 flex flex-wrap items-center gap-y-1 gap-x-2 border-t border-neutral-800/80 pt-3">
                        {bike.colour && (
                          <span>Colour: <strong className="text-neutral-200 font-normal">{bike.colour}</strong></span>
                        )}
                        {bike.colour && bike.lastServiceDate && (
                          <span aria-hidden="true" className="text-neutral-600">·</span>
                        )}
                        {bike.lastServiceDate && (
                          <span>Last Serviced: <strong className="text-emerald-400 font-mono font-normal">{bike.lastServiceDate}</strong></span>
                        )}
                        {bike.frameSizeOrNotes && (
                          <>
                            <span aria-hidden="true" className="text-neutral-600">·</span>
                            <span className="text-neutral-300">{bike.frameSizeOrNotes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* OEM Stock Specs & Upgrades Preview Strip */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                      <div>
                        {bike.stockSpecsScraped ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Stock Specs Scraped</span>
                            {bike.scrapedData && bike.scrapedData.detectedUpgradesCount > 0 && (
                              <span className="text-amber-400 font-bold ml-1">
                                ({bike.scrapedData.detectedUpgradesCount} Upgrades)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-400">
                            OEM stock spec verification
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setViewingBikeSpecs(bike)}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>Specs &amp; Upgrades</span>
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartBookingForBike(bike.id)}
                        className="flex-1 py-2 px-4 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Book Workshop Service</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeCustomerBike(bike.id)}
                        title="Remove bike from profile"
                        className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 border border-neutral-800 transition-colors cursor-pointer"
                        aria-label="Remove bike"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOK SERVICE */}
      {activeTab === 'booking' && (
        <BookingPortal
          initialBikeId={selectedBikeForBooking}
          onGoToMyBikes={() => setActiveTab('garage')}
        />
      )}

      {/* TAB 3: MY SERVICE BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                My Service Bookings
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Track active workshop repairs, technician notes, and completion history.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('booking')}
              className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs cursor-pointer transition-colors"
            >
              + New Booking
            </button>
          </div>

          {customerBookings.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
              <Wrench className="w-8 h-8 text-neutral-500 mx-auto" />
              <div className="font-display text-base font-bold text-white">No active workshop bookings</div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Need a tune-up, puncture repair, or brake check? Book online with our Cytech mechanics.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('booking')}
                className="mt-2 px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs cursor-pointer transition-colors"
              >
                Book Workshop Service
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] divide-y divide-neutral-800/80 overflow-hidden">
              {customerBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-neutral-900/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-mono text-emerald-400">#{b.id}</span>
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                      <span className="font-medium text-white">{b.vehicleModel}</span>
                    </div>
                    <div className="text-sm font-semibold text-neutral-200">
                      {b.serviceTitle}
                      {b.invoice ? (
                        <span className="ml-2 font-mono text-[#05C147] font-bold">
                          £{b.invoice.grandTotal.toFixed(2)}
                        </span>
                      ) : b.quotedPrice ? (
                        <div className="mt-2 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                          <span className="text-emerald-400 font-bold block">Estimated Quote: £{b.quotedPrice.toFixed(2)}</span>
                          <p className="text-neutral-300 italic">"{b.quoteNote}"</p>
                          <a
                            href={`https://wa.me/447911882910?text=${encodeURIComponent(`Hi Stakey's Cycles, regarding my booking #${b.id}. I have questions about the quote of £${b.quotedPrice.toFixed(2)} and would like to share more info/photos.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 px-3 py-1 bg-[#25D366] text-white rounded-lg font-bold text-[10px]"
                          >
                            Reply via WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span className="ml-2 font-mono text-amber-400 text-xs">
                          (Quote on inspection)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Drop-off: {b.preferredDate} ({b.preferredTimeSlot})</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <span className="text-xs font-mono font-medium text-neutral-300">
                      Status: <strong className="text-white uppercase font-normal">{b.status}</strong>
                    </span>
                    {b.invoice && (
                      <button
                        type="button"
                        onClick={() => setViewingCustomerInvoice(b)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Invoice ({b.invoice.invoiceNumber})</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: LIVE REPAIR PROGRESS TRACKER */}
      {activeTab === 'repairs' && (
        <CustomerRepairTracker
          initialBookingId={
            customerBookings.find(
              (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'declined'
            )?.id
          }
          onGoToBooking={() => setActiveTab('booking')}
        />
      )}

      {/* TAB: WEEKLY PRIZE WHEEL */}
      {activeTab === 'wheel' && (
        <WeeklyPrizeWheel
          onGoToStamps={() => setActiveTab('stamps')}
          onGoToBooking={() => setActiveTab('booking')}
        />
      )}

      {/* TAB 4: LOYALTY PASS & STAMPS */}
      {activeTab === 'stamps' && (
        <div className="space-y-6">
          {/* Quick link to Weekly Wheel */}
          <div className="p-4 rounded-xl bg-[#0d1015] border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">Earn Stamps Faster Every Week</h4>
                <p className="text-[11px] text-neutral-400">
                  Spin the Weekly Prize Wheel once every 7 days to win +1, +2, or +3 loyalty stamps!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('wheel')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>Spin Weekly Prize Wheel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-4">

              <div className="rounded-xl border border-neutral-800 bg-[#0d1015] p-4 text-center text-xs text-neutral-400">
                Present this digital pass at the till when visiting Stakey's Cycles to earn your daily visit stamp.
              </div>
            </div>

            <div className="lg:col-span-7">
              <StampCard user={currentUser} onGoToBooking={() => setActiveTab('booking')} />
            </div>
          </div>
        </div>
      )}

      {/* ADD BIKE MODAL */}
      {isAddBikeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Bike className="w-5 h-5 text-[#05C147]" />
                <span>Add Bike to Your Garage</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddBikeModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveNewBike} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Category
                </label>
                <select
                  value={newBikeCategory}
                  onChange={(e) => setNewBikeCategory(e.target.value as VehicleCategory)}
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="cycle">Standard Bicycle (Road / Mountain / Hybrid)</option>
                  <option value="ebike">Electric Bicycle (E-Bike)</option>
                  <option value="electric_scooter">Electric Scooter</option>
                  <option value="cargo">Kids / Cargo / Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Brand
                  </label>
                  <select
                    value={newBikeBrand}
                    onChange={(e) => {
                      const b = e.target.value;
                      setNewBikeBrand(b);
                      const models = BRAND_MODELS_MAP[b];
                      if (models && models.length > 0) {
                        setNewBikeModel(models[0]);
                      } else {
                        setNewBikeModel('Standard Model');
                      }
                    }}
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {POPULAR_BIKE_BRANDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Model
                  </label>
                  <select
                    value={newBikeModel}
                    onChange={(e) => setNewBikeModel(e.target.value)}
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {(BRAND_MODELS_MAP[newBikeBrand] || ['Standard Model', 'Other Model']).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newBikeModel.includes('Other') && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Custom Model Name
                  </label>
                  <input
                    type="text"
                    value={newBikeCustomModel}
                    onChange={(e) => setNewBikeCustomModel(e.target.value)}
                    placeholder="e.g. Vintage Sprint, Dual Hardtail"
                    className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Colour (Optional)
                </label>
                <input
                  type="text"
                  value={newBikeColour}
                  onChange={(e) => setNewBikeColour(e.target.value)}
                  placeholder="e.g. Matte Black, Deep Blue, Emerald Green"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Notes / Frame Size (Optional)
                </label>
                <input
                  type="text"
                  value={newBikeNotes}
                  onChange={(e) => setNewBikeNotes(e.target.value)}
                  placeholder="e.g. Size M, Shimano 105, fitted with rack"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBikeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-white font-medium text-xs cursor-pointer hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBike}
                  className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-semibold text-xs cursor-pointer transition-colors shadow-sm"
                >
                  {isSavingBike ? 'Saving...' : 'Save Bike to Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OEM Specs & Upgrades Modal for Customer */}
      {viewingBikeSpecs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                    OEM Factory Specification Sheet
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Verified
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {viewingBikeSpecs.brand} {viewingBikeSpecs.model}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                  Category: {viewingBikeSpecs.categoryLabel}
                  {viewingBikeSpecs.scrapedData?.frameMaterial ? ` • Frame: ${viewingBikeSpecs.scrapedData.frameMaterial}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingBikeSpecs(null)}
                className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Upgrades counter banner */}
            {viewingBikeSpecs.scrapedData?.detectedUpgradesCount ? (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{viewingBikeSpecs.scrapedData.detectedUpgradesCount} aftermarket upgrades</strong> identified from factory OEM build!
                  </span>
                </div>
                {viewingBikeSpecs.scrapedData.totalEstimatedUpgradeValue > 0 && (
                  <span className="font-mono font-bold text-emerald-300 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                    +£{viewingBikeSpecs.scrapedData.totalEstimatedUpgradeValue} added value
                  </span>
                )}
              </div>
            ) : null}

            {/* Component list */}
            {viewingBikeSpecs.scrapedData?.components && viewingBikeSpecs.scrapedData.components.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-400">
                  Component Breakdown:
                </div>
                <div className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950">
                  {viewingBikeSpecs.scrapedData.components.map((c) => (
                    <div key={c.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                            {c.category}
                          </span>
                          <span className="font-semibold text-white">{c.componentName}</span>
                          {c.isUpgraded && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Upgraded
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-300 mt-1 font-mono text-[11px]">
                          {c.currentPart}
                        </div>
                        {c.isUpgraded && (
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Original Factory Stock: {c.stockOEM}
                          </div>
                        )}
                      </div>
                      {c.isUpgraded && c.estimatedUpgradeValue ? (
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          +£{c.estimatedUpgradeValue}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-neutral-500">
                          Factory OEM
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center text-neutral-400 text-xs">
                Detailed specs pending staff workshop intake scan.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingBikeSpecs(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Close Specs Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Invoice Modal for Customer */}
      {viewingCustomerInvoice && viewingCustomerInvoice.invoice && (
        <RepairInvoiceModal
          invoice={viewingCustomerInvoice.invoice}
          booking={viewingCustomerInvoice}
          isOpen={!!viewingCustomerInvoice}
          onClose={() => setViewingCustomerInvoice(null)}
          isStaff={false}
        />
      )}

      {/* AI Bike Identifier — photo to garage */}
      <AiBikeIdentifier
        user={currentUser}
        isOpen={isAiIdentifierOpen}
        onClose={() => setIsAiIdentifierOpen(false)}
        addBike={undefined}
        onAdded={(bike: CustomerBike) => setViewingBikeSpecs(bike)}
      />
    </div>
  );
};
