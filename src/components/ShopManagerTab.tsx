import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Store,
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
  Database,
  Copy,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  PRODUCT_CONDITIONS,
  PRODUCT_IMAGES_BUCKET,
  WEBSITE_SETUP_SQL,
  type ShopProduct,
} from '../shared/data/websiteCatalog';
import {
  checkWebsiteTables,
  deleteWebsiteProduct,
  fetchWebsiteProducts,
  formatMoney,
  provisionWebsiteSchema,
  saveWebsiteProduct,
  setWebsiteProductPublished,
  uploadWebsiteImage,
  type WebsiteTableStatus,
} from '../shared/api/websiteService';
import { APP_DEEP_LINKS } from '../shared/data/appLinks';

interface FormState {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  wasPrice: string;
  stock: string;
  imageUrl: string;
  condition: string;
  sku: string;
  published: boolean;
  sortOrder: string;
}

const blankForm = (): FormState => ({
  id: `prod-${Date.now().toString(36)}`,
  name: '',
  description: '',
  category: 'Parts',
  price: '',
  wasPrice: '',
  stock: '1',
  imageUrl: '',
  condition: 'Used',
  sku: '',
  published: true,
  sortOrder: '0',
});

function toForm(product: ShopProduct): FormState {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    price: String(product.price),
    wasPrice: product.wasPrice === undefined ? '' : String(product.wasPrice),
    stock: String(product.stock),
    imageUrl: product.imageUrl,
    condition: product.condition,
    sku: product.sku,
    published: product.published,
    sortOrder: String(product.sortOrder),
  };
}

interface Props {
  onCountChange?: (count: number) => void;
}

export const ShopManagerTab: React.FC<Props> = ({ onCountChange }) => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [tables, setTables] = useState<WebsiteTableStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [status, rows] = await Promise.all([checkWebsiteTables(), fetchWebsiteProducts()]);
      setTables(status);
      setProducts(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the shop catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(products.length);
  }, [products.length, onCountChange]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

  const openAdd = () => {
    setForm(blankForm());
    setEditing(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (product: ShopProduct) => {
    setForm(toForm(product));
    setEditing(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadWebsiteImage(PRODUCT_IMAGES_BUCKET, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not upload the image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Give the product a name.');
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) return setFormError('Enter a valid price.');

    const product: ShopProduct = {
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim() || 'Other',
      price,
      wasPrice: form.wasPrice.trim() === '' ? undefined : Number(form.wasPrice),
      stock: Math.max(0, Math.round(Number(form.stock) || 0)),
      imageUrl: form.imageUrl.trim(),
      condition: form.condition,
      sku: form.sku.trim(),
      published: form.published,
      sortOrder: Math.round(Number(form.sortOrder) || 0),
    };

    try {
      await saveWebsiteProduct(product);
      setFlash(
        editing
          ? `Updated ${product.name}.`
          : `${product.name} added${product.published ? ' and live on the website' : ' as a draft'}.`
      );
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the product.');
    }
  };

  const togglePublished = async (product: ShopProduct) => {
    setBusyId(product.id);
    try {
      await setWebsiteProductPublished(product.id, !product.published);
      setFlash(`${product.name} is now ${product.published ? 'hidden from' : 'live on'} the website.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the product.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (product: ShopProduct) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setBusyId(product.id);
    try {
      await deleteWebsiteProduct(product.id);
      setFlash(`${product.name} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the product.');
    } finally {
      setBusyId(null);
    }
  };

  const copySetupSql = async () => {
    try {
      await navigator.clipboard.writeText(WEBSITE_SETUP_SQL);
      setFlash('Website setup SQL copied — paste it into the Supabase SQL editor.');
    } catch {
      setError('Could not copy to the clipboard.');
    }
  };

  const runSetup = async () => {
    try {
      await provisionWebsiteSchema();
      setFlash('Website tables created.');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'SQL_RPC_UNAVAILABLE') {
        setFormError(null);
        setFlash('This project has no SQL runner — copy the SQL below into Supabase instead.');
      } else {
        setError(message || 'Could not create the tables.');
      }
    }
  };

  const needsSetup = tables && !tables.products;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-400" /> Shop Manager
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            The catalogue customers browse at{' '}
            <a
              href={APP_DEEP_LINKS.websiteShop}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              the website shop <ExternalLink className="inline w-3 h-3" />
            </a>
            . Published items appear instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="pressable flex items-center gap-2 rounded-xl border border-neutral-800 px-3.5 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-900"
          >
            <Database className="w-4 h-4" /> Setup
          </button>
          <button
            type="button"
            onClick={openAdd}
            disabled={!!needsSetup}
            className="pressable flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New Item
          </button>
        </div>
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
          <Database className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-amber-200">
            The website shop tables do not exist yet.
          </p>
          <p className="mt-1 text-xs text-amber-200/70 max-w-lg mx-auto">
            Run the one-time website setup to create the products, orders, order lines and gallery
            tables, plus the image buckets. Safe to run more than once.
          </p>
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="pressable mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
          >
            <Database className="w-4 h-4" /> Set up the website backend
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
            <Search className="w-4 h-4 text-neutral-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, category or SKU"
              className="w-full bg-transparent text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
              Loading catalogue…
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
              <Store className="w-8 h-8 text-neutral-700 mx-auto" />
              <p className="mt-2 text-sm text-neutral-400">
                {products.length === 0 ? 'No items in the shop yet.' : 'No items match that search.'}
              </p>
              <p className="text-xs text-neutral-500">
                Add an item and it appears on the website shop straight away.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950"
                >
                  <div className="relative h-36 bg-neutral-900">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImagePlus className="w-7 h-7 text-neutral-700" />
                      </div>
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        product.published
                          ? 'border-emerald-800 bg-emerald-950/80 text-emerald-300'
                          : 'border-neutral-700 bg-neutral-900/80 text-neutral-400'
                      }`}
                    >
                      {product.published ? 'Live' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{product.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          {product.category}
                          {product.sku ? ` · ${product.sku}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-400">
                          {formatMoney(product.price)}
                        </div>
                        {product.wasPrice !== undefined && (
                          <div className="text-[11px] text-neutral-600 line-through">
                            {formatMoney(product.wasPrice)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
                      <span className="rounded-md bg-neutral-900 px-1.5 py-0.5">
                        {product.condition}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 ${
                          product.stock > 0
                            ? 'bg-neutral-900'
                            : 'bg-rose-950/60 text-rose-300'
                        }`}
                      >
                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center gap-1.5 border-t border-neutral-900 pt-2">
                      <button
                        type="button"
                        disabled={busyId === product.id}
                        onClick={() => togglePublished(product)}
                        className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-900 disabled:opacity-50"
                      >
                        {product.published ? (
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
                        onClick={() => openEdit(product)}
                        className="pressable rounded-lg border border-neutral-800 p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === product.id}
                        onClick={() => remove(product)}
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
        </>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-8 w-full max-w-2xl space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">
                {editing ? 'Edit item' : 'New shop item'}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[11px] text-neutral-400 sm:col-span-2">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <label className="text-[11px] text-neutral-400">
                Category
                <input
                  list="shop-categories"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
                <datalist id="shop-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>

              <label className="text-[11px] text-neutral-400">
                SKU
                <input
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <label className="text-[11px] text-neutral-400">
                Price (£)
                <input
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <label className="text-[11px] text-neutral-400">
                Was price (£, optional)
                <input
                  inputMode="decimal"
                  value={form.wasPrice}
                  onChange={(e) => setForm((f) => ({ ...f, wasPrice: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <label className="text-[11px] text-neutral-400">
                Stock
                <input
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <label className="text-[11px] text-neutral-400">
                Condition
                <select
                  value={form.condition}
                  onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                >
                  {PRODUCT_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[11px] text-neutral-400 sm:col-span-2">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-700"
                />
              </label>

              <div className="text-[11px] text-neutral-400 sm:col-span-2">
                Photo
                <div className="mt-1 flex items-center gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
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
                <Save className="w-4 h-4" /> {editing ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-3xl space-y-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" /> Website backend setup
              </h3>
              <button
                type="button"
                onClick={() => setIsSetupOpen(false)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Creates the <span className="font-mono text-neutral-300">products</span>,{' '}
              <span className="font-mono text-neutral-300">orders</span>,{' '}
              <span className="font-mono text-neutral-300">order_items</span> and{' '}
              <span className="font-mono text-neutral-300">gallery_items</span> tables plus the{' '}
              <span className="font-mono text-neutral-300">product-images</span> and{' '}
              <span className="font-mono text-neutral-300">gallery</span> buckets. Idempotent, so
              running it again is harmless.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runSetup}
                className="pressable flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Database className="w-4 h-4" /> Try automatic setup
              </button>
              <button
                type="button"
                onClick={copySetupSql}
                className="pressable flex items-center gap-2 rounded-xl border border-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-900"
              >
                <Copy className="w-4 h-4" /> Copy SQL
              </button>
              <a
                href="https://supabase.com/dashboard/project/lhojocpygcnkxvkrcuxh/sql/new"
                target="_blank"
                rel="noreferrer"
                className="pressable flex items-center gap-2 rounded-xl border border-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-900"
              >
                <ExternalLink className="w-4 h-4" /> Open Supabase SQL editor
              </a>
            </div>

            <pre className="max-h-80 overflow-auto rounded-xl border border-neutral-800 bg-black/60 p-3 text-[10px] leading-relaxed text-neutral-400">
              {WEBSITE_SETUP_SQL}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopManagerTab;
