import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Home,
  MapPin,
  Users,
  HelpCircle,
  Tag,
  Share2,
  LayoutGrid,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { updateWebsiteContent, useWebsiteContent } from '../context/WebsiteContentStore';
import { DEFAULT_WEBSITE_CONTENT } from '../data/websiteContent';
import { ItemQrModal } from './ItemQrModal';
import { DriveImagePicker } from './DriveImagePicker';
import { TileButton } from './tiles/TileButton';
import { TileGrid } from './tiles/TileGrid';
import { TileGroup } from './tiles/TileGroup';
import { DriveFolderKey } from '../utils/googleDrive';
import {
  WebFaq,
  WebFaqSection,
  WebPriceItem,
  WebProduct,
  WebProductCategory,
  WebSocialLink,
  WebsiteContent,
} from '../types/websiteContent';

const inputCls = (isDark: boolean): string =>
  `w-full rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors ${
    isDark
      ? 'bg-neutral-950/60 border-neutral-800 text-neutral-100 focus:border-emerald-500/60'
      : 'bg-white border-neutral-200 text-neutral-900 focus:border-emerald-500/60'
  }`;

const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 7)}`;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function makeMatcher(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return () => true;
  return (...fields: unknown[]) => fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  hint?: string;
  placeholder?: string;
  isDark: boolean;
  error?: string;
}

function Field({ label, value, onChange, textarea, hint, placeholder, isDark, error }: FieldProps) {
  const control = textarea ? (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      aria-invalid={!!error}
      className={`${inputCls(isDark)} resize-y ${error ? '!border-rose-500/70' : ''}`}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error}
      className={`${inputCls(isDark)} ${error ? '!border-rose-500/70' : ''}`}
    />
  );
  return (
    <div className="block">
      <label className="block">
        <span className={labelCls}>{label}</span>
        {control}
      </label>
      {error ? (
        <span role="alert" className="mt-1 block text-[10px] font-bold text-rose-400">
          {error}
        </span>
      ) : (
        hint && <span className={`mt-1 block text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{hint}</span>
      )}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function SectionCard({ title, subtitle, isDark, action, children }: SectionCardProps) {
  return (
    <section className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className={`text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-neutral-900'}`}>{title}</h4>
          {subtitle && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface CollapsibleItemProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  isDark: boolean;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
  /** Ask for confirmation before removing (default true) — destructive action guard. */
  confirmRemoval?: boolean;
}

function CollapsibleItem({
  title,
  subtitle,
  badge,
  isDark,
  open,
  onToggle,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  extraActions,
  children,
  confirmRemoval = true,
}: CollapsibleItemProps) {
  const confirmRemove = () => {
    if (confirmRemoval && !window.confirm(`Remove "${title || 'this item'}"? This cannot be undone.`)) return;
    onRemove();
  };
  const iconBtn = `pressable inline-flex items-center justify-center rounded-lg border p-1.5 cursor-pointer ${
    isDark ? 'border-neutral-800 text-neutral-400 hover:bg-neutral-800/60' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100'
  }`;
  return (
    <div className={`rounded-xl border ${isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className="flex items-center gap-1.5 p-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          <ChevronRight className={`w-4 h-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="min-w-0">
            <span className={`block truncate text-xs font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-800'}`}>
              {title || 'Untitled'}
            </span>
            {subtitle && <span className="block truncate text-[10px] text-neutral-500">{subtitle}</span>}
          </span>
        </button>
        {badge}
        {extraActions}
        {onDuplicate && (
          <button type="button" onClick={onDuplicate} className={iconBtn} title="Duplicate" aria-label="Duplicate item">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveUp && (
          <button type="button" onClick={onMoveUp} className={iconBtn} title="Move up" aria-label="Move item up">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button type="button" onClick={onMoveDown} className={iconBtn} title="Move down" aria-label="Move item down">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={confirmRemove}
          className="pressable inline-flex items-center justify-center rounded-lg border border-rose-900 p-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
          title="Remove"
          aria-label="Remove item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && <div className={`space-y-2.5 border-t px-3 py-3 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>{children}</div>}
    </div>
  );
}

const WEBSITE_SECTIONS = [
  { id: 'hero', label: 'Hero & Contact', icon: Home },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'join', label: 'Join the Team', icon: Users },
  { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  { id: 'prices', label: 'Price List', icon: Tag },
  { id: 'socials', label: 'Socials', icon: Share2 },
] as const;

type WebsiteSectionId = (typeof WEBSITE_SECTIONS)[number]['id'];

const FAQ_SECTIONS: { value: WebFaqSection; label: string }[] = [
  { value: 'repairs', label: 'Repairs & Service' },
  { value: 'parts', label: 'Parts & Accessories' },
  { value: 'general', label: 'General Information' },
];

const CATEGORY_OPTIONS: WebProductCategory[] = [
  'Second hand parts',
  'Mens Bikes',
  "women's Bikes",
  "Children's bikes",
];

function StatChip({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${isDark ? 'bg-neutral-950/60 border-neutral-800 text-neutral-400' : 'bg-neutral-100 border-neutral-200 text-neutral-500'}`}>
      {children}
    </span>
  );
}

export const WebsiteContentManagerTab: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const content = useWebsiteContent();

  const [draft, setDraft] = useState<WebsiteContent>(content);
  const [editorTab, setEditorTab] = useState<'website' | 'shop' | 'gallery'>('website');
  // The focused section for the Main Website area ('all' = show every section).
  const [activeSection, setActiveSection] = useState<'all' | WebsiteSectionId>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [savedSink, setSavedSink] = useState(0);
  const [qrProduct, setQrProduct] = useState<WebProduct | null>(null);
  const [drivePicker, setDrivePicker] = useState<null | { folder: DriveFolderKey; apply: (url: string) => void }>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(content), [draft, content]);
  const match = useMemo(() => makeMatcher(search), [search]);
  const searching = search.trim().length > 0;

  // Inline validation for the fields an operator is most likely to get wrong.
  const errors = useMemo<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    const email = draft.email.trim();
    const url = draft.calloutUrl.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isUrl = /^https?:\/\/\S+$/i.test(url);
    if (!draft.heroTitle.trim()) e.heroTitle = 'Hero title is required.';
    if (!draft.phone.trim()) e.phone = 'A contact phone number is required.';
    if (!email) e.email = 'A contact email is required.';
    else if (!isEmail) e.email = 'Enter a valid email address.';
    if (!url) e.calloutUrl = 'A booking URL is required.';
    else if (!isUrl) e.calloutUrl = 'Enter a full URL (https://…).';
    draft.socials.forEach((s, i) => {
      if (s.url.trim() && !/^https?:\/\/\S+$/i.test(s.url.trim())) e[`social-${i}`] = 'Enter a full URL (https://…).';
    });
    return e;
  }, [draft]);
  const hasErrors = Object.keys(errors).length > 0;

  // Warn before the tab closes with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Switching area (Main Website / Shop / Gallery) or section guards unsaved edits.
  const confirmLeave = () => !dirty || window.confirm('You have unsaved changes. Leave without publishing?');
  const changeEditorTab = (tab: 'website' | 'shop' | 'gallery') => {
    if (tab === editorTab) return;
    if (!confirmLeave()) return;
    setEditorTab(tab);
  };
  const changeSection = (id: 'all' | WebsiteSectionId) => {
    if (id === activeSection) return;
    if (!confirmLeave()) return;
    setActiveSection(id);
  };
  const sectionActive = (id: WebsiteSectionId) => activeSection === 'all' || activeSection === id;

  const openDrivePicker = (folder: DriveFolderKey, apply: (url: string) => void) => {
    setDrivePicker({ folder, apply });
  };

  const save = () => {
    if (hasErrors) return;
    // Publishing a brand-new item should hand staff its QR label straight away.
    const publishedIds = new Set(content.products.map((p) => p.id));
    const newlyAdded = draft.products.filter((p) => !publishedIds.has(p.id) && (p.name.trim() || p.price > 0));
    updateWebsiteContent(draft);
    setSavedSink((n) => n + 1);
    if (newlyAdded.length > 0) setQrProduct(newlyAdded[0]);
  };

  const discard = () => {
    setDraft(content);
    setExpanded({});
  };

  // Cmd/Ctrl+S publishes from anywhere in the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const applyDraft = (patch: Partial<WebsiteContent>) => setDraft((prev) => ({ ...prev, ...patch }));
  const setTextField = (key: keyof WebsiteContent, value: string) => applyDraft({ [key]: value } as Partial<WebsiteContent>);

  const isOpen = (id: string, defaultOpen = false) => expanded[id] ?? defaultOpen;
  const toggle = (id: string, defaultOpen = false) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? defaultOpen) }));

  // ---- FAQs -------------------------------------------------------------
  const setFaqField = (index: number, key: keyof WebFaq, value: string) => {
    applyDraft({ faqs: draft.faqs.map((f, i) => (i === index ? ({ ...f, [key]: value } as WebFaq) : f)) });
  };
  const addFaq = () => {
    const faq: WebFaq = { id: uid('faq'), section: 'general', q: '', a: '' };
    applyDraft({ faqs: [...draft.faqs, faq] });
    setExpanded((prev) => ({ ...prev, [faq.id]: true }));
  };
  const removeFaq = (index: number) => applyDraft({ faqs: draft.faqs.filter((_, i) => i !== index) });
  const duplicateFaq = (index: number) => {
    const copy = { ...draft.faqs[index], id: uid('faq') };
    const faqs = draft.faqs.slice();
    faqs.splice(index + 1, 0, copy);
    applyDraft({ faqs });
    setExpanded((prev) => ({ ...prev, [copy.id]: true }));
  };
  const moveFaq = (index: number, to: number) => applyDraft({ faqs: moveItem(draft.faqs, index, to) });

  // ---- Price list -------------------------------------------------------
  const setPriceField = (index: number, key: keyof WebPriceItem, value: string) => {
    applyDraft({ priceList: draft.priceList.map((r, i) => (i === index ? ({ ...r, [key]: value } as WebPriceItem) : r)) });
  };
  const addPriceRow = (scope: WebPriceItem['scope']) => {
    const row: WebPriceItem = { id: uid('p'), scope, group: '', item: '', desc: '', price: '', note: '' };
    applyDraft({ priceList: [...draft.priceList, row] });
    setExpanded((prev) => ({ ...prev, [row.id]: true }));
  };
  const removePriceRow = (index: number) => applyDraft({ priceList: draft.priceList.filter((_, i) => i !== index) });
  const duplicatePriceRow = (index: number) => {
    const copy = { ...draft.priceList[index], id: uid('p') };
    const priceList = draft.priceList.slice();
    priceList.splice(index + 1, 0, copy);
    applyDraft({ priceList });
    setExpanded((prev) => ({ ...prev, [copy.id]: true }));
  };
  const movePriceRow = (index: number, to: number) => applyDraft({ priceList: moveItem(draft.priceList, index, to) });

  // ---- Products ---------------------------------------------------------
  const setProductField = (index: number, key: keyof WebProduct, value: string) => {
    applyDraft({ products: draft.products.map((p, i) => (i === index ? { ...p, [key]: value } : p)) });
  };
  const setProductNum = (index: number, key: 'price' | 'stock', value: number) => {
    applyDraft({ products: draft.products.map((p, i) => (i === index ? { ...p, [key]: value } : p)) });
  };
  const addProduct = () => {
    const product: WebProduct = {
      id: uid('prod'),
      name: '',
      price: 0,
      category: 'Second hand parts' as WebProductCategory,
      image: '',
      stock: 1,
    };
    applyDraft({ products: [...draft.products, product] });
    setExpanded((prev) => ({ ...prev, [product.id]: true }));
  };
  const removeProduct = (index: number) => applyDraft({ products: draft.products.filter((_, i) => i !== index) });
  const duplicateProduct = (index: number) => {
    const copy = { ...draft.products[index], id: uid('prod') };
    const products = draft.products.slice();
    products.splice(index + 1, 0, copy);
    applyDraft({ products });
    setExpanded((prev) => ({ ...prev, [copy.id]: true }));
  };
  const moveProduct = (index: number, to: number) => applyDraft({ products: moveItem(draft.products, index, to) });

  // ---- Socials ----------------------------------------------------------
  const setSocialField = (index: number, key: keyof WebSocialLink, value: string) => {
    applyDraft({ socials: draft.socials.map((s, i) => (i === index ? ({ ...s, [key]: value } as WebSocialLink) : s)) });
  };
  const addSocial = () => {
    const social: WebSocialLink = { id: uid('soc'), platform: '', url: '' };
    applyDraft({ socials: [...draft.socials, social] });
    setExpanded((prev) => ({ ...prev, [social.id]: true }));
  };
  const removeSocial = (index: number) => applyDraft({ socials: draft.socials.filter((_, i) => i !== index) });
  const moveSocial = (index: number, to: number) => applyDraft({ socials: moveItem(draft.socials, index, to) });

  // ---- Gallery ----------------------------------------------------------
  const setGalleryUrl = (index: number, url: string) =>
    applyDraft({ galleryImages: draft.galleryImages.map((g, i) => (i === index ? { ...g, url } : g)) });
  const addGalleryImage = () => {
    const image = { id: uid('gallery'), url: '' };
    applyDraft({ galleryImages: [...draft.galleryImages, image] });
    setExpanded((prev) => ({ ...prev, [image.id]: true }));
  };
  const removeGalleryImage = (index: number) =>
    applyDraft({ galleryImages: draft.galleryImages.filter((_, i) => i !== index) });
  const moveGalleryImage = (index: number, to: number) => applyDraft({ galleryImages: moveItem(draft.galleryImages, index, to) });

  // ---- Repeatable text lists -------------------------------------------
  const setAnnouncement = (index: number, value: string) =>
    applyDraft({ siteAnnouncements: draft.siteAnnouncements.map((a, i) => (i === index ? value : a)) });
  const addAnnouncement = () => applyDraft({ siteAnnouncements: [...draft.siteAnnouncements, ''] });
  const removeAnnouncement = (index: number) =>
    applyDraft({ siteAnnouncements: draft.siteAnnouncements.filter((_, i) => i !== index) });

  const setDisclaimer = (index: number, value: string) =>
    applyDraft({ shopDisclaimers: draft.shopDisclaimers.map((d, i) => (i === index ? value : d)) });
  const addDisclaimer = () => applyDraft({ shopDisclaimers: [...draft.shopDisclaimers, ''] });
  const removeDisclaimer = (index: number) =>
    applyDraft({ shopDisclaimers: draft.shopDisclaimers.filter((_, i) => i !== index) });

  const resetDefaults = () => {
    setDraft(JSON.parse(JSON.stringify(DEFAULT_WEBSITE_CONTENT)) as WebsiteContent);
    setExpanded({});
  };

  // ---- Filtered rows ----------------------------------------------------
  const faqRows = draft.faqs
    .map((faq, index) => ({ faq, index }))
    .filter(({ faq }) => match(faq.q, faq.a, faq.section));
  const priceRows = draft.priceList
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => match(row.group, row.item, row.desc, row.price, row.note));
  const productRows = draft.products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => match(product.name, product.description, product.category));
  const socialRows = draft.socials
    .map((social, index) => ({ social, index }))
    .filter(({ social }) => match(social.platform, social.url));
  const galleryRows = draft.galleryImages
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => match(image.url));

  // Prose sections hide when a search cannot reach them; list sections stay
  // mounted so their "no match" message can explain an empty result.
  const sectionVisible: Record<WebsiteSectionId, boolean> = {
    hero: match(
      'Hero & Contact',
      draft.heroBadge,
      draft.heroTitle,
      draft.heroSubtitle,
      draft.calloutCta,
      draft.calloutUrl,
      draft.phone,
      draft.email,
      draft.heroBlurb,
      draft.reviewBlurb,
      draft.feedbackBody,
      draft.feedbackTitle,
      draft.siteAnnouncements.join(' ')
    ),
    location: match('Location', draft.locationQuote, draft.mobileTitle, draft.mobileBody, draft.locationImage),
    join: match('Join the Team', draft.joinTitle, draft.joinBody, draft.joinCtaLabel, draft.joinBullets.join(' ')),
    faqs: true,
    prices: true,
    socials: true,
  };

  const expandAll = (ids: string[]) => setExpanded(Object.fromEntries(ids.map((id) => [id, true])));
  const collapseAll = () => setExpanded({});

  const statusChip = (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${dirty ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
      {dirty ? 'Unsaved changes' : 'All changes published'}
    </span>
  );

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Marketing Website Manager</h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Edit the public website. Use the search box to jump straight to a field, click a row to open it, and publish when you are done.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusChip}
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={`pressable inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer ${isDark ? 'border-neutral-700 text-neutral-200 hover:border-emerald-500/60' : 'border-neutral-200 text-neutral-700 hover:border-emerald-500/60'}`}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Preview Site'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || hasErrors}
              className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Publish Changes
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <StatChip isDark={isDark}>{content.faqs.length} FAQs</StatChip>
          <StatChip isDark={isDark}>{content.priceList.length} price rows</StatChip>
          <StatChip isDark={isDark}>{content.products.length} products</StatChip>
          <StatChip isDark={isDark}>{content.socials.length} socials</StatChip>
          <StatChip isDark={isDark}>Published {content.updatedAt ? new Date(content.updatedAt).toLocaleString() : 'never'}</StatChip>
        </div>
      </div>

      {/* Search + area switcher */}
      <div className={`rounded-2xl border p-3 space-y-3 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search website content — e.g. brake, opening hours, price, Instagram…"
            aria-label="Search website content"
            className={`${inputCls(isDark)} !pl-9 !pr-9`}
          />
          {searching && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-neutral-500 hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: 'website', label: 'Main Website', hint: 'Hero, pages, FAQs, prices, socials' },
            { id: 'shop', label: 'Shop & Stock', hint: 'Products, prices, stock levels' },
            { id: 'gallery', label: 'Gallery', hint: 'Photos shown on the site' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => changeEditorTab(t.id)}
              className={`rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer border ${
                editorTab === t.id
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25'
                  : isDark
                    ? 'border-transparent text-neutral-300 hover:bg-neutral-800/60'
                    : 'border-transparent text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <span className="block text-xs font-black uppercase tracking-wider">{t.label}</span>
              <span className={`block text-[10px] font-medium mt-0.5 ${editorTab === t.id ? 'text-neutral-900/80' : isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Validation summary — surfaces why Publish is disabled. */}
      {hasErrors && (
        <div
          role="alert"
          data-testid="cms-validation-summary"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"
        >
          {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's need' : ' needs'} attention before you can publish.
        </div>
      )}

      {/* Section picker for the Main Website area — focus one section or all */}
      {editorTab === 'website' && (
        <div data-testid="cms-section-picker" className="sticky top-2 z-20">
          <TileGroup label="Website sections">
            <TileGrid cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              <TileButton
                icon={LayoutGrid}
                label="All sections"
                hint="Show everything"
                actionLabel="View all"
                active={activeSection === 'all'}
                onSelect={() => changeSection('all')}
                testId="cms-section-all"
              />
              {WEBSITE_SECTIONS.map((s) => (
                <TileButton
                  key={s.id}
                  icon={s.icon}
                  label={s.label}
                  actionLabel="Edit"
                  active={activeSection === s.id}
                  onSelect={() => changeSection(s.id)}
                  testId={`cms-section-${s.id}`}
                />
              ))}
            </TileGrid>
          </TileGroup>
        </div>
      )}

      {showPreview && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
          <details open={previewOpen} onToggle={(e) => setPreviewOpen((e.target as HTMLDetailsElement).open)}>
            <summary className={`text-xs font-black uppercase tracking-widest cursor-pointer ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
              Draft preview — {draft.heroTitle}
            </summary>
            <div className="mt-3 text-xs space-y-1">
              <p className={isDark ? 'text-neutral-300' : 'text-neutral-600'}>Hero blurb: {draft.heroBlurb}</p>
              <p className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>Phone: {draft.phone} · Email: {draft.email} · Book CTA: {draft.calloutCta}</p>
              <p className="rounded-full border px-2 py-0.5 text-[10px] inline-block">Promotions shown on Home come from the Promotions manager</p>
            </div>
          </details>
        </div>
      )}

      {/* ---- Main Website ---- */}
      {editorTab === 'website' && sectionVisible.hero && sectionActive('hero') && (
        <div>
          <SectionCard title="Hero & Contact" subtitle="Shown on Home and reused across every page." isDark={isDark}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Hero badge" isDark={isDark} value={draft.heroBadge} onChange={(v) => setTextField('heroBadge', v)} />
              <Field label="Hero title" isDark={isDark} value={draft.heroTitle} error={errors.heroTitle} onChange={(v) => setTextField('heroTitle', v)} />
              <Field label="Hero subtitle" isDark={isDark} value={draft.heroSubtitle} onChange={(v) => setTextField('heroSubtitle', v)} />
              <Field label="Call-out CTA label" isDark={isDark} value={draft.calloutCta} onChange={(v) => setTextField('calloutCta', v)} />
              <Field label="External booking URL" isDark={isDark} value={draft.calloutUrl} error={errors.calloutUrl} onChange={(v) => setTextField('calloutUrl', v)} />
              <Field label="Phone (call-out number)" isDark={isDark} value={draft.phone} error={errors.phone} onChange={(v) => setTextField('phone', v)} />
              <Field label="Email" isDark={isDark} value={draft.email} error={errors.email} onChange={(v) => setTextField('email', v)} />
            </div>
            <Field label="Hero blurb — call-out-only pitch (Home)" isDark={isDark} textarea value={draft.heroBlurb} onChange={(v) => setTextField('heroBlurb', v)} />
            <Field label='Review / feedback intro (Home "Leave a Review")' isDark={isDark} textarea value={draft.reviewBlurb} onChange={(v) => setTextField('reviewBlurb', v)} />
            <Field label="Feedback body" isDark={isDark} textarea value={draft.feedbackBody} onChange={(v) => setTextField('feedbackBody', v)} />
            <Field label="Feedback section title" isDark={isDark} value={draft.feedbackTitle} onChange={(v) => setTextField('feedbackTitle', v)} />
            <div className={`rounded-xl border p-3.5 space-y-2.5 ${isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className={`block text-xs font-black uppercase tracking-wider ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>Announcement ribbon</span>
                  <span className="block text-[10px] text-neutral-500">Rotates at the top of the public site — the website's own voice, separate from in-store notices.</span>
                </div>
                <button
                  type="button"
                  onClick={addAnnouncement}
                  className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {draft.siteAnnouncements.length === 0 && (
                <p className="text-[11px] text-neutral-500">No announcements — the ribbon is hidden.</p>
              )}
              {draft.siteAnnouncements.map((a, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={`Announcement ${i + 1}`} isDark={isDark} value={a} onChange={(v) => setAnnouncement(i, v)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm('Remove this announcement?')) removeAnnouncement(i); }}
                    className="pressable mb-1 inline-flex items-center rounded-lg border border-rose-900 px-2 py-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    aria-label={`Remove announcement ${i + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {editorTab === 'website' && sectionVisible.location && sectionActive('location') && (
        <div>
          <SectionCard title="Location Page" isDark={isDark}>
            <Field label="Location quote (overlaid on image)" isDark={isDark} textarea value={draft.locationQuote} onChange={(v) => setTextField('locationQuote', v)} />
            <Field label="Mobile-only heading" isDark={isDark} value={draft.mobileTitle} onChange={(v) => setTextField('mobileTitle', v)} />
            <Field label="Mobile-only body" isDark={isDark} textarea value={draft.mobileBody} onChange={(v) => setTextField('mobileBody', v)} />
            <Field label="Location hero image URL" isDark={isDark} value={draft.locationImage} onChange={(v) => setTextField('locationImage', v)} />
          </SectionCard>
        </div>
      )}

      {editorTab === 'website' && sectionVisible.join && sectionActive('join') && (
        <div>
          <SectionCard title="Join the Team" isDark={isDark}>
            <Field label="Heading" isDark={isDark} value={draft.joinTitle} onChange={(v) => setTextField('joinTitle', v)} />
            <Field label="Pitch" isDark={isDark} textarea value={draft.joinBody} onChange={(v) => setTextField('joinBody', v)} />
            <Field label="CTA label (links to phone call)" isDark={isDark} value={draft.joinCtaLabel} onChange={(v) => setTextField('joinCtaLabel', v)} />
            <div>
              <span className={labelCls}>Bullet points (one per line)</span>
              <textarea
                rows={4}
                className={`${inputCls(isDark)} resize-y`}
                value={draft.joinBullets.join('\n')}
                onChange={(e) => applyDraft({ joinBullets: e.target.value.split('\n') })}
              />
            </div>
          </SectionCard>
        </div>
      )}

      {editorTab === 'website' && sectionVisible.faqs && sectionActive('faqs') && (
        <div>
          <SectionCard
            title="FAQs"
            subtitle="Repairs & Service · Parts & Accessories · General."
            isDark={isDark}
            action={
              <div className="flex items-center gap-1.5">
                <StatChip isDark={isDark}>{faqRows.length} shown</StatChip>
                <button type="button" onClick={() => expandAll(draft.faqs.map((f) => f.id))} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Expand all</button>
                <button type="button" onClick={collapseAll} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Collapse all</button>
              </div>
            }
          >
            <div className="space-y-2">
              {faqRows.length === 0 && <p className="text-[11px] text-neutral-500">No FAQs match “{search}”.</p>}
              {faqRows.map(({ faq, index }) => (
                <CollapsibleItem
                  key={faq.id}
                  title={faq.q || 'New question'}
                  subtitle={FAQ_SECTIONS.find((s) => s.value === faq.section)?.label}
                  isDark={isDark}
                  open={isOpen(faq.id, !faq.q && !faq.a)}
                  onToggle={() => toggle(faq.id, !faq.q && !faq.a)}
                  onDuplicate={() => duplicateFaq(index)}
                  onMoveUp={index > 0 ? () => moveFaq(index, index - 1) : undefined}
                  onMoveDown={index < draft.faqs.length - 1 ? () => moveFaq(index, index + 1) : undefined}
                  onRemove={() => removeFaq(index)}
                >
                  <div>
                    <span className={labelCls}>Section</span>
                    <select
                      value={faq.section}
                      onChange={(e) => setFaqField(index, 'section', e.target.value as WebFaqSection)}
                      className={`${inputCls(isDark)} !w-auto`}
                    >
                      {FAQ_SECTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <Field label="Question" isDark={isDark} value={faq.q} onChange={(v) => setFaqField(index, 'q', v)} />
                  <Field label="Answer" isDark={isDark} textarea value={faq.a} onChange={(v) => setFaqField(index, 'a', v)} />
                </CollapsibleItem>
              ))}
            </div>
            <button type="button" onClick={addFaq} className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add FAQ
            </button>
          </SectionCard>
        </div>
      )}

      {editorTab === 'website' && sectionVisible.prices && sectionActive('prices') && (
        <div>
          <SectionCard
            title="Price List"
            subtitle="Ballpark UK labour-only prices for bicycles and e-scooters."
            isDark={isDark}
            action={
              <div className="flex items-center gap-1.5">
                <StatChip isDark={isDark}>{priceRows.length} shown</StatChip>
                <button type="button" onClick={() => expandAll(draft.priceList.map((r) => r.id))} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Expand all</button>
                <button type="button" onClick={collapseAll} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Collapse all</button>
              </div>
            }
          >
            <Field label="Intro title" isDark={isDark} value={draft.priceIntroTitle} onChange={(v) => setTextField('priceIntroTitle', v)} />
            <Field label="Intro body" isDark={isDark} textarea value={draft.priceIntroBody} onChange={(v) => setTextField('priceIntroBody', v)} />
            <div>
              <span className={labelCls}>General pricing notes (one per line)</span>
              <textarea
                rows={4}
                className={`${inputCls(isDark)} resize-y`}
                value={draft.priceNotes.join('\n')}
                onChange={(e) => applyDraft({ priceNotes: e.target.value.split('\n') })}
              />
            </div>
            <div className="space-y-2">
              {priceRows.length === 0 && <p className="text-[11px] text-neutral-500">No price rows match “{search}”.</p>}
              {priceRows.map(({ row, index }) => (
                <CollapsibleItem
                  key={row.id}
                  title={row.item || 'New price row'}
                  subtitle={`${row.scope === 'bike' ? 'Bicycle' : 'E-Scooter'}${row.price ? ` · ${row.price}` : ''}`}
                  isDark={isDark}
                  open={isOpen(row.id, !row.item && !row.price)}
                  onToggle={() => toggle(row.id, !row.item && !row.price)}
                  onDuplicate={() => duplicatePriceRow(index)}
                  onMoveUp={index > 0 ? () => movePriceRow(index, index - 1) : undefined}
                  onMoveDown={index < draft.priceList.length - 1 ? () => movePriceRow(index, index + 1) : undefined}
                  onRemove={() => removePriceRow(index)}
                >
                  <div>
                    <span className={labelCls}>Applies to</span>
                    <select
                      value={row.scope}
                      onChange={(e) => setPriceField(index, 'scope', e.target.value as WebPriceItem['scope'])}
                      className={`${inputCls(isDark)} !w-auto`}
                    >
                      <option value="bike">Bicycle</option>
                      <option value="scooter">E-Scooter</option>
                    </select>
                  </div>
                  <Field label="Group heading" isDark={isDark} value={row.group} onChange={(v) => setPriceField(index, 'group', v)} />
                  <Field label="Item" isDark={isDark} value={row.item} onChange={(v) => setPriceField(index, 'item', v)} />
                  <Field label="Description" isDark={isDark} value={row.desc} onChange={(v) => setPriceField(index, 'desc', v)} />
                  <Field label="Ballpark price" isDark={isDark} value={row.price} onChange={(v) => setPriceField(index, 'price', v)} />
                  <Field label="Footnote / note (optional)" isDark={isDark} value={row.note ?? ''} onChange={(v) => setPriceField(index, 'note', v)} />
                </CollapsibleItem>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addPriceRow('bike')} className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add Bicycle Row
              </button>
              <button type="button" onClick={() => addPriceRow('scooter')} className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add E-Scooter Row
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {editorTab === 'website' && sectionVisible.socials && sectionActive('socials') && (
        <div>
          <SectionCard title="Social Links" subtitle="Footer + contact strip; used across every page." isDark={isDark}>
            <div className="space-y-2">
              {socialRows.length === 0 && <p className="text-[11px] text-neutral-500">No social links match “{search}”.</p>}
              {socialRows.map(({ social, index }) => (
                <CollapsibleItem
                  key={social.id}
                  title={social.platform || 'New social link'}
                  subtitle={social.url}
                  isDark={isDark}
                  open={isOpen(social.id, !social.platform && !social.url)}
                  onToggle={() => toggle(social.id, !social.platform && !social.url)}
                  onMoveUp={index > 0 ? () => moveSocial(index, index - 1) : undefined}
                  onMoveDown={index < draft.socials.length - 1 ? () => moveSocial(index, index + 1) : undefined}
                  onRemove={() => removeSocial(index)}
                >
                  <Field label="Platform" isDark={isDark} value={social.platform} onChange={(v) => setSocialField(index, 'platform', v)} />
                  <Field label="URL" isDark={isDark} value={social.url} error={errors[`social-${index}`]} onChange={(v) => setSocialField(index, 'url', v)} />
                </CollapsibleItem>
              ))}
            </div>
            <button type="button" onClick={addSocial} className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Social Link
            </button>
          </SectionCard>
        </div>
      )}

      {/* ---- Shop & Stock ---- */}
      {editorTab === 'shop' && (
        <SectionCard
          title="Shop Products"
          subtitle="Every item you add here appears on the public Shop and as a one-tap button on the staff Till — prices and stock stay in sync."
          isDark={isDark}
          action={
            <div className="flex items-center gap-1.5">
              <StatChip isDark={isDark}>{productRows.length} shown</StatChip>
              <button type="button" onClick={() => expandAll(draft.products.map((p) => p.id))} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Expand all</button>
              <button type="button" onClick={collapseAll} className="pressable rounded-lg border border-neutral-700 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer">Collapse all</button>
            </div>
          }
        >
          <div className={`rounded-xl border p-3.5 text-[11px] leading-relaxed ${isDark ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-200/90' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
            Add an item below and it is instantly sellable at the counter: the Till builds one button per product, priced and stock-capped, and selling it decrements this shelf count.
          </div>
          <Field label="Suspension notice title" isDark={isDark} value={draft.shopNoticeTitle} onChange={(v) => setTextField('shopNoticeTitle', v)} />
          <Field label="Suspension notice body" isDark={isDark} textarea value={draft.shopNoticeBody} onChange={(v) => setTextField('shopNoticeBody', v)} />
          <div className={`rounded-xl border p-3.5 space-y-2.5 ${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className={`block text-xs font-black uppercase tracking-wider ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>Customer disclaimers</span>
                <span className={`block text-[10px] ${isDark ? 'text-amber-200/70' : 'text-amber-800/80'}`}>Shown above the shop and again at checkout before the customer can order.</span>
              </div>
              <button type="button" onClick={addDisclaimer} className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {draft.shopDisclaimers.length === 0 && <p className="text-[11px] text-neutral-500">No disclaimers — customers will see nothing at checkout.</p>}
            {draft.shopDisclaimers.map((d, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={`Disclaimer ${i + 1}`} isDark={isDark} textarea value={d} onChange={(v) => setDisclaimer(i, v)} />
                </div>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Remove this note?')) removeDisclaimer(i); }}
                  className="pressable mb-1 inline-flex items-center rounded-lg border border-rose-900 px-2 py-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                  aria-label={`Remove disclaimer ${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {productRows.length === 0 && <p className="text-[11px] text-neutral-500">No products match “{search}”.</p>}
            {productRows.map(({ product, index }) => (
              <CollapsibleItem
                key={product.id}
                title={product.name || 'New product'}
                subtitle={[product.category, product.price ? `£${product.price}` : '', `${product.stock} in stock`].filter(Boolean).join(' · ')}
                isDark={isDark}
                open={isOpen(product.id, !product.name)}
                onToggle={() => toggle(product.id, !product.name)}
                badge={
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${product.stock > 0 ? 'border-emerald-800 text-emerald-400' : 'border-rose-900 text-rose-400'}`}>
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                }
                extraActions={
                  <button
                    type="button"
                    onClick={() => setQrProduct(product)}
                    className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-800 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                    title="Generate and print this item's QR code"
                  >
                    <QrCode className="w-3 h-3" /> QR
                  </button>
                }
                onDuplicate={() => duplicateProduct(index)}
                onMoveUp={index > 0 ? () => moveProduct(index, index - 1) : undefined}
                onMoveDown={index < draft.products.length - 1 ? () => moveProduct(index, index + 1) : undefined}
                onRemove={() => removeProduct(index)}
              >
                <Field label="Product name" isDark={isDark} value={product.name} onChange={(v) => setProductField(index, 'name', v)} />
                <Field label="Description" isDark={isDark} textarea value={product.description ?? ''} onChange={(v) => setProductField(index, 'description', v)} />
                <div className="grid grid-cols-3 gap-3">
                  <Field
                    label="Price (£)"
                    isDark={isDark}
                    value={String(product.price ?? '')}
                    onChange={(v) => {
                      const parsed = Number.parseFloat(v);
                      if (!Number.isNaN(parsed)) setProductNum(index, 'price', parsed);
                    }}
                  />
                  <Field
                    label="Was price (£)"
                    isDark={isDark}
                    hint="Optional"
                    value={product.wasPrice != null ? String(product.wasPrice) : ''}
                    onChange={(v) => {
                      if (v.trim() === '') {
                        applyDraft({ products: draft.products.map((p, idx) => (idx === index ? { ...p, wasPrice: undefined } : p)) });
                      } else {
                        const parsed = Number.parseFloat(v);
                        if (!Number.isNaN(parsed)) {
                          applyDraft({ products: draft.products.map((p, idx) => (idx === index ? { ...p, wasPrice: parsed } : p)) });
                        }
                      }
                    }}
                  />
                  <Field
                    label="Stock"
                    isDark={isDark}
                    value={String(product.stock ?? 0)}
                    onChange={(v) => {
                      const parsedStock = Number.parseInt(v, 10);
                      if (!Number.isNaN(parsedStock)) setProductNum(index, 'stock', parsedStock);
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Field label="Image URL" isDark={isDark} value={product.image} onChange={(v) => setProductField(index, 'image', v)} />
                  </div>
                  {product.image && (
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 mt-5">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="shrink-0 px-3.5 py-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all font-bold cursor-pointer h-[38px] mt-5 flex items-center justify-center">
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') setProductField(index, 'image', reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openDrivePicker('stock', (url) => setProductField(index, 'image', url))}
                    className="shrink-0 px-3.5 py-2 rounded-xl border border-emerald-800 bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-400 transition-all font-bold cursor-pointer h-[38px] mt-5 flex items-center justify-center"
                  >
                    Drive
                  </button>
                </div>
                <div>
                  <span className={labelCls}>Category</span>
                  <select
                    value={product.category}
                    onChange={(e) => setProductField(index, 'category', e.target.value)}
                    className={`${inputCls(isDark)} !w-auto`}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </CollapsibleItem>
            ))}
          </div>
          <button type="button" onClick={addProduct} className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </SectionCard>
      )}

      {/* ---- Gallery ---- */}
      {editorTab === 'gallery' && (
        <SectionCard
          title="Gallery"
          subtitle="Photos shown on the public site."
          isDark={isDark}
          action={<StatChip isDark={isDark}>{galleryRows.length} shown</StatChip>}
        >
          <div className="space-y-2">
            {galleryRows.length === 0 && <p className="text-[11px] text-neutral-500">No gallery images match “{search}”.</p>}
            {galleryRows.map(({ image, index }) => (
              <CollapsibleItem
                key={image.id}
                title={image.url ? `Image ${index + 1}` : 'New image'}
                subtitle={image.url}
                isDark={isDark}
                open={isOpen(image.id, !image.url)}
                onToggle={() => toggle(image.id, !image.url)}
                onMoveUp={index > 0 ? () => moveGalleryImage(index, index - 1) : undefined}
                onMoveDown={index < draft.galleryImages.length - 1 ? () => moveGalleryImage(index, index + 1) : undefined}
                onRemove={() => removeGalleryImage(index)}
              >
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Field label={`Gallery image ${index + 1}`} isDark={isDark} value={image.url} onChange={(v) => setGalleryUrl(index, v)} />
                  </div>
                  {image.url && (
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 mb-1">
                      <img src={image.url} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="shrink-0 px-3.5 py-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all font-bold cursor-pointer h-[38px] mb-1 flex items-center justify-center">
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') setGalleryUrl(index, reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => openDrivePicker('gallery', (url) => setGalleryUrl(index, url))}
                    className="shrink-0 px-3.5 py-2 rounded-xl border border-emerald-800 bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-400 transition-all font-bold cursor-pointer h-[38px] mb-1 flex items-center justify-center"
                  >
                    Drive
                  </button>
                </div>
              </CollapsibleItem>
            ))}
          </div>
          <button type="button" onClick={addGalleryImage} className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add Gallery Image
          </button>
        </SectionCard>
      )}

      {/* Sticky action bar — publish/discard are always reachable. */}
      <div className={`sticky bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border p-3 backdrop-blur ${isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-neutral-200'}`}>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || hasErrors}
          className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" /> Publish Changes
        </button>
        <button
          type="button"
          onClick={discard}
          disabled={!dirty}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800/60 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" /> Discard changes
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-amber-900 px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-950/40 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Reload Defaults
        </button>
        <span className={`text-[10px] font-mono ml-auto ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {dirty ? 'Unsaved changes · ⌘/Ctrl+S to publish' : 'Saved'} · published {savedSink}× this session
        </span>
      </div>

      {qrProduct && <ItemQrModal product={qrProduct} isDark={isDark} onClose={() => setQrProduct(null)} />}

      {drivePicker && (
        <DriveImagePicker
          folder={drivePicker.folder}
          onClose={() => setDrivePicker(null)}
          onPick={(url) => {
            drivePicker.apply(url);
            setDrivePicker(null);
          }}
        />
      )}
    </div>
  );
};
