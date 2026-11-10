<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\Poll;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /polls/{slug} and /polls/{slug}/leaderboard: one poll and its results. */
final class PollPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /**
     * The government tier list is this poll under its own address. Both URLs
     * render the same records, so the poll URLs point at /tierlist.
     */
    private const TIER_LIST_SLUG = 'best-ministers';

    private const PARENT = ['/polls', 'الاستبيانات واستطلاعات الرأي'];

    public static function cardType(): string
    {
        return 'poll';
    }

    public static function fallbackCard(): string
    {
        return 'polls';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/polls/([^/]+)(/leaderboard)?$#', $path, $m)) {
            return null;
        }

        // UUID links resolve too and are canonicalised to the slug.
        $poll = Poll::where('slug', $m[1])->orWhere('id', $m[1])->first();
        if ($poll === null) {
            return null;
        }

        $leaderboard = isset($m[2]);

        if ($poll->slug === self::TIER_LIST_SLUG) {
            return new Preview(
                title: $leaderboard ? 'نتائج تقييم الحكومة السورية | Syrian Zone' : 'تير ليست الحكومة السورية | Syrian Zone',
                description: $leaderboard
                    ? 'إحصائيات ونتائج تصويت تير ليست الحكومة السورية، المحافظين، والشخصيات العامة ببيانات تفاعلية محدثة.'
                    : 'شارك في تقييم وتصنيف أداء أعضاء الحكومة السورية الجديدة عبر منصة تير ليست تفاعلية وشاركه مع الآخرين.',
                canonicalPath: $leaderboard ? '/tierlist/leaderboard' : '/tierlist',
                image: StaticCards::url($leaderboard ? 'tierlist-leaderboard' : 'tierlist'),
                type: 'article',
                noindex: ! $poll->is_active,
                schema: 'Article',
                parent: self::PARENT,
            );
        }

        return new Preview(
            title: ($leaderboard ? 'نتائج ' : '').$poll->title.' | استطلاعات سوريا زون',
            description: $leaderboard
                ? 'إحصائيات ونتائج تصويت '.$poll->title.' على المساحة السورية.'
                : 'شارك في استطلاع الرأي والتقييم المجتمعي لـ '.$poll->title.' وصوّت وشارك رأيك معنا.',
            canonicalPath: '/polls/'.$poll->slug.($leaderboard ? '/leaderboard' : ''),
            image: $this->describe($poll)->url(),
            type: 'article',
            noindex: ! $poll->is_active,
            schema: 'Article',
            parent: self::PARENT,
        );
    }

    public function card(string $key): ?RecordCard
    {
        $poll = Poll::where('slug', $key)->first();

        return $poll === null || $poll->slug === self::TIER_LIST_SLUG ? null : $this->describe($poll);
    }

    private function describe(Poll $poll): RecordCard
    {
        return new RecordCard(self::cardType(), $poll->slug, [
            'kind' => 'split',
            'url' => $this->address('/polls/'.$poll->slug),
            'kicker' => ['icon' => 'tierlist', 'label' => 'استطلاعات الرأي'],
            'pills' => [$poll->is_active
                ? ['label' => 'استطلاع مفتوح', 'tone' => 'primary', 'glyph' => 'Vote']
                : ['label' => 'استطلاع مغلق', 'glyph' => 'Vote']],
            'title' => $poll->title,
            'subtitle' => $poll->is_active ? 'صوّت ورتّب المرشحين وشارك رأيك' : 'شاهد نتائج التصويت والترتيب',
            'art' => ['type' => 'icon', 'icon' => 'tierlist'],
        ]);
    }
}
