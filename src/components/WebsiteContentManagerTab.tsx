import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  resetWebsiteContent,
  updateWebsiteContent,
  useWebsiteContent,
} from '../context/WebsiteContentStore';
import { DEFAULT_WEBSITE_CONTENT } from '../data/websiteContent';
import { ItemQrModal } from './ItemQrModal';
import {
  WebFaq,
  WebPriceItem,
  WebProduct,
  WebProductCategory,
  WebSocialLink,
  WebFaqSection,
} from '../types/websiteContent';

const inputCls = (isDark: boolean): string =>
  `w-full rounded-xl border px-3 py-2 text-xs font-medium outline-none transition-colors ${
    isDark
      ? 'bg-neutral-950/60 border-neutral-800 text-neutral-100 focus:border-emerald-500/60'
      : 'bg-white border-neutral-200 text-neutral-900 focus:border-emerald-500/60'
  }`;

const labelCls = 'text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}}.${Math.random().toString(36).slice(2, 7)}`;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  isDark: boolean;
}

function Field({ label, value, onChange, textarea, isDark }: FieldProps) {
  if (textarea) {
    return (
      <label className="block">
        <span className={labelCls}>{label}</span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${inputCls(isDark)} resize-y`}
        />
      </label>
    );
  }
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls(isDark)}
      />
    </label>
  );
}

interface SectionCardProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  children: React.ReactNode;
}

function SectionCard({ title, subtitle, isDark, children }: SectionCardProps) {
  return (
    <section className={`rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
      <div>
        <h4 className={`text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-neutral-900'}`}>{title}</h4>
        {subtitle && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ListItemEditor<T>({
  item,
  index,
  fields,
  isDark,
  onField,
  onRemove,
}: {
  item: T;
  index: number;
  fields: { key: keyof T; label: string; textarea?: boolean }[];
  isDark: boolean;
  onField: (index: number, key: keyof T, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 ${isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
          #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>
      {fields.map((f) => (
        <Field
          key={String(f.key)}
          label={f.label}
          isDark={isDark}
          textarea={f.textarea}
          value={String(item[f.key] ?? '')}
          onChange={(v) => onField(index, f.key, v)}
        />
      ))}
    </div>
  );
}

export const WebsiteContentManagerTab: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const content = useWebsiteContent();
  const [showPreview, setShowPreview] = useState(false);
  const [editorTab, setEditorTab] = useState<'website' | 'shop' | 'gallery'>('website');
  const [draft, setDraft] = useState(content);
  const [savedSink, setSavedSink] = useState(0);
  const [qrProduct, setQrProduct] = useState<WebProduct | null>(null);

  const save = () => {
    // Publishing a brand-new item should hand staff its QR label straight away.
    const publishedIds = new Set(content.products.map((p) => p.id));
    const newlyAdded = draft.products.filter(
      (p) => !publishedIds.has(p.id) && (p.name.trim() || p.price > 0)
    );
    updateWebsiteContent(draft);
    setSavedSink((n) => n + 1);
    if (newlyAdded.length > 0) setQrProduct(newlyAdded[0]);
  };

  const applyDraft = (patch: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const setTextField = (key: keyof typeof draft, value: string) => {
    applyDraft({ [key]: value } as Partial<typeof draft>);
  };

  const setFaqField = (index: number, key: keyof WebFaq, value: string) => {
    const faqs = draft.faqs.map((f,i) => (i === index ? { ...f, [key]: value } as WebFaq: f));
    applyDraft({ faqs } as Partial<typeof draft>);
  };

  const addFaq = () => {
    const faq: WebFaq = { id: uid('faq'), section: 'general', q: '', a: '' };
    applyDraft({ faqs: [...draft.faqs, faq] } as Partial<typeof draft>);
  };

  const removeFaq = (index: number) => {
    applyDraft({ faqs: draft.faqs.filter((_,i) => i !== index) } as Partial<typeof draft>);
  };

  const setPriceField = (index: number, key: keyof WebPriceItem, value: string) => {
    const priceList = draft.priceList.map((r,i) => (i === index ? { ...r, [key]: value } as WebPriceItem: r));
    applyDraft({ priceList } as Partial<typeof draft>);
  };

  const addPriceRow = (scope: WebPriceItem['scope']) => {
    const row: WebPriceItem = { id: uid('p'), scope, group: '', item: '', desc: '', price: '', note: '' };
    applyDraft({ priceList: [...draft.priceList, row] } as Partial<typeof draft>);
  };

  const removePriceRow = (index: number) => {
    applyDraft({ priceList: draft.priceList.filter((_,i) => i !== index) } as Partial<typeof draft>);
  };

  const setProductField = (index: number, key: keyof WebProduct, value: string) => {
    const products = draft.products.map((p, i) => (i === index ? { ...p, [key]: value } : p));
    applyDraft({ products } as Partial<typeof draft>);
  };

  const setProductNum = (index: number, key: 'price' | 'stock', value: number) => {
    const products = draft.products.map((p, i) => (i === index ? { ...p, [key]: value } : p));
    applyDraft({ products } as Partial<typeof draft>);
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
    applyDraft({ products: [...draft.products, product] } as Partial<typeof draft>);
  };

  const removeProduct = (index: number) => {
    applyDraft({ products: draft.products.filter((_,i) => i !== index) } as Partial<typeof draft>);
  };

  const setSocialField = (index: number, key: keyof WebSocialLink, value: string) => {
    const socials = draft.socials.map((s,i) => (i === index ? { ...s, [key]: value } as WebSocialLink: s));
    applyDraft({ socials } as Partial<typeof draft>);
  };

  const addSocial = () => {
    const social: WebSocialLink = { id: uid('soc'), platform: '', url: '' };
    applyDraft({ socials: [...draft.socials, social] } as Partial<typeof draft>);
  };

  const removeSocial = (index: number) => {
    applyDraft({ socials: draft.socials.filter((_,i) => i !== index) } as Partial<typeof draft>);
  };

  const resetDefaults = () => {
    const next = JSON.parse(JSON.stringify(DEFAULT_WEBSITE_CONTENT)) as typeof content;
    setDraft(next);
  };

  const faqSections: { value: WebFaqSection; label: string }[] = [
    { value: 'repairs', label: 'Repairs & Service' },
    { value: 'parts', label: 'Parts & Accessories' },
    { value: 'general', label: 'General Information' },
  ];

  const categoryOptions: WebProductCategory[] = [
    'Second hand parts',
    'Mens Bikes',
    "women's Bikes",
    "Children's bikes",
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Marketing Website Manager
              </h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Edit the content shown on the public Website tab (recreated from stakeyscycles.square.site). Changes save to this device and auto-publish to the site preview.

              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Publish Changes
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDark ? 'bg-neutral-950/60 border border-neutral-800 text-neutral-400' : 'bg-neutral-100 border border-neutral-200 text-neutral-500'}`}>
            {content.faqs.length} FAQs · {content.priceList.length} price rows · {content.products.length} products · {content.socials.length} socials
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
            Saved {savedSink > 0 ? `${savedSink}×` : 'locally'} · publishes via Staff Station
          </span>
        </div>
      </div>

      {/* Separate the three publishing concerns so an editor never has to
          scroll past shop stock to change the gallery. */}
      <div className={`rounded-2xl border p-1.5 grid grid-cols-3 gap-1.5 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
        {([
          { id: 'website', label: 'Main Website', hint: 'Hero, pages, FAQs, prices, socials' },
          { id: 'shop', label: 'Shop & Stock', hint: 'Products, prices, stock levels' },
          { id: 'gallery', label: 'Gallery', hint: 'Photos shown on the site' },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setEditorTab(t.id)}
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

      {showPreview && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`}>
          <details open>
            <summary className={`text-xs font-black uppercase tracking-widest cursor-pointer ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
              Draft preview — {draft.heroTitle}
            </summary>
            <div className="mt-3 text-xs">
              <p className={isDark ? 'text-neutral-300' : 'text-neutral-600'}>Hero blurb: {draft.heroBlurb}</p>
              <p className={isDark ? 'text-neutral-400' : 'text-neutral-500'} mt-1>Phone: {draft.phone} · Email: {draft.email} · Book CTA: {draft.calloutCta}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="rounded-full border px-2 py-0.5 text-[10px]">Promotions shown on Home come from the Promotions manager</span>
              </div>
            </div>
          </details>
        </div>
      )}

      {editorTab === 'website' && (
      <SectionCard title="Hero & Contact" subtitle="Shown on Home and reused across every page." isDark={isDark}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Hero badge" isDark={isDark} value={draft.heroBadge} onChange={(v) => setTextField('heroBadge', v)} />
          <Field label="Hero title" isDark={isDark} value={draft.heroTitle} onChange={(v) => setTextField('heroTitle', v)} />
          <Field label="Hero subtitle" isDark={isDark} value={draft.heroSubtitle} onChange={(v) => setTextField('heroSubtitle', v)} />
          <Field label="Call-out CTA label" isDark={isDark} value={draft.calloutCta} onChange={(v) => setTextField('calloutCta', v)} />
          <Field label="External booking URL" isDark={isDark} value={draft.calloutUrl} onChange={(v) => setTextField('calloutUrl', v)} />
          <Field label="Phone (call-out number)" isDark={isDark} value={draft.phone} onChange={(v) => setTextField('phone', v)} />
          <Field label="Email" isDark={isDark} value={draft.email} onChange={(v) => setTextField('email', v)} />
        </div>
        <Field label="Hero blurb — call-out-only pitch (Home)" isDark={isDark} textarea value={draft.heroBlurb} onChange={(v) => setTextField('heroBlurb', v)} />
        <Field label='Review / feedback intro (Home "Leave a Review")' isDark={isDark} textarea value={draft.reviewBlurb} onChange={(v) => setTextField('reviewBlurb', v)} />
        <Field label="Feedback body" isDark={isDark} textarea value={draft.feedbackBody} onChange={(v) => setTextField('feedbackBody', v)} />
        <Field label="Feedback section title" isDark={isDark} value={draft.feedbackTitle} onChange={(v) => setTextField('feedbackTitle', v)} />
        <div className={`rounded-xl border p-3.5 space-y-2.5 ${isDark ? 'bg-neutral-950/40 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className={`block text-xs font-black uppercase tracking-wider ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>Announcement ribbon</span>
              <span className={`block text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>Rotates at the top of the public site — the website's own voice, separate from in-store notices.</span>
            </div>
            <button
              type="button"
              onClick={() => applyDraft({ siteAnnouncements: [...draft.siteAnnouncements, ''] } as Partial<typeof draft>)}
              className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {draft.siteAnnouncements.length === 0 && (
            <p className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>No announcements — the ribbon is hidden.</p>
          )}
          {draft.siteAnnouncements.map((a, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Announcement ${i + 1}`}
                  isDark={isDark}
                  value={a}
                  onChange={(v) => {
                    const siteAnnouncements = draft.siteAnnouncements.map((x, idx) => (idx === i ? v : x));
                    applyDraft({ siteAnnouncements } as Partial<typeof draft>);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => applyDraft({ siteAnnouncements: draft.siteAnnouncements.filter((_, idx) => idx !== i) } as Partial<typeof draft>)}
                className="pressable mb-1 inline-flex items-center rounded-lg border border-rose-900 px-2 py-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                aria-label={`Remove announcement ${i + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
      )}

      {editorTab === 'website' && (
      <SectionCard title="Location Page" isDark={isDark}>
        <Field label="Location quote (overlaid on image)" isDark={isDark} textarea value={draft.locationQuote} onChange={(v) => setTextField('locationQuote', v)} />
        <Field label="Mobile-only heading" isDark={isDark} value={draft.mobileTitle} onChange={(v) => setTextField('mobileTitle', v)} />
        <Field label="Mobile-only body" isDark={isDark} textarea value={draft.mobileBody} onChange={(v) => setTextField('mobileBody', v)} />
        <Field label="Location hero image URL" isDark={isDark} value={draft.locationImage} onChange={(v) => setTextField('locationImage', v)} />
      </SectionCard>
      )}

      {editorTab === 'website' && (
      <SectionCard title="Join the Team" isDark={isDark}>
        <Field label="Heading" isDark={isDark} value={draft.joinTitle} onChange={(v) => setTextField('joinTitle', v)} />
        <Field label="Pitch" isDark={isDark} textarea value={draft.joinBody} onChange={(v) => setTextField('joinBody', v)} />
        <Field label="CTA label (links to phone call)" isDark={isDark} value={draft.joinCtaLabel} onChange={(v) => setTextField('joinCtaLabel', v)} />
        <div className="space-y-2">
          <span className={labelCls}>Bullet points (one per line)</span>
          <textarea
            rows={4}
            className={`${inputCls(isDark)} resize-y`}
            value={draft.joinBullets.join('\n')}
            onChange={(e) => applyDraft({ joinBullets: e.target.value.split('\n') })}
          />
        </div>
      </SectionCard>
      )}

      {editorTab === 'website' && (
      <SectionCard title="FAQs" subtitle="Repairs & Service · Parts & Accessories · General." isDark={isDark}>
        <div className="space-y-3">
          {draft.faqs.map((faq, i) => (
            <div key={faq.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-neutral-500">#{i + 1}</span>
                <select
                  value={faq.section}
                  onChange={(e) => setFaqField(i, 'section', e.target.value as WebFaqSection)}
                  className={`${inputCls(isDark)} !w-auto`}
                >
                  {faqSections.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeFaq(i)}
                  className="ml-auto pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
              <Field label="Question" isDark={isDark} value={faq.q} onChange={(v) => setFaqField(i, 'q', v)} />
              <Field label="Answer" isDark={isDark} textarea value={faq.a} onChange={(v) => setFaqField(i, 'a', v)} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFaq}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer w-full justify-center"
        >
          <Plus className="w-3.5 h-3.5" /> Add FAQ
        </button>
      </SectionCard>
      )}

      {editorTab === 'website' && (
      <SectionCard title="Price List" subtitle="Ballpark UK labour-only prices for bicycles and e-scooters." isDark={isDark}>
        <Field label="Intro title" isDark={isDark} value={draft.priceIntroTitle} onChange={(v) => setTextField('priceIntroTitle', v)} />
        <Field label="Intro body" isDark={isDark} textarea value={draft.priceIntroBody} onChange={(v) => setTextField('priceIntroBody', v)} />
        <div className="space-y-2">
          <span className={labelCls}>General pricing notes (one per line)</span>
          <textarea
            rows={4}
            className={`${inputCls(isDark)} resize-y`}
            value={draft.priceNotes.join('\n')}
            onChange={(e) => applyDraft({ priceNotes: e.target.value.split('\n') })}
          />
        </div>
        <div className="space-y-3">
          {draft.priceList.map((row, i) => (
            <div key={row.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-neutral-500">#{i + 1}</span>
                <select
                  value={row.scope}
                  onChange={(e) => setPriceField(i, 'scope', e.target.value as WebPriceItem['scope'])}
                  className={`${inputCls(isDark)} !w-auto`}
                >
                  <option value="bike">Bicycle</option>
                  <option value="scooter">E-Scooter</option>
                </select>
                <button
                  type="button"
                  onClick={() => removePriceRow(i)}
                  className="ml-auto pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
              <Field label="Group heading" isDark={isDark} value={row.group} onChange={(v) => setPriceField(i, 'group', v)} />
              <Field label="Item" isDark={isDark} value={row.item} onChange={(v) => setPriceField(i, 'item', v)} />
              <Field label="Description" isDark={isDark} value={row.desc} onChange={(v) => setPriceField(i, 'desc', v)} />
              <Field label="Ballpark price" isDark={isDark} value={row.price} onChange={(v) => setPriceField(i, 'price', v)} />
              <Field label="Footnote / note (optional)" isDark={isDark} value={row.note ?? ''} onChange={(v) => setPriceField(i, 'note', v)} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addPriceRow('bike')}
            className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Bicycle Row
          </button>
          <button
            type="button"
            onClick={() => addPriceRow('scooter')}
            className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add E-Scooter Row
          </button>
        </div>
      </SectionCard>
      )}

      {editorTab === 'shop' && (
      <SectionCard title="Shop Products" subtitle="Every item you add here appears on the public Shop and as a one-tap button on the staff Till — prices and stock stay in sync." isDark={isDark}>
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
            <button
              type="button"
              onClick={() => applyDraft({ shopDisclaimers: [...draft.shopDisclaimers, ''] } as Partial<typeof draft>)}
              className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {draft.shopDisclaimers.length === 0 && (
            <p className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>No disclaimers — customers will see nothing at checkout.</p>
          )}
          {draft.shopDisclaimers.map((d, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Disclaimer ${i + 1}`}
                  isDark={isDark}
                  textarea
                  value={d}
                  onChange={(v) => {
                    const shopDisclaimers = draft.shopDisclaimers.map((x, idx) => (idx === i ? v : x));
                    applyDraft({ shopDisclaimers } as Partial<typeof draft>);
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => applyDraft({ shopDisclaimers: draft.shopDisclaimers.filter((_, idx) => idx !== i) } as Partial<typeof draft>)}
                className="pressable mb-1 inline-flex items-center rounded-lg border border-rose-900 px-2 py-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                aria-label={`Remove disclaimer ${i + 1}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {draft.products.map((product, i) => (
            <div key={product.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-neutral-500">#{i + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQrProduct(product)}
                    className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-800 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                    title="Generate and print this item's QR code"
                  >
                    <QrCode className="w-3 h-3" /> QR code
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(i)}
                    className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
              <Field label="Product name" isDark={isDark} value={product.name} onChange={(v) => setProductField(i, 'name', v)} />
              <Field label="Description" isDark={isDark} textarea value={product.description ?? ''} onChange={(v) => setProductField(i, 'description', v)} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Price (£)" isDark={isDark} value={String(product.price ?? '')} onChange={(v) => {
                  const parsed = Number.parseFloat(v);
                  if (!Number.isNaN(parsed)) setProductNum(i, 'price', parsed);
                }} />
                <Field label="Was price (£, optional)"isDark={isDark} value={product.wasPrice != null ? String(product.wasPrice) : ''} onChange={(v) => {
                  if (v.trim() === '') {
                    const products = draft.products.map((p, idx) => (idx === i ? { ...p, wasPrice: undefined } : p));
                    applyDraft({ products } as Partial<typeof draft>);
                  } else {
                    const parsedd = Number.parseFloat(v);
                    if (!Number.isNaN(parsedd)) {
                      const products = draft.products.map((p, idx) => (idx === i ? { ...p, wasPrice: parsedd } : p));
                      applyDraft({ products } as Partial<typeof draft>);
                    }
                  }
                }} />
                <Field label="Stock" isDark={isDark} value={String(product.stock ?? 0)} onChange={(v) => {
                  const parsedStock = Number.parseInt(v, 10);
                  if (!Number.isNaN(parsedStock)) setProductNum(i, 'stock', parsedStock);
                }} />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Field label="Image URL" isDark={isDark} value={product.image} onChange={(v) => setProductField(i, "image", v)} />
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
                          if (typeof reader.result === "string") {
                            setProductField(i, "image", reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <div>
                <span className={labelCls}>Category</span>
                <select
                  value={product.category}
                  onChange={(e) => setProductField(i, 'category', e.target.value)}
                  className={`${inputCls(isDark)} !w-auto`}
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addProduct}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer w-full justify-center"
        >
          <Plus className="w-3.5 h-3.5" /> Add Product
        </button>
      </SectionCard>
      )}

      {editorTab === 'gallery' && (
      <SectionCard title="Gallery" isDark={isDark}>
        <div className="space-y-3">
          {draft.galleryImages.map((img, i) => (
            <div key={img.id} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label={"Gallery image " + (i + 1)} isDark={isDark} value={img.url} onChange={(v) => {
                  const galleryImages = draft.galleryImages.map((g, idx) => (idx === i ? { ...g, url: v } : g));
                  applyDraft({ galleryImages } as Partial<typeof draft>);
                }} />
              </div>
              {img.url && (
                <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900 mb-1">
                  <img src={img.url} alt={"Gallery " + (i + 1)} className="w-full h-full object-cover" />
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
                        if (typeof reader.result === 'string') {
                          const galleryImages = draft.galleryImages.map((g, idx) => (idx === i ? { ...g, url: reader.result } : g));
                          applyDraft({ galleryImages } as Partial<typeof draft>);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const galleryImages = draft.galleryImages.filter((g) => g.id !== img.id);
                  applyDraft({ galleryImages } as Partial<typeof draft>);
                }}
                className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const galleryImages = [...draft.galleryImages, { id: uid('gallery'), url: '' }];
            applyDraft({ galleryImages } as Partial<typeof draft>);
          }}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Gallery Image
        </button>
      </SectionCard>
      )}

      {editorTab === 'website' && (
      <SectionCard title="Social Links" subtitle="Footer + contact strip; used across every page." isDark={isDark}>
        <div className="space-y-3">
          {draft.socials.map((social, i) => (
            <div key={social.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Platform" isDark={isDark} value={social.platform} onChange={(v) => setSocialField(i, 'platform', v)} />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="URL" isDark={isDark} value={social.url} onChange={(v) => setSocialField(i, 'url', v)} />
                </div>
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  className="pressable inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSocial}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Social Link
        </button>
      </SectionCard>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
        >
          <Save className="w-4 h-4" /> Publish Changes
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="pressable inline-flex items-center gap-2 rounded-xl border border-amber-900 px-4 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-950/40 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Discard Draft &amp; Reload Defaults
        </button>
        <span className={`text-[10px] font-mono ml-auto ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
          Saved {savedSink}× this session · Last published {content.updatedAt ? new Date(content.updatedAt).toLocaleString() : 'never'}
        </span>
      </div>

      {qrProduct && (
        <ItemQrModal product={qrProduct} isDark={isDark} onClose={() => setQrProduct(null)} />
      )}
    </div>
  );
};