import React, { useState } from 'react';
import { Camera, CircleAlert, ScanSearch, ShieldCheck, ArrowRight, LoaderCircle } from 'lucide-react';
import { analyzeBikeImage } from '../api/visionService';

export const BikeIdentificationEngine = ({ onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  // Keep uploads comfortably below common 4.5 MB serverless request limits.
  const prepareImage = (file) => new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not prepare photo for scanning.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that photo. Try JPEG or PNG.'));
    };
    image.src = objectUrl;
  });

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPEG, PNG or WebP photograph.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('Photos must be smaller than 6 MB.');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const dataUrl = await prepareImage(file);
      const result = await analyzeBikeImage(dataUrl);
      setAnalysis(result);
    } catch (err) {
      setError(err?.message || 'We could not scan that image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const bike = analysis?.identified_bike;

  return (
    <div className="w-full sm:w-auto">
      <label className={`inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold transition-all border cursor-pointer focus-within:ring-2 focus-within:ring-emerald-400 ${loading ? 'bg-neutral-900 text-neutral-400 border-neutral-700' : 'bg-neutral-900 hover:bg-neutral-800 text-emerald-300 border-emerald-500/35 hover:border-emerald-400'}`}>
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        <span>{loading ? 'Identifying your bike…' : 'Scan your bike with AI'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFileChange} disabled={loading} className="sr-only" aria-label="Upload a bike photo for AI identification" />
      </label>

      {error && <div role="alert" className="mt-3 max-w-lg rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-xs text-rose-200 flex items-start gap-2"><CircleAlert className="h-4 w-4 shrink-0" />{error}</div>}

      {bike && (
        <div className="mt-3 max-w-xl rounded-2xl border border-emerald-400/30 bg-[#0c1913] p-4 shadow-xl text-white">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400"><ScanSearch className="h-4 w-4" />AI PHOTO ANALYSIS</div>
          <div className="text-base font-bold">{bike.make || 'Unknown brand'} · {bike.model || 'Unknown model'}</div>
          <p className="mt-1 text-xs text-neutral-300">Category: {bike.type || 'Unconfirmed'}</p>
          <div className="mt-3 flex gap-2 text-[11px] leading-relaxed text-neutral-400"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />Visual identification is an estimate; confirm bike details and any repairs in person.</div>
          {onAnalysisComplete && (
            <button type="button" onClick={() => onAnalysisComplete(analysis)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-neutral-950 hover:bg-emerald-300">
              Review and add to garage <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
