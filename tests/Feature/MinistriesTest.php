<?php

use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\PromiseSpeaker;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;
use App\Support\Seo\Preview\Resolvers\MinistryPreview;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

test('ministries.json has a valid schema where every holder has dates and a source', function () {
    $data = Facts::ministries();

    expect($data['meta']['source_url'] ?? null)->toStartWith('https://')
        ->and($data['meta']['updated_at'] ?? null)->not->toBeEmpty()
        ->and($data['eras'] ?? [])->toHaveCount(4)
        ->and($data['restructurings'] ?? [])->not->toBeEmpty();

    $eraIds = array_column($data['eras'], 'id');
    $slugs = array_column($data['ministries'], 'slug');
    expect(count($slugs))->toBe(count(array_unique($slugs)))
        ->and(count($slugs))->toBeGreaterThanOrEqual(30);

    $slugSet = array_flip($slugs);

    foreach ($data['ministries'] as $ministry) {
        expect($ministry['slug'])->toMatch('/^[a-z0-9-]+$/')
            ->and($ministry['name_ar'])->not->toBeEmpty()
            ->and($ministry['kind'])->toBeIn(['ministry', 'sovereign'])
            ->and($ministry['status'])->toBeIn(['current', 'merged', 'split', 'abolished'])
            ->and($ministry['holders'])->not->toBeEmpty();

        foreach (array_merge($ministry['predecessors'] ?? [], $ministry['successors'] ?? []) as $ref) {
            expect(array_key_exists($ref, $slugSet))
                ->toBeTrue("Unknown lineage slug {$ref} on {$ministry['slug']}");
        }

        foreach (array_merge($ministry['holders'], $ministry['deputies'] ?? []) as $holder) {
            expect($holder['name'])->not->toBeEmpty()
                ->and($holder['title'])->not->toBeEmpty()
                ->and($holder['start_date'])->toMatch('/^\d{4}-\d{2}-\d{2}$/')
                ->and($holder['era'])->toBeIn($eraIds)
                ->and($holder['source_url'])->toMatch('#^https?://#');

            if ($holder['end_date'] !== null) {
                expect($holder['end_date'])->toMatch('/^\d{4}-\d{2}-\d{2}$/');
            }
        }
    }
});

test('ministries hub and every ministry slug return 200 with a unique title and valid JSON-LD', function () {
    $hubResponse = $this->get('/ministries')->assertOk();
    $hubResponse->assertInertia(fn ($page) => $page
        ->component('Ministries/Index')
        ->has('eras', 4)
        ->has('current_cabinet', 24)
        ->has('sovereign_bodies', 7)
        ->has('historical_ministries', 6)
    );

    $hubTitle = SeoMeta::resolve(Request::create('/ministries', 'GET'))['title'];
    $seenTitles = [$hubTitle => '/ministries'];

    foreach (Facts::ministries()['ministries'] as $ministry) {
        $path = '/ministries/'.$ministry['slug'];
        $this->get($path)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Ministries/Show')
                ->where('ministry.slug', $ministry['slug'])
            );

        $meta = SeoMeta::resolve(Request::create($path, 'GET'));
        expect($seenTitles)->not->toHaveKey($meta['title'], "Duplicate title on {$path}");
        $seenTitles[$meta['title']] = $path;

        $graph = json_decode($meta['json_ld'], true, flags: JSON_THROW_ON_ERROR)['@graph'];
        $types = array_column($graph, '@type');
        expect($types)->toContain('BreadcrumbList');

        $webPage = collect($graph)->firstWhere('@type', 'WebPage');
        expect($webPage['mainEntity']['@type'] ?? null)->toBe('GovernmentOrganization')
            ->and($webPage['mainEntity']['name'] ?? null)->toBe($ministry['name_ar']);

        $hasCurrent = collect($ministry['holders'])->contains(fn (array $h) => ! empty($h['is_current']));
        if ($hasCurrent) {
            $person = collect($graph)->firstWhere('@type', 'Person');
            expect($person)->not->toBeNull()
                ->and($person['jobTitle'] ?? null)->not->toBeEmpty();
        }
    }
});

test('unknown ministry slug returns 404', function () {
    $this->get('/ministries/unknown-ministry-slug-xyz')->assertNotFound();
});

test('ministry detail enriches govtcvs, official accounts, gov apps, promises, and image sitemap', function () {
    $category = OfficialCategory::create([
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'order_column' => 1,
        'is_active' => true,
    ]);

    OfficialEntity::create([
        'id' => 'min-energy',
        'category_id' => $category->id,
        'name' => 'Ministry of Energy',
        'name_ar' => 'وزارة الطاقة السورية',
        'description' => 'Syrian Ministry of Energy',
        'description_ar' => 'الوزارة المعنية بقطاع الطاقة والكهرباء والنفط والمياه',
        'image' => 'https://example.com/energy-logo.webp',
        'socials' => [
            'website' => 'https://moe.gov.sy',
            'telegram' => 'https://t.me/syrian_energy',
        ],
        'order_column' => 1,
        'is_active' => true,
    ]);

    $speaker = PromiseSpeaker::create([
        'name' => 'محمد البشير',
        'role_title' => 'وزير الطاقة',
    ]);

    $sector = PromiseSector::create([
        'id' => 'energy',
        'label' => 'الطاقة',
        'order_column' => 1,
        'is_active' => true,
    ]);

    $official = GovtOfficial::create([
        'slug' => 'mohammed-al-bashir',
        'full_name_ar' => 'محمد البشير',
        'display_name_ar' => 'محمد البشير',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'publish_status' => 'published',
        'verification_level' => 'decree_verified',
        'portrait_url' => 'https://example.com/portraits/bashir.webp',
        'promise_speaker_id' => $speaker->id,
    ]);

    GovApp::create([
        'id' => 'seg',
        'name' => 'Syrian Energy Gate',
        'name_ar' => 'بوابة الطاقة السورية',
        'description' => 'Energy services portal',
        'description_ar' => 'بوابة خدمات الطاقة الرسمية',
        'official_entity_id' => 'min-energy',
        'is_active' => true,
        'order_column' => 1,
    ]);

    Promise::factory()->published()->create([
        'number' => 42,
        'title' => 'تحسين ساعات التغذية الكهربائية',
        'quote' => 'سنرفع ساعات التغذية الكهربائية خلال الأشهر المقبلة.',
        'speaker_id' => $speaker->id,
        'sector_id' => $sector->id,
        'statement_date' => '2025-06-01',
        'status' => 'in_progress',
    ]);

    $this->get('/ministries/energy')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Ministries/Show')
            ->where('ministry.current_holder.govtcvs_slug', 'mohammed-al-bashir')
            ->where('ministry.current_holder.govtcvs_url', '/govtcvs/mohammed-al-bashir')
            ->where('ministry.current_holder.portrait_url', 'https://example.com/portraits/bashir.webp')
            ->where('official_accounts.primary.id', 'min-energy')
            ->has('gov_apps', 1)
            ->where('gov_apps.0.id', 'seg')
            ->has('promises', 1)
            ->where('promises.0.number', 42)
        );

    // JSON-LD includes official website and sameAs accounts
    $meta = SeoMeta::resolve(Request::create('/ministries/energy', 'GET'));
    $graph = json_decode($meta['json_ld'], true, flags: JSON_THROW_ON_ERROR)['@graph'];
    $webPage = collect($graph)->firstWhere('@type', 'WebPage');
    expect($webPage['mainEntity']['url'])->toBe('https://moe.gov.sy')
        ->and($webPage['mainEntity']['sameAs'])->toContain('https://t.me/syrian_energy');

    // GovtCvs profile links back to the official's ministry pages
    $this->get('/govtcvs/'.$official->slug)
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('GovtCvs/Show')
            ->where('ministry_links.0.href', '/ministries/energy')
        );

    // Image sitemap includes minister portraits for /ministries and /ministries/energy
    $imageEntries = collect(app(ImageSitemapBuilder::class)->build())->keyBy('path');
    expect($imageEntries->get('/ministries')?->images)->toContain('https://example.com/portraits/bashir.webp')
        ->and($imageEntries->get('/ministries/energy')?->images)->toContain('https://example.com/portraits/bashir.webp');

    // Preview card source returns a card for valid slug and null for invalid slug
    $preview = app(MinistryPreview::class);
    expect($preview->card('energy'))->not->toBeNull()
        ->and($preview->card('not-a-ministry'))->toBeNull();
});

test('sitemap and llms.txt include ministries hub and every ministry slug', function () {
    $urls = collect(app(SitemapBuilder::class)->build())->pluck('path')->all();

    expect($urls)->toContain('/ministries');
    foreach (Facts::ministries()['ministries'] as $ministry) {
        expect($urls)->toContain('/ministries/'.$ministry['slug']);
    }

    $llms = $this->get('/llms.txt')->assertOk()->getContent();
    expect($llms)->toContain('/ministries');
});
