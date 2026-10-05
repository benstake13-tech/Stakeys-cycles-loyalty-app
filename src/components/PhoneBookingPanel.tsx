import React, { useMemo, useState } from 'react';
import {
  Phone,
  PhoneCall,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Bike,
  Zap,
  ChevronDown,
  ClipboardList,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { VehicleCategory, BikeDetails, UserProfile } from '../shared/types/bikeShop';
import { BIKE_CATEGORY_OPTIONS, FRIENDLY_SERVICE_OPTIONS, TIME_SLOT_OPTIONS } from '../shared/data/bikeCatalog';
import { MAINTENANCE_PACKAGES } from '../shared/data/maintenancePackages';
import {
  BikeIdentityFields,
  BikeIdentityValue,
  EMPTY_BIKE_IDENTITY,
  toBikeDetails,
  resolveModel,
} from './BikeIdentityFields';
import { ALL_BIKE_ISSUES_MAP } from '../shared/data/bikeIssuesCatalog';

/** The call-handling script a staff member reads from while booking on the phone. */
const CALL_SCRIPT: { title: string; lines: string[] }[] = [
  {
    title: 'Open the call',
    lines: [
      '"Good morning/afternoon, Stakey\'s Cycles, this is [your name] — how can I help?"',
      'Note the customer\'s name and the best callback number straight away.',
    ],
  },
  {
    title: 'Identify the rider & bike',
    lines: [
      'Ask if they are an existing loyalty member. If so, search their name, email or membership number below.',
      'Capture the bike: type, brand, model, colour and (for e-bikes) the motor/battery setup.',
    ],
  },
  {
    title: 'Understand the problem',
    lines: [
      'Ask "What is the bike doing, and when did it start?" — pick the closest service below.',
      'Ask whether the bike is safe to ride; if not, advise them to stop riding and book in.',
    ],
  },
  {
    title: 'Agree a drop-off',
    lines: [
      'Offer the next available slot and confirm the day and time window.',
      'Confirm they will bring any battery key / charger for e-bikes.',
    ],
  },
  {
    title: 'Confirm & close',
    lines: [
      'Read back: name, number, bike, service and drop-off slot.',
      'Tell them a confirmation email will follow, and the final price is confirmed on inspection.',
      'Submit the booking below — it goes into the same workshop queue as online bookings.',
    ],
  },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const fieldCls =
  'w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-xs font-semibold text-neutral-300 mb-1.5';

export const PhoneBookingPanel: React.FC = () => {
  const { users, createBooking } = useShop();

  // Member lookup
  const [memberQuery, setMemberQuery] = useState('');
  const [matchedMember, setMatchedMember] = useState<UserProfile | null>(null);

  // Caller details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Bike
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('cycle');
  const [bikeIdentity, setBikeIdentity] = useState<BikeIdentityValue>({ ...EMPTY_BIKE_IDENTITY });

  // Problem / service
  const [serviceId, setServiceId] = useState<string>(FRIENDLY_SERVICE_OPTIONS[0].id);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [problemNotes, setProblemNotes] = useState('');

  // Symptom-based services plus the standardised seasonal tune-up packages, so
  // the call handler can book either from the same picker. Seasonal packages
  // are filtered to the vehicle type being booked.
  const serviceOptions = useMemo(
    () => [
      ...FRIENDLY_SERVICE_OPTIONS.map((o) => ({
        id: o.id,
        serviceId: o.serviceId,
        headline: o.headline,
        duration: o.duration,
        symptom: o.symptom,
      })),
      ...MAINTENANCE_PACKAGES.filter((p) => p.appliesTo.includes(bikeIdentity.category)).map((p) => ({
        id: p.id,
        serviceId: p.serviceId,
        headline: p.headline,
        duration: p.duration,
        symptom: p.tagline,
      })),
    ],
    [bikeIdentity.category]
  );

  // Schedule
  const [preferredDate, setPreferredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>(TIME_SLOT_OPTIONS[0]);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openScript, setOpenScript] = useState(true);

  const patchBike = (patch: Partial<BikeIdentityValue>) =>
    setBikeIdentity((prev) => ({ ...prev, ...patch }));

  const chooseCategory = (category: VehicleCategory) => {
    setVehicleCategory(category);
    patchBike({ category });
  };

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return users
      .filter((u) => u.role === 'customer')
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.membershipNumber || '').toLowerCase().includes(q) ||
          (u.phoneNumber || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      )
      .slice(0, 6);
  }, [memberQuery, users]);

  const handleSelectMember = (member: UserProfile) => {
    setMatchedMember(member);
    setMemberQuery('');
    setCustomerName(member.displayName || '');
    setCustomerPhone(member.phoneNumber || '');
    setCustomerEmail(member.email || '');

    const bike = member.bikes?.[0];
    if (bike) {
      setVehicleCategory(bike.category);
      setBikeIdentity({
        ...EMPTY_BIKE_IDENTITY,
        category: bike.category,
        brand: bike.brand,
        model: bike.model,
        colour: bike.colour || '',
        year: bike.year ? String(bike.year) : '',
        frameSize: bike.frameSizeOrNotes || '',
        serialNumber: bike.serialNumber || '',
        ebikeStatus: bike.bikeDetails?.ebikeStatus || '',
      });
    }
  };

  const clearMember = () => {
    setMatchedMember(null);
    setMemberQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!customerName.trim()) {
      setError('Please take the caller\'s name.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Please take a contact phone number.');
      return;
    }
    if (customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())) {
      setError('That email address does not look right — leave it blank to use phone contact instead.');
      return;
    }
    if (!preferredDate) {
      setError('Please choose a drop-off date.');
      return;
    }

    const finalModel = resolveModel(bikeIdentity);
    const formattedVehicleName = `${bikeIdentity.brand} - ${finalModel}${
      bikeIdentity.colour ? ` (${bikeIdentity.colour})` : ''
    }`;
    const bikeDetails: BikeDetails | undefined = toBikeDetails(bikeIdentity);
    const service = serviceOptions.find((o) => o.id === serviceId) || serviceOptions[0];

    const bikeBlock = [
      `Bike: ${formattedVehicleName}`,
      bikeIdentity.year ? `Year: ${bikeIdentity.year}` : '',
      bikeIdentity.frameSize ? `Frame size: ${bikeIdentity.frameSize}` : '',
      bikeIdentity.serialNumber ? `Serial: ${bikeIdentity.serialNumber}` : '',
      bikeIdentity.ebikeStatus ? `E-Bike: ${bikeIdentity.ebikeStatus}` : '',
      bikeIdentity.conversionSystem ? `Motor/system: ${bikeIdentity.conversionSystem}` : '',
      bikeIdentity.batteryPosition ? `Battery: ${bikeIdentity.batteryPosition}` : '',
      bikeIdentity.systemVoltage ? `Voltage: ${bikeIdentity.systemVoltage}` : '',
      bikeIdentity.driveType ? `Drive: ${bikeIdentity.driveType}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const issueItems = selectedIssueIds
      .map((id) => ALL_BIKE_ISSUES_MAP.get(id))
      .filter(Boolean);
    const issuesBlock =
      issueItems.length > 0
        ? `Reported Symptoms (${issueItems.length}):\n` +
          issueItems.map((it) => `• [${it?.category}] ${it?.label}`).join('\n')
        : '';

    const finalNotes = [
      'BOOKING CHANNEL: Phone call (staff-entered)',
      matchedMember ? `Loyalty member: ${matchedMember.membershipNumber}` : 'Loyalty member: not linked',
      bikeBlock,
      issuesBlock,
      problemNotes.trim() ? `Caller description: ${problemNotes.trim()}` : '',
      notes.trim() ? `Staff notes: ${notes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const sanitizedEmail =
      customerEmail.trim() ||
      `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'guest'}-${
        customerPhone.replace(/[^0-9]/g, '').slice(-4) || 'phone'
      }@guest.stakeysbikes.co.uk`;

    setIsSubmitting(true);
    try {
      const booking = await createBooking({
        customerName: customerName.trim(),
        customerEmail: sanitizedEmail,
        customerPhone: customerPhone.trim(),
        customerId: matchedMember?.uid,
        membershipNumber: matchedMember?.membershipNumber,
        vehicleCategory: bikeIdentity.category,
        vehicleModel: formattedVehicleName,
        bikeDetails,
        serviceId: service.serviceId,
        serviceTitle: service.headline,
        servicePrice: 0,
        preferredDate,
        preferredTimeSlot,
        notes: finalNotes,
        selectedIssues: selectedIssueIds,
        otherNotes: problemNotes.trim() || undefined,
      });

      setSuccess(
        `Phone booking #${booking.id} logged for ${booking.customerName}. It is now in the same queue as online bookings — approve it and confirm the estimate when the bike is booked in.`
      );
      // Reset the caller-specific fields, keep the schedule handy for the next call.
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setMatchedMember(null);
      setSelectedIssueIds([]);
      setProblemNotes('');
      setNotes('');
      setBikeIdentity({ ...EMPTY_BIKE_IDENTITY });
      setVehicleCategory('cycle');
    } catch (err: any) {
      setError(err.message || 'Failed to log the phone booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-400" />
            Phone Bookings
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Log a booking taken over the phone. It uses the same workshop system as online bookings —
            follow the script, fill the form, and it drops straight into the queue.
          </p>
        </div>
      </header>

      {/* Staff call script */}
      <div className="bg-[#0d1015] border border-emerald-900/50 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenScript((s) => !s)}
          className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <span>
              <span className="block text-sm font-bold text-white">Phone call script</span>
              <span className="block text-xs text-neutral-400">
                Read through these steps with the caller before filling in the form.
              </span>
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${openScript ? 'rotate-180' : ''}`}
          />
        </button>

        {openScript && (
          <ol className="px-4 sm:px-5 pb-5 space-y-4">
            {CALL_SCRIPT.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{step.title}</p>
                  <ul className="mt-1 space-y-1">
                    {step.lines.map((line) => (
                      <li key={line} className="text-[11px] text-neutral-300 leading-relaxed flex gap-1.5">
                        <ArrowRight className="w-3 h-3 text-emerald-500/70 mt-0.5 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Caller details */}
        <section className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" /> Caller details
          </h3>

          <div>
            <label className={labelCls}>Look up a loyalty member (optional)</label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search by name, email, phone or membership number..."
                className={`${fieldCls} pl-9`}
              />
            </div>
            {memberMatches.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {memberMatches.map((m) => (
                  <li key={m.uid}>
                    <button
                      type="button"
                      onClick={() => handleSelectMember(m)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950/70 hover:border-emerald-500/50 px-3 py-2 text-left cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-white truncate">{m.displayName}</span>
                        <span className="block text-[11px] text-neutral-400 truncate">
                          {m.email} · {m.membershipNumber}
                        </span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 shrink-0">Link</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {matchedMember && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2">
                <span className="text-xs text-emerald-200">
                  Linked: <strong>{matchedMember.displayName}</strong> ({matchedMember.membershipNumber})
                </span>
                <button
                  type="button"
                  onClick={clearMember}
                  className="text-[11px] font-bold text-emerald-300 hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Caller name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Sam Carter"
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Phone number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+44 7700 900..."
                className={`${fieldCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>Email (optional)</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="sam@example.com"
                className={fieldCls}
              />
            </div>
          </div>
        </section>

        {/* Bike */}
        <section className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bike className="w-4 h-4 text-emerald-400" /> The bike
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {BIKE_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => chooseCategory(cat.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  vehicleCategory === cat.id
                    ? 'bg-neutral-900 border-emerald-500/60'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <span className="flex items-center justify-between mb-2">
                  {cat.id === 'electric_scooter' || cat.id === 'ebike' ? (
                    <Zap className={`w-4 h-4 ${vehicleCategory === cat.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  ) : (
                    <Bike className={`w-4 h-4 ${vehicleCategory === cat.id ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  )}
                  {vehicleCategory === cat.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </span>
                <span className={`block text-xs font-semibold ${vehicleCategory === cat.id ? 'text-white' : 'text-neutral-300'}`}>
                  {cat.title}
                </span>
              </button>
            ))}
          </div>
          <BikeIdentityFields value={bikeIdentity} onChange={patchBike} showCategory={false} idPrefix="phone-bike" />
        </section>

        {/* Service */}
        <section className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-emerald-400" /> Service needed
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {serviceOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setServiceId(opt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  serviceId === opt.id
                    ? 'bg-neutral-900 border-emerald-500/60'
                    : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-semibold ${serviceId === opt.id ? 'text-white' : 'text-neutral-200'}`}>
                    {opt.headline}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0">{opt.duration}</span>
                </span>
                <span className="block text-[11px] text-neutral-400 leading-snug mt-1">{opt.symptom}</span>
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>Caller description (optional)</label>
            <textarea
              rows={2}
              value={problemNotes}
              onChange={(e) => setProblemNotes(e.target.value)}
              placeholder="In the caller's words: what the bike is doing, when it started..."
              className={`${fieldCls} resize-none`}
            />
          </div>
        </section>

        {/* Schedule & staff notes */}
        <section className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" /> Drop-off
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Drop-off date</label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className={`${fieldCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Time window
                </span>
              </label>
              <select
                value={preferredTimeSlot}
                onChange={(e) => setPreferredTimeSlot(e.target.value)}
                className={fieldCls}
              >
                {TIME_SLOT_OPTIONS.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Staff notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Caller is bringing the bike Saturday, needs it back for Monday commute..."
              className={`${fieldCls} resize-none`}
            />
          </div>
        </section>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            <span>{isSubmitting ? 'Logging booking...' : 'Log phone booking'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
