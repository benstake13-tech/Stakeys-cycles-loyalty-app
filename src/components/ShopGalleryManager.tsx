import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'shop-gallery';
const FOLDERS = ['shop/products', 'gallery/workshop', 'gallery/repairs', 'gallery/customer-bikes'] as const;
type Folder = typeof FOLDERS[number];
type Photo = { name: string; url: string; path: string };

export function ShopGalleryManager() {
  const [folder, setFolder] = useState<Folder>(FOLDERS[0]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setError('');
    const { data, error: listError } = await supabase.storage.from(BUCKET).list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (listError) { setError(listError.message); return; }
    setPhotos((data || []).filter(item => item.name && item.name !== '.emptyFolderPlaceholder').map(item => {
      const path = `${folder}/${item.name}`;
      return { name: item.name, path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    }));
  };
  useEffect(() => { void refresh(); }, [folder]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      for (const file of Array.from(files)) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) throw new Error(`${file.name}: unsupported image format`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: image exceeds 10 MB`);
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${folder}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      setMessage('Photos uploaded successfully.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (photo: Photo) => {
    if (!window.confirm(`Permanently delete ${photo.name}?`)) return;
    setBusy(true); setError('');
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([photo.path]);
    if (deleteError) setError(deleteError.message);
    else { setMessage('Photo deleted.'); await refresh(); }
    setBusy(false);
  };

  return <section className="rounded-2xl border border-emerald-800 bg-neutral-950 p-5 space-y-4">
    <h2 className="text-xl font-bold text-white">Shop & Gallery Photos</h2>
    <p className="text-sm text-neutral-400">Photos are stored in Supabase. Anyone with the public image link can view them. Upload only photos approved for publication.</p>
    <label className="block text-sm text-neutral-200">Photo collection
      <select className="block w-full mt-2 p-3 rounded-lg bg-neutral-900 text-white border border-neutral-700" value={folder} onChange={e => setFolder(e.target.value as Folder)}>{FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}</select>
    </label>
    <label className="block p-4 rounded-lg border border-dashed border-emerald-600 text-emerald-300 cursor-pointer">{busy ? 'Working…' : 'Choose photos to upload (10 MB max each)'}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={busy} className="block mt-2 text-xs" onChange={e => { void upload(e.target.files); e.target.value = ''; }} />
    </label>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {message && <p role="status" className="text-emerald-400">{message}</p>}
    <button type="button" disabled={busy} className="text-emerald-400 underline" onClick={() => void refresh()}>Refresh photos</button>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{photos.map(photo => <div key={photo.path} className="rounded-lg bg-neutral-900 overflow-hidden"><img src={photo.url} alt={photo.name} loading="lazy" className="w-full h-32 object-cover" /><div className="p-2 space-y-2"><a className="block text-xs text-emerald-400 underline truncate" href={photo.url} target="_blank" rel="noreferrer">Open photo</a><button type="button" disabled={busy} className="text-xs text-red-400 underline" onClick={() => void remove(photo)}>Delete</button></div></div>)}</div>
    {photos.length === 0 && !error && <p className="text-neutral-500 text-sm">No photos in this collection yet.</p>}
  </section>;
}
