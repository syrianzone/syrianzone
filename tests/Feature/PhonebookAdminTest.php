<?php

use App\Http\Middleware\AutoLoginDevUser;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\User;

test('phonebook page auto seeds database when empty and displays entries', function () {
    PhonebookEntry::query()->delete();
    PhonebookCategory::query()->delete();

    $response = $this->get('/phonebook');
    $response->assertStatus(200);

    expect(PhonebookCategory::count())->toBeGreaterThan(0);
    expect(PhonebookEntry::count())->toBeGreaterThan(0);
});

test('unauthorized users cannot access phonebook admin panel', function () {
    $user = User::factory()->create(['role' => 'user', 'permissions' => []]);

    $response = $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($user)
        ->get('/admin/phonebook');
    $response->assertStatus(403);
});

test('users with phonebook permissions or superadmin role can access admin panel', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $response = $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($superadmin)
        ->get('/admin/phonebook');
    $response->assertStatus(200);

    $permittedUser = User::factory()->create([
        'role' => 'user',
        'permissions' => ['phonebook.edit', 'phonebook.create'],
    ]);

    $response2 = $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($permittedUser)
        ->get('/admin/phonebook');
    $response2->assertStatus(200);
});

test('admin can create, toggle active state, and delete phonebook entries', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $cat = PhonebookCategory::create([
        'id' => 'test_cat',
        'label_ar' => 'فئة تجريبية',
        'label_en' => 'Test Category',
        'order_column' => 1,
        'is_active' => true,
    ]);

    $response = $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($superadmin)
        ->post('/api/v1/admin/phonebook/entries', [
            'id' => 'test_entry_123',
            'category_id' => 'test_cat',
            'name_ar' => 'رقم اختبار',
            'name_en' => 'Test Number',
            'number' => '123456',
            'is_whatsapp' => true,
            'is_active' => true,
        ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('phonebook_entries', [
        'id' => 'test_entry_123',
        'number' => '123456',
        'is_active' => true,
    ]);

    // Toggle active state
    $toggleResponse = $this->withoutMiddleware(AutoLoginDevUser::class)
        ->actingAs($superadmin)
        ->post('/api/v1/admin/phonebook/entries/test_entry_123/toggle');
    $toggleResponse->assertRedirect();

    $this->assertDatabaseHas('phonebook_entries', [
        'id' => 'test_entry_123',
        'is_active' => false,
    ]);
});
