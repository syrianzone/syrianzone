import { projectIcon } from '@/Lib/projectIcons';

/**
 * The site's project icons. Every drawing lives in
 * `resources/data/project-icons.json` (`Lib/projectIcons.tsx` renders it), so
 * the same key renders the same mark here and in the Blade/Filament panel.
 * Add an icon by adding a key to that file; `projectIcons.test.ts` keeps the
 * two sides on the same key set.
 */
interface ProjectIconProps {
    className?: string;
}

export const SyOfficialIcon = projectIcon('syofficial');
export const RoznamaIcon = projectIcon('roznama');
export const MuslimIcon = projectIcon('muslim');
export const QuranIcon = projectIcon('quran');
export const QuranRadioIcon = projectIcon('quran_radio');
export const GamesIcon = projectIcon('games');
export const Game2048Icon = projectIcon('game_2048');
export const SolitaireIcon = projectIcon('solitaire');
export const TarneebIcon = projectIcon('tarneeb');
export const TrixIcon = projectIcon('trix');
export const GuessWhoIcon = projectIcon('guesswho');
export const PhonebookIcon = projectIcon('phonebook');
export const SyIdIcon = projectIcon('syid');
export const PartyIcon = projectIcon('party');
export const TierlistIcon = projectIcon('tierlist');
export const HouseIcon = projectIcon('house');
export const CompassIcon = projectIcon('compass');
export const PromisesIcon = projectIcon('promises');
export const PrioritiesIcon = projectIcon('priorities');
export const SitesIcon = projectIcon('sites');
export const PopulationIcon = projectIcon('population');
export const GovAppsIcon = projectIcon('govapps');
export const TransitIcon = projectIcon('transit');
export const JusticeIcon = projectIcon('justice');
export const MishwarIcon = projectIcon('mishwar');
export const BoardIcon = projectIcon('board');
export const RecipesIcon = projectIcon('recipes');
export const NewsIcon = projectIcon('news');
export const AnswersIcon = projectIcon('answers');
export const CodexCommunityIcon = projectIcon('codex');
export const CrossingsIcon = projectIcon('crossings');

/**
 * رئيس الجمهورية (external game): its own mark, shipped from `public/` rather
 * than drawn as an SVG, so it is the one icon that is not in the data file.
 */
export function PresidentIcon({ className = 'w-7 h-7' }: ProjectIconProps) {
    return <img src="/assets/games/president.svg" alt="" className={className} />;
}

/**
 * Every utility class the drawings use, in one scanned string.
 *
 * Tailwind reads code files (`@source "../js"` / `@source "../views"` in
 * `resources/css/app.css`), not the JSON data files the drawings are stored
 * in, so the paint tokens have to appear in a file it scans or the icons
 * render uncoloured. `projectIcons.test.ts` fails when this list and
 * `project-icons.json` disagree.
 */
export const PROJECT_ICON_PAINT_TOKENS =
    'fill-[#3B82F6]/15 dark:fill-[#60A5FA]/25 stroke-[#2563EB] dark:stroke-[#60A5FA] stroke-[#F59E0B] dark:stroke-[#FBBF24] fill-[#8B5CF6] dark:fill-[#A78BFA] fill-[#06B6D4] dark:fill-[#22D3EE] fill-[#3B82F6] dark:fill-[#60A5FA] fill-[#8B5CF6]/15 dark:fill-[#A78BFA]/25 stroke-[#7C3AED] dark:stroke-[#A78BFA] stroke-[#10B981] dark:stroke-[#34D399] fill-[#06B6D4]/10 dark:fill-[#22D3EE]/20 stroke-[#0891B2] dark:stroke-[#22D3EE] fill-[#EF4444] dark:fill-[#F87171] fill-[#F59E0B] dark:fill-[#FBBF24] fill-[#10B981] dark:fill-[#34D399] stroke-[#FFFFFF] dark:stroke-[#0F172A] fill-[#94A3B8]/20 dark:fill-[#CBD5E1]/25 stroke-[#475569] dark:stroke-[#CBD5E1] stroke-[#DC2626] dark:stroke-[#F87171] stroke-[#F8FAFC] fill-[#F59E0B]/25 dark:fill-[#FBBF24]/30 stroke-[#D97706] fill-[#D97706]/25 dark:fill-[#FBBF24]/35 stroke-[#06B6D4] fill-[#475569]/15 dark:fill-[#94A3B8]/20 stroke-[#334155] dark:stroke-[#94A3B8] stroke-[#64748B] fill-[#3DDC84] dark:fill-[#4ADE80] fill-[#64748B] dark:fill-[#94A3B8] fill-[#FDE68A]/30 dark:fill-[#FCD34D]/20 stroke-[#0EA5E9] dark:stroke-[#38BDF8] stroke-[#374151] dark:stroke-[#E2E8F0] fill-[#374151] dark:fill-[#E2E8F0] fill-[#0284C7]/25 dark:fill-[#38BDF8]/30 stroke-[#0284C7] fill-[#475569]/20 dark:fill-[#94A3B8]/30 stroke-[#B45309] dark:stroke-[#F59E0B] fill-[#EF4444]/20 dark:fill-[#F87171]/30 fill-[#10B981]/15 dark:fill-[#34D399]/20 stroke-[#059669] fill-[#F59E0B]/15 dark:fill-[#FBBF24]/20 fill-[#0284C7]/15 dark:fill-[#38BDF8]/25 stroke-[#EF4444] fill-[#0284C7] dark:fill-[#38BDF8] fill-[#8B5CF6]/25 dark:fill-[#A78BFA]/30 fill-[#F97316]/25 dark:fill-[#FB923C]/30 stroke-[#EA580C] dark:stroke-[#FB923C] fill-[#10B981]/25 dark:fill-[#34D399]/30 dark:fill-[#34D399]/25 stroke-[#3B82F6] fill-[#F97316]/15 dark:fill-[#FB923C]/25 stroke-[#C2410C] dark:stroke-[#F97316] fill-[#10B981]/10 dark:stroke-[#EF4444] fill-[#EF4444]/10 dark:fill-[#FB7185]/20 stroke-[#E11D48] dark:stroke-[#FB7185] dark:fill-[#C084FC] stroke-[#6366F1] dark:stroke-[#818CF8] fill-[#F1F5F9]/60 dark:fill-[#E2E8F0]/20 fill-[#EC4899]/20 dark:fill-[#F472B6]/30 stroke-[#DB2777] dark:stroke-[#F472B6] fill-[#3B82F6]/20 dark:fill-[#60A5FA]/30 stroke-[#8B5CF6] dark:stroke-[#C084FC] fill-[#F1F5F9]/70 fill-[#0EA5E9]/15 dark:fill-[#38BDF8]/20 fill-[#EAB308]/20 dark:fill-[#FACC15]/25 stroke-[#CA8A04] dark:stroke-[#FACC15] fill-[#2563EB] fill-[#7C3AED]/85';
