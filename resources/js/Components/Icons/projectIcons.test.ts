import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as ProjectIconExport from './ProjectIcons';
import { PROJECT_ICON_PAINT_TOKENS } from './ProjectIcons';
import { PROJECT_ICON_KEYS, ProjectIcon } from '@/Lib/projectIcons';
import { SITE_ICON_MAP, SITE_ICON_OPTIONS } from '@/Lib/siteLinks';
import { SITE_MODULES } from '@/Lib/siteModules';

/**
 * The drawings in `resources/data/project-icons.json` are what both the React
 * app and the Blade component render, and `PROJECT_ICON_PAINT_TOKENS` is what
 * makes Tailwind generate the paint for the React copy. These tests are the
 * contract around that file, so a new or renamed icon cannot reach one side
 * only.
 */
type IconComponent = ComponentType<{ className?: string }>;

/** The named icons, mapped to the drawing key each one renders. */
const NAMED_ICONS: Record<string, string> = {
    SyOfficialIcon: 'syofficial',
    RoznamaIcon: 'roznama',
    MuslimIcon: 'muslim',
    QuranIcon: 'quran',
    QuranRadioIcon: 'quran_radio',
    GamesIcon: 'games',
    Game2048Icon: 'game_2048',
    SolitaireIcon: 'solitaire',
    TarneebIcon: 'tarneeb',
    TrixIcon: 'trix',
    GuessWhoIcon: 'guesswho',
    PhonebookIcon: 'phonebook',
    SyIdIcon: 'syid',
    PartyIcon: 'party',
    TierlistIcon: 'tierlist',
    HouseIcon: 'house',
    CompassIcon: 'compass',
    PromisesIcon: 'promises',
    PrioritiesIcon: 'priorities',
    SitesIcon: 'sites',
    PopulationIcon: 'population',
    GovAppsIcon: 'govapps',
    TransitIcon: 'transit',
    JusticeIcon: 'justice',
    MishwarIcon: 'mishwar',
    BoardIcon: 'board',
    RecipesIcon: 'recipes',
    NewsIcon: 'news',
    AnswersIcon: 'answers',
    CodexCommunityIcon: 'codex',
    CrossingsIcon: 'crossings',
};

const COMPONENTS: Record<string, IconComponent> = {
    SyOfficialIcon: ProjectIconExport.SyOfficialIcon,
    RoznamaIcon: ProjectIconExport.RoznamaIcon,
    MuslimIcon: ProjectIconExport.MuslimIcon,
    QuranIcon: ProjectIconExport.QuranIcon,
    QuranRadioIcon: ProjectIconExport.QuranRadioIcon,
    GamesIcon: ProjectIconExport.GamesIcon,
    Game2048Icon: ProjectIconExport.Game2048Icon,
    SolitaireIcon: ProjectIconExport.SolitaireIcon,
    TarneebIcon: ProjectIconExport.TarneebIcon,
    TrixIcon: ProjectIconExport.TrixIcon,
    GuessWhoIcon: ProjectIconExport.GuessWhoIcon,
    PhonebookIcon: ProjectIconExport.PhonebookIcon,
    SyIdIcon: ProjectIconExport.SyIdIcon,
    PartyIcon: ProjectIconExport.PartyIcon,
    TierlistIcon: ProjectIconExport.TierlistIcon,
    HouseIcon: ProjectIconExport.HouseIcon,
    CompassIcon: ProjectIconExport.CompassIcon,
    PromisesIcon: ProjectIconExport.PromisesIcon,
    PrioritiesIcon: ProjectIconExport.PrioritiesIcon,
    SitesIcon: ProjectIconExport.SitesIcon,
    PopulationIcon: ProjectIconExport.PopulationIcon,
    GovAppsIcon: ProjectIconExport.GovAppsIcon,
    TransitIcon: ProjectIconExport.TransitIcon,
    JusticeIcon: ProjectIconExport.JusticeIcon,
    MishwarIcon: ProjectIconExport.MishwarIcon,
    BoardIcon: ProjectIconExport.BoardIcon,
    RecipesIcon: ProjectIconExport.RecipesIcon,
    NewsIcon: ProjectIconExport.NewsIcon,
    AnswersIcon: ProjectIconExport.AnswersIcon,
    CodexCommunityIcon: ProjectIconExport.CodexCommunityIcon,
    CrossingsIcon: ProjectIconExport.CrossingsIcon,
};

/** Drawings that exist for the administration side only (no React module). */
const BLADE_ONLY = ['assets', 'atlas', 'contributors', 'places', 'polls', 'site', 'users'];

function bodyOf(markup: string): string {
    return markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</svg>'));
}

function drawingBody(key: string): string {
    return bodyOf(renderToStaticMarkup(createElement(ProjectIcon, { name: key })));
}

function classTokens(body: string): string[] {
    return Array.from(body.matchAll(/class="([^"]*)"/g))
        .flatMap((match) => match[1].split(/\s+/))
        .filter(Boolean);
}

describe('the project icons', () => {
    it('renders every key in the shared drawing file, aliases included', () => {
        for (const key of PROJECT_ICON_KEYS) {
            expect(renderToStaticMarkup(createElement(ProjectIcon, { name: key })), key).toContain('<svg');
        }
    });

    it('covers the same keys in React and in the shared file', () => {
        const reactKeys = Object.values(NAMED_ICONS).sort();
        const fileKeys = PROJECT_ICON_KEYS.filter((key) => !BLADE_ONLY.includes(key)).sort();

        expect(reactKeys).toEqual(fileKeys);
        expect(new Set([...reactKeys, ...BLADE_ONLY])).toEqual(new Set(PROJECT_ICON_KEYS));
    });

    it('gives each named export the drawing it is named after', () => {
        for (const [exportName, key] of Object.entries(NAMED_ICONS)) {
            const markup = renderToStaticMarkup(createElement(COMPONENTS[exportName], { className: '' }));
            expect(bodyOf(markup), exportName).toBe(drawingBody(key));
        }
    });

    it('lists every paint token the drawings use, so Tailwind generates them', () => {
        const scanned = new Set(PROJECT_ICON_PAINT_TOKENS.split(/\s+/).filter(Boolean));
        for (const key of PROJECT_ICON_KEYS) {
            for (const token of classTokens(drawingBody(key))) {
                expect(scanned.has(token), `${key} -> ${token}`).toBe(true);
            }
        }
    });

    it('resolves every icon key the navigation names', () => {
        for (const module of SITE_MODULES) {
            if (module.iconKey === null) continue;
            expect(SITE_ICON_MAP[module.iconKey], `${module.id} -> ${module.iconKey}`).toBeDefined();
        }
    });

    it('only offers picker options that draw something', () => {
        for (const option of SITE_ICON_OPTIONS) {
            expect(SITE_ICON_MAP[option.key], option.key).toBeDefined();
        }
    });
});
