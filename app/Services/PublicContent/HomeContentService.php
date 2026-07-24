<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

final class HomeContentService
{
    private const QUICK_LINKS = [
        ['official-accounts', 'الحسابات الرسمية', 'Official accounts', 'feature', 'syofficial'],
        ['board', 'لوح', 'Board', 'feature', 'board'],
        ['calendar', 'الروزنامة', 'Calendar', 'feature', 'roznama'],
        ['phonebook', 'دليل الهاتف', 'Phonebook', 'feature', 'phonebook'],
        ['visual-identity', 'الهوية البصرية', 'Visual identity', 'feature', 'syid'],
        ['organizations', 'دليل الأحزاب', 'Organizations', 'feature', 'party'],
        ['government-ranking', 'تقييم الحكومة', 'Government ranking', 'feature', 'tierlist'],
        ['legislative-council', 'المجلس التشريعي', 'Legislative council', 'feature', 'house'],
        ['political-compass', 'البوصلة السياسية', 'Political compass', 'feature', 'compass'],
        ['syria-priorities', 'أولويات سوريا', 'Syria priorities', 'feature', 'priorities'],
        ['web-directory', 'دليل المواقع', 'Web directory', 'feature', 'sites'],
        ['syria-atlas', 'أطلس', 'Syria atlas', 'feature', 'population'],
        ['government-apps', 'تطبيقات الحكومة', 'Government apps', 'feature', 'govapps'],
        ['transit', 'ترانزيت', 'Transit', 'feature', 'transit'],
        ['transitional-justice', 'العدالة الانتقالية', 'Transitional justice', 'feature', 'justice'],
        ['joory', 'جوري AI', 'Joory AI', 'external', 'https://joory.chat'],
        ['jard', 'جرد', 'Jard', 'external', 'https://jard.chat'],
        ['recipes', 'وصفاتنا', 'Our recipes', 'external', 'https://food.syrian.zone'],
        ['news', 'أخبار سوريا', 'Syria news', 'external', 'https://news.jard.chat'],
        ['answers', 'إجابات سوريا', 'Syria answers', 'external', 'https://answers.syrian.zone'],
        ['codex-community', 'مجتمع كوديكس', 'Codex community', 'external', 'https://discord.gg/NqE8849VzA'],
        ['flag-replacer', 'مبدل العلم', 'Syrian flag replacer', 'external', 'https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog'],
    ];

    private const SEARCH_PROVIDERS = [
        ['id' => 'duckduckgo', 'label' => 'DuckDuckGo', 'template' => 'https://duckduckgo.com/?q=%s'],
        ['id' => 'searx', 'label' => 'SearX', 'template' => 'https://searx.be/search?q=%s'],
        ['id' => 'google', 'label' => 'Google', 'template' => 'https://www.google.com/search?q=%s'],
        ['id' => 'bing', 'label' => 'Bing', 'template' => 'https://www.bing.com/search?q=%s'],
    ];

    public function about(): string
    {
        $path = resource_path('js/Data/about.md');

        return is_file($path) ? (string) file_get_contents($path) : '';
    }

    public function mobilePayload(): array
    {
        return [
            'about_content' => $this->about(),
            'quick_links' => array_map(
                static fn (array $link): array => [
                    'id' => $link[0],
                    'label_ar' => $link[1],
                    'label_en' => $link[2],
                    'type' => $link[3],
                    'target' => $link[4],
                ],
                self::QUICK_LINKS,
            ),
            'search_providers' => self::SEARCH_PROVIDERS,
        ];
    }
}
