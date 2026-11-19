<?php

use App\Models\DirectorySuggestion;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Models\User;

test('guests are rejected with 401 and banned users with 403 when submitting directory suggestions', function () {
    $this->postJson('/api/v1/suggestions/govtcvs', [
        'kind' => 'add',
        'title' => 'مسؤول جديد',
        'details' => 'تفاصيل مقترحة لإضافة مسؤول جديد إلى الدليل.',
    ])->assertUnauthorized();

    $banned = User::factory()->create(['is_banned' => true]);

    $this->actingAs($banned)
        ->postJson('/api/v1/suggestions/govtcvs', [
            'kind' => 'add',
            'title' => 'مسؤول جديد',
            'details' => 'تفاصيل مقترحة لإضافة مسؤول جديد إلى الدليل.',
        ])
        ->assertForbidden();
});

test('signed-in users can submit add and edit suggestions across govtcvs, syofficial, govapps, and phonebook', function () {
    $user = User::factory()->create();

    // Seed one target record per module
    $official = GovtOfficial::create([
        'slug' => 'ahmad-ramadan',
        'full_name_ar' => 'المهندس أحمد رواد رمضان',
        'display_name_ar' => 'رواد رمضان',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);

    $offCat = OfficialCategory::create([
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'is_active' => true,
    ]);
    $entity = OfficialEntity::create([
        'id' => 'min-economy',
        'category_id' => $offCat->id,
        'name' => 'Ministry of Economy',
        'name_ar' => 'وزارة الاقتصاد',
        'is_active' => true,
    ]);

    $app = GovApp::create([
        'id' => 'sham-cash',
        'name' => 'Sham Cash',
        'name_ar' => 'شام كاش',
        'is_active' => true,
    ]);

    $phoneCat = PhonebookCategory::create([
        'id' => 'emergency',
        'label_ar' => 'الطوارئ',
        'label_en' => 'Emergency',
        'is_active' => true,
    ]);
    $phone = PhonebookEntry::create([
        'id' => 'phone_emergency_112',
        'category_id' => $phoneCat->id,
        'name_ar' => 'الإسعاف والطوارئ',
        'number' => '112',
        'is_whatsapp' => false,
        'is_active' => true,
    ]);

    // 1. govtcvs edit with target snapshot
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/govtcvs', [
            'kind' => 'edit',
            'target_id' => $official->id,
            'title' => 'تحديث المنصب الوزاري',
            'details' => 'تم تعيينه وزيراً للاقتصاد والتجارة الخارجية بالمرسوم 203 لعام 2026.',
            'source_url' => 'https://sana.sy/presidency/2638733/',
            'payload' => [
                'role_title_ar' => 'وزير الاقتصاد والتجارة الخارجية',
                'decree_ref' => 'المرسوم 203 لعام 2026',
                'ignored_key' => 'should be stripped',
            ],
        ])
        ->assertCreated()
        ->assertJsonStructure(['id', 'message']);

    $govtSuggestion = DirectorySuggestion::forModule('govtcvs')->first();
    expect($govtSuggestion)->not->toBeNull()
        ->and($govtSuggestion->target_id)->toBe($official->id)
        ->and($govtSuggestion->target_label)->toBe('رواد رمضان')
        ->and($govtSuggestion->payload)->toBe([
            'role_title_ar' => 'وزير الاقتصاد والتجارة الخارجية',
            'decree_ref' => 'المرسوم 203 لعام 2026',
        ]);

    // 2. syofficial add
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/syofficial', [
            'kind' => 'add',
            'title' => 'هيئة الاستثمار السورية',
            'details' => 'يرجى إضافة الحساب الرسمي الموثق لهيئة الاستثمار السورية على منصة إكس.',
            'payload' => [
                'category_id' => 'ministries',
                'account_url' => 'https://x.com/syriainvest',
            ],
        ])
        ->assertCreated();

    // 3. govapps edit
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/govapps', [
            'kind' => 'edit',
            'target_id' => $app->id,
            'details' => 'يرجى تحديث رابط تطبيق شام كاش على متجر App Store إلى الإصدار الجديد.',
            'payload' => [
                'apple_url' => 'https://apps.apple.com/app/sham-cash/id123456',
            ],
        ])
        ->assertCreated();

    $appSuggestion = DirectorySuggestion::forModule('govapps')->first();
    expect($appSuggestion->target_label)->toBe('شام كاش')
        ->and($appSuggestion->title)->toBe('شام كاش');

    // 4. phonebook add requires number, validates cleanly
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/phonebook', [
            'kind' => 'add',
            'title' => 'شكاوى الكهرباء دمشق',
            'details' => 'رقم الطوارئ والشكاوى على مدار الساعة في محافظة دمشق.',
            'payload' => [],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['payload.number']);

    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/phonebook', [
            'kind' => 'add',
            'title' => 'شكاوى الكهرباء دمشق',
            'details' => 'رقم الطوارئ والشكاوى على مدار الساعة في محافظة دمشق.',
            'payload' => [
                'category_id' => 'emergency',
                'number' => '+963112223344',
                'is_whatsapp' => true,
            ],
        ])
        ->assertCreated();

    // 5. Invalid target_id returns 422
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/syofficial', [
            'kind' => 'edit',
            'target_id' => 'non-existent-entity',
            'details' => 'محاولة ربط اقتراح تعديل بجهة غير موجودة في قاعدة البيانات.',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['target_id']);

    // 6. Unknown module returns 404
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/unknown-module', [
            'kind' => 'add',
            'title' => 'اختبار',
            'details' => 'تفاصيل لاختبار رفض قسم غير معروف.',
        ])
        ->assertNotFound();

    // Ensure entity and phone targets also resolve when edited
    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/syofficial', [
            'kind' => 'edit',
            'target_id' => $entity->id,
            'details' => 'تحديث رابط قناة تيليغرام الرسمية لوزارة الاقتصاد.',
        ])
        ->assertCreated();

    $this->actingAs($user)
        ->postJson('/api/v1/suggestions/phonebook', [
            'kind' => 'edit',
            'target_id' => $phone->id,
            'details' => 'الرقم يعمل أيضاً كخط طوارئ مجاني من جميع الشبكات.',
        ])
        ->assertCreated();
});

test('module admin review endpoints enforce capabilities, isolate modules, and prevent double review', function () {
    $submitter = User::factory()->create();

    $govtSuggestion = DirectorySuggestion::create([
        'module' => 'govtcvs',
        'kind' => 'add',
        'title' => 'مسؤول مقترح',
        'details' => 'سيرة مقترحة لمسؤول جديد مع رابط رسمي.',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);

    $syOfficialSuggestion = DirectorySuggestion::create([
        'module' => 'syofficial',
        'kind' => 'add',
        'title' => 'هيئة مقترحة',
        'details' => 'إضافة حساب رسمي جديد إلى دليل الحسابات.',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);

    $govAppsSuggestion = DirectorySuggestion::create([
        'module' => 'govapps',
        'kind' => 'add',
        'title' => 'تطبيق مقترح',
        'details' => 'إضافة تطبيق حكومي جديد لمتابعة المعاملات.',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);

    $phonebookSuggestion = DirectorySuggestion::create([
        'module' => 'phonebook',
        'kind' => 'add',
        'title' => 'رقم طوارئ مقترح',
        'details' => 'إضافة رقم خدمة طوارئ جديد في حلب.',
        'payload' => ['number' => '113', 'is_whatsapp' => false],
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);

    // View-only govtcvs staff can list suggestions but cannot accept/dismiss
    $viewOnly = User::factory()->create(['role' => 'user', 'permissions' => ['govtcvs.view']]);
    $this->actingAs($viewOnly)
        ->getJson('/api/v1/admin/govtcvs/suggestions?status=pending')
        ->assertOk()
        ->assertJsonCount(1, 'suggestions')
        ->assertJsonPath('counts.pending', 1);

    $this->actingAs($viewOnly)
        ->postJson("/api/v1/admin/govtcvs/suggestions/{$govtSuggestion->id}/accept")
        ->assertForbidden();

    // Cross-module isolation: syofficial editor cannot review govtcvs suggestion via syofficial endpoint
    $syOfficialEditor = User::factory()->create(['role' => 'user', 'permissions' => ['syofficial.edit']]);
    $this->actingAs($syOfficialEditor)
        ->postJson("/api/v1/admin/syofficial/suggestions/{$govtSuggestion->id}/accept")
        ->assertNotFound();

    // Module editor can accept their own module's suggestion once; second attempt returns 409
    $govtEditor = User::factory()->create(['role' => 'user', 'permissions' => ['govtcvs.edit']]);
    $this->actingAs($govtEditor)
        ->postJson("/api/v1/admin/govtcvs/suggestions/{$govtSuggestion->id}/accept", [
            'resolution_note' => 'تم التحديث في الملف.',
        ])
        ->assertOk()
        ->assertJsonPath('suggestion.status', 'accepted')
        ->assertJsonPath('suggestion.resolution_note', 'تم التحديث في الملف.');

    $this->actingAs($govtEditor)
        ->postJson("/api/v1/admin/govtcvs/suggestions/{$govtSuggestion->id}/dismiss")
        ->assertStatus(409);

    // Verify syofficial, govapps, and phonebook admin review endpoints work with their respective edit capabilities
    $this->actingAs($syOfficialEditor)
        ->postJson("/api/v1/admin/syofficial/suggestions/{$syOfficialSuggestion->id}/dismiss", [
            'resolution_note' => 'مكرر',
        ])
        ->assertOk()
        ->assertJsonPath('suggestion.status', 'dismissed');

    $govAppsEditor = User::factory()->create(['role' => 'user', 'permissions' => ['govapps.edit']]);
    $this->actingAs($govAppsEditor)
        ->getJson('/api/v1/admin/govapps/suggestions')
        ->assertOk()
        ->assertJsonCount(1, 'suggestions');
    $this->actingAs($govAppsEditor)
        ->postJson("/api/v1/admin/govapps/suggestions/{$govAppsSuggestion->id}/accept")
        ->assertOk()
        ->assertJsonPath('suggestion.status', 'accepted');

    $phonebookEditor = User::factory()->create(['role' => 'user', 'permissions' => ['phonebook.edit']]);
    $this->actingAs($phonebookEditor)
        ->getJson('/api/v1/admin/phonebook/suggestions')
        ->assertOk()
        ->assertJsonCount(1, 'suggestions');
    $this->actingAs($phonebookEditor)
        ->postJson("/api/v1/admin/phonebook/suggestions/{$phonebookSuggestion->id}/accept")
        ->assertOk()
        ->assertJsonPath('suggestion.status', 'accepted');
});
