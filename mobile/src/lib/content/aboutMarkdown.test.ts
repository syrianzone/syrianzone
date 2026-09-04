import { aboutDocuments } from '@/data/about';

import { parseAboutInline, parseAboutMarkdown } from './aboutMarkdown';

const locales = ['ar', 'en'] as const;

function contributorList(locale: (typeof locales)[number]) {
  const block = parseAboutMarkdown(aboutDocuments[locale]).find(
    (candidate) =>
      candidate.type === 'list' &&
      JSON.stringify(candidate.items).includes('macdoos'),
  );

  if (block?.type !== 'list') {
    throw new Error(`The ${locale} contributor list was not parsed`);
  }
  return block;
}

describe('bundled About documents', () => {
  test.each(locales)(
    'matches the complete %s token golden',
    (locale) => {
      expect(parseAboutMarkdown(aboutDocuments[locale])).toMatchSnapshot();
    },
  );

  test.each(locales)(
    'keeps every %s contributor credit in its own list item',
    (locale) => {
      const list = contributorList(locale);

      expect(list.items).toHaveLength(8);
      expect(JSON.stringify(list.items)).toContain('abd_hmh');
    },
  );

  test.each(locales)(
    'links the GitHub repository and the BrandKit download in %s',
    (locale) => {
      const hrefs = JSON.stringify(parseAboutMarkdown(aboutDocuments[locale]));

      expect(hrefs).toContain('https://github.com/syrianzone/syrianzone');
      expect(hrefs).toContain('https://syrian.zone/assets/BrandKit.zip');
    },
  );

  test.each(locales)('closes %s with the CC BY 4.0 attribution', (locale) => {
    const blocks = parseAboutMarkdown(aboutDocuments[locale]);

    expect(JSON.stringify(blocks.at(-1))).toContain('CC BY 4.0');
  });

  test('composes bold spans inside link labels', () => {
    expect(
      parseAboutInline('[**SourceM7**](https://github.com/SourceM7)'),
    ).toEqual([
      {
        type: 'link',
        href: 'https://github.com/SourceM7',
        children: [
          {
            type: 'bold',
            children: [{ type: 'text', value: 'SourceM7' }],
          },
        ],
      },
    ]);
  });

  test('leaves malformed and raw markup literal', () => {
    expect(parseAboutInline('**open <b>tag</b> [bad](url')).toEqual([
      { type: 'text', value: '**open <b>tag</b> [bad](url' },
    ]);
  });
});
