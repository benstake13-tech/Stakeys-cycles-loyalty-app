import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Images,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { GALLERY_BUCKET, type GalleryItem } from '../shared/data/websiteCatalog';
import {
  checkWebsiteTables,
  deleteGalleryItem,
  fetchGalleryItems,
  saveGalleryItem,
  uploadWebsiteImage,
  type WebsiteTableStatus,
} from '../shared/api/websiteService';
import { APP_DEEP_LINKS } from '../shared/data/appLinks';

interface FormState {
  id: string;
  imageUrl: string;
  title: string;
  caption: string;
  vehicleType: string;
  sortOrder: string;
  published: boolean;
}

const blankForm = (): FormState => ({
  id: `job-${Date.now().toString(36)}`,
  imageUrl: '',
  title: '',
  caption: '',
  vehicleType: 'Bicycle',
  sortOrder: '0',
  published: true,
});

function toForm(item: GalleryItem): FormState {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    title: item.title,
    caption: item.caption,
    vehicleType: item.vehicleType,
    sortOrder: String(item.sortOrder),
    published: item.published,
  };
}

interface Props {
  onCountChange?: (count: number) => void;
}

export const GalleryManagerTab: React.FC<Props> = ({ onCountChange }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [tables, setTables] = useState<WebsiteTableStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [status, rows] = await Promise.all([checkWebsiteTables(), fetchGalleryItems()]);
      setTables(status);
      setItems(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the gallery.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(items.filter((i) => i.published).length);
  }, [items, onCountChange]);

  const openAdd = () => {
    setForm(blankForm());
    setEditing(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (item: GalleryItem) => {
    setForm(toForm(item));
    setEditing(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadWebsiteImage(GALLERY_BUCKET, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.imageUrl.trim()) return setFormError('Add a photo — upload one or paste a URL.');

    const item: GalleryItem = {
      id: form.id,
      imageUrl: form.imageUrl.trim(),
      title: form.title.trim(),
      caption: form.caption.trim(),
      vehicleType: form.vehicleType.trim() || 'Bicycle',
      sortOrder: Math.round(Number(form.sortOrder) || 0),
      published: form.published,
      createdAt: '',
    };

    try {
      await saveGalleryItem(item);
      setFlash(editing ? 'Job photo updated.' : 'Job photo added to the website gallery.');
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the photo.');
    }
  };

  const togglePublished = async (item: GalleryItem) => {
    setBusyId(item.id);
    try {
      await saveGalleryItem({ ...item, published: !item.published });
      setFlash(item.published ? 'Photo hidden from the website.' : 'Photo is live on the website.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the photo.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: GalleryItem) => {
    if (!window.confirm('Delete this job photo? This cannot be undone.')) return;
    setBusyId(item.id);
    try {
      await deleteGalleryItem(item.id);
      setFlash('Job photo deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the photo.');
    } finally {
      setBusyId(null);
    }
  };

  const needsSetup = tables && !tables.gallery;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Images className="w-5 h-5 text-emerald-400" /> Gallery Manager
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Job photos shown on{' '}
            <a
              href={APP_DEEP_LINKS.websiteGallery}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              "Jobs we're proud of" <ExternalLink className="inline w-3 h-3" />
            </a>
            . Published photos appear instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={!!needsSetup}
          className="pressable flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add photo
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle className="w-4 h-4" /> {flash}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {needsSetup ? (
        <div className="rounded-2xl border border-dashed border-amber-900 bg-amber-950/20 p-6 text-center">
          <Images className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-amber-200">
            The gallery table does not exist yet.
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            Run the one-time website setup from{' '}
            <span className="font-semibold">Shop Manager → Setup</span> first.
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
          Loading gallery…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
          <Images className="w-8 h-8 text-neutral-700 mx-auto" />
          <p className="mt-2 text-sm text-neutral-400">No job photos yet.</p>
          <p className="text-xs text-neutral-500">
            Add a photo of a finished repair to show it on the website.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
            >
              <div className="relative h-40 bg-neutral-900">
                <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                <span
                  className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                    item.published
                      ? 'border-emerald-800 bg-emerald-950/80 text-emerald-300'
                      : 'border-neutral-700 bg-neutral-900/80 text-neutral-400'
                  }`}
                >
                  {item.published ? 'Live' : 'Hidden'}
                </span>
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <div className="truncate text-sm font-bold text-white">
                    {item.title || 'Untitled job'}
                  </div>
                  <div className="text-[11px] text-neutral-500">{item.vehicleType}</div>
                </div>
                {item.caption && (
                  <p className="line-clamp-2 text-[11px] text-neutral-400">{item.caption}</p>
                )}
                <div className="flex items-center gap-1.5 border-t border-neutral-900 pt-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => togglePublished(item)}
                    className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
                  >
                    {item.published ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Publish
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="pressable rounded-lg border border-neutral-800 p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => remove(item)}
                    className="pressable rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-900 hover:text-rose-400 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-8 w-full max-w-xl space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">
                {editing ? 'Edit job photo' : 'Add a job photo'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4" /> {formError}
              </div>
            )}

            <div className="text-[11px] text-neutral-400">
              Photo
              <div className="mt-1 flex items-center gap-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-neutral-700" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="pressable flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    {uploading ? 'Uploading…' : 'Upload photo'}
                  </button>
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="…or paste an image URL"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-200 outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] text-neutral-400">
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>
              <label className="text-[11px] text-neutral-400">
                Vehicle type
                <input
                  value={form.vehicleType}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>
              <label className="text-[11px] text-neutral-400 sm:col-span-2">
                Caption
                <textarea
                  rows={2}
                  value={form.caption}
                  onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>
              <label className="text-[11px] text-neutral-400">
                Sort order
                <input
                  inputMode="numeric"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>
              <label className="flex items-center gap-2 self-end text-[11px] text-neutral-300">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-900"
                />
                Publish to the website now
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-900 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="pressable rounded-xl border border-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pressable flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Save className="w-4 h-4" /> {editing ? 'Save changes' : 'Add photo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GalleryManagerTab;
