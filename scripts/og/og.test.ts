import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildIcons } from './export-icons';
// @ts-expect-error plain ES modules, shared with the Node renderer
import { readTokens } from './export-tokens.mjs';
// @ts-expect-error plain ES modules, shared with the Node renderer
import { inspectCard } from './lib/cards.mjs';
// @ts-expect-error plain ES modules, shared with the Node renderer
import { init, renderPng, ROOT } from './lib/engine.mjs';
// @ts-expect-error plain ES modules, shared with the Node renderer
import { pageModel, readCards } from './lib/pages.mjs';
// @ts-expect-error plain ES modules, shared with the Node renderer
import { clean, fitText, measureLine } from './lib/text.mjs';

const RLI = '⁧';
const LRI = '⁦';
const PDI = '⁩';

beforeAll(async () => {
    await init();
});

describe('share card text', () => {
    it('keeps a short title on one line at full size', () => {
        const fit = fitText('عداد الوعود', { maxWidth: 760, maxLines: 2, maxSize: 104, minSize: 56, weight: 700 });
        expect(fit).toMatchObject({ size: 104, lines: ['عداد الوعود'], truncated: false });
    });

    it('never draws a line wider than its box', () => {
        const texts = [
            'تحويل المعاملات إلى رقمية في جميع مراكز الأحوال المدنية بالمحافظات بحلول نيسان 2026',
            'أفضل 10 مطورين سوريين على GitHub في 2026',
            'دوار الجامعة - دوار بابا عمرو - شارع البرازيل - طريق طرابلس - شارع الملعب - دوار الغوطة - الدبلان',
            'Supercalifragilisticexpialidocious.syrian.zone',
        ];
        for (const text of texts) {
            for (const maxWidth of [420, 760, 1060]) {
                const fit = fitText(text, { maxWidth, maxLines: 3, maxSize: 70, minSize: 44, weight: 700 });
                expect(fit.lines.length).toBeLessThanOrEqual(3);
                for (const line of fit.lines) expect(measureLine(line, fit.size, 700)).toBeLessThanOrEqual(maxWidth + 0.5);
            }
        }
    });

    it('wraps into even lines instead of leaving a lone word', () => {
        const fit = fitText('إعادة المعلمين المفصولين بسبب الثورة إلى العمل اعتباراً من أيلول 2025', {
            maxWidth: 1060, maxLines: 3, maxSize: 70, minSize: 70, weight: 700,
        });
        expect(fit.lines).toHaveLength(2);
        const [first, second] = fit.lines.map((line: string) => measureLine(line, fit.size, 700));
        expect(Math.abs(first - second) / Math.max(first, second)).toBeLessThan(0.25);
    });

    it('ends in an ellipsis only when the text cannot fit at the smallest size', () => {
        const long = Array.from({ length: 40 }, () => 'كلمة').join(' ');
        const fit = fitText(long, { maxWidth: 600, maxLines: 2, maxSize: 60, minSize: 44, weight: 700 });
        expect(fit.truncated).toBe(true);
        expect(fit.size).toBe(44);
        expect(fit.lines).toHaveLength(2);
        expect(fit.lines[1].endsWith('…')).toBe(true);
    });

    it('prefers one line at a smaller size when asked to', () => {
        const options = { maxWidth: 760, maxLines: 2, maxSize: 104, minSize: 56, weight: 700 };
        expect(fitText('نتائج تقييم الحكومة', options).lines).toHaveLength(2);
        const single = fitText('نتائج تقييم الحكومة', { ...options, singleLineMin: 72 });
        expect(single.lines).toHaveLength(1);
        expect(single.size).toBeGreaterThanOrEqual(72);
    });

    it('cuts a single over-long Latin token and keeps the ellipsis on its right', () => {
        const fit = fitText('Supercalifragilisticexpialidocious.syrian.zone', { maxWidth: 760, maxLines: 2, maxSize: 104, minSize: 56, weight: 700 });
        expect(fit.truncated).toBe(true);
        expect(fit.lines).toHaveLength(1);
        expect(fit.lines[0].startsWith(LRI)).toBe(true);
        expect(fit.lines[0].endsWith(`…${PDI}`)).toBe(true);
    });

    it('keeps a handle reading left to right inside Arabic text', () => {
        const fit = fitText('ترتيب يومي: @username وغيره', { maxWidth: 900, maxLines: 1, maxSize: 38, minSize: 38 });
        expect(fit.lines[0]).toContain(`${LRI}@username${PDI}`);
    });

    it('drops emoji, direction controls and extra whitespace from untrusted text', () => {
        expect(clean('مطعم  الشام 🍽️✨\nألذّ شاورما')).toBe('مطعم الشام ألذّ شاورما');
        expect(clean(`${RLI}abc‮def${PDI}`)).toBe('abcdef');
        expect(clean(null)).toBe('');
    });
});

describe('share cards', () => {
    it('fits the title and sentence of every fixed page without cutting them', () => {
        for (const entry of readCards()) {
            expect(inspectCard(pageModel(entry)).truncated, entry.slug).toEqual([]);
        }
    });

    it('gives every fixed-page card a slug of its own and an icon the renderer knows', () => {
        const cards = readCards();
        const slugs = cards.map((card: { slug: string }) => card.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        const paths = cards.flatMap((card: { paths: string[] }) => card.paths);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('renders a card to a 1200x630 PNG in both colourways', () => {
        for (const theme of ['dark', 'light']) {
            const png: Buffer = renderPng(inspectCard({ ...pageModel(readCards()[1]), theme }).svg);
            expect(png.subarray(1, 4).toString()).toBe('PNG');
            expect(png.readUInt32BE(16)).toBe(1200);
            expect(png.readUInt32BE(20)).toBe(630);
        }
    });

    it('draws a place without its photograph as an ordinary record card', () => {
        const model = { kind: 'photo', url: 'syrian.zone/mishwar', title: 'قلعة حلب', art: { type: 'icon', icon: 'mishwar' } };
        expect(inspectCard(model).svg).not.toContain('id="scrim"');
        expect(inspectCard({ ...model, photo: 'data:image/jpeg;base64,AAAA' }).svg).toContain('id="scrim"');
    });
});

describe('generated card inputs', () => {
    const read = (file: string) => JSON.parse(readFileSync(join(ROOT, 'resources', 'og', file), 'utf8'));

    it('tokens.json matches the theme tokens in app.css (run `npm run og:tokens`)', () => {
        expect(read('tokens.json')).toEqual(readTokens());
    });

    it('icons.json matches the site icons (run `npm run og:icons`)', () => {
        expect(read('icons.json')).toEqual(buildIcons());
    });
});
