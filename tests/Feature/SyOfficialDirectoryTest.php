<?php

use App\Exceptions\Directories\DirectoryActionException;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use Illuminate\Support\Facades\Cache;

/*
|--------------------------------------------------------------------------
| SyOfficial directory service
|--------------------------------------------------------------------------
|
| These lock in the rules the agent tools now depend on. The important ones are
| the destructive ones: category delete cascades to its entities, ids are
| caller-supplied and unique, and entity ordering is scoped per category rather
| than per table.
|
*/

beforeEach(function () {
    $this->service = app(SyOfficialDirectoryService::class);
});

it('appends a new category to the end of the ordering', function () {
    OfficialCategory::factory()->create(['order_column' => 4]);

    $created = $this->service->createCategory([
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
    ]);

    expect($created->order_column)->toBe(5)
        ->and($created->is_active)->toBeTrue();
});

it('refuses a duplicate category id instead of overwriting', function () {
    OfficialCategory::factory()->create(['id' => 'governorates']);

    $this->service->createCategory(['id' => 'governorates', 'label_ar' => 'x', 'label_en' => 'x']);
})->throws(DirectoryActionException::class, 'already in use');

it('orders entities within their own category, not the whole table', function () {
    $a = OfficialCategory::factory()->create();
    $b = OfficialCategory::factory()->create();

    OfficialEntity::factory()->inCategory($a)->create(['order_column' => 7]);
    OfficialEntity::factory()->inCategory($b)->create(['order_column' => 3]);

    $created = $this->service->createEntity([
        'id' => 'new-entity',
        'category_id' => $a->id,
        'name' => 'New',
        'name_ar' => 'جديد',
    ]);

    // Category a was at 7, so the sibling in category b must not influence this.
    expect($created->order_column)->toBe(8);
});

it('defaults a new entity to the placeholder image when none is uploaded', function () {
    $category = OfficialCategory::factory()->create();

    $entity = $this->service->createEntity([
        'id' => 'no-image',
        'category_id' => $category->id,
        'name' => 'No Image',
        'name_ar' => 'بلا صورة',
    ]);

    expect($entity->image)->toBe(SyOfficialDirectoryService::PLACEHOLDER_IMAGE);
});

it('rejects an entity pointing at a category that does not exist', function () {
    $this->service->createEntity([
        'id' => 'orphan',
        'category_id' => 'no-such-category',
        'name' => 'Orphan',
        'name_ar' => 'يتيم',
    ]);
})->throws(DirectoryActionException::class, 'No category exists with id no-such-category');

it('drops non-http social links and reindexes so the column stays a list', function () {
    $category = OfficialCategory::factory()->create();

    $entity = $this->service->createEntity(
        [
            'id' => 'social-test',
            'category_id' => $category->id,
            'name' => 'Social',
            'name_ar' => 'سوشيال',
        ],
        ['https://example.com', 'javascript:alert(1)', '', 'http://example.org', null],
    );

    $entity->refresh();

    // The old code array_filter'd without array_values, which would have stored
    // {"2":"http://example.org"} and broken .map() in the Inertia components.
    expect($entity->socials)->toBe(['https://example.com', 'http://example.org'])
        ->and(array_is_list($entity->socials))->toBeTrue();
});

it('leaves socials untouched on update when none are supplied', function () {
    $entity = OfficialEntity::factory()->create(['socials' => ['https://keep.me']]);

    $this->service->updateEntity($entity->id, ['name' => 'Renamed']);

    expect($entity->fresh()->socials)->toBe(['https://keep.me'])
        ->and($entity->fresh()->name)->toBe('Renamed');
});

it('toggles activity without touching the other fields', function () {
    $entity = OfficialEntity::factory()->inactive()->create(['name' => 'Original']);

    $toggled = $this->service->setEntityActive($entity->id, true);

    expect($toggled->is_active)->toBeTrue()
        ->and($toggled->name)->toBe('Original');
});

it('deleting a category cascades to its entities and reports the count', function () {
    $category = OfficialCategory::factory()->create();
    OfficialEntity::factory()->count(3)->inCategory($category)->create();
    $other = OfficialCategory::factory()->create();
    OfficialEntity::factory()->inCategory($other)->create();

    $removed = $this->service->deleteCategory($category->id);

    expect($removed)->toBe(3)
        ->and(OfficialEntity::where('category_id', $category->id)->count())->toBe(0)
        // The unrelated category and its entity must survive.
        ->and(OfficialCategory::where('id', $other->id)->exists())->toBeTrue()
        ->and(OfficialEntity::where('category_id', $other->id)->count())->toBe(1);
});

it('refuses to delete a category that does not exist', function () {
    $this->service->deleteCategory('ghost');
})->throws(DirectoryActionException::class, 'No Category exists with id ghost');

it('flushes both public read caches on every write', function () {
    Cache::put(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY, 'stale', 600);
    Cache::put(SyOfficialDirectoryService::ENTITIES_CACHE_KEY, 'stale', 600);

    $category = OfficialCategory::factory()->create();
    $this->service->setCategoryActive($category->id, false);

    expect(Cache::has(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY))->toBeFalse()
        ->and(Cache::has(SyOfficialDirectoryService::ENTITIES_CACHE_KEY))->toBeFalse();
});

it('applies a reorder and forgets the cache', function () {
    Cache::put(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY, 'stale', 600);

    $first = OfficialCategory::factory()->create(['order_column' => 1]);
    $second = OfficialCategory::factory()->create(['order_column' => 2]);

    $written = $this->service->reorderCategories([
        ['id' => $second->id, 'order_column' => 1],
        ['id' => $first->id, 'order_column' => 2],
    ]);

    expect($written)->toBe(2)
        ->and($first->fresh()->order_column)->toBe(2)
        ->and($second->fresh()->order_column)->toBe(1)
        ->and(Cache::has(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY))->toBeFalse();
});

it('reports a not-found kind so the transport layer can answer 404', function () {
    try {
        $this->service->findEntity('missing');
    } catch (DirectoryActionException $e) {
        expect($e->kind)->toBe(DirectoryActionException::NOT_FOUND)
            ->and($e->httpStatus())->toBe(404);

        return;
    }

    $this->fail('Expected a DirectoryActionException for a missing entity.');
});
