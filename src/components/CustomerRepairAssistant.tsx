import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, ScanLine, X } from 'lucide-react';
import { assessCustomerRepair } from '../api/customerRepairAssessment';
import { compressImageFile } from '../utils/imageCompress';
import { descriptionOnlyReport, MAX_REPAIR_PHOTO_CHARS, MAX_REPAIR_PHOTOS, type CustomerRepairReport, type RepairPhoto } from '../utils/customerRepairReport';
import { CustomerRepairReportView } from './CustomerRepairReportView';

interface Props {
  bike: string; symptoms: string[]; notes: string;
  value: CustomerRepairReport | null;
  onChange: (report: CustomerRepairReport | null) => void;
  onBusyChange: (busy: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  disabled?: boolean;
  knownSafetyConcern?: boolean;
}
const PHOTO_AREAS = ['Whole bike, side on', 'Problem area close-up', 'Part model / size markings', 'Brakes and levers', 'Tyre sidewall and valve', 'Gears and chain', 'Display error / motor label'];
const INTAKE_QUESTIONS = ['When did the problem start?', 'When does it happen, and what do you hear or feel?', 'Any recent crash, repairs, new parts or modifications?'];
async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP photo. Export HEIC photos as JPEG first.');
  if (file.size > 15_000_000) throw Error('That photo is too large. Choose one under 15 MB.');
  const compressed = await compressImageFile(file);
  if (compressed.dataUrl.length <= MAX_REPAIR_PHOTO_CHARS) return compressed.dataUrl;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => reject(Error('Could not prepare this photo. Please try another.')), 5000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(Error('Could not read this photo.')); };
    img.src = compressed.dataUrl;
  });
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1100 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Photo preparation is unavailable on this device. Try a smaller JPEG.');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.65, 0.5, 0.35]) {
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= MAX_REPAIR_PHOTO_CHARS) return data;
  }
  throw Error('Crop closer to the bike or part so we can attach a clear, smaller photo.');
}

export function CustomerRepairAssistant({ bike, symptoms, notes, value, onChange, onBusyChange, onPendingChange, disabled, knownSafetyConcern = false }: Props) {
  const [photos, setPhotos] = useState<RepairPhoto[]>([]);
  const [area, setArea] = useState(PHOTO_AREAS[0]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [safetyConcern, setSafetyConcern] = useState(false);
  const [followUps, setFollowUps] = useState<CustomerRepairReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const camera = useRef<HTMLInputElement>(null), gallery = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null), sequence = useRef(0);
  const symptomKey = symptoms.join('\0');
  const hasAnswers = Object.values(answers).some(a => a.trim());
  const hasEvidence = photos.length > 0 || notes.trim().length > 0 || symptoms.length > 0 || hasAnswers;
  useEffect(() => {
    sequence.current++; controller.current?.abort(); setBusy(false); onChange(null);
  }, [bike, symptomKey, notes, onChange]);
  useEffect(() => { onBusyChange(busy || preparing); }, [busy, preparing, onBusyChange]);
  useEffect(() => { onPendingChange((photos.length > 0 || hasAnswers) && !value); }, [photos.length, hasAnswers, value, onPendingChange]);
  useEffect(() => () => { sequence.current++; controller.current?.abort(); onBusyChange(false); onPendingChange(false); }, [onBusyChange, onPendingChange]);
  const input = () => ({ bike, symptoms, notes, photos, answers, safetyConcern: safetyConcern || knownSafetyConcern });
  const invalidate = () => { sequence.current++; controller.current?.abort(); setBusy(false); onChange(null); };
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(''); setPreparing(true); invalidate();
    const available = MAX_REPAIR_PHOTOS - photos.length;
    if (files.length > available) setError(`You can attach ${MAX_REPAIR_PHOTOS} photos. Remove an older photo before adding more.`);
    const next: RepairPhoto[] = [];
    try {
      for (const file of Array.from(files).slice(0, available)) next.push({ id: crypto.randomUUID(), label: area, dataUrl: await preparePhoto(file) });
      setPhotos(current => [...current, ...next].slice(0, MAX_REPAIR_PHOTOS));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare that photo. Please try another.'); }
    finally { setPreparing(false); }
  };
  const analyse = async () => {
    const id = ++sequence.current;
    controller.current?.abort(); controller.current = new AbortController();
    setError(''); setBusy(true); onChange(null);
    try {
      const result = await assessCustomerRepair(input(), controller.current.signal);
      if (sequence.current === id) { onChange(result); setFollowUps(result); }
    } catch {
      if (sequence.current === id) setError('Photo analysis is unavailable or incomplete. Try again, or attach your photos and description for staff to review.');
    } finally { if (sequence.current === id) setBusy(false); }
  };
  return <section className="surface-panel p-4 sm:p-5 space-y-4" aria-label="Photo repair assistant">
    <div className="flex items-start gap-3"><ScanLine className="w-6 h-6 text-emerald-400 shrink-0"/><div><h4 className="font-semibold text-white">Show us what is wrong</h4><p className="text-xs text-neutral-400 mt-1">Add a whole-bike photo, then close-ups of the problem and any readable part codes. Gemini can help prepare your repair report.</p></div></div>
    <p className="text-xs text-neutral-400">Keep the bike stationary and switched off. Avoid faces and addresses. Never open a battery or dismantle a part to take a photo. Photos go to Google only when you choose “Review my bike”; they are attached for staff when you submit your booking.</p>
    <div className="space-y-3">{INTAKE_QUESTIONS.map(q => <label key={q} className="block text-xs text-neutral-300">{q}<input aria-label={q} maxLength={800} disabled={disabled || busy} value={answers[q] || ''} onChange={e => { invalidate(); setAnswers(a => ({ ...a, [q]: e.target.value })); }} placeholder="Optional — tell us what you have noticed" className="block mt-1 rounded-lg border border-neutral-700 bg-transparent w-full p-2 text-white"/></label>)}</div>
    <label className="block text-xs text-neutral-300">Photo area<select aria-label="Photo area" value={area} onChange={e => setArea(e.target.value)} className="block mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-white">{[...new Set([...PHOTO_AREAS, ...(followUps?.photoRequests.map(p => p.area) || [])])].map(a => <option key={a}>{a}</option>)}</select></label>
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Take repair photo" className="hidden" onChange={e => { void addPhotos(e.target.files); e.target.value = ''; }} />
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Choose repair photos" className="hidden" onChange={e => { void addPhotos(e.target.files); e.target.value = ''; }} />
    <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled || preparing || busy || photos.length >= MAX_REPAIR_PHOTOS} onClick={() => camera.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-neutral-950 disabled:opacity-50"><Camera size={16}/>Take photo</button><button type="button" disabled={disabled || preparing || busy || photos.length >= MAX_REPAIR_PHOTOS} onClick={() => gallery.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 disabled:opacity-50"><ImagePlus size={16}/>Choose photos</button><span className="self-center text-xs text-neutral-500">{photos.length}/{MAX_REPAIR_PHOTOS} photos</span></div>
    {preparing && <p role="status" className="text-xs text-emerald-300">Preparing your photos…</p>}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{photos.map(p => <figure key={p.id} className="relative"><img src={p.dataUrl} alt={p.label} className="w-full aspect-square rounded-lg object-contain bg-black/20"/><button type="button" aria-label={`Remove ${p.label}`} disabled={disabled || preparing || busy} onClick={() => { invalidate(); setPhotos(prev => prev.filter(x => x.id !== p.id)); }} className="absolute top-1 right-1 rounded-full bg-neutral-950 p-1.5 text-white"><X size={14}/></button><figcaption className="mt-1 text-xs text-neutral-400">{p.label}</figcaption></figure>)}</div>
    <label className="flex items-start gap-2 text-xs text-neutral-300"><input type="checkbox" checked={safetyConcern} disabled={disabled || busy} onChange={e => { invalidate(); setSafetyConcern(e.target.checked); }}/>I have lost braking, have loose steering, suspect crash damage, or have a hot / swollen battery.</label>
    {(safetyConcern || knownSafetyConcern) && <p role="alert" className="text-sm text-rose-300">Do not ride. If a battery is smoking or burning, move away and contact emergency services. Arrange safe transport with the workshop.</p>}
    {followUps && <div className="space-y-3">
      {followUps.photoRequests.length > 0 && <div className="rounded-xl border border-amber-500/25 p-3 space-y-2"><h5 className="text-sm font-semibold text-amber-200">A closer look would help</h5>{followUps.photoRequests.map((p, i) => <div key={i} className="text-xs text-neutral-300"><strong>{p.area}: </strong>{p.instruction}<p className="text-neutral-500">{p.reason}</p><button type="button" disabled={disabled || busy || preparing || photos.length >= MAX_REPAIR_PHOTOS} className="text-emerald-300 underline mt-1 disabled:opacity-50" onClick={() => { setArea(p.area); camera.current?.click(); }}>Take this close-up</button></div>)}</div>}
      {followUps.questions.map((q, i) => <label key={q} className="block text-xs text-neutral-300">{q}<input aria-label={q} maxLength={800} value={answers[q] || ''} disabled={disabled || busy} onChange={e => { invalidate(); setAnswers(a => ({ ...a, [q]: e.target.value })); }} className="block mt-1 rounded-lg border border-neutral-700 bg-transparent w-full p-2 text-white" placeholder="Answer if you can; otherwise leave for the mechanic"/></label>)}
    </div>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled || preparing || busy || !hasEvidence} onClick={() => void analyse()} className="inline-flex gap-2 items-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-neutral-950 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin"/> : <ScanLine size={16}/>} {busy ? 'Reviewing your bike…' : followUps ? 'Update photo review' : 'Review my bike'}</button>
      {busy ? <button type="button" onClick={invalidate} className="text-xs text-neutral-300 underline">Cancel analysis</button> : <button type="button" disabled={disabled || preparing || !hasEvidence} onClick={() => { setError(''); onChange(descriptionOnlyReport(input())); }} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-200 disabled:opacity-50">Attach for staff without AI</button>}
    </div>
    {!value && (photos.length > 0 || hasAnswers || followUps) && <p className="text-xs text-amber-200">Choose a review option above to attach your current photos and answers to the booking.</p>}
    {value && <><p className="text-xs font-semibold text-emerald-300" role="status">Report ready — it will be sent when you submit this booking.</p><CustomerRepairReportView report={value}/></>}
  </section>;
}
