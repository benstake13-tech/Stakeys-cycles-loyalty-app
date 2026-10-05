import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { AvatarModel } from './AvatarModel';
import { type AvatarConfig, type AvatarImage } from '../shared/types/avatar';
import {
  generateAvatarImage,
  downloadAvatarImage,
  isAvatarImageGenConfigured,
  AvatarImageError,
} from '../shared/api/avatarImageService';

export interface AvatarLikenessStudioProps {
  config: AvatarConfig;
  /** The portrait currently saved on the profile, if any. */
  image?: AvatarImage | null;
  onSave: (image: AvatarImage | null) => Promise<void> | void;
  saving?: boolean;
}

/**
 * Generates and manages the HD, Bitmoji-style likeness portrait. The vector
 * AvatarModel stays as the instant preview; this layers an AI-rendered HD
 * portrait on top once the customer is happy with their character.
 */
export const AvatarLikenessStudio: React.FC<AvatarLikenessStudioProps> = ({
  config,
  image,
  onSave,
  saving,
}) => {
  const [brief, setBrief] = useState('');
  const [sourcePhoto, setSourcePhoto] = useState<string | undefined>(undefined);
  const [candidate, setCandidate] = useState<AvatarImage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const configured = isAvatarImageGenConfigured();
  const shown = candidate || image || null;

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setSourcePhoto(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const result = await generateAvatarImage({ config, brief, sourceImage: sourcePhoto });
      setCandidate(result);
    } catch (err) {
      setError(err instanceof AvatarImageError ? err.message : 'Could not generate a portrait. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!candidate) return;
    await onSave(candidate);
    setCandidate(null);
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 space-y-5">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-display text-base font-bold text-white">HD likeness portrait (AI)</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Turn your rider into a premium, HD Bitmoji-style portrait. Add a photo to capture your real
            features, or just describe yourself in the brief.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Portrait generation is not configured yet. Add <code className="font-mono">VITE_GEMINI_API_KEY</code>{' '}
            to the environment to enable it.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        {/* Preview frame */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-800 bg-[#090b0e] overflow-hidden aspect-[4/5] flex items-center justify-center relative">
            {shown ? (
              <img
                src={shown.dataUrl}
                alt="Generated avatar portrait"
                className="w-full h-full object-cover"
              />
            ) : (
              <AvatarModel config={config} size={170} animate={false} title="Your rider character" />
            )}
            {generating && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-emerald-300">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-[11px] font-semibold">Rendering your portrait…</span>
              </div>
            )}
            {candidate && !generating && (
              <span className="absolute top-2 left-2 rounded-full bg-emerald-500 text-neutral-950 text-[10px] font-bold px-2 py-0.5">
                Preview — not saved
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!configured || generating}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 cursor-pointer"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : candidate ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {candidate ? 'Regenerate' : 'Generate portrait'}
            </button>
            {candidate && (
              <button
                type="button"
                onClick={() => setCandidate(null)}
                className="px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400 text-xs font-semibold hover:text-white cursor-pointer"
              >
                Discard
              </button>
            )}
          </div>

          {candidate && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save portrait'}
            </button>
          )}

          {shown && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadAvatarImage(shown.dataUrl)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 text-xs font-semibold hover:text-white cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download PNG
              </button>
              {image && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onSave(null)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-60 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5" htmlFor="avatar-brief">
              Describe yourself (optional)
            </label>
            <textarea
              id="avatar-brief"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Female, late 20s, almond hazel eyes, shoulder-length dark brown wavy hair with caramel highlights, teal blazer"
              className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-neutral-300 mb-1.5">Reference photo (optional)</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 text-xs font-semibold hover:text-white cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> {sourcePhoto ? 'Change photo' : 'Upload photo'}
              </button>
              {sourcePhoto ? (
                <>
                  <img src={sourcePhoto} alt="Reference" className="w-10 h-10 rounded-lg object-cover border border-neutral-700" />
                  <button
                    type="button"
                    onClick={() => setSourcePhoto(undefined)}
                    className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                  <ImageIcon className="w-3.5 h-3.5" /> A clear, front-facing headshot works best.
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Generated on-device and stored privately on your profile. Photos are only used to build your
            portrait and are never shared.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AvatarLikenessStudio;
