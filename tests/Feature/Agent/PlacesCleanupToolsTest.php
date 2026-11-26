<?php

use App\Mcp\Tools\Places\AuditPlacesTool;
use App\Mcp\Tools\Places\MergePlacesTool;
use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\PlaceReport;
use App\Models\PlaceSave;
use App\Models\User;
use App\Services\IndexNow\IndexNow;
use App\Services\Places\PlaceGovernorates;
use App\Services\Places\PlaceModerationService;
use App\Services\Sitemap\ImageSitemapBuilder;
use App\Services\Sitemap\SitemapBuilder;
use App\Support\Agents\TokenIssuer;
use Illuminate\Support\Facades\Cache;

const CLEANUP_RICH_DESC = 'هذا وصف تفصيلي غني بالمعلومات عن المعلم السياحي التاريخي في سوريا ويحتوي على أكثر من خمس عشرة كلمة كاملة ومفيدة للزوار والباحثين.';
const CLEANUP_SHORT_DESC = 'مكان جميل وسط المدينة.';

const CLEANUP_DAMASCUS_LAT = 33.5119;
const CLEANUP_DAMASCUS_LNG = 36.3065;
const CLEANUP_ALEPPO_LAT = 36.1992;
const CLEANUP_ALEPPO_LNG = 37.1626;
const CLEANUP_HAMA_LAT = 35.1318;
const CLEANUP_HAMA_LNG = 36.7578;
const CLEANUP_OFFSHORE_LAT = 34.5;
const CLEANUP_OFFSHORE_LNG = 33.0;

function enableCleanupIndexNow(): IndexNow
{
    app()['env'] = 'production';
    config([
        'seo.base_url' => 'https://syrian.zone',
        'seo.indexnow.enabled' => true,
        'seo.indexnow.key' => 'cleanup-indexnow-key',
        'seo.indexnow.endpoint' => 'https://api.indexnow.org/indexnow',
    ]);
    Cache::forget(IndexNow::CACHE_KEY);

    return app(IndexNow::class);
}

beforeEach(function () {
    Cache::flush();
});

/*
|--------------------------------------------------------------------------
| audit-places
|--------------------------------------------------------------------------
*/

test('audit-places reports every finding kind including all three duplicate verdicts and ignores non-approved places', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    // 1. duplicate_names -> "duplicate" (<= 1 km, folded spelling difference: أ vs ا, ة vs ه)
    $dupA = Place::factory()->approved()->create([
        'name' => 'قلعة بصرى الشام',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
        'saves_count' => 3,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $dupA->id]);

    $dupB = Place::factory()->approved()->create([
        'name' => 'قلعه بصرى الشام',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT + 0.0005, // ~55 m
        'lng' => CLEANUP_DAMASCUS_LNG,
        'saves_count' => 1,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $dupB->id]);

    // 2. duplicate_names -> "same_name_different_place" (>= 25 km in different governorates)
    $diffA = Place::factory()->approved()->create([
        'name' => 'قصر العظم',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $diffA->id]);

    $diffB = Place::factory()->approved()->create([
        'name' => 'قصر العظم',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_HAMA_LAT,
        'lng' => CLEANUP_HAMA_LNG,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $diffB->id]);

    // 3. duplicate_names -> "check_coordinates" (>= 25 km inside the SAME governorate: Aleppo)
    $checkA = Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_ALEPPO_LAT,
        'lng' => CLEANUP_ALEPPO_LNG,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $checkA->id]);

    $checkB = Place::factory()->approved()->create([
        'name' => 'قلعة حلب',
        'description' => CLEANUP_RICH_DESC,
        'lat' => 36.4700, // ~30 km north, still inside Aleppo governorate
        'lng' => 37.1626,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $checkB->id]);

    // 4. nearby_similar (different folded names within 0.2 km where one contains the other)
    $simA = Place::factory()->approved()->create([
        'name' => 'الجامع الأموي',
        'description' => CLEANUP_RICH_DESC,
        'lat' => 33.5110,
        'lng' => 36.3060,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $simA->id]);

    $simB = Place::factory()->approved()->create([
        'name' => 'الجامع الأموي الكبير',
        'description' => CLEANUP_RICH_DESC,
        'lat' => 33.5116, // ~67 m
        'lng' => 36.3060,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $simB->id]);

    // 5. latin_only_names (also thin: <15 words and 1 photo)
    $latin = Place::factory()->approved()->create([
        'name' => 'Pizzeria Al-Kabbas',
        'description' => CLEANUP_SHORT_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    PlacePhoto::factory()->create(['place_id' => $latin->id]);

    // 6. no_governorate (offshore)
    $offshore = Place::factory()->approved()->create([
        'name' => 'جزيرة أرواد البعيدة',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_OFFSHORE_LAT,
        'lng' => CLEANUP_OFFSHORE_LNG,
    ]);
    PlacePhoto::factory()->count(2)->create(['place_id' => $offshore->id]);

    // Non-approved place must be ignored completely by the audit
    Place::factory()->create([
        'name' => 'Pending Latin Place',
        'status' => 'pending',
        'description' => CLEANUP_SHORT_DESC,
        'lat' => CLEANUP_OFFSHORE_LAT,
        'lng' => CLEANUP_OFFSHORE_LNG,
    ]);

    $payload = toolPayload(callTool(AuditPlacesTool::class));

    expect($payload['approved_places_checked'])->toBe(10);

    // duplicate_names
    $dupGroups = collect($payload['findings']['duplicate_names'])->keyBy('folded_name');
    expect($dupGroups->has('قلعه بصري الشام'))->toBeTrue()
        ->and($dupGroups['قلعه بصري الشام']['likely'])->toBe('duplicate')
        ->and($dupGroups['قلعه بصري الشام']['members'][0]['id'])->toBe($dupA->id)
        ->and($dupGroups['قلعه بصري الشام']['members'][0]['governorate'])->toBe('damascus')
        ->and($dupGroups['قلعه بصري الشام']['members'][0]['photos_count'])->toBe(2)
        ->and($dupGroups['قلعه بصري الشام']['members'][0]['saves_count'])->toBe(3)
        ->and($dupGroups['قلعه بصري الشام']['members'][0]['url'])->toBe($dupA->publicPath())
        ->and($dupGroups['قلعه بصري الشام']['members'][1]['id'])->toBe($dupB->id)
        ->and($dupGroups['قلعه بصري الشام']['members'][1]['likely'])->toBe('duplicate')
        ->and($dupGroups['قلعه بصري الشام']['members'][1]['km_from_first'])->toBeLessThan(1.0);

    expect($dupGroups['قصر العظم']['likely'])->toBe('same_name_different_place')
        ->and($dupGroups['قصر العظم']['members'][0]['likely'])->toBe('same_name_different_place')
        ->and($dupGroups['قصر العظم']['members'][1]['likely'])->toBe('same_name_different_place')
        ->and($dupGroups['قصر العظم']['members'][0]['governorate'])->toBe('damascus')
        ->and($dupGroups['قصر العظم']['members'][1]['governorate'])->toBe('hama');

    expect($dupGroups['قلعه حلب']['likely'])->toBe('check_coordinates')
        ->and($dupGroups['قلعه حلب']['members'][0]['governorate'])->toBe('aleppo')
        ->and($dupGroups['قلعه حلب']['members'][1]['governorate'])->toBe('aleppo')
        ->and($dupGroups['قلعه حلب']['members'][1]['likely'])->toBe('check_coordinates')
        ->and($dupGroups['قلعه حلب']['members'][1]['km_from_first'])->toBeGreaterThanOrEqual(25.0);

    // nearby_similar
    $nearby = $payload['findings']['nearby_similar'];
    expect($nearby)->toHaveCount(1)
        ->and(collect($nearby[0]['places'])->pluck('id')->all())->toBe([$simA->id, $simB->id])
        ->and($nearby[0]['distance_km'])->toBeLessThanOrEqual(0.2);

    // latin_only_names
    expect(collect($payload['findings']['latin_only_names'])->pluck('id')->all())->toBe([$latin->id]);

    // thin
    expect(collect($payload['findings']['thin'])->pluck('id')->all())->toBe([$latin->id])
        ->and($payload['findings']['thin'][0]['word_count'])->toBeLessThan(15)
        ->and($payload['findings']['thin'][0]['photos_count'])->toBe(1)
        ->and($payload['findings']['thin'][0]['url'])->toBe($latin->publicPath());

    // no_governorate
    expect(collect($payload['findings']['no_governorate'])->pluck('id')->all())->toBe([$offshore->id])
        ->and($payload['findings']['no_governorate'][0]['governorate'])->toBeNull();
});

test('audit-places respects kinds filter and limit while reporting full counts', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    for ($i = 1; $i <= 3; $i++) {
        Place::factory()->approved()->create([
            'name' => "Cafe {$i}",
            'description' => CLEANUP_RICH_DESC,
            'lat' => CLEANUP_DAMASCUS_LAT,
            'lng' => CLEANUP_DAMASCUS_LNG,
        ]);
    }

    $payload = toolPayload(callTool(AuditPlacesTool::class, [
        'kinds' => ['latin_only_names'],
        'limit' => 2,
    ]));

    expect(array_keys($payload['findings']))->toBe(['latin_only_names'])
        ->and($payload['counts']['latin_only_names'])->toBe(3)
        ->and($payload['findings']['latin_only_names'])->toHaveCount(2);
});

/*
|--------------------------------------------------------------------------
| merge-places
|--------------------------------------------------------------------------
*/

test('merge-places defaults to dry_run=true and changes nothing', function () {
    $user = agentUser(['permissions' => ['places.edit', 'places.delete']]);
    agentToken($user, ['places.edit', 'places.delete']);

    $target = Place::factory()->approved()->create([
        'name' => 'قلعة بصرى الشام',
        'description' => CLEANUP_SHORT_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    $source = Place::factory()->approved()->create([
        'name' => 'قلعة بصرى الشام',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);

    PlacePhoto::factory()->count(2)->create(['place_id' => $target->id]);
    PlacePhoto::factory()->count(3)->create(['place_id' => $source->id]);

    $saver = User::factory()->create();
    PlaceSave::create(['place_id' => $source->id, 'user_id' => $saver->id]);
    $source->update(['saves_count' => 1]);

    $indexNow = enableCleanupIndexNow();

    $payload = toolPayload(callTool(MergePlacesTool::class, [
        'source_id' => $source->id,
        'target_id' => $target->id,
        'keep_description' => 'longer',
    ]));

    expect($payload['dry_run'])->toBeTrue()
        ->and($payload['applied'])->toBeFalse()
        ->and($payload['photos']['moved_count'])->toBe(3)
        ->and($payload['saves']['moved_count'])->toBe(1)
        ->and($payload['description']['changed'])->toBeTrue()
        ->and($payload['description']['kept'])->toBe('source');

    // Database and IndexNow are untouched
    expect($source->fresh()->status)->toBe('approved')
        ->and($source->fresh()->merged_into_id)->toBeNull()
        ->and($target->fresh()->description)->toBe(CLEANUP_SHORT_DESC)
        ->and($target->photos()->count())->toBe(2)
        ->and($source->photos()->count())->toBe(3)
        ->and($target->saves()->count())->toBe(0)
        ->and($indexNow->pending())->toBe([]);
});

test('merge-places moves photos in sort order up to the cap, deduplicates saves, handles open reports, updates description, busts caches, and queues IndexNow', function () {
    $user = agentUser(['permissions' => ['places.edit', 'places.delete']]);
    agentToken($user, ['places.edit', 'places.delete']);

    $target = Place::factory()->approved()->create([
        'name' => 'قلعة بصرى الشام',
        'category' => 'historical',
        'description' => CLEANUP_SHORT_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    $source = Place::factory()->approved()->create([
        'name' => 'قلعة بصرى الشام مكرر',
        'category' => 'cultural',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_HAMA_LAT,
        'lng' => CLEANUP_HAMA_LNG,
    ]);

    // Target has 8 photos (sort 0..7); source has 4 photos (sort 2, 5, 8, 9).
    // Limit is 10 -> first 2 source photos (sort 2, 5) move at sort 8, 9; last 2 stay on source.
    for ($i = 0; $i < 8; $i++) {
        PlacePhoto::factory()->create(['place_id' => $target->id, 'sort' => $i]);
    }
    $sPhoto1 = PlacePhoto::factory()->create(['place_id' => $source->id, 'sort' => 2]);
    $sPhoto2 = PlacePhoto::factory()->create(['place_id' => $source->id, 'sort' => 5]);
    $sPhoto3 = PlacePhoto::factory()->create(['place_id' => $source->id, 'sort' => 8]);
    $sPhoto4 = PlacePhoto::factory()->create(['place_id' => $source->id, 'sort' => 9]);

    // Saves: u1 saved both (deduplicated), u2 saved target only, u3 saved source only (moved)
    [$u1, $u2, $u3] = User::factory()->count(3)->create();
    PlaceSave::create(['place_id' => $target->id, 'user_id' => $u1->id]);
    PlaceSave::create(['place_id' => $target->id, 'user_id' => $u2->id]);
    PlaceSave::create(['place_id' => $source->id, 'user_id' => $u1->id]);
    PlaceSave::create(['place_id' => $source->id, 'user_id' => $u3->id]);
    $target->update(['saves_count' => 2]);
    $source->update(['saves_count' => 2]);

    // Reports: u1 already reported target (open conflict -> resolved on source); u3 reported source (moved to target)
    PlaceReport::create(['place_id' => $target->id, 'user_id' => $u1->id, 'reason' => 'wrong_info', 'status' => 'open']);
    $conflictReport = PlaceReport::create(['place_id' => $source->id, 'user_id' => $u1->id, 'reason' => 'duplicate', 'status' => 'open']);
    $movableReport = PlaceReport::create(['place_id' => $source->id, 'user_id' => $u3->id, 'reason' => 'wrong_info', 'status' => 'open']);

    // Warm map and governorate caches
    cache()->put(PlaceModerationService::MAP_CACHE_KEY, ['stale'], 60);
    app(PlaceGovernorates::class)->map();
    expect(Cache::has(PlaceGovernorates::CACHE_KEY))->toBeTrue();

    $indexNow = enableCleanupIndexNow();

    $payload = toolPayload(callTool(MergePlacesTool::class, [
        'source_id' => $source->id,
        'target_id' => $target->id,
        'keep_description' => 'longer',
        'dry_run' => false,
    ]));

    expect($payload['dry_run'])->toBeFalse()
        ->and($payload['applied'])->toBeTrue()
        ->and($payload['photos']['moved_ids'])->toBe([$sPhoto1->id, $sPhoto2->id])
        ->and($payload['photos']['left_on_source_ids'])->toBe([$sPhoto3->id, $sPhoto4->id])
        ->and($payload['photos']['target_after'])->toBe(10)
        ->and($payload['saves']['moved_count'])->toBe(1)
        ->and($payload['saves']['deduplicated_count'])->toBe(1)
        ->and($payload['saves']['target_after'])->toBe(3)
        ->and($payload['reports']['moved_ids'])->toBe([$movableReport->id])
        ->and($payload['reports']['resolved_conflict_ids'])->toBe([$conflictReport->id])
        ->and($payload['description']['changed'])->toBeTrue();

    // Verify DB state
    $target->refresh();
    $source->refresh();

    expect($target->description)->toBe(CLEANUP_RICH_DESC)
        ->and($target->saves_count)->toBe(3)
        ->and($target->photos()->count())->toBe(10)
        ->and($sPhoto1->fresh()->place_id)->toBe($target->id)
        ->and($sPhoto1->fresh()->sort)->toBe(8)
        ->and($sPhoto2->fresh()->place_id)->toBe($target->id)
        ->and($sPhoto2->fresh()->sort)->toBe(9)
        ->and($sPhoto3->fresh()->place_id)->toBe($source->id)
        ->and($sPhoto4->fresh()->place_id)->toBe($source->id)
        ->and($source->status)->toBe('rejected')
        ->and($source->merged_into_id)->toBe($target->id)
        ->and($source->saves_count)->toBe(0)
        ->and($movableReport->fresh()->place_id)->toBe($target->id)
        ->and($conflictReport->fresh()->place_id)->toBe($source->id)
        ->and($conflictReport->fresh()->status)->toBe('resolved');

    // Caches busted
    expect(Cache::has(PlaceModerationService::MAP_CACHE_KEY))->toBeFalse()
        ->and(Cache::has(PlaceGovernorates::CACHE_KEY))->toBeFalse();

    // IndexNow queued source, target, /mishwar, and both places' hubs
    $pending = $indexNow->pending();
    expect($pending)->toContain(
        'https://syrian.zone'.$source->publicPath(),
        'https://syrian.zone'.$target->publicPath(),
        'https://syrian.zone/mishwar',
        'https://syrian.zone/mishwar/damascus',
        'https://syrian.zone/mishwar/damascus/historical',
        'https://syrian.zone/mishwar/hama',
        'https://syrian.zone/mishwar/hama/cultural',
    );
});

test('merged source 301s from slug page, bare id, and ?place= share, follows chains A->B->C, and disappears from map, sitemaps, and hubs', function () {
    $user = agentUser(['permissions' => ['places.edit', 'places.delete']]);
    agentToken($user, ['places.edit', 'places.delete']);

    $placeA = Place::factory()->approved()->create([
        'name' => 'القيمرية الأولى',
        'category' => 'historical',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    $placeB = Place::factory()->approved()->create([
        'name' => 'القيمرية الثانية',
        'category' => 'historical',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    $placeC = Place::factory()->approved()->create([
        'name' => 'القيمرية',
        'category' => 'historical',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    PlacePhoto::factory()->create(['place_id' => $placeA->id, 'display_path' => 'places/a/1.webp']);
    PlacePhoto::factory()->create(['place_id' => $placeB->id, 'display_path' => 'places/b/1.webp']);
    PlacePhoto::factory()->create(['place_id' => $placeC->id, 'display_path' => 'places/c/1.webp']);

    $pathA = $placeA->publicPath();
    $pathB = $placeB->publicPath();
    $pathC = $placeC->publicPath();

    // Merge A -> B, then B -> C
    callTool(MergePlacesTool::class, ['source_id' => $placeA->id, 'target_id' => $placeB->id, 'dry_run' => false]);
    callTool(MergePlacesTool::class, ['source_id' => $placeB->id, 'target_id' => $placeC->id, 'dry_run' => false]);

    // 301s for B -> C (slug page, bare id, ?place=)
    $this->get($pathB)->assertStatus(301)->assertRedirect($pathC);
    $this->get('/mishwar/'.$placeB->id)->assertStatus(301)->assertRedirect($pathC);
    $this->get('/mishwar?place='.$placeB->id)->assertStatus(301)->assertRedirect($pathC);
    $this->get('/mishwar?place='.$placeB->id.'&utm_source=wa')->assertStatus(301)->assertRedirect($pathC.'?utm_source=wa');

    // Chain A -> B -> C resolves in one 301 straight to C
    $this->get($pathA)->assertStatus(301)->assertRedirect($pathC);
    $this->get('/mishwar/'.$placeA->id)->assertStatus(301)->assertRedirect($pathC);
    $this->get('/mishwar?place='.$placeA->id)->assertStatus(301)->assertRedirect($pathC);

    // Canonical target C still renders 200
    $this->get($pathC)->assertOk();

    // Disappears from map JSON
    $mapIds = collect($this->getJson('/api/v1/places/map')->assertOk()->json('features'))
        ->pluck('properties.id')
        ->all();
    expect($mapIds)->toContain($placeC->id)
        ->and($mapIds)->not->toContain($placeA->id, $placeB->id);

    // Disappears from sitemap & image sitemap
    $sitemapPaths = collect(app(SitemapBuilder::class)->build())->pluck('path');
    expect($sitemapPaths->contains($pathC))->toBeTrue()
        ->and($sitemapPaths->contains($pathA))->toBeFalse()
        ->and($sitemapPaths->contains($pathB))->toBeFalse();

    $imagePaths = collect(app(ImageSitemapBuilder::class)->build())->pluck('path');
    expect($imagePaths->contains($pathC))->toBeTrue()
        ->and($imagePaths->contains($pathA))->toBeFalse()
        ->and($imagePaths->contains($pathB))->toBeFalse();

    // Disappears from governorate hub
    $this->get('/mishwar/damascus')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('total', 1)
            ->has('places', 1)
            ->where('places.0.id', $placeC->id));

    // Owner cannot resubmit a merged place back into pending
    $this->actingAs($placeA->user)
        ->postJson("/api/v1/my/places/{$placeA->id}/resubmit")
        ->assertStatus(400);
});

test('merge-places rejects same id, non-approved target, non-approved source, missing ids, and already-merged source', function () {
    $user = agentUser(['permissions' => ['places.edit', 'places.delete']]);
    agentToken($user, ['places.edit', 'places.delete']);

    $approvedA = Place::factory()->approved()->create();
    $approvedB = Place::factory()->approved()->create();
    $pending = Place::factory()->create(['status' => 'pending']);
    $rejected = Place::factory()->rejected()->create();

    // source == target
    $same = callTool(MergePlacesTool::class, ['source_id' => $approvedA->id, 'target_id' => $approvedA->id]);
    expect($same->isError())->toBeTrue()
        ->and(toolText($same))->toContain('source_id and target_id must be different');

    // non-approved target (pending & rejected)
    $pendingTarget = callTool(MergePlacesTool::class, ['source_id' => $approvedA->id, 'target_id' => $pending->id]);
    expect($pendingTarget->isError())->toBeTrue()
        ->and(toolText($pendingTarget))->toContain('target')
        ->and(toolText($pendingTarget))->toContain('approved');

    $rejectedTarget = callTool(MergePlacesTool::class, ['source_id' => $approvedA->id, 'target_id' => $rejected->id]);
    expect($rejectedTarget->isError())->toBeTrue()
        ->and(toolText($rejectedTarget))->toContain('target')
        ->and(toolText($rejectedTarget))->toContain('approved');

    // non-approved source
    $pendingSource = callTool(MergePlacesTool::class, ['source_id' => $pending->id, 'target_id' => $approvedA->id]);
    expect($pendingSource->isError())->toBeTrue()
        ->and(toolText($pendingSource))->toContain('source')
        ->and(toolText($pendingSource))->toContain('approved');

    // missing id
    $missing = callTool(MergePlacesTool::class, ['source_id' => 999999, 'target_id' => $approvedA->id]);
    expect($missing->isError())->toBeTrue()
        ->and(toolText($missing))->toContain('No place exists with id 999999');

    // already-merged source
    callTool(MergePlacesTool::class, ['source_id' => $approvedA->id, 'target_id' => $approvedB->id, 'dry_run' => false]);
    $again = callTool(MergePlacesTool::class, ['source_id' => $approvedA->id, 'target_id' => $approvedB->id]);
    expect($again->isError())->toBeTrue()
        ->and(toolText($again))->toContain("already been merged into place {$approvedB->id}");
});

/*
|--------------------------------------------------------------------------
| Permissions & JSON-RPC discovery
|--------------------------------------------------------------------------
*/

test('audit-places requires places.review and merge-places requires both places.edit and places.delete', function () {
    $a = Place::factory()->approved()->create();
    $b = Place::factory()->approved()->create();

    // No places permission at all -> denied and hidden
    $noPerm = agentUser(['permissions' => ['transit.approve']]);
    agentToken($noPerm, ['transit.approve']);
    expect((new AuditPlacesTool)->shouldRegister())->toBeFalse()
        ->and((new MergePlacesTool)->shouldRegister())->toBeFalse()
        ->and(callTool(AuditPlacesTool::class)->isError())->toBeTrue()
        ->and(callTool(MergePlacesTool::class, ['source_id' => $a->id, 'target_id' => $b->id])->isError())->toBeTrue();

    // Only places.review -> audit registered, merge hidden & denied
    $reviewOnly = agentUser(['permissions' => ['places.review']]);
    agentToken($reviewOnly, ['places.review']);
    expect((new AuditPlacesTool)->shouldRegister())->toBeTrue()
        ->and((new MergePlacesTool)->shouldRegister())->toBeFalse()
        ->and(callTool(MergePlacesTool::class, ['source_id' => $a->id, 'target_id' => $b->id])->isError())->toBeTrue();

    // Only places.edit (missing places.delete) -> merge hidden & denied
    $editOnly = agentUser(['permissions' => ['places.edit']]);
    agentToken($editOnly, ['places.edit']);
    expect((new MergePlacesTool)->shouldRegister())->toBeFalse();
    $editDenial = callTool(MergePlacesTool::class, ['source_id' => $a->id, 'target_id' => $b->id]);
    expect($editDenial->isError())->toBeTrue()
        ->and(toolText($editDenial))->toContain('Permission denied');

    // Only places.delete (missing places.edit) -> merge hidden & denied
    $deleteOnly = agentUser(['permissions' => ['places.delete']]);
    agentToken($deleteOnly, ['places.delete']);
    expect((new MergePlacesTool)->shouldRegister())->toBeFalse();
    $deleteDenial = callTool(MergePlacesTool::class, ['source_id' => $a->id, 'target_id' => $b->id]);
    expect($deleteDenial->isError())->toBeTrue()
        ->and(toolText($deleteDenial))->toContain('Permission denied');

    // Both places.edit and places.delete -> merge registered & permitted
    $both = agentUser(['permissions' => ['places.edit', 'places.delete']]);
    agentToken($both, ['places.edit', 'places.delete']);
    expect((new MergePlacesTool)->shouldRegister())->toBeTrue()
        ->and(toolPayload(callTool(MergePlacesTool::class, ['source_id' => $a->id, 'target_id' => $b->id]))['dry_run'])->toBeTrue();
});

test('audit-places and merge-places round-trip over the real JSON-RPC MCP surface', function () {
    $staff = User::factory()->create([
        'role' => 'user',
        'permissions' => ['places.review', 'places.edit', 'places.delete'],
    ]);

    $plain = app(TokenIssuer::class)->issue($staff, 'places-cleanup', [
        'places.review',
        'places.edit',
        'places.delete',
    ])['token']->plainTextToken;

    $source = Place::factory()->approved()->create([
        'name' => 'سوق مدحت باشا',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);
    $target = Place::factory()->approved()->create([
        'name' => 'سوق مدحت باشا',
        'description' => CLEANUP_RICH_DESC,
        'lat' => CLEANUP_DAMASCUS_LAT,
        'lng' => CLEANUP_DAMASCUS_LNG,
    ]);

    // audit-places is directly advertised in tools/list
    expect(mcpToolNames($plain))->toContain('audit-places');

    // Direct tools/call for audit-places
    $auditRes = mcpCall($plain, [
        'method' => 'tools/call',
        'params' => [
            'name' => 'audit-places',
            'arguments' => ['kinds' => ['duplicate_names']],
        ],
    ])->assertOk();
    expect($auditRes->json('result.structuredContent.counts.duplicate_names'))->toBe(1);

    // merge-places is discoverable through search_tools and runs via execute_tools
    expect(mcpSearchToolNames($plain, 'merge duplicate places'))->toContain('merge-places');

    $merged = mcpExecuteTool($plain, 'merge-places', [
        'source_id' => $source->id,
        'target_id' => $target->id,
        'dry_run' => true,
    ]);

    expect($merged['ok'] ?? false)->toBeTrue()
        ->and($merged['results'][0]['isError'] ?? true)->toBeFalse();
});
