<?php

use App\Models\City;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Support\Facts;
use App\Support\Seo\Og\StaticCards;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\Preview\Resolvers\PlacePreview;

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

test('a place link previews as the place and canonicalizes to the dedicated place page', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'category' => 'historical',
        'description' => "قلعة تاريخية عريقة تقع في قلب مدينة حلب القديمة وتعد من أقدم وأكبر القلاع في العالم.\nوجهة مميزة للزوار.",
        'lat' => 36.1992,
        'lng' => 37.1626,
    ]);
    PlacePhoto::factory()->create(['place_id' => $place->id, 'display_path' => "places/{$place->id}/a_display.webp"]);

    $meta = seoMetaFor('/mishwar?place='.$place->id);
    $card = Previews::cardSource('place')->card((string) $place->id);
    $expectedUrl = 'https://syrian.zone'.$place->publicPath();

    expect($meta['title'])->toBe('قلعة حلب في حلب — صور وموقع | مشوار')
        ->and($meta['description'])->toBe('قلعة تاريخية عريقة تقع في قلب مدينة حلب القديمة وتعد من أقدم وأكبر القلاع في العالم. وجهة مميزة للزوار.')
        ->and($meta['url'])->toBe($expectedUrl)
        ->and($meta['canonical'])->toBe($expectedUrl)
        ->and($meta['type'])->toBe('article')
        ->and($meta['image'])->toBe('https://syrian.zone/og/r/place/'.$place->id.'.jpg?v='.$card->version())
        ->and($meta['robots'])->toBe('index, follow');

    // Structured data describes the canonical place page.
    $page = collect(json_decode($meta['json_ld'], true)['@graph'])->firstWhere('@type', 'WebPage');
    expect($page['url'])->toBe($expectedUrl)
        ->and($page['mainEntity']['@type'])->toBe(['TouristAttraction', 'LandmarksOrHistoricalBuildings']);

    expect($card->format)->toBe('jpg')
        ->and($card->model['kind'])->toBe('photo')
        ->and($card->model['title'])->toBe('قلعة حلب')
        ->and($card->model['pills'])->toBe([['label' => 'تاريخي', 'glyph' => 'Landmark']])
        ->and($card->model['photo'])->toContain("places/{$place->id}/a_display.webp");
});

/**
 * The tags a link scraper reads, parsed into values keyed by property/name/rel.
 *
 * @return array{meta: array<string, string>, links: array<string, string>, title: string}
 */
function deepLinkHead(string $html): array
{
    $attributesOf = function (string $source): array {
        preg_match_all('/([a-zA-Z:-]+)="([^"]*)"/', $source, $pairs, PREG_SET_ORDER);

        return array_column($pairs, 2, 1);
    };

    $meta = [];
    preg_match_all('/<meta\b([^>]*)>/i', $html, $metaTags);
    foreach ($metaTags[1] as $source) {
        $tag = $attributesOf($source);
        $key = $tag['property'] ?? $tag['name'] ?? null;
        if ($key !== null) {
            $meta[$key] = $tag['content'] ?? '';
        }
    }

    $links = [];
    preg_match_all('/<link\b([^>]*)>/i', $html, $linkTags);
    foreach ($linkTags[1] as $source) {
        $tag = $attributesOf($source);
        if (isset($tag['rel'])) {
            $links[$tag['rel']] = $tag['href'] ?? '';
        }
    }

    preg_match('/<title\b[^>]*>(.*?)<\/title>/is', $html, $title);

    return [
        'meta' => $meta,
        'links' => $links,
        'title' => html_entity_decode($title[1] ?? '', ENT_QUOTES | ENT_HTML5),
    ];
}

test('the place tags reach the html a scraper reads', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'بحيرة قطينة',
        'lat' => 34.656,
        'lng' => 36.617,
    ]);

    $head = deepLinkHead($this->get('/mishwar?place='.$place->id)->assertOk()->getContent());
    $expectedUrl = 'https://syrian.zone'.$place->publicPath();

    expect($head['title'])->toBe('بحيرة قطينة في حمص — صور وموقع | مشوار')
        ->and($head['meta']['og:title'])->toBe('بحيرة قطينة')
        ->and($head['meta']['twitter:title'])->toBe('بحيرة قطينة')
        ->and($head['meta']['og:image:alt'])->toBe('بحيرة قطينة')
        ->and($head['meta']['og:url'])->toBe($expectedUrl)
        ->and($head['links']['canonical'])->toBe($expectedUrl)
        ->and($head['meta']['og:image'])->toStartWith('https://syrian.zone/og/r/place/'.$place->id.'.png?v=');
});

test('a place without a photograph gets a drawn card; without a description, a written one', function () {
    $place = Place::factory()->approved()->create([
        'name' => 'سوق الحميدية',
        'category' => 'market',
        'description' => '',
        'lat' => 33.5110,
        'lng' => 36.3020,
    ]);
    $card = Previews::cardSource('place')->card((string) $place->id);

    expect($card->format)->toBe('png')
        ->and($card->model)->not->toHaveKey('photo')
        ->and($card->model['art'])->toBe(['type' => 'icon', 'icon' => 'mishwar'])
        ->and(seoMetaFor('/mishwar?place='.$place->id)['description'])->toBe('مكان سوق في دمشق على خريطة مشوار: الصور والموقع والتفاصيل.');
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
        ->and($card->model['art'])->toBe(['type' => 'route', 'colour' => Facts::transit()['route_palette'][2]]);

    // A draft route, an unknown one, or a route of another city: the city itself.
    foreach (['damascus-draft', 'no-such-route', 'bad id!'] as $route) {
        expect(seoMetaFor('/transit/city/damascus?route='.urlencode($route))['title'])->toBe('خطوط السرافيس في دمشق — خريطة ومسارات وأجرة | ترانزيت سوريا');
    }
    expect(seoMetaFor('/transit/city/homs?route=damascus-001')['title'])->toBe('خطوط السرافيس في حمص — خريطة ومسارات وأجرة | ترانزيت سوريا')
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
        ->and(seoMetaFor('/transit/city/homs?route=rif-001')['title'])->toBe('خطوط السرافيس في حمص — خريطة ومسارات وأجرة | ترانزيت سوريا');

    expect(City::mapGroup('damascus'))->toBe(['damascus', 'rif-dimashq'])
        ->and(City::mapGroup('rif-dimashq'))->toBe(['damascus', 'rif-dimashq'])
        ->and(City::mapGroup('homs'))->toBe(['homs']);
});

test('a crossing link previews as the crossing', function () {
    $meta = seoMetaFor('/crossings?c=1');
    $card = Previews::cardSource('crossing')->card('1');

    expect($meta['title'])->toBe('منفذ باب الهوى الحدودي — ساعات العمل والواتساب والموقع | المنافذ الحدودية')
        ->and($meta['description'])->toContain('منفذ برّي مع تركيا')
        ->and($meta['url'])->toBe('https://syrian.zone/crossings?c=1')
        ->and($meta['canonical'])->toBe('https://syrian.zone/crossings/bab-al-hawa')
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
