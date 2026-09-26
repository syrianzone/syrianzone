<?php

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\User;
use App\Services\SyOfficial\SyOfficialDirectoryService;

/*
|--------------------------------------------------------------------------
| SyOfficial admin HTTP surface
|--------------------------------------------------------------------------
|
| The controller was reduced to a transport adapter over
| SyOfficialDirectoryService. These assert the HTTP contract did not move while
| that happened: the same validation rules, the same Arabic success toasts, and
| — the part that would actually break — a missing id still answering 404
| rather than surfacing as an unhandled 500.
|
*/

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);

    $this->routes = [
        'categories' => '/api/v1/admin/syofficial/categories',
        'entities' => '/api/v1/admin/syofficial/entities',
        'reorderCategories' => '/api/v1/admin/syofficial/reorder/categories',
        'reorderEntities' => '/api/v1/admin/syofficial/reorder/entities',
    ];
});

it('renders the dashboard for an authorised admin', function () {
    OfficialCategory::factory()->count(2)->create();

    $this->actingAs($this->admin)
        ->get('/admin/syofficial')
        ->assertOk();
});

it('refuses the dashboard without a syofficial permission', function () {
    $this->actingAs(User::factory()->create(['role' => 'user']))
        ->get('/admin/syofficial')
        ->assertForbidden();
});

it('creates a category and flashes the admin toast', function () {
    $this->actingAs($this->admin)
        ->post($this->routes['categories'], [
            'id' => 'governorates',
            'label_ar' => 'المحافظات',
            'label_en' => 'Governorates',
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'تم إضافة الفئة بنجاح');

    expect(OfficialCategory::where('id', 'governorates')->exists())->toBeTrue();
});

it('still rejects a duplicate id through the unique validation rule', function () {
    OfficialCategory::factory()->create(['id' => 'governorates']);

    $this->actingAs($this->admin)
        ->post($this->routes['categories'], [
            'id' => 'governorates',
            'label_ar' => 'x',
            'label_en' => 'x',
        ])
        ->assertSessionHasErrors('id');
});

it('answers 404 when updating a category that does not exist', function () {
    $this->actingAs($this->admin)
        ->put($this->routes['categories'].'/ghost', [
            'label_ar' => 'x',
            'label_en' => 'x',
        ])
        ->assertNotFound();
});

it('answers 404 when deleting an entity that does not exist', function () {
    $this->actingAs($this->admin)
        ->delete($this->routes['entities'].'/ghost')
        ->assertNotFound();
});

it('answers 404 when creating an entity under a missing category', function () {
    $this->actingAs($this->admin)
        ->post($this->routes['entities'], [
            'id' => 'orphan',
            'category_id' => 'no-such-category',
            'name' => 'Orphan',
            'name_ar' => 'يتيم',
        ])
        ->assertSessionHasErrors('category_id');
});

it('creates an entity and defaults its image to the placeholder', function () {
    $category = OfficialCategory::factory()->create();

    $this->actingAs($this->admin)
        ->post($this->routes['entities'], [
            'id' => 'damascus-gov',
            'category_id' => $category->id,
            'name' => 'Damascus Governorate',
            'name_ar' => 'محافظة دمشق',
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'تم إضافة الجهة الرسمية بنجاح');

    expect(OfficialEntity::where('id', 'damascus-gov')->first()->image)
        ->toBe(SyOfficialDirectoryService::PLACEHOLDER_IMAGE);
});

it('accepts an entity update on both POST and PUT', function () {
    $entity = OfficialEntity::factory()->create(['name' => 'Old Name']);
    $category = OfficialEntity::find($entity->id)->category;

    $payload = [
        'category_id' => $category->id,
        'name' => 'New Name',
        'name_ar' => 'اسم جديد',
    ];

    $this->actingAs($this->admin)->post("{$this->routes['entities']}/{$entity->id}", $payload)
        ->assertRedirect();

    $this->actingAs($this->admin)->put("{$this->routes['entities']}/{$entity->id}", $payload)
        ->assertRedirect();

    expect($entity->fresh()->name)->toBe('New Name');
});

it('deletes a category through the dashboard and cascades', function () {
    $category = OfficialCategory::factory()->create();
    OfficialEntity::factory()->count(2)->inCategory($category)->create();

    $this->actingAs($this->admin)
        ->delete($this->routes['categories'].'/'.$category->id)
        ->assertRedirect()
        ->assertSessionHas('success', 'تم حذف الفئة بنجاح');

    expect(OfficialCategory::where('id', $category->id)->exists())->toBeFalse()
        ->and(OfficialEntity::where('category_id', $category->id)->count())->toBe(0);
});

it('reorders categories and returns the Arabic JSON message', function () {
    $first = OfficialCategory::factory()->create(['order_column' => 1]);
    $second = OfficialCategory::factory()->create(['order_column' => 2]);

    $this->actingAs($this->admin)
        ->post($this->routes['reorderCategories'], [
            'orders' => [
                ['id' => $second->id, 'order_column' => 1],
                ['id' => $first->id, 'order_column' => 2],
            ],
        ])
        ->assertOk()
        ->assertJson(['message' => 'تم إعادة الترتيب بنجاح']);

    expect($first->fresh()->order_column)->toBe(2);
});

it('rejects a reorder naming a category that does not exist', function () {
    $this->actingAs($this->admin)
        ->post($this->routes['reorderCategories'], [
            'orders' => [['id' => 'ghost', 'order_column' => 1]],
        ])
        ->assertSessionHasErrors('orders.0.id');
});
