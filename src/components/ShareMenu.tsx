import React, { useEffect, useRef, useState } from 'react';
import { Share2, Copy, Check, Mail } from 'lucide-react';
import { SocialBrandIcon } from './SocialBrandIcon';

interface ShareMenuProps {
  /** Item name, used as the email subject. */
  title: string;
  /** Pre-written blurb people can send to friends and family. */
  text: string;
  /** Public link to the item. Defaults to the current page URL. */
  url?: string;
  isDark: boolean;
  className?: string;
}

/**
 * Share a product to friends and family via the official platform share
 * intents. Uses real brand marks and opens each network in a new tab so the
 * customer never loses their place in the shop.
 */
export const ShareMenu: React.FC<ShareMenuProps> = ({ title, text, url, isDark, className }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(shareUrl);
  const combined = encodeURIComponent(`${text} ${shareUrl}`);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard can be blocked in some in-app browsers; fall back to a prompt.
      window.prompt('Copy this link to share:', shareUrl);
    }
  };

  const targets: Array<{ slug: string; label: string; href: string }> = [
    { slug: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${combined}` },
    { slug: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { slug: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { slug: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
  ];

  const linkClass = `pressable inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
    isDark
      ? 'border-neutral-700 text-neutral-200 hover:border-emerald-500/50 hover:text-white'
      : 'border-neutral-300 text-neutral-700 hover:border-emerald-500/60 hover:text-neutral-900'
  }`;

  return (
    <div ref={rootRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Share ${title}`}
        className={`pressable inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
          isDark
            ? 'border-neutral-700 text-neutral-300 hover:border-emerald-500/50 hover:text-white'
            : 'border-neutral-300 text-neutral-600 hover:border-emerald-500/60 hover:text-neutral-900'
        }`}
      >
        <Share2 className="w-3.5 h-3.5" /> Share
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-56 rounded-2xl border p-2 shadow-2xl ${
            isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="grid grid-cols-2 gap-1.5">
            {targets.map((t) => (
              <a
                key={t.slug}
                role="menuitem"
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                <SocialBrandIcon platform={t.slug} className="w-3.5 h-3.5" /> {t.label}
              </a>
            ))}
          </div>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${combined}`}
            className={`${linkClass} mt-1.5 w-full`}
            onClick={() => setOpen(false)}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className={`${linkClass} mt-1.5 w-full`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
};
