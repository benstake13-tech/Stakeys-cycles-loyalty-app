import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Mic,
  MapPin,
  Siren,
  Loader2,
  X,
  Check,
  Navigation,
  Bike,
  User,
  Phone,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { getBrowserLocation, reverseGeocodeArea } from '../utils/weatherService';
import { VehicleCategory } from '../types/bikeShop';
import {
  EXPRESS_SOS_TILES,
  EXPRESS_SOS_SURCHARGE,
  ExpressSosTile,
  ExpressSosTileId,
  ExpressSosTone,
  SOS_RIDER_LANGUAGES,
  SOS_VOICE_MAX_SECONDS,
  expressSosCtaLabel,
  expressSosStepsComplete,
  formatGpsLocation,
  sosTileHint,
} from '../utils/expressSos';

export interface SosVehicleOption {
  id: string;
  label: string;
  category: VehicleCategory;
}

export interface ExpressSosModeProps {
  tileId: ExpressSosTileId | '';
  onTile: (id: ExpressSosTileId) => void;
  faultText: string;
  onFaultText: (v: string) => void;
  photoUrl: string | null;
  onPhotoUrl: (v: string | null) => void;
  voiceUrl: string | null;
  onVoiceUrl: (v: string | null) => void;
  location: string;
  onLocation: (v: string) => void;
  vehicles: SosVehicleOption[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  contactName: string;
  contactPhone: string;
  onContactName: (v: string) => void;
  onContactPhone: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

const TONE_CLASSES: Record<ExpressSosTone, string> = {
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  sky: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  orange: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  neutral: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30',
};

/** Downscale a captured photo so the stored data URL stays small. */
function downscaleImage(file: File, maxEdge = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(src);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * Express SOS Mode — the single-screen, icon-first emergency booking.
 *
 * Everything is visual so a rider who does not read English can still dispatch
 * help in three taps: pick the issue tile, set the location, send. The normal
 * bike-spec fields, terms, discount and referral inputs never render while this
 * mode is active.
 */
export const ExpressSosMode: React.FC<ExpressSosModeProps> = ({
  tileId,
  onTile,
  faultText,
  onFaultText,
  photoUrl,
  onPhotoUrl,
  voiceUrl,
  onVoiceUrl,
  location,
  onLocation,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  contactName,
  contactPhone,
  onContactName,
  onContactPhone,
  submitting,
  error,
  onSubmit,
}) => {
  const [lang, setLang] = useState('en');
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  const selectedTile = EXPRESS_SOS_TILES.find((t) => t.id === tileId) || null;
  const steps = expressSosStepsComplete({
    tileSelected: Boolean(tileId),
    locationSet: Boolean(location.trim()),
    contactSet: Boolean(contactName.trim() && contactPhone.trim()),
  });

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const useGps = useCallback(async () => {
    setGpsBusy(true);
    setGpsNote(null);
    try {
      const coords = await getBrowserLocation();
      if (!coords) {
        setGpsNote('We could not get your GPS — please type the nearest landmark.');
        return;
      }
      const place = await reverseGeocodeArea(coords.latitude, coords.longitude);
      onLocation(formatGpsLocation(coords, place));
      setGpsNote(place ? `Located: ${place}` : 'GPS coordinates captured.');
    } finally {
      setGpsBusy(false);
    }
  }, [onLocation]);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setMediaError(null);
    try {
      onPhotoUrl(await downscaleImage(file));
    } catch {
      setMediaError('Could not attach that photo — please try again.');
    }
  };

  const startRecording = async () => {
    setMediaError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('Voice notes need a microphone — you can describe the fault in the box instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          onVoiceUrl(await blobToDataUrl(blob));
        } catch {
          setMediaError('Could not save that recording — please try again.');
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= SOS_VOICE_MAX_SECONDS) stopRef.current?.();
          return s + 1;
        });
      }, 1000);
      stopRef.current = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        if (recorder.state !== 'inactive') recorder.stop();
        setRecording(false);
      };
    } catch {
      setMediaError('Microphone blocked — allow access, or describe the fault in the box.');
    }
  };

  const stopRecording = () => stopRef.current?.();

  return (
    <div className="space-y-4" data-testid="express-sos-mode">
      {/* Three-tap status strip */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3">
        <div className="flex items-center gap-2 text-rose-200">
          <Siren className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-black uppercase tracking-widest">Express SOS · 3 taps</span>
        </div>
        <span className="text-[11px] font-bold text-rose-200">{steps.done} / {steps.total} ready</span>
      </div>

      {/* 1. Visual issue selector */}
      <section className="space-y-3" aria-label="What is wrong with your bike?">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-neutral-950 text-[11px] font-black">1</span>
          Tap what is wrong
        </h3>

        {/* Language chips so a rider can read the hints in their own language. */}
        <div className="flex flex-wrap gap-1.5">
          {SOS_RIDER_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold cursor-pointer transition-colors ${
                lang === l.code
                  ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {EXPRESS_SOS_TILES.map((tile) => {
            const active = tile.id === tileId;
            return (
              <button
                key={tile.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTile(tile.id)}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3.5 text-center cursor-pointer transition-all ${
                  active
                    ? 'border-[#05C147] bg-emerald-500/10 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                    : 'border-neutral-800 bg-[#0d1015] hover:border-neutral-600'
                }`}
              >
                <span className="text-3xl leading-none" aria-hidden="true">{tile.emoji}</span>
                <span className={`text-xs font-black ${active ? 'text-emerald-200' : 'text-neutral-100'}`}>
                  {tile.label}
                </span>
                <span className={`text-[10px] leading-tight ${active ? 'text-emerald-300/90' : 'text-neutral-400'}`}>
                  {tile.hint}
                </span>
                {lang !== 'en' && (
                  <span className="text-[10px] leading-tight text-neutral-300" dir={SOS_RIDER_LANGUAGES.find((l) => l.code === lang)?.rtl ? 'rtl' : 'ltr'}>
                    {sosTileHint(tile, lang)}
                  </span>
                )}
                {active && (
                  <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#05C147] text-neutral-950">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <textarea
          value={faultText}
          onChange={(e) => onFaultText(e.target.value)}
          rows={2}
          placeholder="Anything else? (optional — say it in your own words)"
          className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-xs text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none"
        />
      </section>

      {/* 2. Fast diagnostic media bar */}
      <section className="space-y-3" aria-label="Add a photo or voice note">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-neutral-950 text-[11px] font-black">2</span>
          Show us the problem <span className="text-[10px] font-normal text-neutral-500">(optional)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handlePhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold cursor-pointer ${
              photoUrl ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-500'
            }`}
          >
            <Camera className="w-4 h-4" />
            {photoUrl ? 'Photo attached' : 'Take Photo of Issue'}
          </button>

          <button
            type="button"
            onPointerDown={() => void startRecording()}
            onPointerUp={stopRecording}
            onPointerLeave={() => recording && stopRecording()}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold cursor-pointer select-none ${
              recording
                ? 'border-rose-500 bg-rose-500/20 text-rose-200 animate-pulse'
                : voiceUrl
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                : 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-neutral-500'
            }`}
          >
            <Mic className="w-4 h-4" />
            {recording
              ? `Recording… ${recordSeconds}s / ${SOS_VOICE_MAX_SECONDS}s`
              : voiceUrl
              ? 'Voice note recorded'
              : `Hold to Record Voice Note (${SOS_VOICE_MAX_SECONDS}s)`}
          </button>
        </div>

        {(photoUrl || voiceUrl) && (
          <div className="flex flex-wrap items-center gap-3">
            {photoUrl && (
              <div className="relative">
                <img src={photoUrl} alt="Attached fault" className="h-16 w-16 rounded-lg border border-neutral-700 object-cover" />
                <button
                  type="button"
                  onClick={() => onPhotoUrl(null)}
                  aria-label="Remove photo"
                  className="absolute -top-2 -right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {voiceUrl && (
              <div className="flex items-center gap-2">
                <audio controls src={voiceUrl} className="h-8" />
                <button
                  type="button"
                  onClick={() => onVoiceUrl(null)}
                  aria-label="Remove voice note"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
        {mediaError && <p className="text-[11px] text-amber-400">{mediaError}</p>}
      </section>

      {/* 3. Location + vehicle + contact, then one-tap dispatch */}
      <section className="space-y-3" aria-label="Where are you and how do we reach you?">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-neutral-950 text-[11px] font-black">3</span>
          Where are you?
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => onLocation(e.target.value)}
            placeholder="Nearest landmark, or tap GPS"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-xs text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void useGps()}
            disabled={gpsBusy}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-xs font-bold text-sky-300 cursor-pointer disabled:opacity-50"
          >
            {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            Use My Current Location
          </button>
        </div>
        {gpsNote && <p className="text-[11px] text-sky-300 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {gpsNote}</p>}

        {/* Vehicle auto-selected from the rider's saved garage. */}
        {vehicles.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Your vehicle</span>
            <div className="flex flex-wrap gap-2">
              {vehicles.map((v) => {
                const active = v.id === selectedVehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVehicle(v.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold cursor-pointer ${
                      active ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-neutral-700 text-neutral-300'
                    }`}
                  >
                    {v.category === 'cycle' ? <Bike className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={contactName}
              onChange={(e) => onContactName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div className="relative">
            <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => onContactPhone(e.target.value)}
              placeholder="Mobile (for WhatsApp)"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-9 pr-3 py-3 text-xs text-white placeholder-neutral-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/70 p-3 text-xs text-rose-200">{error}</div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-rose-500/25 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Sending SOS…
          </>
        ) : (
          <>
            <Siren className="w-4 h-4" />
            {expressSosCtaLabel(EXPRESS_SOS_SURCHARGE)}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      <p className="text-center text-[10px] text-neutral-500">
        Nothing is charged now — we approve, then send a £{EXPRESS_SOS_SURCHARGE.toFixed(0)} express quote on WhatsApp for you to confirm.
      </p>
    </div>
  );
};

export default ExpressSosMode;
