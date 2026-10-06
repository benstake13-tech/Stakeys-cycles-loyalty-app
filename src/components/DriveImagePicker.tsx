import React, { useEffect, useMemo, useState } from 'react';
import { Folder, Image as ImageIcon, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  DRIVE_FOLDERS,
  DriveFolderKey,
  DriveImage,
  listDriveFolder,
  normaliseDriveUrl,
} from '../utils/googleDrive';

interface DriveImagePickerProps {
  /** Which folder to open first. */
  folder: DriveFolderKey;
  /** Called with a ready-to-use image URL. */
  onPick: (url: string, image?: DriveImage) => void;
  onClose: () => void;
}

const FOLDER_LABELS: Record<DriveFolderKey, string> = {
  stock: 'Shop stock',
  gallery: 'Gallery',
  promo: 'Adverts & promotions',
};

/**
 * Browse a public Google Drive folder and pick an image, or paste a link.
 * Removes the "download then re-upload" round trip when adding shop items.
 */
export const DriveImagePicker: React.FC<DriveImagePickerProps> = ({ folder, onPick, onClose }) => {
  const [activeKey, setActiveKey] = useState<DriveFolderKey>(folder);
  const [folderId, setFolderId] = useState<string>(DRIVE_FOLDERS[folder]);
  const [images, setImages] = useState<DriveImage[]>([]);
  const [subFolders, setSubFolders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pasted, setPasted] = useState('');

  const load = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listDriveFolder(id);
      setImages(result.images);
      setSubFolders(result.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
      setImages([]);
      setSubFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(folderId);
  }, [folderId]);

  const switchFolder = (key: DriveFolderKey) => {
    setActiveKey(key);
    setFolderId(DRIVE_FOLDERS[key]);
    setQuery('');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? images.filter((img) => img.name.toLowerCase().includes(q)) : images;
  }, [images, query]);

  const handlePaste = () => {
    const url = normaliseDriveUrl(pasted);
    if (url) onPick(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
      <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono">Add image from Google Drive</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Folder switcher */}
        <div className="px-5 pt-4 flex flex-wrap gap-2">
          {(Object.keys(DRIVE_FOLDERS) as DriveFolderKey[]).map((key) => (
            <button
              key={key}
              onClick={() => switchFolder(key)}
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                activeKey === key
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              {FOLDER_LABELS[key]}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => load(folderId)}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-1.5 text-[11px] font-bold text-neutral-300 hover:border-neutral-700 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Search + paste link */}
        <div className="px-5 py-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by file name…"
              className="w-full rounded-xl border bg-neutral-950/60 border-neutral-800 text-neutral-100 focus:border-emerald-500/60 outline-none pl-9 pr-3 py-2 text-xs"
            />
          </div>
          <div className="relative flex-1">
            <input
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePaste(); }}
              placeholder="…or paste a Drive link"
              className="w-full rounded-xl border bg-neutral-950/60 border-neutral-800 text-neutral-100 focus:border-emerald-500/60 outline-none px-3 py-2 text-xs"
            />
          </div>
          <button
            onClick={handlePaste}
            disabled={!pasted.trim()}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2 text-xs font-bold transition-colors cursor-pointer"
          >
            Use link
          </button>
        </div>

        {/* Sub-folders */}
        {subFolders.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {subFolders.map((f) => (
              <button
                key={f.id}
                onClick={() => setFolderId(f.id)}
                className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-2.5 py-1 text-[10px] font-bold text-neutral-300 hover:border-neutral-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Folder className="w-3 h-3 text-amber-400" /> {f.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 text-neutral-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading {FOLDER_LABELS[activeKey]}…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-xs text-rose-300">
              <p className="font-bold mb-1">Couldn't load that folder</p>
              <p className="text-rose-400/80">{error}</p>
              <p className="mt-2 text-neutral-400">
                The folder must be shared publicly and the server needs a Google Drive API key
                (<code>GOOGLE_DRIVE_API_KEY</code>). You can still paste an image link above.
              </p>
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-neutral-500 text-xs">
              {images.length === 0 ? 'No images in this folder yet.' : 'No images match that filter.'}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((img) => (
                <button
                  key={img.id}
                  onClick={() => onPick(img.directUrl, img)}
                  title={img.name}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 hover:border-emerald-500 transition-all cursor-pointer"
                >
                  <img src={img.thumbnailUrl} alt={img.name} loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-neutral-950/80 text-[9px] text-neutral-200 px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
