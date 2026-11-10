<?php

namespace App\Support\Seo;

/**
 * Builds /llms.txt: a short Markdown index of the site for language-model
 * tools, in the format proposed at https://llmstxt.org (a title, a one-line
 * summary, then sections of links with a note each).
 *
 * It is a curated guide, not a second sitemap: only fixed pages are listed,
 * and their names and notes are the ones SeoMeta::PAGES already holds, so the
 * file cannot drift from the pages' own metadata.
 */
class LlmsTxt
{
    /**
     * Section heading => the fixed pages under it, in reading order. "Optional"
     * is the heading the format reserves for links a reader short on context
     * may skip.
     */
    private const SECTIONS = [
        'بيانات وأدلة' => [
            '/promises', '/syofficial', '/phonebook', '/govapps', '/sites',
            '/party', '/house', '/justice', '/crossings', '/atlas',
        ],
        'خدمات يومية' => ['/transit', '/mishwar', '/roznama', '/muslim/prayer'],
        'رأي ومشاركة' => [
            '/tierlist', '/tierlist/leaderboard', '/polls', '/compass',
            '/compass/stats', '/priorities',
        ],
        'عن المنصة' => ['/about', '/privacy', '/terms'],
        'Optional' => [
            '/syid', '/syrian-contributors', '/muslim/quran', '/muslim/radio',
            '/board', '/games',
        ],
    ];

    /**
     * Every page the file links to.
     *
     * @return list<string>
     */
    public static function paths(): array
    {
        return array_merge(...array_values(self::SECTIONS));
    }

    public function render(): string
    {
        $base = rtrim((string) config('seo.base_url'), '/');

        $lines = [
            '# '.config('seo.alternate_name').' ('.config('seo.site_name').')',
            '',
            '> '.config('seo.default_description'),
            '',
            'الموقع باللغة العربية. لكل وعد في عداد الوعود صفحة على '.$base.'/promises/{number}، '
                .'ولكل مدينة في ترانزيت صفحة على '.$base.'/transit/city/{id}. '
                .'القائمة الكاملة بالصفحات في [sitemap.xml]('.$base.'/sitemap.xml).',
        ];

        foreach (self::SECTIONS as $heading => $paths) {
            $lines[] = '';
            $lines[] = '## '.$heading;
            $lines[] = '';

            foreach ($paths as $path) {
                $page = SeoMeta::fixedPage($path);
                if ($page === null) {
                    continue;
                }

                $lines[] = '- ['.self::inline($page->shareTitle ?? $page->title).']('.$base.$path.'): '
                    .self::inline($page->description);
            }
        }

        return implode("\n", $lines)."\n";
    }

    /** Keeps a name or note on one line and out of Markdown link syntax. */
    private static function inline(string $text): string
    {
        return str_replace(['[', ']'], ['(', ')'], trim((string) preg_replace('/\s+/u', ' ', $text)));
    }
}
