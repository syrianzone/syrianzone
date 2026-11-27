<?php

use App\Http\Controllers\Api\PopulationAtlasController;
use App\Models\Place;
use App\Models\Population\PopulationDemographic;
use App\Services\Places\PlaceGovernorates;
use Illuminate\Support\Facades\Cache;

test('GET /atlas returns a compact cached initialSummary without inlining the full master payload', function () {
    Cache::forget(PopulationAtlasController::SUMMARY_CACHE_KEY);

    // Non-governorate fallback row for Damascus (should be overridden by source_id 4)
    PopulationDemographic::create([
        'data_type' => 'population',
        'source_id' => 1,
        'city_name' => 'Damascus',
        'value' => 1_500_000,
        'date' => '2020-01-01',
        'note' => 'City estimate',
    ]);

    // Preferred governorate-level rows
    PopulationDemographic::create([
        'data_type' => 'population',
        'source_id' => 4,
        'city_name' => 'Damascus',
        'value' => 2_103_000,
        'date' => '2021-01-01',
        'source_url' => 'https://www.geo-ref.net/en/syr.htm',
        'note' => 'Governorate populations',
    ]);
    PopulationDemographic::create([
        'data_type' => 'population',
        'source_id' => 4,
        'city_name' => 'Aleppo',
        'value' => 4_118_000,
        'date' => '2021-01-01',
        'source_url' => 'https://www.geo-ref.net/en/syr.htm',
        'note' => 'Governorate populations',
    ]);

    // Fallback-only governorate (no source_id 4 row)
    PopulationDemographic::create([
        'data_type' => 'population',
        'source_id' => 1,
        'city_name' => 'Homs',
        'value' => 1_790_000,
        'date' => '2020-06-01',
        'note' => 'City estimate',
    ]);

    $this->get('/atlas')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Population/Index')
            ->missing('groups')
            ->missing('rainfall_data')
            ->missing('cities')
            ->where('initialSummary.source_id', 4)
            ->where('initialSummary.note', 'Governorate populations')
            ->where('initialSummary.date', '2021-01-01')
            ->where('initialSummary.source_url', 'https://www.geo-ref.net/en/syr.htm')
            ->where('initialSummary.total', 2_103_000 + 4_118_000 + 1_790_000)
            ->has('initialSummary.governorates', 3)
            ->where('initialSummary.governorates.0.id', 'damascus')
            ->where('initialSummary.governorates.0.name_ar', 'دمشق')
            ->where('initialSummary.governorates.0.value', 2_103_000)
            ->where('initialSummary.governorates.0.url', '/governorates/damascus')
            ->where('initialSummary.governorates.1.id', 'aleppo')
            ->where('initialSummary.governorates.1.value', 4_118_000)
            ->where('initialSummary.governorates.1.url', '/governorates/aleppo')
            ->where('initialSummary.governorates.2.id', 'homs')
            ->where('initialSummary.governorates.2.value', 1_790_000)
            ->where('initialSummary.governorates.2.url', '/governorates/homs')
        );
});

test('GET /atlas handles an empty demographics table gracefully', function () {
    Cache::forget(PopulationAtlasController::SUMMARY_CACHE_KEY);

    $this->get('/atlas')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Population/Index')
            ->where('initialSummary', null)
        );
});

test('GET /mishwar passes initial approved places and indexable governorate hub links', function () {
    PlaceGovernorates::forget();

    // 3 approved places in Hama (meets default min_governorate_places = 3)
    $hama1 = Place::factory()->approved()->create([
        'name' => 'نواعير حماة',
        'category' => 'historical',
        'lat' => 35.1318,
        'lng' => 36.7578,
    ]);
    $hama2 = Place::factory()->approved()->create([
        'name' => 'قلعة حماة',
        'category' => 'historical',
        'lat' => 35.1350,
        'lng' => 36.7500,
    ]);
    $hama3 = Place::factory()->approved()->create([
        'name' => 'حديقة أم الحسن',
        'category' => 'natural',
        'lat' => 35.1330,
        'lng' => 36.7550,
    ]);

    // 1 approved place in Aleppo (below threshold -> included in initialPlaces, excluded from governorateHubs)
    $aleppo = Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'category' => 'historical',
        'lat' => 36.1992,
        'lng' => 37.1626,
    ]);

    // 1 pending place in Hama (must not appear in initialPlaces or hub counts)
    Place::factory()->create([
        'name' => 'مكان بانتظار الموافقة',
        'status' => 'pending',
        'lat' => 35.1320,
        'lng' => 36.7560,
    ]);

    PlaceGovernorates::forget();

    $this->get('/mishwar')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Places/Index')
            ->missing('initialBounds')
            ->where('initialPlaces.current_page', 1)
            ->where('initialPlaces.last_page', 1)
            ->where('initialPlaces.total', 4)
            ->has('initialPlaces.data', 4)
            ->where('initialPlaces.data', function ($items) use ($hama1, $hama2, $hama3, $aleppo) {
                $urls = collect($items)->pluck('url')->all();
                $names = collect($items)->pluck('name')->all();

                return in_array($hama1->publicPath(), $urls, true)
                    && in_array($hama2->publicPath(), $urls, true)
                    && in_array($hama3->publicPath(), $urls, true)
                    && in_array($aleppo->publicPath(), $urls, true)
                    && ! in_array('مكان بانتظار الموافقة', $names, true);
            })
            ->has('governorateHubs', 1)
            ->where('governorateHubs.0', [
                'id' => 'hama',
                'name_ar' => 'حماة',
                'count' => 3,
                'url' => '/mishwar/hama',
            ])
        );
});
