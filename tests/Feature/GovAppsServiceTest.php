<?php

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\GovApp;
use App\Services\GovApps\GovAppService;
use Illuminate\Support\Facades\Cache;

/*
|--------------------------------------------------------------------------
| Government apps service
|--------------------------------------------------------------------------
|
| The behaviour that matters here and differs from SyOfficial: GovApp soft
| deletes, so a removed app keeps its row and its id. Two tests below pin that
| down, because an agent tool that lets a caller recreate a deleted id would
| hit an opaque unique-key violation instead of a clean refusal.
|
*/

beforeEach(function () {
    $this->service = app(GovAppService::class);
});

it('appends a new app to the end of the ordering', function () {
    GovApp::factory()->create(['order_column' => 9]);

    $created = $this->service->create([
        'id' => 'services',
        'name' => 'Services',
        'name_ar' => 'الخدمات',
    ]);

    expect($created->order_column)->toBe(10)
        ->and($created->is_active)->toBeTrue()
        ->and($created->icon)->toBeNull();
});

it('seeds an empty gallery and drops non-http links', function () {
    $created = $this->service->create(
        ['id' => 'apps', 'name' => 'Apps', 'name_ar' => 'تطبيقات'],
        ['https://example.com', 'javascript:alert(1)', 'data:text/html,x'],
    );

    expect($created->images)->toBe([])
        ->and($created->links)->toBe(['https://example.com'])
        ->and(array_is_list($created->links))->toBeTrue();
});

it('refuses a duplicate id', function () {
    GovApp::factory()->create(['id' => 'services']);

    $this->service->create(['id' => 'services', 'name' => 'x', 'name_ar' => 'x']);
})->throws(DirectoryActionException::class, 'already in use');

it('still owns the id after a soft delete, so it cannot be recreated', function () {
    $app = $this->service->create(['id' => 'services', 'name' => 'S', 'name_ar' => 'س']);

    $this->service->delete($app->id);

    // The row is gone from the normal scope...
    expect(GovApp::find($app->id))->toBeNull()
        // ...but the id is taken, and refusing cleanly beats a driver-level
        // unique-key error surfacing as a 500.
        ->and(GovApp::withTrashed()->where('id', $app->id)->exists())->toBeTrue();

    $this->service->create(['id' => 'services', 'name' => 'x', 'name_ar' => 'x']);
})->throws(DirectoryActionException::class, 'already in use');

it('restores a soft-deleted app and forgets the cache', function () {
    $app = $this->service->create(['id' => 'services', 'name' => 'S', 'name_ar' => 'س']);
    $this->service->delete($app->id);

    Cache::put(GovAppService::APPS_CACHE_KEY, 'stale', 600);

    $restored = $this->service->restore($app->id);

    expect($restored->trashed())->toBeFalse()
        ->and(GovApp::find($app->id))->not->toBeNull()
        ->and(Cache::has(GovAppService::APPS_CACHE_KEY))->toBeFalse();
});

it('toggles activity without touching the other fields', function () {
    $app = GovApp::factory()->inactive()->create(['name' => 'Original', 'links' => ['https://keep.me']]);

    $toggled = $this->service->setActive($app->id, true);

    expect($toggled->is_active)->toBeTrue()
        ->and($toggled->name)->toBe('Original')
        ->and($toggled->links)->toBe(['https://keep.me']);
});

it('leaves links untouched on update when none are supplied', function () {
    $app = GovApp::factory()->create(['links' => ['https://keep.me']]);

    $this->service->update($app->id, ['name' => 'Renamed']);

    expect($app->fresh()->links)->toBe(['https://keep.me'])
        ->and($app->fresh()->name)->toBe('Renamed');
});

it('never touches the images gallery on update', function () {
    $app = GovApp::factory()->create(['images' => ['https://cdn/one.jpg']]);

    $this->service->update($app->id, ['name' => 'Renamed']);

    expect($app->fresh()->images)->toBe(['https://cdn/one.jpg']);
});

it('flushes the public cache on every write', function () {
    Cache::put(GovAppService::APPS_CACHE_KEY, 'stale', 600);

    $app = GovApp::factory()->create();
    $this->service->setActive($app->id, false);

    expect(Cache::has(GovAppService::APPS_CACHE_KEY))->toBeFalse();
});

it('applies a reorder', function () {
    $first = GovApp::factory()->create(['order_column' => 1]);
    $second = GovApp::factory()->create(['order_column' => 2]);

    $written = $this->service->reorder([
        ['id' => $second->id, 'order_column' => 1],
        ['id' => $first->id, 'order_column' => 2],
    ]);

    expect($written)->toBe(2)
        ->and($first->fresh()->order_column)->toBe(2)
        ->and($second->fresh()->order_column)->toBe(1);
});

it('excludes soft-deleted apps from the default listing', function () {
    GovApp::factory()->count(2)->create();
    $gone = GovApp::factory()->create();
    $this->service->delete($gone->id);

    expect($this->service->apps())->toHaveCount(2);
});
