import type { ComponentType } from 'react';
import { Globe, Link as LinkIcon, MessageCircle, Send } from 'lucide-react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/Components/ui/icons';
import raw from '../../../data/social-platforms.json';

/**
 * The social-link vocabulary of an official entity: the keys a
 * `OfficialEntity.socials` object can carry, in display order, with the copy the
 * public tiles and the admin form use. From `resources/data/social-platforms.json`
 * — adding a platform is a data edit, and the form state, its inputs, the public
 * icon and its hover treatment all follow from this list.
 */
interface SocialPlatform {
  key: string;
  labelAr: string;
  labelEn: string;
  /** The admin form's field label. */
  formLabelAr: string;
  /** The input's accessible name. */
  inputAriaLabel: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = raw.map((platform) => ({
  key: platform.key,
  labelAr: platform.label_ar,
  labelEn: platform.label_en,
  formLabelAr: platform.form_label_ar,
  inputAriaLabel: platform.input_aria_label,
  placeholder: platform.placeholder,
}));

interface SocialVisual {
  Icon: ComponentType<{ className?: string }>;
  /** The brand colour class of the platform's icon. */
  iconClass: string;
  /** The tile's hover treatment for this platform. */
  hoverClass: string;
}

/**
 * The icons and brand colours. A component (and its Tailwind classes) cannot
 * live in the data file, so they live next to it and `socialVisual()` resolves
 * them by key; `social.test.ts` fails when the data file gains a key this map
 * does not paint.
 */
const SOCIAL_VISUALS: Record<string, SocialVisual> = {
  facebook: {
    Icon: Facebook,
    iconClass: 'text-[#1877F2]',
    hoverClass: 'hover:border-[#1877F2]/50 hover:bg-[#1877F2]/10',
  },
  instagram: {
    Icon: Instagram,
    iconClass: 'text-[#E4405F]',
    hoverClass: 'hover:border-[#E4405F]/50 hover:bg-[#E4405F]/10',
  },
  twitter: {
    Icon: Twitter,
    iconClass: 'text-[#1DA1F2]',
    hoverClass: 'hover:border-[#1DA1F2]/50 hover:bg-[#1DA1F2]/10',
  },
  telegram: {
    Icon: Send,
    iconClass: 'text-[#26A5E4]',
    hoverClass: 'hover:border-[#26A5E4]/50 hover:bg-[#26A5E4]/10',
  },
  linkedin: {
    Icon: Linkedin,
    iconClass: 'text-[#0A66C2]',
    hoverClass: 'hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/10',
  },
  youtube: {
    Icon: Youtube,
    iconClass: 'text-[#FF0000]',
    hoverClass: 'hover:border-[#FF0000]/50 hover:bg-[#FF0000]/10',
  },
  whatsapp: {
    Icon: MessageCircle,
    iconClass: 'text-[#25D366]',
    hoverClass: 'hover:border-[#25D366]/50 hover:bg-[#25D366]/10',
  },
  website: {
    Icon: Globe,
    iconClass: 'text-primary',
    hoverClass: 'hover:border-primary/50 hover:bg-primary/10',
  },
};

const FALLBACK_VISUAL: SocialVisual = { Icon: LinkIcon, iconClass: '', hoverClass: '' };

/** A platform's icon and brand treatment; `_secondary` shares its primary's. */
export function socialVisual(key: string): SocialVisual {
  return SOCIAL_VISUALS[key] ?? SOCIAL_VISUALS[key.replace(/_secondary$/, '')] ?? FALLBACK_VISUAL;
}

/** The platform's name in the reader's language, or the raw key when unknown. */
export function socialPlatformLabel(key: string, language: 'ar' | 'en'): string {
  const platform = SOCIAL_PLATFORMS.find((entry) => entry.key === key);

  return platform === undefined ? key : language === 'ar' ? platform.labelAr : platform.labelEn;
}
