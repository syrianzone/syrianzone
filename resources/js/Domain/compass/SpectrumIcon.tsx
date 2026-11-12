import React from 'react';
import {
  Wrench, Landmark, MoonStar, Flag, Globe, Scale, HeartHandshake, Puzzle, ScrollText, Shield,
  type LucideIcon,
} from 'lucide-react';

// Maps the `icon` string on each Spectrum to a Lucide component.
const ICONS: Record<string, LucideIcon> = {
  Wrench, Landmark, MoonStar, Flag, Globe, Scale, HeartHandshake, Puzzle, ScrollText, Shield,
};

export default function SpectrumIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && ICONS[name]) || Shield;
  return <Icon className={className} />;
}
