import { Instagram, Facebook, type LucideIcon } from 'lucide-react';

/**
 * Stakey's Cycles public social profiles. A single source of truth so the
 * footer, and anything else that links out, stays in sync.
 */
export interface SocialLink {
  id: 'instagram' | 'facebook';
  label: string;
  handle: string;
  url: string;
  icon: LucideIcon;
}

export const SHOP_SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '@stakeyscycles22',
    url: 'https://www.instagram.com/stakeyscycles22',
    icon: Instagram,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: "Stakey's cycles",
    url: 'https://www.facebook.com/p/Stakeys-cycles-100088457832581',
    icon: Facebook,
  },
];
