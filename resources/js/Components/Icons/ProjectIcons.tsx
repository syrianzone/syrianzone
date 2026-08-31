import React from 'react';

export interface ProjectIconProps {
  className?: string;
}

// 1. SyOfficial (Official Accounts - Verified Shield)
export function SyOfficialIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3L5 7v9c0 7.2 4.7 13.9 11 16 6.3-2.1 11-8.8 11-16V7L16 3z"
        className="fill-[#3B82F6]/15 dark:fill-[#60A5FA]/25 stroke-[#2563EB] dark:stroke-[#60A5FA]"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 16l3.5 3.5L21 11"
        className="stroke-[#10B981] dark:stroke-[#34D399]"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Theme Accent Touch */}
      <circle cx="21" cy="11" r="2" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 2. Roznama (Calendar & Events - Colorful Date Card)
export function RoznamaIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="24" height="22" rx="4" className="fill-[#EF4444]/10 dark:fill-[#FB7185]/20 stroke-[#E11D48] dark:stroke-[#FB7185]" strokeWidth="2" />
      <path d="M4 12h24" className="stroke-[#EF4444] dark:stroke-[#FB7185]" strokeWidth="2" />
      <path d="M9 3v5M23 3v5" className="stroke-[#3B82F6] dark:stroke-[#60A5FA]" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="10" cy="18" r="1.5" className="fill-[#10B981] dark:fill-[#34D399]" />
      <circle cx="16" cy="18" r="1.5" className="fill-[#F59E0B] dark:fill-[#FBBF24]" />
      <circle cx="22" cy="18" r="1.5" className="fill-[#3B82F6] dark:fill-[#60A5FA]" />
      <circle cx="10" cy="23" r="1.5" className="fill-[#8B5CF6] dark:fill-[#C084FC]" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="23" r="2" fill="hsl(var(--primary))" />
      <circle cx="22" cy="23" r="1.5" className="fill-[#06B6D4] dark:fill-[#22D3EE]" />
    </svg>
  );
}

// 3. Phonebook (Directory - Amber & Emerald Directory Book)
export function PhonebookIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="20" height="24" rx="3" className="fill-[#F59E0B]/15 dark:fill-[#FBBF24]/20 stroke-[#D97706] dark:stroke-[#FBBF24]" strokeWidth="2" />
      <path d="M6 9h20" className="stroke-[#059669] dark:stroke-[#34D399]" strokeWidth="2" />
      <circle cx="16" cy="16" r="3.5" className="fill-[#10B981]/25 dark:fill-[#34D399]/30 stroke-[#059669] dark:stroke-[#34D399]" strokeWidth="2" />
      <path d="M11 24c0-2.8 2.2-5 5-5s5 2.2 5 5" className="stroke-[#374151] dark:stroke-[#E2E8F0]" strokeWidth="2" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <path d="M2 8v3M2 15v3M2 22v3" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 4. SyID (Visual Identity / Brand Palette)
export function SyIdIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="7" className="fill-[#EC4899]/20 dark:fill-[#F472B6]/30 stroke-[#DB2777] dark:stroke-[#F472B6]" strokeWidth="2" />
      <circle cx="20" cy="12" r="7" className="fill-[#3B82F6]/20 dark:fill-[#60A5FA]/30 stroke-[#2563EB] dark:stroke-[#60A5FA]" strokeWidth="2" />
      <path d="M6 26l7.5-7.5" className="stroke-[#8B5CF6] dark:stroke-[#C084FC]" strokeWidth="2.5" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="20" r="3" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 5. Party (Parties Directory - Purple & Orange People)
export function PartyIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="4" className="fill-[#8B5CF6]/25 dark:fill-[#A78BFA]/30 stroke-[#7C3AED] dark:stroke-[#A78BFA]" strokeWidth="2" />
      <circle cx="21" cy="11" r="4" className="fill-[#F97316]/25 dark:fill-[#FB923C]/30 stroke-[#EA580C] dark:stroke-[#FB923C]" strokeWidth="2" />
      <path d="M4 25c0-3.9 3.1-7 7-7s7 3.1 7 7" className="stroke-[#7C3AED] dark:stroke-[#A78BFA]" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 25c0-3.1 2.2-5.7 5.2-6.6M14 25h14" className="stroke-[#EA580C] dark:stroke-[#FB923C]" strokeWidth="2" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="18" r="2" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 6. Tierlist (Government Rankings - Gold, Blue, Emerald Bars)
export function TierlistIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="24" height="6" rx="2" className="fill-[#F59E0B] dark:fill-[#FBBF24]" opacity="0.9" />
      <rect x="4" y="13" width="24" height="6" rx="2" className="fill-[#3B82F6] dark:fill-[#60A5FA]" opacity="0.85" />
      <rect x="4" y="21" width="24" height="6" rx="2" className="fill-[#10B981] dark:fill-[#34D399]" opacity="0.85" />
      <path d="M8 8h6M8 16h10M8 24h14" className="stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="2" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="25" cy="8" r="1.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 7. House (Parliament / Legislative House)
export function HouseIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3L3 10v3h26v-3L16 3z" className="fill-[#0284C7]/25 dark:fill-[#38BDF8]/30 stroke-[#0284C7] dark:stroke-[#38BDF8]" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 13v11M11 13v11M16 13v11M21 13v11M26 13v11" className="stroke-[#64748B] dark:stroke-[#CBD5E1]" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 24h26v4H3v-4z" className="fill-[#475569]/20 dark:fill-[#94A3B8]/30 stroke-[#475569] dark:stroke-[#94A3B8]" strokeWidth="2" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="7" r="1.8" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 8. Compass (Political Compass - Four Quarter Needle)
export function CompassIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13" className="fill-[#06B6D4]/10 dark:fill-[#22D3EE]/20 stroke-[#0891B2] dark:stroke-[#22D3EE]" strokeWidth="2" />
      <polygon points="16,6 20,16 16,16" className="fill-[#EF4444] dark:fill-[#F87171]" />
      <polygon points="16,26 12,16 16,16" className="fill-[#3B82F6] dark:fill-[#60A5FA]" />
      <polygon points="6,16 16,12 16,16" className="fill-[#F59E0B] dark:fill-[#FBBF24]" />
      <polygon points="26,16 16,20 16,16" className="fill-[#10B981] dark:fill-[#34D399]" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="16" r="2.5" fill="hsl(var(--primary))" className="stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="1" />
    </svg>
  );
}

// 9. Priorities (Syria Priorities - Multicolor Sliders)
export function PrioritiesIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 8h22" className="stroke-[#3B82F6] dark:stroke-[#60A5FA]" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 16h22" className="stroke-[#10B981] dark:stroke-[#34D399]" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 24h22" className="stroke-[#F59E0B] dark:stroke-[#FBBF24]" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="8" r="3.5" className="fill-[#3B82F6] dark:fill-[#60A5FA] stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="1.5" />
      <circle cx="21" cy="16" r="3.5" className="fill-[#10B981] dark:fill-[#34D399] stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="1.5" />
      {/* Theme Accent Touch */}
      <circle cx="14" cy="24" r="3.5" fill="hsl(var(--primary))" className="stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="1.5" />
    </svg>
  );
}

// 10. Sites (Sites Directory - Indigo & Emerald Link)
export function SitesIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 18l-3 3a4.24 4.24 0 01-6-6l3-3a4.24 4.24 0 016 0" className="stroke-[#6366F1] dark:stroke-[#818CF8]" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 14l3-3a4.24 4.24 0 016 6l-3 3a4.24 4.24 0 01-6 0" className="stroke-[#10B981] dark:stroke-[#34D399]" strokeWidth="2.5" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <line x1="12" y1="20" x2="20" y2="12" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// 11. Population (Atlas - Emerald Globe)
export function PopulationIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13" className="fill-[#10B981]/15 dark:fill-[#34D399]/25 stroke-[#059669] dark:stroke-[#34D399]" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="13" ry="5" className="stroke-[#3B82F6] dark:stroke-[#60A5FA]" strokeWidth="2" />
      <path d="M16 3v26" className="stroke-[#059669] dark:stroke-[#34D399]" strokeWidth="2" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="16" r="2.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 12. GovApps (Government Applications - Phone Shell & App Tiles)
export function GovAppsIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="3" width="16" height="26" rx="3" className="fill-[#475569]/15 dark:fill-[#94A3B8]/20 stroke-[#334155] dark:stroke-[#94A3B8]" strokeWidth="2" />
      <path d="M14 6h4" className="stroke-[#64748B] dark:stroke-[#CBD5E1]" strokeWidth="2" strokeLinecap="round" />
      <rect x="11" y="10" width="4" height="4" rx="1" className="fill-[#3DDC84] dark:fill-[#4ADE80]" />
      <rect x="17" y="10" width="4" height="4" rx="1" className="fill-[#3B82F6] dark:fill-[#60A5FA]" />
      <rect x="11" y="16" width="4" height="4" rx="1" className="fill-[#F59E0B] dark:fill-[#FBBF24]" />
      {/* Theme Accent Touch */}
      <rect x="17" y="16" width="4" height="4" rx="1" fill="hsl(var(--primary))" />
      <circle cx="16" cy="24" r="1.5" className="fill-[#64748B] dark:fill-[#94A3B8]" />
    </svg>
  );
}

// 13. Transit (Transit / Transport - Yellow & Blue Bus)
export function TransitIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="5" width="20" height="19" rx="4" className="fill-[#EAB308]/20 dark:fill-[#FACC15]/25 stroke-[#CA8A04] dark:stroke-[#FACC15]" strokeWidth="2" />
      <path d="M6 13h20" className="stroke-[#2563EB] dark:stroke-[#60A5FA]" strokeWidth="2" />
      <circle cx="10" cy="18" r="2" className="fill-[#2563EB] dark:fill-[#60A5FA]" />
      <circle cx="22" cy="18" r="2" className="fill-[#2563EB] dark:fill-[#60A5FA]" />
      <path d="M9 24v4M23 24v4" className="stroke-[#334155] dark:stroke-[#CBD5E1]" strokeWidth="2.5" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="9" r="1.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 14. Justice (Transitional Justice - Bronze & Gold Scales)
export function JusticeIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3v24M8 27h16" className="stroke-[#B45309] dark:stroke-[#F59E0B]" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 9h20" className="stroke-[#F59E0B] dark:stroke-[#FBBF24]" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M6 9l-3 7a4 4 0 008 0L6 9z" className="fill-[#F59E0B]/25 dark:fill-[#FBBF24]/30 stroke-[#D97706] dark:stroke-[#FBBF24]" strokeWidth="1.5" />
      <path d="M26 9l-3 7a4 4 0 008 0l-5-7z" className="fill-[#F59E0B]/25 dark:fill-[#FBBF24]/30 stroke-[#D97706] dark:stroke-[#FBBF24]" strokeWidth="1.5" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="9" r="2" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 15. Mishwar (Mishwar Map & Guide - Crimson Pin & Map)
export function MishwarIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 3C10.5 3 6 7.5 6 13c0 7.5 10 16 10 16s10-8.5 10-16c0-5.5-4.5-10-10-10z"
        className="fill-[#EF4444]/20 dark:fill-[#F87171]/30 stroke-[#DC2626] dark:stroke-[#F87171]"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="13" r="3.5" fill="hsl(var(--primary))" className="stroke-[#FFFFFF] dark:stroke-[#0F172A]" strokeWidth="1.5" />
    </svg>
  );
}

// 16. Board (Dashboard & Widgets - Violet, Cyan & Blue Tiles)
export function BoardIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="10" height="10" rx="2" className="fill-[#8B5CF6] dark:fill-[#A78BFA]" opacity="0.9" />
      <rect x="18" y="4" width="10" height="14" rx="2" className="fill-[#06B6D4] dark:fill-[#22D3EE]" opacity="0.9" />
      <rect x="4" y="18" width="10" height="10" rx="2" className="fill-[#3B82F6] dark:fill-[#60A5FA]" opacity="0.9" />
      {/* Theme Accent Touch */}
      <rect x="18" y="22" width="10" height="6" rx="2" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 17. Recipes (وصفاتنا - Recipe Book with Chef Hat & Ribbon)
export function RecipesIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Recipe Book Body */}
      <rect x="5" y="4" width="22" height="24" rx="3" className="fill-[#F97316]/15 dark:fill-[#FB923C]/25 stroke-[#EA580C] dark:stroke-[#FB923C]" strokeWidth="2" />
      {/* Book Spine */}
      <path d="M5 4v24" className="stroke-[#C2410C] dark:stroke-[#F97316]" strokeWidth="3" strokeLinecap="round" />
      {/* Chef Hat Emblem */}
      <path
        d="M12 17h8v2h-8v-2zm0 0c-1.2 0-2-.8-2-1.8 0-.6.3-1.2.8-1.5.3-.2.4-.6.3-1-.2-.5-.1-1.1.3-1.5.4-.4 1-.5 1.5-.3.4.1.8 0 1-.3.5-.7 1.3-1.1 2.1-1.1s1.6.4 2.1 1.1c.2.3.6.4 1 .3.5-.2 1.1-.1 1.5.3.4.4.5 1 .3 1.5-.1.4 0 .8.3 1 .5.3.8.9.8 1.5 0 1-.8 1.8-2 1.8"
        className="stroke-[#10B981] dark:stroke-[#34D399] fill-[#10B981]/10 dark:fill-[#34D399]/20"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Recipe Bookmark Ribbon */}
      <path d="M22 4v6l-2-1.5L18 10V4" className="fill-[#EF4444] dark:fill-[#F87171] stroke-[#DC2626] dark:stroke-[#EF4444]" strokeWidth="1" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="22" r="1.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 18. News (أخبار سوريا - Sky & Red Gazette)
export function NewsIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="24" height="22" rx="3" className="fill-[#0284C7]/15 dark:fill-[#38BDF8]/25 stroke-[#0284C7] dark:stroke-[#38BDF8]" strokeWidth="2" />
      <path d="M8 10h16" className="stroke-[#EF4444] dark:stroke-[#F87171]" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 15h10M8 19h10M8 23h7" className="stroke-[#334155] dark:stroke-[#CBD5E1]" strokeWidth="2" strokeLinecap="round" />
      <rect x="20" y="15" width="4" height="8" rx="1" className="fill-[#0284C7] dark:fill-[#38BDF8]" />
      {/* Theme Accent Touch */}
      <circle cx="22" cy="19" r="1" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 19. Answers (إجابات سوريا - Blue & Amber Q&A Bubble)
export function AnswersIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M27 15c0 6.1-5 11-11 11-1.8 0-3.5-.4-5-1.2L4 27l2.4-6.8C5.5 18.7 5 16.9 5 15 5 8.9 9.9 4 16 4s11 4.9 11 11z"
        className="fill-[#3B82F6]/15 dark:fill-[#60A5FA]/25 stroke-[#2563EB] dark:stroke-[#60A5FA]"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 10v5" className="stroke-[#F59E0B] dark:stroke-[#FBBF24]" strokeWidth="2.5" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="16" cy="19.5" r="1.5" fill="hsl(var(--primary))" />
    </svg>
  );
}

// 20. Codex Community (مجتمع كوديكس - Violet & Emerald Code Shield)
export function CodexCommunityIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M26 21c0 3.3-4.5 6-10 6s-10-2.7-10-6V11c0-3.3 4.5-6 10-6s10 2.7 10 6v10z"
        className="fill-[#8B5CF6]/15 dark:fill-[#A78BFA]/25 stroke-[#7C3AED] dark:stroke-[#A78BFA]"
        strokeWidth="2"
      />
      <path d="M11 13l-4 3 4 3" className="stroke-[#10B981] dark:stroke-[#34D399]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13l4 3-4 3" className="stroke-[#10B981] dark:stroke-[#34D399]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Theme Accent Touch */}
      <path d="M17 12l-2 8" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 21. Crossings (المنافذ الحدودية - Red & White Border Barrier)
export function CrossingsIcon({ className = "w-7 h-7" }: ProjectIconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="6" height="18" rx="2" className="fill-[#94A3B8]/20 dark:fill-[#CBD5E1]/25 stroke-[#475569] dark:stroke-[#CBD5E1]" strokeWidth="2" />
      {/* barrier arm: solid red bar, then dashes punched over it for the stripes */}
      <path d="M11 14.5L28 11" className="stroke-[#DC2626] dark:stroke-[#F87171]" strokeWidth="4" strokeLinecap="round" />
      <path d="M13 14.1L26 11.4" className="stroke-[#F8FAFC] dark:stroke-[#0F172A]" strokeWidth="4" strokeDasharray="3 4" />
      <path d="M3 28h26" className="stroke-[#475569] dark:stroke-[#CBD5E1]" strokeWidth="2" strokeLinecap="round" />
      {/* Theme Accent Touch */}
      <circle cx="23" cy="21" r="3" fill="hsl(var(--primary))" />
    </svg>
  );
}
