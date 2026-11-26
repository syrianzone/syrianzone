<?php

use App\Models\Candidate;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\Place;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseCoSpeaker;
use App\Models\PromiseSpeaker;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Support\Facts;

/**
 * Parse /sitemap-images.xml into a map of page <loc> => list of <image:loc>.
 *
 * @return array<string, list<string>>
 */
function parseImageSitemap(string $xml): array
{
    $doc = simplexml_load_string($xml);
    expect($doc)->not->toBeFalse();

    $nsImage = 'http://www.google.com/schemas/sitemap-image/1.1';
    $map = [];

    foreach ($doc->url as $url) {
        $loc = (string) $url->loc;
        $images = [];
        foreach ($url->children($nsImage)->image as $imgNode) {
            $images[] = (string) $imgNode->children($nsImage)->loc;
        }
        $map[$loc] = $images;
    }

    return $map;
}

test('image sitemap is served as xml without cookies and uses the image namespace', function () {
    $response = $this->get('/sitemap-images.xml')->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('application/xml; charset=UTF-8')
        ->and($response->headers->get('Cache-Control'))->toContain('public')
        ->and($response->headers->getCookies())->toBe([])
        ->and($response->getContent())->toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');

    $doc = simplexml_load_string($response->getContent());
    expect($doc)->not->toBeFalse()
        ->and($doc->getName())->toBe('urlset');
});

test('image sitemap includes published officials with resolved portraits and skips placeholders and drafts', function () {
    $category = OfficialCategory::create([
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'is_active' => true,
    ]);

    $entityWithFilename = OfficialEntity::create([
        'id' => 'min-foreign',
        'category_id' => $category->id,
        'name' => 'MOFA',
        'name_ar' => 'وزارة الخارجية',
        'image' => 'mofa.webp',
        'is_active' => true,
    ]);

    $mismatchedEntity = OfficialEntity::create([
        'id' => 'pf-safwat-raslan',
        'category_id' => $category->id,
        'name' => 'Safwat Raslan',
        'name_ar' => 'صفوت رسلان',
        'image' => 'pf-abdulkader-husrieh.webp',
        'is_active' => true,
    ]);

    GovtOfficial::create([
        'slug' => 'explicit-portrait',
        'full_name_ar' => 'مسؤول بصورة مباشرة',
        'display_name_ar' => 'مسؤول بصورة مباشرة',
        'portrait_url' => '/images/govtcvs/explicit.webp',
        'publish_status' => 'published',
    ]);

    GovtOfficial::create([
        'slug' => 'entity-portrait',
        'full_name_ar' => 'مسؤول بصورة جهة',
        'display_name_ar' => 'مسؤول بصورة جهة',
        'official_entity_id' => $entityWithFilename->id,
        'publish_status' => 'published',
    ]);

    GovtOfficial::create([
        'slug' => 'placeholder-portrait',
        'full_name_ar' => 'مسؤول بصورة افتراضية',
        'display_name_ar' => 'مسؤول بصورة افتراضية',
        'portrait_url' => '/placeholder-user.jpg',
        'publish_status' => 'published',
    ]);

    GovtOfficial::create([
        'slug' => 'safwat-mismatched',
        'full_name_ar' => 'صفوت رسلان',
        'display_name_ar' => 'صفوت رسلان',
        'official_entity_id' => $mismatchedEntity->id,
        'publish_status' => 'published',
    ]);

    GovtOfficial::create([
        'slug' => 'draft-official',
        'full_name_ar' => 'مسؤول مسودة',
        'display_name_ar' => 'مسؤول مسودة',
        'portrait_url' => '/images/govtcvs/draft.webp',
        'publish_status' => 'draft',
    ]);

    $map = parseImageSitemap($this->get('/sitemap-images.xml')->getContent());
    $mediaBase = rtrim((string) (config('filesystems.disks.r2.url') ?: Facts::media()['public_base']), '/');

    expect($map['https://syrian.zone/govtcvs/explicit-portrait'] ?? null)
        ->toBe(['https://syrian.zone/images/govtcvs/explicit.webp'])
        ->and($map['https://syrian.zone/govtcvs/entity-portrait'] ?? null)
        ->toBe([$mediaBase.'/syofficial/entities/mofa.webp'])
        ->and($map)->not->toHaveKey('https://syrian.zone/govtcvs/placeholder-portrait')
        ->and($map)->not->toHaveKey('https://syrian.zone/govtcvs/safwat-mismatched')
        ->and($map)->not->toHaveKey('https://syrian.zone/govtcvs/draft-official');
});

test('image sitemap includes rich govapps, published promises, active syofficial entities, and excludes thin apps and places', function () {
    // Rich active GovApp -> in /govapps/{id} and /govapps
    GovApp::factory()->create([
        'id' => 'rich-app',
        'icon' => '/assets/apps/rich/icon.png',
        'images' => ['/assets/apps/rich/s1.png', 'https://cdn.example.com/apps/s2.webp?v=1&fmt=webp'],
        'overview_ar' => 'دليل متكامل للتطبيق الحكومي.',
        'features' => ['ميزة 1', 'ميزة 2', 'ميزة 3'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    // Thin active GovApp -> excluded from /govapps/{id}, icon still shown on /govapps
    GovApp::factory()->create([
        'id' => 'thin-app',
        'icon' => '/assets/apps/thin/icon.png',
        'images' => ['/assets/apps/thin/s1.png'],
        'overview_ar' => null,
        'features' => [],
        'order_column' => 2,
        'is_active' => true,
    ]);

    // Inactive rich GovApp -> excluded everywhere
    GovApp::factory()->inactive()->create([
        'id' => 'inactive-app',
        'icon' => '/assets/apps/inactive/icon.png',
        'images' => ['/assets/apps/inactive/s1.png'],
        'overview_ar' => 'غير مفعل.',
        'features' => ['1', '2', '3'],
    ]);

    // Published promise with speaker + co-speaker; draft promise excluded
    $poll = Poll::factory()->create(['slug' => 'best-ministers', 'is_active' => true]);
    $cand = Candidate::factory()->create(['poll_id' => $poll->id, 'image_url' => 'https://cdn.example.com/cand.webp']);
    $speaker1 = PromiseSpeaker::factory()->create(['candidate_id' => $cand->id, 'image_url' => null, 'status' => 'approved']);
    $speaker2 = PromiseSpeaker::factory()->create(['image_url' => '/images/speakers/co.webp', 'status' => 'approved']);
    $draftSpeaker = PromiseSpeaker::factory()->create(['image_url' => '/images/speakers/draft.webp', 'status' => 'approved']);

    $publishedPromise = Promise::factory()->published()->create([
        'number' => 12,
        'speaker_id' => $speaker1->id,
    ]);
    PromiseCoSpeaker::create([
        'promise_id' => $publishedPromise->id,
        'speaker_id' => $speaker2->id,
        'sort' => 0,
    ]);
    Promise::factory()->create([
        'number' => null,
        'review_status' => 'pending',
        'speaker_id' => $draftSpeaker->id,
    ]);

    // Active SyOfficial category + entity vs inactive category
    $activeCat = OfficialCategory::create(['id' => 'active-cat', 'label_ar' => 'نشط', 'label_en' => 'Active', 'is_active' => true]);
    $inactiveCat = OfficialCategory::create(['id' => 'inactive-cat', 'label_ar' => 'معطل', 'label_en' => 'Inactive', 'is_active' => false]);
    OfficialEntity::create([
        'id' => 'entity-active',
        'category_id' => $activeCat->id,
        'name' => 'Active Entity',
        'name_ar' => 'جهة نشطة',
        'image' => '/assets/officials/active.webp',
        'is_active' => true,
    ]);
    OfficialEntity::create([
        'id' => 'entity-in-inactive-cat',
        'category_id' => $inactiveCat->id,
        'name' => 'Hidden Entity',
        'name_ar' => 'جهة مخفية',
        'image' => '/assets/officials/hidden.webp',
        'is_active' => true,
    ]);

    // Thin approved Mishwar place (<15 words & 1 photo) -> must NOT appear; indexable place appears at its canonical place page
    $thinPlace = Place::factory()->approved()->create(['description' => 'وصف قصير جداً']);
    placePhoto($thinPlace->id);

    $richPlace = Place::factory()->approved()->create([
        'name' => 'الجامع الأموي الكبير',
        'description' => 'الجامع الأموي الكبير في قلب دمشق القديمة من أقدم وأعرق المساجد التاريخية في العالم الإسلامي ويضم صحناً واسعاً وفسيفساء أثرية نادرة.',
    ]);
    $richPhoto = placePhoto($richPlace->id);

    $map = parseImageSitemap($this->get('/sitemap-images.xml')->getContent());

    expect($map['https://syrian.zone/govapps/rich-app'] ?? null)->toBe([
        'https://syrian.zone/assets/apps/rich/icon.png',
        'https://syrian.zone/assets/apps/rich/s1.png',
        'https://cdn.example.com/apps/s2.webp?v=1&fmt=webp',
    ])
        ->and($map)->not->toHaveKey('https://syrian.zone/govapps/thin-app')
        ->and($map)->not->toHaveKey('https://syrian.zone/govapps/inactive-app')
        ->and($map['https://syrian.zone/govapps'] ?? null)->toBe([
            'https://syrian.zone/assets/apps/rich/icon.png',
            'https://syrian.zone/assets/apps/thin/icon.png',
        ])
        ->and($map['https://syrian.zone/promises/12'] ?? null)->toBe([
            'https://cdn.example.com/cand.webp',
            'https://syrian.zone/images/speakers/co.webp',
        ])
        ->and($map['https://syrian.zone/promises'] ?? null)->toBe([
            'https://cdn.example.com/cand.webp',
            'https://syrian.zone/images/speakers/co.webp',
        ])
        ->and($map['https://syrian.zone/syofficial'] ?? null)->toBe([
            'https://syrian.zone/assets/officials/active.webp',
        ])
        ->and($map)->not->toHaveKey('https://syrian.zone/mishwar')
        ->and($map)->not->toHaveKey('https://syrian.zone/mishwar?place='.$thinPlace->id)
        ->and($map)->not->toHaveKey('https://syrian.zone'.$thinPlace->publicPath())
        ->and($map['https://syrian.zone'.$richPlace->publicPath()] ?? null)->not->toBeEmpty();

    // Every loc and image:loc must be an absolute http(s) URL.
    foreach ($map as $pageLoc => $imageLocs) {
        expect($pageLoc)->toMatch('#^https?://#');
        foreach ($imageLocs as $imageLoc) {
            expect($imageLoc)->toMatch('#^https?://#');
        }
    }
});

test('image sitemap uses configured canonical host', function () {
    config(['seo.base_url' => 'https://staging.example.test']);

    GovtOfficial::create([
        'slug' => 'host-check',
        'full_name_ar' => 'فحص المضيف',
        'display_name_ar' => 'فحص المضيف',
        'portrait_url' => '/images/govtcvs/host.webp',
        'publish_status' => 'published',
    ]);

    $paths = collect(app(ImageSitemapBuilder::class)->build())->pluck('path');
    expect($paths)->toContain('/govtcvs/host-check');

    $map = parseImageSitemap($this->get('/sitemap-images.xml')->getContent());
    foreach (array_keys($map) as $loc) {
        expect($loc)->toStartWith('https://staging.example.test/');
    }
    expect($map)->toHaveKey('https://staging.example.test/govtcvs/host-check')
        ->and($map['https://staging.example.test/govtcvs/host-check'])
        ->toBe(['https://staging.example.test/images/govtcvs/host.webp']);
});

test('image sitemap lists the Ramadan city photos and the banknote fronts', function () {
    $map = parseImageSitemap($this->get('/sitemap-images.xml')->assertOk()->getContent());
    $base = rtrim((string) config('seo.base_url'), '/');

    foreach (Facts::ramadanImages() as $id => $image) {
        expect($map["{$base}/muslim/ramadan/{$id}"] ?? [])->toBe(["{$base}{$image['file']}"]);
        expect(is_file(public_path(ltrim($image['file'], '/'))))->toBeTrue();
    }
    expect($map["{$base}/muslim/ramadan"] ?? [])->not->toBeEmpty();

    $currency = Facts::currency();
    $fronts = collect([...$currency['new_denominations'], ...$currency['old_denominations']])
        ->map(fn (array $note) => $base.$note['front_image']['path'])
        ->all();
    expect($map["{$base}/currency"] ?? [])->toEqualCanonicalizing($fronts);
    foreach ($map["{$base}/currency"] as $url) {
        expect($url)->not->toContain('-back.');
    }
});

test('image sitemap lists the Syrian visual identity logo, flag, and hub images and all files exist on disk', function () {
    $map = parseImageSitemap($this->get('/sitemap-images.xml')->assertOk()->getContent());
    $base = rtrim((string) config('seo.base_url'), '/');

    expect($map["{$base}/syid/logo"] ?? [])
        ->toContain("{$base}/syid-assets/downloads/syrian-arab-republic-eagle-emblem-4k.png")
        ->toContain("{$base}/syid-assets/materials/logo.ai.svg")
        ->toContain("{$base}/syid-assets/downloads/syrian-arab-republic-eagle-emblem-black-4k.png")
        ->toContain("{$base}/syid-assets/downloads/syrian-arab-republic-eagle-emblem-white-4k.png");

    expect($map["{$base}/syid/flag"] ?? [])
        ->toContain("{$base}/syid-assets/downloads/syrian-flag-3840.png")
        ->toContain("{$base}/syid-assets/downloads/syrian-flag.svg")
        ->toContain("{$base}/syid-assets/materials/syrian-identity-wallpaper-desktop.png")
        ->toContain("{$base}/syid-assets/materials/syrian-identity-wallpaper-mobile.png");

    expect($map["{$base}/syid"] ?? [])
        ->toContain("{$base}/syid-assets/materials/logo.ai.svg")
        ->toContain("{$base}/syid-assets/downloads/syrian-flag-1280.png");

    foreach (["{$base}/syid/logo", "{$base}/syid/flag", "{$base}/syid"] as $pageUrl) {
        foreach ($map[$pageUrl] as $imageUrl) {
            $rel = ltrim((string) parse_url($imageUrl, PHP_URL_PATH), '/');
            expect(is_file(public_path($rel)), "Image sitemap references missing file: {$rel}")->toBeTrue();
        }
    }
});
