<?php

use App\Services\Sitemap\SitemapBuilder;
use App\Support\Facts;
use App\Support\Seo\Preview\Previews;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Inertia\Testing\AssertableInertia as Assert;

test('ramadan hub renders with expected start date and meta', function () {
    $this->get('/muslim/ramadan')
        ->assertOk()
        ->assertSee('إمساكية رمضان 1448', false)
        ->assertInertia(fn (Assert $page) => $page
            ->component('Muslim/Ramadan/Index')
            ->where('meta.hijri_year', 1448)
            ->where('meta.expected_start_date', '2027-02-08'));
});

test('every governorate has a valid ramadan imsakiya page and unknown city returns 404', function () {
    foreach (Facts::governorates() as $gov) {
        $id = (string) $gov['id'];
        $nameAr = (string) $gov['name_ar'];

        $this->get("/muslim/ramadan/{$id}")
            ->assertOk()
            ->assertSee("إمساكية رمضان 2027 في {$nameAr}", false)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Muslim/Ramadan/Show')
                ->where('city.id', $id)
                ->where('city.nameAr', $nameAr)
                ->has('rows', 29));
    }

    $this->get('/muslim/ramadan/unknown-city')->assertNotFound();
});

test('ramadan city preview builds photo card and canonical metadata', function () {
    $meta = SeoMeta::resolve(Request::create('/muslim/ramadan/damascus', 'GET'));
    $card = Previews::cardSource('ramadan')?->card('damascus');

    expect($meta['title'])->toBe('إمساكية رمضان 2027 في دمشق | الركن الإسلامي')
        ->and($meta['og_title'])->toBe('إمساكية رمضان 2027 في دمشق')
        ->and($meta['canonical'])->toBe(rtrim((string) config('seo.base_url'), '/').'/muslim/ramadan/damascus')
        ->and($card)->not->toBeNull()
        ->and($card->model['kind'])->toBe('photo');
});

test('sitemap and llms.txt include ramadan pages', function () {
    $urls = app(SitemapBuilder::class)->build();
    $paths = array_map(fn ($u) => $u->path, $urls);

    expect($paths)->toContain('/muslim/ramadan');
    foreach (Facts::governorates() as $gov) {
        expect($paths)->toContain('/muslim/ramadan/'.$gov['id']);
    }

    $llms = $this->get('/llms.txt')->assertOk()->getContent();
    expect($llms)->toContain('/muslim/ramadan')
        ->and($llms)->toContain('/muslim/ramadan/{city}');
});
