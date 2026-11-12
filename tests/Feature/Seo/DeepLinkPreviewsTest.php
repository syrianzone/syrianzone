<?php

use App\Models\City;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\Preview\Resolvers\PlacePreview;
use App\Support\Seo\Preview\Resolvers\TransitRoutePreview;

/** The city row this file's deep links point at. */
function seedDeepLinkCity(string $id, string $name): void
{
    seedCity($id, [
        'name_ar' => $name,
        'name_en' => ucfirst($id),
        'center' => [36.3, 33.5],
        'bounds' => [[36.1, 33.4], [36.5, 33.6]],
    ]);
}

function seedDeepLinkRoute(string $id, string $city, string $name, string $status = 'published', int $colour = 2): void
{
    transitRoute($id, $city, ['name_ar' => $name, 'status' => $status, 'color_index' => $colour]);
}

test('a place link previews as the place, while the map stays the canonical page', function () {
    $place = Place::factory()->approved()->create(['name' => 'قلعة حلب', 'category' => 'historical', 'description' => "قلعة تاريخية\nوسط المدينة القديمة."]);
    PlacePhoto::factory()->create(['place_id' => $place->id, 'display_path' => "places/{$place->id}/a_display.webp"]);

    $meta = seoMetaFor('/mishwar?place='.$place->id);
    $card = Previews::cardSource('place')->card((string) $place->id);

    expect($meta['title'])->toBe('قلعة حلب | مشوار')
        ->and($meta['description'])->toBe('قلعة تاريخية وسط المدينة القديمة.')
        ->and($meta['url'])->toBe('https://syrian.zone/mishwar?place='.$place->id)
        ->and($meta['canonical'])->toBe('https://syrian.zone/mishwar')
        ->and($meta['image'])->toBe('https://syrian.zone/og/r/place/'.$place->id.'.jpg?v='.$card->version())
        ->and($meta['robots'])->toBe('index, follow');

    // Structured data keeps describing the canonical page, the map.
    $page = collect(json_decode($meta['json_ld'], true)['@graph'])->firstWhere('@type', 'CollectionPage');
    expect($page['name'])->toBe(seoMetaFor('/mishwar')['title'])
        ->and($page['url'])->toBe('https://syrian.zone/mishwar');

    expect($card->format)->toBe('jpg')
        ->and($card->model['kind'])->toBe('photo')
        ->and($card->model['title'])->toBe('قلعة حلب')
        ->and($card->model['pills'])->toBe([['label' => 'تاريخي', 'glyph' => 'Landmark']])
        ->and($card->model['photo'])->toContain("places/{$place->id}/a_display.webp");
});

test('the place tags reach the html a scraper reads', function () {
    $place = Place::factory()->approved()->create(['name' => 'بحيرة قطينة']);

    $html = $this->get('/mishwar?place='.$place->id)->assertOk()->getContent();

    expect($html)->toContain('<title inertia>بحيرة قطينة | مشوار</title>')
        ->and($html)->toContain('<meta property="og:title" content="بحيرة قطينة" inertia>')
        ->and($html)->toContain('<meta name="twitter:title" content="بحيرة قطينة" inertia>')
        ->and($html)->toContain('<meta property="og:image:alt" content="بحيرة قطينة" inertia>')
        ->and($html)->toContain('<meta property="og:url" content="https://syrian.zone/mishwar?place='.$place->id.'" inertia>')
        ->and($html)->toContain('<link rel="canonical" href="https://syrian.zone/mishwar" inertia>')
        ->and($html)->toContain('content="https://syrian.zone/og/r/place/'.$place->id.'.png?v=');
});

test('a place without a photograph gets a drawn card; without a description, a written one', function () {
    $place = Place::factory()->approved()->create(['name' => 'سوق الحميدية', 'category' => 'market', 'description' => '']);
    $card = Previews::cardSource('place')->card((string) $place->id);

    expect($card->format)->toBe('png')
        ->and($card->model)->not->toHaveKey('photo')
        ->and($card->model['art'])->toBe(['type' => 'icon', 'icon' => 'mishwar'])
        ->and(seoMetaFor('/mishwar?place='.$place->id)['description'])->toBe('مكان سوق على خريطة مشوار: الصور والموقع والتفاصيل.');
});

test('a place that is not approved, unknown or malformed previews as the map and has no card', function () {
    $pending = Place::factory()->create(['name' => 'مكان بانتظار المراجعة']);
    $rejected = Place::factory()->rejected()->create();
    $map = seoMetaFor('/mishwar');

    foreach ([$pending->id, $rejected->id, 999999, 'abc', '1 OR 1=1'] as $id) {
        $meta = seoMetaFor('/mishwar?place='.urlencode((string) $id));
        expect($meta['title'])->toBe($map['title'])
            ->and($meta['url'])->toBe('https://syrian.zone/mishwar')
            ->and($meta['image'])->toBe('https://syrian.zone'.StaticCards::url('mishwar'));
    }

    expect(Previews::cardSource('place')->card((string) $pending->id))->toBeNull()
        ->and(Previews::cardSource('place')->card('abc'))->toBeNull();
});

test('place category labels on the card are the ones the map uses', function () {
    // Both sides read resources/data/places.json, so this asserts the resolver
    // serves the shared table rather than a copy of it.
    $facts = json_decode(file_get_contents(resource_path('data/places.json')), true, flags: JSON_THROW_ON_ERROR);

    expect(array_keys(PlacePreview::categories()))->toBe(array_column($facts['categories'], 'key'));

    foreach ($facts['categories'] as $category) {
        expect(PlacePreview::categories()[$category['key']])->toBe([$category['label'], $category['glyph']]);
    }
});

test('a route link previews as the route on its city map', function () {
    seedDeepLinkCity('damascus', 'دمشق');
    seedDeepLinkCity('homs', 'حمص');
    seedDeepLinkRoute('damascus-001', 'damascus', 'مزة جبل – كراج الست', colour: 10);
    seedDeepLinkRoute('damascus-draft', 'damascus', 'خط قيد الإعداد', status: 'draft');

    $meta = seoMetaFor('/transit/city/damascus?route=damascus-001');
    $card = Previews::cardSource('route')->card('damascus-001');

    expect($meta['title'])->toBe('مزة جبل – كراج الست | مواصلات دمشق')
        ->and($meta['url'])->toBe('https://syrian.zone/transit/city/damascus?route=damascus-001')
        ->and($meta['canonical'])->toBe('https://syrian.zone/transit/city/damascus')
        ->and($meta['image'])->toBe('https://syrian.zone/og/r/route/damascus-001.png?v='.$card->version())
        ->and($card->model['pills'][0])->toBe(['label' => 'دمشق', 'glyph' => 'MapPin'])
        // colour index 10 wraps around the eight map colours
        ->and($card->model['art'])->toBe(['type' => 'route', 'colour' => TransitRoutePreview::PALETTE[2]]);

    // A draft route, an unknown one, or a route of another city: the city itself.
    foreach (['damascus-draft', 'no-such-route', 'bad id!'] as $route) {
        expect(seoMetaFor('/transit/city/damascus?route='.urlencode($route))['title'])->toBe('مواصلات دمشق | ترانزيت');
    }
    expect(seoMetaFor('/transit/city/homs?route=damascus-001')['title'])->toBe('مواصلات حمص | ترانزيت')
        ->and(Previews::cardSource('route')->card('damascus-draft'))->toBeNull();
});

test('cities that share one map accept each other\'s routes', function () {
    seedDeepLinkCity('damascus', 'دمشق');
    seedDeepLinkCity('rif-dimashq', 'ريف دمشق');
    seedDeepLinkCity('homs', 'حمص');
    seedDeepLinkRoute('rif-001', 'rif-dimashq', 'صحنايا – نهر عيشة');
    seedDeepLinkRoute('damascus-001', 'damascus', 'مزة جبل – كراج الست');

    // The Damascus map shows the countryside's routes too, so this is the
    // address the page itself produces when one of them is selected.
    $meta = seoMetaFor('/transit/city/damascus?route=rif-001');

    expect($meta['title'])->toBe('صحنايا – نهر عيشة | مواصلات ريف دمشق')
        ->and($meta['url'])->toBe('https://syrian.zone/transit/city/damascus?route=rif-001')
        ->and($meta['canonical'])->toBe('https://syrian.zone/transit/city/damascus')
        ->and($meta['image'])->toContain('/og/r/route/rif-001.png?v=')
        ->and(seoMetaFor('/transit/city/rif-dimashq?route=damascus-001')['og_title'])->toBe('مزة جبل – كراج الست')
        // a city outside the shared map still does not claim the route
        ->and(seoMetaFor('/transit/city/homs?route=rif-001')['title'])->toBe('مواصلات حمص | ترانزيت');

    expect(City::mapGroup('damascus'))->toBe(['damascus', 'rif-dimashq'])
        ->and(City::mapGroup('rif-dimashq'))->toBe(['damascus', 'rif-dimashq'])
        ->and(City::mapGroup('homs'))->toBe(['homs']);
});

test('route colours on the card are the ones the map uses', function () {
    $source = file_get_contents(resource_path('js/Pages/Transit/_lib/mapColors.ts'));
    preg_match_all("/'(#[0-9a-f]{6})'/i", str($source)->between('ROUTE_PALETTE = [', ']')->toString(), $colours);

    expect($colours[1])->toBe(TransitRoutePreview::PALETTE);
});

test('a crossing link previews as the crossing', function () {
    $meta = seoMetaFor('/crossings?c=1');
    $card = Previews::cardSource('crossing')->card('1');

    expect($meta['title'])->toBe('منفذ باب الهوى الحدودي | المنافذ الحدودية')
        ->and($meta['description'])->toBe('منفذ برّي مع تركيا: الحالة وساعات العمل وأرقام التواصل والموقع على الخريطة.')
        ->and($meta['url'])->toBe('https://syrian.zone/crossings?c=1')
        ->and($meta['canonical'])->toBe('https://syrian.zone/crossings')
        ->and($meta['image'])->toBe('https://syrian.zone/og/r/crossing/1.png?v='.$card->version())
        ->and($card->model['title'])->toBe('منفذ باب الهوى الحدودي')
        ->and(array_column($card->model['pills'], 'label'))->toBe(['منفذ برّي', 'تركيا', 'مسافرين وتجاري']);

    $port = Previews::cardSource('crossing')->card('20');
    expect(array_column($port->model['pills'], 'label'))->toBe(['مرفأ بحري', 'مسافرين وتجاري']);

    foreach (['999', 'abc', ''] as $number) {
        expect(seoMetaFor('/crossings?c='.$number)['title'])->toBe(seoMetaFor('/crossings')['title']);
    }
});

test('a shared priorities link previews as an invitation and keeps its ranking', function () {
    $state = 'MToyMCwyOjMwfGEsYg==';
    $meta = seoMetaFor('/priorities?state='.urlencode($state));

    expect($meta['title'])->toBe('أولوياتي لسوريا المستقبل | Syrian Zone')
        ->and($meta['url'])->toBe('https://syrian.zone/priorities?state='.rawurlencode($state))
        ->and($meta['canonical'])->toBe('https://syrian.zone/priorities')
        ->and($meta['image'])->toBe('https://syrian.zone'.StaticCards::url('priorities-share'));

    foreach (['<script>', str_repeat('A', 2001), ''] as $bad) {
        expect(seoMetaFor('/priorities?state='.urlencode($bad))['title'])->toBe(seoMetaFor('/priorities')['title']);
    }
});

test('an unrelated query string leaves a fixed page exactly as it is', function () {
    $plain = seoMetaFor('/mishwar');
    $withNoise = seoMetaFor('/mishwar?view=grid&utm_source=x&guide=4');

    expect($withNoise)->toBe($plain);
});
