import { aboutMarkdown } from '@/data/about';

import { parseAboutInline, parseAboutMarkdown } from './aboutMarkdown';

describe('bundled About Markdown', () => {
  test('matches the complete source-derived token golden', () => {
    expect(parseAboutMarkdown(aboutMarkdown)).toMatchSnapshot();
  });

  test('keeps the BrandKit line inside the final contribution item', () => {
    const contributions = parseAboutMarkdown(aboutMarkdown).find(
      (block) =>
        block.type === 'list' &&
        block.items.some((item) =>
          JSON.stringify(item).includes('SourceM7'),
        ),
    );

    expect(contributions?.type).toBe('list');
    if (contributions?.type !== 'list') {
      throw new Error('Contribution list was not parsed');
    }
    expect(JSON.stringify(contributions.items.at(-1))).toContain(
      'BrandKit.zip',
    );
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
