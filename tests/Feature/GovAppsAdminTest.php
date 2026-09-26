<?php

use App\Models\GovApp;
use App\Models\User;

/*
|--------------------------------------------------------------------------
| Government apps admin HTTP surface
|--------------------------------------------------------------------------
|
| The controller was reduced to a transport adapter over GovAppService. What is
| asserted here is that the HTTP contract survived: same validation, same Arabic
| toasts, and a missing id still answering 404.
|
*/

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'admin']);
    $this->base = '/api/v1/admin/govapps';
});

it('renders the dashboard for an authorised admin', function () {
    GovApp::factory()->count(2)->create();

    $this->actingAs($this->admin)->get('/admin/govapps')->assertOk();
});

it('refuses the dashboard without a govapps permission', function () {
    $this->actingAs(User::factory()->create(['role' => 'user']))
        ->get('/admin/govapps')
        ->assertForbidden();
});

it('creates an app and flashes the admin toast', function () {
    $this->actingAs($this->admin)
        ->post($this->base, [
            'id' => 'services',
            'name' => 'Services',
            'name_ar' => 'الخدمات',
            'links' => ['https://example.com'],
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'تم إضافة التطبيق الحكومي بنجاح');

    $app = GovApp::where('id', 'services')->first();

    expect($app->links)->toBe(['https://example.com'])
        ->and($app->icon)->toBeNull()
        ->and($app->order_column)->toBe(1);
});

it('still rejects a duplicate id through the unique validation rule', function () {
    GovApp::factory()->create(['id' => 'services']);

    $this->actingAs($this->admin)
        ->post($this->base, ['id' => 'services', 'name' => 'x', 'name_ar' => 'x'])
        ->assertSessionHasErrors('id');
});

it('answers 404 when updating an app that does not exist', function () {
    $this->actingAs($this->admin)
        ->put($this->base.'/ghost', ['name' => 'x', 'name_ar' => 'x'])
        ->assertNotFound();
});

it('answers 404 when deleting an app that does not exist', function () {
    $this->actingAs($this->admin)
        ->delete($this->base.'/ghost')
        ->assertNotFound();
});

it('accepts an update on both POST and PUT', function () {
    $app = GovApp::factory()->create(['name' => 'Old Name']);
    $payload = ['name' => 'New Name', 'name_ar' => 'اسم جديد'];

    $this->actingAs($this->admin)->post($this->base.'/'.$app->id, $payload)->assertRedirect();
    $this->actingAs($this->admin)->put($this->base.'/'.$app->id, $payload)->assertRedirect();

    expect($app->fresh()->name)->toBe('New Name');
});

it('soft deletes an app through the dashboard', function () {
    $app = GovApp::factory()->create();

    $this->actingAs($this->admin)
        ->delete($this->base.'/'.$app->id)
        ->assertRedirect()
        ->assertSessionHas('success', 'تم حذف التطبيق بنجاح');

    expect(GovApp::find($app->id))->toBeNull()
        ->and(GovApp::withTrashed()->where('id', $app->id)->exists())->toBeTrue();
});

it('reorders apps and returns the Arabic JSON message', function () {
    $first = GovApp::factory()->create(['order_column' => 1]);
    $second = GovApp::factory()->create(['order_column' => 2]);

    $this->actingAs($this->admin)
        ->post($this->base.'/reorder', [
            'orders' => [
                ['id' => $second->id, 'order_column' => 1],
                ['id' => $first->id, 'order_column' => 2],
            ],
        ])
        ->assertOk()
        ->assertJson(['message' => 'تم إعادة الترتيب بنجاح']);

    expect($first->fresh()->order_column)->toBe(2);
});

it('rejects a reorder naming an app that does not exist', function () {
    $this->actingAs($this->admin)
        ->post($this->base.'/reorder', ['orders' => [['id' => 'ghost', 'order_column' => 1]]])
        ->assertSessionHasErrors('orders.0.id');
});
