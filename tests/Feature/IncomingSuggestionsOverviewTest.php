<?php

use App\Models\DirectorySuggestion;
use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\RouteDraft;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

it('enforces capability-scoped moderator access on the incoming suggestions overview', function () {
    $this->get('/admin/suggestions')->assertRedirect();
    $this->getJson('/api/v1/admin/suggestions/overview')->assertUnauthorized();

    $plainUser = User::factory()->create(['role' => 'user']);
    $this->actingAs($plainUser)->get('/admin/suggestions')->assertForbidden();
    $this->actingAs($plainUser)->getJson('/api/v1/admin/suggestions/overview')->assertForbidden();

    // A user with only non-moderation capabilities cannot access the overview.
    $nonModUser = User::factory()->create([
        'role' => 'user',
        'permissions' => ['assets.manage'],
    ]);
    $this->actingAs($nonModUser)->get('/admin/suggestions')->assertForbidden();
    $this->actingAs($nonModUser)->getJson('/api/v1/admin/suggestions/overview')->assertForbidden();

    // A moderator with phonebook.edit gets 200 and only sees the phonebook section.
    $phonebookMod = User::factory()->create([
        'role' => 'user',
        'permissions' => ['phonebook.edit'],
    ]);
    $this->actingAs($phonebookMod)
        ->get('/admin/suggestions')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Admin/Suggestions/Index')
            ->has('initialOverview.sections', 1)
            ->where('initialOverview.sections.0.id', 'phonebook')
        );

    $response = $this->actingAs($phonebookMod)
        ->getJson('/api/v1/admin/suggestions/overview')
        ->assertOk();

    expect(collect($response->json('sections'))->pluck('id')->all())
        ->toBe(['phonebook']);
});

it('aggregates incoming pending suggestions, submissions, reports, and drafts from all sections for superadmins', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);
    $contributor = User::factory()->create(['role' => 'user', 'name' => 'أحمد المساهم']);

    // 1. Directory suggestions across all 4 directory modules (plus one resolved that must be excluded)
    foreach (DirectorySuggestion::MODULES as $i => $module) {
        DirectorySuggestion::create([
            'module' => $module,
            'kind' => $i % 2 === 0 ? 'add' : 'edit',
            'title' => "اقتراح قسم {$module}",
            'details' => "تفاصيل اقتراح {$module}",
            'user_id' => $contributor->id,
            'status' => 'pending',
        ]);
    }
    DirectorySuggestion::create([
        'module' => 'govtcvs',
        'kind' => 'add',
        'title' => 'اقتراح تمت معالجته',
        'details' => 'يجب ألا يظهر في القائمة المعلقة',
        'user_id' => $contributor->id,
        'status' => 'accepted',
    ]);

    // 2. Promises: pending promise, pending speaker, pending report (plus a published promise excluded)
    $approvedSpeaker = PromiseSpeaker::create([
        'name' => 'وزير معتمد',
        'title' => 'وزير',
        'status' => 'approved',
    ]);
    $pendingSpeaker = PromiseSpeaker::create([
        'name' => 'شخص مقترح جديد',
        'title' => 'محافظ',
        'status' => 'pending',
        'submitted_by' => $contributor->id,
    ]);
    Promise::factory()->create([
        'title' => 'وعد بانتظار النشر',
        'speaker_id' => $approvedSpeaker->id,
        'review_status' => 'pending',
        'origin' => 'public',
        'submitted_by' => $contributor->id,
        'submitter_note' => 'ملاحظة المرسل',
    ]);
    $publishedPromise = Promise::factory()->published()->create([
        'title' => 'وعد منشور سابقاً',
        'speaker_id' => $approvedSpeaker->id,
        'origin' => 'editor',
    ]);
    PromiseReport::create([
        'promise_id' => $publishedPromise->id,
        'user_id' => $contributor->id,
        'kind' => 'error',
        'body' => 'يوجد خطأ في التاريخ المذكور',
        'status' => 'pending',
    ]);

    // 3. Mishwar / Places: pending place + open report on approved place (plus closed report excluded)
    Place::create([
        'user_id' => $contributor->id,
        'name' => 'مقهى قيد المراجعة',
        'category' => 'cafe',
        'description' => 'مقهى هادئ في دمشق',
        'lat' => 33.5138,
        'lng' => 36.2765,
        'status' => 'pending',
    ]);
    $approvedPlace = Place::create([
        'user_id' => $contributor->id,
        'name' => 'مطعم منشور',
        'category' => 'restaurant',
        'description' => 'مطعم معروف',
        'lat' => 33.514,
        'lng' => 36.277,
        'status' => 'approved',
    ]);
    PlaceReport::create([
        'place_id' => $approvedPlace->id,
        'user_id' => $contributor->id,
        'reason' => 'wrong_info',
        'details' => 'الموقع على الخريطة غير دقيق',
        'status' => 'open',
    ]);
    PlaceReport::create([
        'place_id' => $approvedPlace->id,
        'user_id' => $superadmin->id,
        'reason' => 'spam',
        'details' => 'بلاغ مغلق',
        'status' => 'dismissed',
    ]);

    // 4. Transit: pending route draft (plus approved draft excluded)
    seedCity('damascus', ['name_ar' => 'دمشق', 'name_en' => 'Damascus']);
    RouteDraft::create([
        'user_id' => $contributor->id,
        'city_id' => 'damascus',
        'name_ar' => 'خط سرفيس جديد',
        'notes' => 'يمر بساحة الأمويين',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'pending',
    ]);
    RouteDraft::create([
        'user_id' => $contributor->id,
        'city_id' => 'damascus',
        'name_ar' => 'خط معتمد سابقاً',
        'geojson' => ['type' => 'FeatureCollection', 'features' => []],
        'status' => 'approved',
    ]);

    // Expected total pending = 4 directories + 3 promises (promise + speaker + report) + 2 places (place + report) + 1 transit = 10
    $this->actingAs($superadmin)
        ->get('/admin/suggestions')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Admin/Suggestions/Index')
            ->where('initialOverview.total_pending', 10)
            ->has('initialOverview.sections', 7)
            ->has('initialOverview.items', 10)
        );

    $response = $this->actingAs($superadmin)
        ->getJson('/api/v1/admin/suggestions/overview')
        ->assertOk();

    $sections = collect($response->json('sections'))->keyBy('id');
    expect($response->json('total_pending'))->toBe(10)
        ->and($sections['govtcvs']['pending_count'])->toBe(1)
        ->and($sections['syofficial']['pending_count'])->toBe(1)
        ->and($sections['govapps']['pending_count'])->toBe(1)
        ->and($sections['phonebook']['pending_count'])->toBe(1)
        ->and($sections['promises']['pending_count'])->toBe(3)
        ->and($sections['places']['pending_count'])->toBe(2)
        ->and($sections['transit']['pending_count'])->toBe(1);

    // Dashboard passes the live incomingSuggestionsCount to superadmins, and 0 to non-superadmins
    $this->actingAs($superadmin)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dashboard/Index')
            ->where('incomingSuggestionsCount', 10)
        );

    $this->actingAs($contributor)
        ->get('/dashboard')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Dashboard/Index')
            ->where('incomingSuggestionsCount', 0)
        );
});
