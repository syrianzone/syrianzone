<?php

use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\Preview\Resolvers\PromisePreview;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A city plus the routes the transit previews count for it.
 */
function seedPreviewCity(string $id, string $name, int $published = 0, int $drafts = 0): void
{
    seedCity($id, [
        'name_ar' => $name,
        'name_en' => ucfirst($id),
        'bounds' => [[36.5, 34.5], [36.9, 34.9]],
    ]);

    foreach (['published' => $published, 'draft' => $drafts] as $status => $count) {
        for ($i = 0; $i < $count; $i++) {
            transitRoute("{$id}-{$status}-{$i}", $id, ['name_ar' => "خط {$i}", 'status' => $status, 'color_index' => $i]);
        }
    }
}

test('a published promise previews as itself with a card of its own', function () {
    $promise = Promise::factory()->published()->create([
        'title' => 'إعادة الكهرباء إلى حلب',
        'summary' => 'وعد بإعادة التغذية الكهربائية.',
        'speaker_id' => PromiseSpeaker::factory()->create(['name' => 'وزير الكهرباء', 'title' => 'وزير'])->id,
        'deadline_date' => '2027-03-14',
    ]);

    $meta = seoMetaFor('/promises/'.$promise->number);
    $card = Previews::cardSource('promise')->card((string) $promise->number);

    expect($meta['title'])->toBe('إعادة الكهرباء إلى حلب — الوعد رقم '.$promise->number.' | عداد الوعود')
        ->and($meta['description'])->toBe('وزير الكهرباء: وعد بإعادة التغذية الكهربائية.')
        ->and($meta['canonical'])->toBe('https://syrian.zone/promises/'.$promise->number)
        ->and($meta['type'])->toBe('article')
        ->and($meta['image'])->toBe('https://syrian.zone/og/r/promise/'.$promise->number.'.png?v='.$card->version());

    $graph = collect(json_decode($meta['json_ld'], true)['@graph']);
    expect($graph->pluck('@type'))->toContain('Article')
        ->and($graph->firstWhere('@type', 'BreadcrumbList')['itemListElement'][1]['item'])->toBe('https://syrian.zone/promises');
});

test('a promise is described as a dated article under its own name', function () {
    $promise = Promise::factory()->published()->create(['title' => 'إعادة الكهرباء إلى حلب']);

    $meta = seoMetaFor('/promises/'.$promise->number);
    $graph = collect(json_decode($meta['json_ld'], true)['@graph']);
    $article = $graph->firstWhere('@type', 'Article');

    expect($article['headline'])->toBe('إعادة الكهرباء إلى حلب')
        ->and($article['image'])->toBe($meta['image'])
        ->and($article['author'])->toBe(['@id' => 'https://syrian.zone/#organization'])
        ->and($article['datePublished'])->toBe($promise->published_at->format(DATE_ATOM))
        ->and($article['dateModified'])->toBe($promise->updated_at->format(DATE_ATOM))
        ->and($graph->firstWhere('@type', 'BreadcrumbList')['itemListElement'][2]['name'])->toBe('إعادة الكهرباء إلى حلب');
});

test('a promise card shows status, number, sector, speaker and an absolute deadline', function () {
    $promise = Promise::factory()->published()->create([
        'title' => 'إعادة الكهرباء إلى حلب',
        'speaker_id' => PromiseSpeaker::factory()->create(['name' => 'عمر شقروق', 'title' => 'وزير الكهرباء', 'image_url' => 'https://example.com/a.jpg'])->id,
        'deadline_date' => '2027-03-14',
        'status' => 'in_progress',
    ]);

    $model = Previews::cardSource('promise')->card((string) $promise->number)->model;

    expect($model['pills'][0])->toBe(['label' => 'قيد التنفيذ', 'tone' => 'outline', 'glyph' => 'Wrench'])
        ->and($model['pills'][1])->toBe(['label' => 'الوعد رقم '.$promise->number])
        ->and($model['pills'][2]['label'])->toBe($promise->sector->label)
        ->and($model['person'])->toBe(['name' => 'عمر شقروق', 'role' => 'وزير الكهرباء', 'image' => 'https://example.com/a.jpg'])
        ->and($model['meta'])->toBe(['glyph' => 'Calendar', 'label' => 'الموعد', 'value' => '14 آذار 2027'])
        ->and($model['url'])->toBe('syrian.zone/promises/'.$promise->number);
});

test('a promise card follows the state the page shows and changes address with it', function () {
    $promise = Promise::factory()->published()->create(['status' => 'pending', 'deadline_date' => now()->addDays(5)->format('Y-m-d')]);
    $source = Previews::cardSource('promise');
    $before = $source->card((string) $promise->number);

    expect($before->model['pills'][0]['label'])->toBe('قيد الانتظار');

    $this->travel(10)->days();
    $overdue = $source->card((string) $promise->number);

    expect($overdue->model['pills'][0])->toBe(['label' => 'متأخر', 'tone' => 'destructive', 'glyph' => 'AlarmClock'])
        ->and($overdue->version())->not->toBe($before->version());

    $promise->update(['status' => 'fulfilled', 'resolved_at' => now()->format('Y-m-d')]);

    expect($source->card((string) $promise->number)->model['pills'][0]['label'])->toBe('تحقق (متأخراً)');
});

test('promise state labels on the card are the ones the page uses', function () {
    // Both sides read resources/data/promises.json, so this asserts the resolver
    // serves the shared vocabulary rather than a copy of it.
    $facts = json_decode(file_get_contents(resource_path('data/promises.json')), true, flags: JSON_THROW_ON_ERROR);

    expect(array_keys(PromisePreview::states()))->toBe(array_column($facts['states'], 'key'));

    foreach ($facts['states'] as $state) {
        expect(PromisePreview::states()[$state['key']])->toBe([$state['label'], $state['card_tone'], $state['glyph']]);
    }
});

test('an unpublished or unknown promise reveals nothing', function () {
    $draft = Promise::factory()->create(['title' => 'وعد لم يُنشر بعد', 'number' => 77]);

    expect(seoMetaFor('/promises/77')['title'])->toBe(config('seo.default_title'))
        ->and(Previews::cardSource('promise')->card('77'))->toBeNull()
        ->and(Previews::cardSource('promise')->card('not-a-number'))->toBeNull()
        ->and(seoMetaFor('/promises/424242')['image'])->toBe('https://syrian.zone'.StaticCards::url('home'));
});

test('a poll previews with a card of its own; the tier list keeps its page card', function () {
    $poll = Poll::factory()->create(['slug' => 'governors-2026', 'title' => 'تقييم المحافظين', 'is_active' => true]);
    Poll::factory()->create(['slug' => 'best-ministers', 'title' => 'تقييم الوزراء', 'is_active' => true]);

    $card = Previews::cardSource('poll')->card('governors-2026');

    expect(seoMetaFor('/polls/governors-2026')['image'])->toBe('https://syrian.zone/og/r/poll/governors-2026.png?v='.$card->version())
        ->and(seoMetaFor('/polls/governors-2026/leaderboard')['image'])->toBe(seoMetaFor('/polls/governors-2026')['image'])
        ->and(seoMetaFor('/polls/'.$poll->id)['canonical'])->toBe('https://syrian.zone/polls/governors-2026')
        ->and($card->model['title'])->toBe('تقييم المحافظين')
        ->and($card->model['pills'][0]['label'])->toBe('استطلاع مفتوح')
        ->and(seoMetaFor('/polls/best-ministers')['image'])->toBe('https://syrian.zone'.StaticCards::url('tierlist'))
        ->and(seoMetaFor('/polls/best-ministers/leaderboard')['image'])->toBe('https://syrian.zone'.StaticCards::url('tierlist-leaderboard'))
        ->and(Previews::cardSource('poll')->card('best-ministers'))->toBeNull();

    $poll->update(['is_active' => false]);

    expect(Previews::cardSource('poll')->card('governors-2026')->model['pills'][0]['label'])->toBe('استطلاع مغلق')
        ->and(seoMetaFor('/polls/governors-2026')['robots'])->toBe('noindex, follow');
});

test('a transit city card shows its live number of published routes', function () {
    seedPreviewCity('homs', 'حمص', published: 12, drafts: 3);
    seedPreviewCity('idlib', 'إدلب');

    $card = Previews::cardSource('city')->card('homs');

    expect(seoMetaFor('/transit/city/homs')['title'])->toBe('مواصلات حمص | ترانزيت')
        ->and(seoMetaFor('/transit/city/homs')['image'])->toBe('https://syrian.zone/og/r/city/homs.png?v='.$card->version())
        ->and($card->model['art'])->toBe(['type' => 'figure', 'value' => 12, 'label' => 'خطاً'])
        ->and(Previews::cardSource('city')->card('idlib')->model['art'])->toBe(['type' => 'icon', 'icon' => 'transit'])
        ->and(Previews::cardSource('city')->card('atlantis'))->toBeNull();

    DB::table('routes')->where('id', 'homs-draft-0')->update(['status' => 'published']);

    expect(Previews::cardSource('city')->card('homs')->version())->not->toBe($card->version());
});

test('a game room link previews as an invitation and is never indexed', function () {
    $meta = seoMetaFor('/guesswho/room/ABCD');

    expect($meta['title'])->toBe('دعوة للعب «من هو؟» | Syrian Zone')
        ->and($meta['image'])->toBe('https://syrian.zone'.StaticCards::url('guesswho-invite'))
        ->and($meta['robots'])->toBe('noindex, follow');
});

test('a shared compass result has its own card and is never indexed', function () {
    $meta = seoMetaFor('/compass/s/abc123');

    expect($meta['title'])->toContain('نتيجة مشتركة')
        ->and($meta['image'])->toBe('https://syrian.zone'.StaticCards::url('compass-share'))
        ->and($meta['robots'])->toBe('noindex, follow');
});

test('a resolver that throws leaves the page with the site defaults', function () {
    $this->app->bind(PromisePreview::class, fn () => new class implements PreviewResolver
    {
        public function resolve(Request $request, string $path): ?Preview
        {
            throw new RuntimeException('the database is unreachable');
        }
    });

    expect(seoMetaFor('/promises/1')['title'])->toBe(config('seo.default_title'));
});

test('counted nouns and dates read correctly in Arabic', function () {
    $forms = ['one' => 'خط', 'two' => 'خطّان', 'few' => 'خطوط', 'many' => 'خطاً'];

    expect(Arabic::counted(1, $forms))->toBe('خط')
        ->and(Arabic::counted(2, $forms))->toBe('خطّان')
        ->and(Arabic::counted(7, $forms))->toBe('خطوط')
        ->and(Arabic::counted(42, $forms))->toBe('خطاً')
        ->and(Arabic::counted(100, $forms))->toBe('خط')
        ->and(Arabic::counted(105, $forms))->toBe('خطوط')
        ->and(Arabic::date(CarbonImmutable::parse('2025-12-31')))->toBe('31 كانون الأول 2025')
        ->and(Arabic::excerpt("سطر\nأول   وثانٍ", 160))->toBe('سطر أول وثانٍ')
        ->and(mb_strlen(Arabic::excerpt(str_repeat('كلمة ', 80), 160)))->toBe(160);
});
