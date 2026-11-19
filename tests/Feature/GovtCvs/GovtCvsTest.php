<?php

use App\Models\Candidate;
use App\Models\GovtCvEntry;
use App\Models\GovtEvidenceLink;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtOfficialAlias;
use App\Models\GovtTenure;
use App\Models\HouseMember2026;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Models\User;
use App\Services\GovtCvs\GovtCvImportService;
use App\Support\Seo\Preview\Resolvers\GovtOfficialPreview;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;

test('public pages return 200 with expected Inertia components and props while hiding draft and archived officials', function () {
    $category = OfficialCategory::create([
        'id' => 'ministries',
        'label_ar' => 'الوزارات',
        'label_en' => 'Ministries',
        'is_active' => true,
    ]);
    $ministry = OfficialEntity::create([
        'id' => 'min-energy',
        'category_id' => $category->id,
        'name' => 'Ministry of Energy',
        'name_ar' => 'وزارة الطاقة',
        'is_active' => true,
    ]);

    $poll = Poll::factory()->create(['slug' => Poll::coreSlug(), 'is_active' => true]);
    $candidate = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'محمد البشير',
        'title' => 'وزير الطاقة',
        'status' => 'active',
    ]);
    $speaker = PromiseSpeaker::factory()->create([
        'name' => 'محمد البشير',
        'candidate_id' => $candidate->id,
        'status' => 'approved',
    ]);
    $promise = Promise::factory()->published()->create([
        'speaker_id' => $speaker->id,
        'title' => 'تحسين التغذية الكهربائية',
    ]);

    $published = GovtOfficial::create([
        'slug' => 'mohammed-al-bashir',
        'full_name_ar' => 'م. محمد البشير',
        'display_name_ar' => 'محمد البشير',
        'full_name_en' => 'Mohammed Al-Bashir',
        'honorific_ar' => 'م.',
        'bio_summary_ar' => 'مهندس ومسؤول حكومي تولى حقيبة الطاقة.',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'candidate_id' => $candidate->id,
        'promise_speaker_id' => $speaker->id,
        'publish_status' => 'published',
        'verification_level' => 'decree_verified',
        'published_at' => now(),
    ]);

    GovtTenure::create([
        'official_id' => $published->id,
        'institution_id' => $ministry->id,
        'institution_name_ar' => 'وزارة الطاقة',
        'role_title_ar' => 'وزير الطاقة',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2025-03-29',
        'start_date_precision' => 'exact',
    ]);

    $draft = GovtOfficial::create([
        'slug' => 'draft-official',
        'full_name_ar' => 'مسؤول مسودة',
        'display_name_ar' => 'مسؤول مسودة',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'positions_only',
        'publish_status' => 'draft',
    ]);
    GovtTenure::create([
        'official_id' => $draft->id,
        'role_title_ar' => 'وزير مسودة',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2025-04-01',
    ]);

    $archived = GovtOfficial::create([
        'slug' => 'archived-official',
        'full_name_ar' => 'مسؤول مؤرشف',
        'display_name_ar' => 'مسؤول مؤرشف',
        'office_status' => 'out_of_office',
        'highest_tier' => 'governor',
        'cv_completeness' => 'positions_only',
        'publish_status' => 'archived',
    ]);
    GovtTenure::create([
        'official_id' => $archived->id,
        'role_title_ar' => 'محافظ مؤرشف',
        'tier' => 'governor',
        'government_phase' => 'caretaker_2024',
        'status' => 'ended',
        'started_at' => '2024-12-10',
        'ended_at' => '2025-03-01',
        'end_reason' => 'replaced',
    ]);

    $this->get('/govtcvs')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovtCvs/Index')
            ->has('officials', 1)
            ->where('officials.0.slug', 'mohammed-al-bashir')
            ->where('stats.total', 1)
            ->where('stats.in_office', 1)
            ->where('stats.full_cv', 1)
            ->where('stats.total_movements', 1)
            ->has('institutions', 1)
            ->missing('options')
        );

    $this->get('/govtcvs/movements')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovtCvs/Movements')
            ->has('movements', 1)
            ->where('movements.0.official_slug', 'mohammed-al-bashir')
            ->has('stats')
            ->has('institutions', 1)
            ->missing('options')
        );

    $this->get('/govtcvs/mohammed-al-bashir')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovtCvs/Show')
            ->where('official.slug', 'mohammed-al-bashir')
            ->has('related_promises', 1)
            ->where('related_promises.0.number', $promise->number)
            ->where('tierlist_link.candidate_id', $candidate->id)
            ->missing('options')
        );

    $this->get('/govtcvs/draft-official')->assertNotFound();
    $this->get('/govtcvs/archived-official')->assertNotFound();
    $this->getJson('/api/v1/govtcvs/draft-official')->assertNotFound();
    $this->getJson('/api/v1/govtcvs/archived-official')->assertNotFound();
});

test('public JSON API endpoints return options, movements, details, and filter by status, tier, phase, cv_completeness, and folded Arabic query with aliases', function () {
    $officialA = GovtOfficial::create([
        'slug' => 'asaad-al-shaibani',
        'full_name_ar' => 'أسعد حسن الشيباني',
        'display_name_ar' => 'أسعد الشيباني',
        'full_name_en' => 'Asaad Al-Shaibani',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);
    GovtOfficialAlias::create([
        'official_id' => $officialA->id,
        'alias_ar' => 'زيد العطار',
        'alias_type' => 'kunya',
    ]);
    GovtTenure::create([
        'official_id' => $officialA->id,
        'institution_name_ar' => 'وزارة الخارجية والمغتربين',
        'role_title_ar' => 'وزير الخارجية والمغتربين',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2024-12-21',
    ]);

    $officialB = GovtOfficial::create([
        'slug' => 'maher-marwan',
        'full_name_ar' => 'ماهر مروان إدلبي',
        'display_name_ar' => 'ماهر مروان',
        'office_status' => 'out_of_office',
        'highest_tier' => 'governor',
        'cv_completeness' => 'partial_bio',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);
    GovtTenure::create([
        'official_id' => $officialB->id,
        'institution_name_ar' => 'محافظة دمشق',
        'role_title_ar' => 'محافظ دمشق',
        'tier' => 'governor',
        'government_phase' => 'caretaker_2024',
        'status' => 'ended',
        'started_at' => '2024-12-15',
        'ended_at' => '2025-05-01',
        'end_reason' => 'replaced',
    ]);

    GovtOfficial::create([
        'slug' => 'hidden-draft',
        'full_name_ar' => 'مسودة مخفية',
        'display_name_ar' => 'مسودة مخفية',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'positions_only',
        'publish_status' => 'draft',
    ]);

    // Options endpoint
    $this->getJson('/api/v1/govtcvs/options')
        ->assertOk()
        ->assertJsonStructure([
            'cutoff_date',
            'office_statuses',
            'tiers',
            'government_phases',
            'tenure_statuses',
            'end_reasons',
            'cv_sections',
            'cv_completeness',
            'evidence_types',
            'publish_statuses',
            'verification_levels',
            'alias_types',
            'date_precisions',
            'slot_statuses',
            'institutions',
            'office_slots',
        ]);

    // Unfiltered index returns only published officials
    $this->getJson('/api/v1/govtcvs')
        ->assertOk()
        ->assertJsonCount(2, 'officials')
        ->assertJsonPath('stats.total', 2);

    // Filter by status
    $this->getJson('/api/v1/govtcvs?status=in_office')
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'asaad-al-shaibani');

    // Filter by tier
    $this->getJson('/api/v1/govtcvs?tier=governor')
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'maher-marwan');

    // Filter by phase
    $this->getJson('/api/v1/govtcvs?phase=caretaker_2024')
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'maher-marwan');

    // Filter by cv_completeness
    $this->getJson('/api/v1/govtcvs?cv_completeness=full_cv')
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'asaad-al-shaibani');

    // Search q with Arabic hamza folding ('اسعد' matches 'أسعد')
    $this->getJson('/api/v1/govtcvs?'.http_build_query(['q' => 'اسعد']))
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'asaad-al-shaibani');

    // Search q with ta-marbuta folding ('الخارجيه' matches 'الخارجية')
    $this->getJson('/api/v1/govtcvs?'.http_build_query(['q' => 'الخارجيه']))
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'asaad-al-shaibani');

    // Search q matching alias ('زيد العطار')
    $this->getJson('/api/v1/govtcvs?'.http_build_query(['q' => 'زيد العطار']))
        ->assertOk()
        ->assertJsonCount(1, 'officials')
        ->assertJsonPath('officials.0.slug', 'asaad-al-shaibani');

    // Public detail JSON API
    $this->getJson('/api/v1/govtcvs/asaad-al-shaibani')
        ->assertOk()
        ->assertJsonPath('official.slug', 'asaad-al-shaibani')
        ->assertJsonPath('official.aliases.0.alias_ar', 'زيد العطار')
        ->assertJsonStructure(['official', 'related_promises', 'tierlist_link']);

    // Public movements JSON API (officialA has 1 appointment, officialB has 1 appointment + 1 ended = 3 events)
    $this->getJson('/api/v1/govtcvs/movements')
        ->assertOk()
        ->assertJsonCount(3, 'movements');

    $this->getJson('/api/v1/govtcvs/movements?event_kind=ended')
        ->assertOk()
        ->assertJsonCount(1, 'movements')
        ->assertJsonPath('movements.0.official_slug', 'maher-marwan');
});

test('guests and accounts without govtcvs capabilities are denied access to admin routes', function () {
    $official = GovtOfficial::create([
        'slug' => 'test-official',
        'full_name_ar' => 'مسؤول اختبار',
        'display_name_ar' => 'مسؤول اختبار',
    ]);
    $outsider = moduleStaff('places');
    $plainUser = User::factory()->create(['role' => 'user', 'permissions' => []]);

    // Guest
    $this->get('/admin/govtcvs')->assertRedirect('/auth/google');
    $this->getJson('/api/v1/admin/govtcvs/officials')->assertUnauthorized();

    // Plain user & other module staff
    foreach ([$plainUser, $outsider] as $unauthorized) {
        $this->actingAs($unauthorized)->get('/admin/govtcvs')->assertForbidden();
        $this->actingAs($unauthorized)->get('/admin/govtcvs/new')->assertForbidden();
        $this->actingAs($unauthorized)->get('/admin/govtcvs/slots')->assertForbidden();
        $this->actingAs($unauthorized)->get("/admin/govtcvs/officials/{$official->id}")->assertForbidden();
        $this->actingAs($unauthorized)->getJson('/api/v1/admin/govtcvs/officials')->assertForbidden();
        $this->actingAs($unauthorized)->postJson('/api/v1/admin/govtcvs/officials', [])->assertForbidden();
        $this->actingAs($unauthorized)->patchJson("/api/v1/admin/govtcvs/officials/{$official->id}/publish")->assertForbidden();
        $this->actingAs($unauthorized)->deleteJson("/api/v1/admin/govtcvs/officials/{$official->id}")->assertForbidden();
    }
});

test('granular capability enforcement restricts govtcvs.view from mutating officials or slots', function () {
    $viewOnly = capabilityUser('govtcvs.view');
    $official = GovtOfficial::create([
        'slug' => 'view-only-target',
        'full_name_ar' => 'مسؤول للعرض فقط',
        'display_name_ar' => 'مسؤول للعرض فقط',
    ]);
    $slot = GovtOfficeSlot::create([
        'slug' => 'minister-of-test',
        'title_ar' => 'وزير الاختبار',
        'tier' => 'minister',
    ]);

    // Allowed reads
    $this->actingAs($viewOnly)->get('/admin/govtcvs')->assertOk();
    $this->actingAs($viewOnly)->get('/admin/govtcvs/slots')->assertOk();
    $this->actingAs($viewOnly)->get("/admin/govtcvs/officials/{$official->id}")->assertOk();
    $this->actingAs($viewOnly)->getJson('/api/v1/admin/govtcvs/officials')->assertOk();
    $this->actingAs($viewOnly)->getJson("/api/v1/admin/govtcvs/officials/{$official->id}")->assertOk();
    $this->actingAs($viewOnly)->getJson('/api/v1/admin/govtcvs/options')->assertOk();
    $this->actingAs($viewOnly)->getJson('/api/v1/admin/govtcvs/slots')->assertOk();

    // Forbidden create (`govtcvs.create`)
    $this->actingAs($viewOnly)->get('/admin/govtcvs/new')->assertForbidden();
    $this->actingAs($viewOnly)->postJson('/api/v1/admin/govtcvs/officials', [
        'full_name_ar' => 'مسؤول جديد',
    ])->assertForbidden();

    // Forbidden edit (`govtcvs.edit`)
    $this->actingAs($viewOnly)->putJson("/api/v1/admin/govtcvs/officials/{$official->id}", [
        'full_name_ar' => 'اسم معدل',
    ])->assertForbidden();
    $this->actingAs($viewOnly)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/tenures", [
        'role_title_ar' => 'وزير',
        'tier' => 'minister',
    ])->assertForbidden();
    $this->actingAs($viewOnly)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/cv-entries", [
        'section' => 'education',
        'title_ar' => 'إجازة جامعية',
    ])->assertForbidden();
    $this->actingAs($viewOnly)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/evidence", [
        'evidence_type' => 'cv_card',
        'source_title_ar' => 'بطاقة رسمية',
    ])->assertForbidden();

    // Forbidden publish/archive (`govtcvs.publish`)
    $this->actingAs($viewOnly)->patchJson("/api/v1/admin/govtcvs/officials/{$official->id}/publish")->assertForbidden();
    $this->actingAs($viewOnly)->patchJson("/api/v1/admin/govtcvs/officials/{$official->id}/archive")->assertForbidden();

    // Forbidden slots mutations (`govtcvs.slots`)
    $this->actingAs($viewOnly)->postJson('/api/v1/admin/govtcvs/slots', [
        'title_ar' => 'منصب جديد',
        'tier' => 'minister',
    ])->assertForbidden();
    $this->actingAs($viewOnly)->putJson("/api/v1/admin/govtcvs/slots/{$slot->id}", [
        'title_ar' => 'منصب معدل',
    ])->assertForbidden();
    $this->actingAs($viewOnly)->deleteJson("/api/v1/admin/govtcvs/slots/{$slot->id}")->assertForbidden();

    // Forbidden delete (`govtcvs.delete`)
    $this->actingAs($viewOnly)->deleteJson("/api/v1/admin/govtcvs/officials/{$official->id}")->assertForbidden();
});

test('admin can create, update with optimistic version lock, publish, archive, and delete an official', function () {
    $staff = moduleStaff('govtcvs');

    // Create official
    $createRes = $this->actingAs($staff)->postJson('/api/v1/admin/govtcvs/officials', [
        'full_name_ar' => 'الدكتور مروان الحلبي',
        'full_name_en' => 'Marwan Al-Halabi',
        'highest_tier' => 'minister',
        'birth_year' => 1972,
        'birth_place_ar' => 'دمشق',
        'aliases' => [
            ['alias_ar' => 'مروان الحلبي', 'alias_type' => 'patronymic_short'],
        ],
    ])->assertCreated();

    $officialId = $createRes->json('official.id');
    expect($createRes->json('official.publish_status'))->toBe('draft')
        ->and($createRes->json('official.version'))->toBe(1)
        ->and($createRes->json('official.display_name_ar'))->toBe('مروان الحلبي')
        ->and($createRes->json('official.honorific_ar'))->toBe('الدكتور');

    // Update with current version (1 -> 2)
    $this->actingAs($staff)->putJson("/api/v1/admin/govtcvs/officials/{$officialId}", [
        'version' => 1,
        'bio_summary_ar' => 'أكاديمي وطبيب سوري تولى وزارة التعليم العالي والبحث العلمي في الحكومة الانتقالية.',
    ])->assertOk()
        ->assertJsonPath('official.version', 2);

    // Stale version returns 409 Conflict
    $this->actingAs($staff)->putJson("/api/v1/admin/govtcvs/officials/{$officialId}", [
        'version' => 1,
        'bio_summary_ar' => 'تعديل بنسخة قديمة يجب رفضه',
    ])->assertStatus(409);

    // Publish official
    $this->actingAs($staff)->patchJson("/api/v1/admin/govtcvs/officials/{$officialId}/publish")
        ->assertOk()
        ->assertJsonPath('official.publish_status', 'published');

    $slug = GovtOfficial::findOrFail($officialId)->slug;
    $this->getJson("/api/v1/govtcvs/{$slug}")->assertOk();

    // Archive official
    $this->actingAs($staff)->patchJson("/api/v1/admin/govtcvs/officials/{$officialId}/archive")
        ->assertOk()
        ->assertJsonPath('official.publish_status', 'archived');

    $this->getJson("/api/v1/govtcvs/{$slug}")->assertNotFound();

    // Delete official
    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/officials/{$officialId}")
        ->assertOk()
        ->assertJson(['success' => true]);

    expect(GovtOfficial::find($officialId))->toBeNull();
});

test('assigning a new current incumbent to a single-seat slot auto-closes the previous incumbent and resolves predecessor/successor lineage', function () {
    $staff = moduleStaff('govtcvs');

    $slot = GovtOfficeSlot::create([
        'slug' => 'governor-of-aleppo',
        'title_ar' => 'محافظ حلب',
        'institution_name_ar' => 'محافظة حلب',
        'tier' => 'governor',
        'is_single_seat' => true,
        'status' => 'active',
    ]);

    $officialA = GovtOfficial::create([
        'slug' => 'official-a',
        'full_name_ar' => 'المسؤول الأول',
        'display_name_ar' => 'المسؤول الأول',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);

    $officialB = GovtOfficial::create([
        'slug' => 'official-b',
        'full_name_ar' => 'المسؤول الثاني',
        'display_name_ar' => 'المسؤول الثاني',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);

    // 1. Assign Official A as current holder of the single-seat slot
    $resA = $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$officialA->id}/tenures", [
        'office_slot_id' => $slot->id,
        'role_title_ar' => 'محافظ حلب',
        'tier' => 'governor',
        'government_phase' => 'caretaker_2024',
        'status' => 'current',
        'started_at' => '2024-12-20',
    ])->assertCreated();

    $tenureAId = $resA->json('tenure.id');
    expect($officialA->fresh()->office_status)->toBe('in_office');

    // 2. Assign Official B as current holder of the same slot with auto_close_incumbent: true
    $resB = $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$officialB->id}/tenures", [
        'office_slot_id' => $slot->id,
        'role_title_ar' => 'محافظ حلب',
        'tier' => 'governor',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2025-04-10',
        'start_decree_ref' => 'مرسوم رقم 55',
        'auto_close_incumbent' => true,
    ])->assertCreated();

    $tenureBId = $resB->json('tenure.id');

    // Verify Official A's tenure was automatically closed
    $tenureA = GovtTenure::findOrFail($tenureAId);
    expect($tenureA->status)->toBe('ended')
        ->and($tenureA->end_reason)->toBe('replaced')
        ->and($tenureA->ended_at->format('Y-m-d'))->toBe('2025-04-10')
        ->and($tenureA->end_decree_ref)->toBe('مرسوم رقم 55')
        ->and($officialA->fresh()->office_status)->toBe('out_of_office')
        ->and($officialB->fresh()->office_status)->toBe('in_office');

    // Verify predecessor/successor lineage on GET /api/v1/govtcvs/{slug}
    $this->getJson('/api/v1/govtcvs/official-a')
        ->assertOk()
        ->assertJsonPath('official.tenures.0.successor.slug', 'official-b')
        ->assertJsonPath('official.tenures.0.predecessor', null);

    $this->getJson('/api/v1/govtcvs/official-b')
        ->assertOk()
        ->assertJsonPath('official.tenures.0.predecessor.slug', 'official-a')
        ->assertJsonPath('official.tenures.0.successor', null);

    // Verify predecessor/successor lineage on GET /api/v1/govtcvs/movements
    $movements = collect($this->getJson('/api/v1/govtcvs/movements')->assertOk()->json('movements'));
    $bAppointed = $movements->firstWhere('id', $tenureBId.':appointed');
    $aEnded = $movements->firstWhere('id', $tenureAId.':ended');

    expect($bAppointed['predecessor']['slug'])->toBe('official-a')
        ->and($aEnded['successor']['slug'])->toBe('official-b');

    // Also test updating and deleting a tenure
    $this->actingAs($staff)->putJson("/api/v1/admin/govtcvs/tenures/{$tenureBId}", [
        'notes_ar' => 'تعيين بمرسوم رئاسي',
    ])->assertOk()
        ->assertJsonPath('tenure.notes_ar', 'تعيين بمرسوم رئاسي');

    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/tenures/{$tenureBId}")
        ->assertOk();
    expect(GovtTenure::find($tenureBId))->toBeNull();
});

test('CV entries CRUD, reorder, evidence links CRUD, and office slots CRUD work and recompute cv_completeness', function () {
    $staff = moduleStaff('govtcvs');

    $official = GovtOfficial::create([
        'slug' => 'cv-test-official',
        'full_name_ar' => 'مسؤول السيرة',
        'display_name_ar' => 'مسؤول السيرة',
        'cv_completeness' => 'positions_only',
    ]);

    expect($official->cv_completeness)->toBe('positions_only');

    // Adding 1 CV entry moves cv_completeness from positions_only -> partial_bio
    $entry1Res = $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/cv-entries", [
        'section' => 'education',
        'title_ar' => 'إجازة في الهندسة المدنية',
        'organization_ar' => 'جامعة حلب',
        'start_year' => 2005,
        'end_year' => 2010,
    ])->assertCreated();

    $entry1Id = $entry1Res->json('cv_entry.id');
    expect($official->fresh()->cv_completeness)->toBe('partial_bio');

    // Adding a 2nd CV entry moves cv_completeness from partial_bio -> full_cv
    $entry2Res = $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/cv-entries", [
        'section' => 'career_history',
        'title_ar' => 'مدير مشاريع البنية التحتية',
        'organization_ar' => 'مؤسسة الإنشاءات',
        'start_year' => 2012,
        'end_year' => 2020,
    ])->assertCreated();

    $entry2Id = $entry2Res->json('cv_entry.id');
    expect($official->fresh()->cv_completeness)->toBe('full_cv');

    // Update CV entry
    $this->actingAs($staff)->putJson("/api/v1/admin/govtcvs/cv-entries/{$entry1Id}", [
        'title_ar' => 'ماجستير في الهندسة المدنية',
    ])->assertOk()
        ->assertJsonPath('cv_entry.title_ar', 'ماجستير في الهندسة المدنية');

    // Reorder CV entries
    $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/cv-entries/reorder", [
        'ids' => [$entry2Id, $entry1Id],
    ])->assertOk();

    expect(GovtCvEntry::findOrFail($entry2Id)->sort_order)->toBe(0)
        ->and(GovtCvEntry::findOrFail($entry1Id)->sort_order)->toBe(1);

    // Delete CV entries and verify cv_completeness recomputes back down
    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/cv-entries/{$entry2Id}")->assertOk();
    expect($official->fresh()->cv_completeness)->toBe('partial_bio');

    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/cv-entries/{$entry1Id}")->assertOk();
    expect($official->fresh()->cv_completeness)->toBe('positions_only');

    // Evidence links CRUD
    $evRes = $this->actingAs($staff)->postJson("/api/v1/admin/govtcvs/officials/{$official->id}/evidence", [
        'evidence_type' => 'appointment_decree',
        'source_title_ar' => 'مرسوم التعيين الرئاسي',
        'source_channel_ar' => 'رئاسة الجمهورية',
        'source_url' => 'https://example.com/decree/1',
        'published_date' => '2025-03-29',
    ])->assertCreated();

    $evId = $evRes->json('evidence.id');
    expect(GovtEvidenceLink::find($evId))->not->toBeNull();

    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/evidence/{$evId}")->assertOk();
    expect(GovtEvidenceLink::find($evId))->toBeNull();

    // Office Slots CRUD
    $slotRes = $this->actingAs($staff)->postJson('/api/v1/admin/govtcvs/slots', [
        'slug' => 'minister-of-economy',
        'title_ar' => 'وزير الاقتصاد والتجارة',
        'tier' => 'minister',
        'is_single_seat' => true,
        'status' => 'active',
    ])->assertCreated();

    $slotId = $slotRes->json('slot.id');

    $this->actingAs($staff)->getJson('/api/v1/admin/govtcvs/slots')
        ->assertOk()
        ->assertJsonCount(1, 'slots')
        ->assertJsonPath('slots.0.slug', 'minister-of-economy');

    $this->actingAs($staff)->putJson("/api/v1/admin/govtcvs/slots/{$slotId}", [
        'title_ar' => 'وزير الاقتصاد والصناعة',
        'status' => 'merged',
    ])->assertOk()
        ->assertJsonPath('slot.title_ar', 'وزير الاقتصاد والصناعة')
        ->assertJsonPath('slot.status', 'merged');

    $this->actingAs($staff)->deleteJson("/api/v1/admin/govtcvs/slots/{$slotId}")
        ->assertOk()
        ->assertJson(['success' => true]);

    expect(GovtOfficeSlot::find($slotId))->toBeNull();
});

test('GovtOfficialPreview resolves SEO preview for published officials and sitemap includes published official URLs only', function () {
    Cache::flush();

    $published = GovtOfficial::create([
        'slug' => 'murhaf-abu-qasra',
        'full_name_ar' => 'اللواء مرهف أبو قصرة',
        'display_name_ar' => 'مرهف أبو قصرة',
        'bio_summary_ar' => 'وزير الدفاع في الحكومة السورية الانتقالية.',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'cv_completeness' => 'full_cv',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);
    GovtTenure::create([
        'official_id' => $published->id,
        'role_title_ar' => 'وزير الدفاع',
        'institution_name_ar' => 'وزارة الدفاع',
        'tier' => 'minister',
        'status' => 'current',
        'started_at' => '2024-12-21',
    ]);

    GovtOfficial::create([
        'slug' => 'unpublished-draft-official',
        'full_name_ar' => 'مسودة غير منشورة',
        'display_name_ar' => 'مسودة غير منشورة',
        'publish_status' => 'draft',
    ]);

    $resolver = app(GovtOfficialPreview::class);

    $preview = $resolver->resolve(Request::create('/govtcvs/murhaf-abu-qasra', 'GET'), '/govtcvs/murhaf-abu-qasra');
    expect($preview)->not->toBeNull()
        ->and($preview->title)->toContain('مرهف أبو قصرة')
        ->and($preview->title)->toContain('وزير الدفاع')
        ->and($preview->canonicalPath)->toBe('/govtcvs/murhaf-abu-qasra');

    expect($resolver->resolve(Request::create('/govtcvs/unpublished-draft-official', 'GET'), '/govtcvs/unpublished-draft-official'))
        ->toBeNull();

    $meta = SeoMeta::resolve(Request::create('/govtcvs/murhaf-abu-qasra', 'GET'));
    expect($meta['title'])->toContain('مرهف أبو قصرة')
        ->and($meta['canonical'])->toEndWith('/govtcvs/murhaf-abu-qasra')
        ->and($meta['robots'])->toBe('index, follow');

    $profilePage = collect(json_decode($meta['json_ld'], true)['@graph'])->firstWhere('@type', 'ProfilePage');
    expect($profilePage['mainEntity'])->toMatchArray([
        '@type' => 'Person',
        '@id' => $meta['canonical'].'#person',
        'name' => 'اللواء مرهف أبو قصرة',
        'jobTitle' => 'وزير الدفاع',
        'worksFor' => [
            '@type' => 'GovernmentOrganization',
            'name' => 'وزارة الدفاع',
        ],
    ]);

    // Advance only a published official's tenure updated_at (and advance a draft's even further)
    $tenureUpdatedAt = now()->addDays(2)->startOfSecond();
    $published->tenures()->first()->forceFill(['updated_at' => $tenureUpdatedAt])->saveQuietly();
    $draftOfficial = GovtOfficial::where('slug', 'unpublished-draft-official')->firstOrFail();
    $draftTenure = GovtTenure::create([
        'official_id' => $draftOfficial->id,
        'role_title_ar' => 'منصب مسودة',
        'tier' => 'minister',
        'status' => 'current',
    ]);
    $draftTenure->forceFill(['updated_at' => now()->addDays(10)])->saveQuietly();

    $xml = $this->get('/sitemap.xml')->assertOk()->getContent();
    expect($xml)->toContain('/govtcvs</loc>')
        ->toContain('/govtcvs/movements</loc>')
        ->toContain('/govtcvs/murhaf-abu-qasra</loc>')
        ->not->toContain('/govtcvs/unpublished-draft-official</loc>');

    $parsed = simplexml_load_string($xml);
    $lastmods = [];
    foreach ($parsed->url as $url) {
        $lastmods[(string) $url->loc] = (string) $url->lastmod;
    }

    $base = rtrim((string) config('seo.base_url'), '/');
    expect($lastmods[$base.'/govtcvs'])->toBe($tenureUpdatedAt->toAtomString())
        ->and($lastmods[$base.'/govtcvs/movements'])->toBe($tenureUpdatedAt->toAtomString());
});

test('GovtCvImportService is idempotent when importing the same fixture payload twice', function () {
    $importer = app(GovtCvImportService::class);
    $method = method_exists($importer, 'importArray') ? 'importArray' : 'import';

    $fixture = [
        'office_slots' => [
            [
                'slug' => 'minister-of-telecommunications',
                'title_ar' => 'وزير الاتصالات وتقانة المعلومات',
                'institution_name_ar' => 'وزارة الاتصالات وتقانة المعلومات',
                'tier' => 'minister',
                'is_single_seat' => true,
                'status' => 'active',
            ],
        ],
        'officials' => [
            [
                'slug' => 'hussein-al-masri',
                'full_name_ar' => 'م. حسين المصري',
                'display_name_ar' => 'حسين المصري',
                'full_name_en' => 'Hussein Al-Masri',
                'office_status' => 'in_office',
                'highest_tier' => 'minister',
                'publish_status' => 'published',
                'verification_level' => 'cv_card_verified',
                'aliases' => [
                    ['alias_ar' => 'أبو عمر المصري', 'alias_type' => 'kunya'],
                ],
                'tenures' => [
                    [
                        'office_slot_slug' => 'minister-of-telecommunications',
                        'role_title_ar' => 'وزير الاتصالات وتقانة المعلومات',
                        'institution_name_ar' => 'وزارة الاتصالات وتقانة المعلومات',
                        'tier' => 'minister',
                        'government_phase' => 'transitional_2025',
                        'status' => 'current',
                        'started_at' => '2025-03-29',
                        'start_date_precision' => 'exact',
                    ],
                ],
                'cv_entries' => [
                    [
                        'section' => 'education',
                        'title_ar' => 'بكالوريوس هندسة اتصالات',
                        'organization_ar' => 'جامعة دمشق',
                        'start_year' => 2002,
                        'end_year' => 2007,
                    ],
                    [
                        'section' => 'career_history',
                        'title_ar' => 'مدير شبكات الاتصالات',
                        'organization_ar' => 'الشركة السورية للاتصالات',
                        'start_year' => 2010,
                        'end_year' => 2020,
                    ],
                ],
                'evidence_links' => [
                    [
                        'evidence_type' => 'cv_card',
                        'paperless_record_id' => 1042,
                        'source_title_ar' => 'بطاقة تعريف وزير الاتصالات',
                        'source_channel_ar' => 'سانا',
                        'source_url' => 'https://sana.sy/cv/1042',
                        'published_date' => '2025-03-30',
                    ],
                ],
            ],
        ],
    ];

    $firstRun = $importer->{$method}($fixture);
    $secondRun = $importer->{$method}($fixture);

    expect($firstRun['officials_imported'])->toBe(1)
        ->and($secondRun['officials_imported'])->toBe(1)
        ->and(GovtOfficial::count())->toBe(1)
        ->and(GovtOfficialAlias::count())->toBe(1)
        ->and(GovtOfficeSlot::count())->toBe(1)
        ->and(GovtTenure::count())->toBe(1)
        ->and(GovtCvEntry::count())->toBe(2)
        ->and(GovtEvidenceLink::count())->toBe(1);
});

test('autoLinkKnownRecords matches English names, propagates PromiseSpeaker FKs back onto GovtOfficial, and exposes structured cross-module links', function () {
    $category = OfficialCategory::create([
        'id' => 'public_figures',
        'label_ar' => 'الشخصيات العامة',
        'label_en' => 'Public Figures',
        'is_active' => true,
    ]);
    $entity = OfficialEntity::create([
        'id' => 'pf-safwat-raslan',
        'category_id' => $category->id,
        'name' => 'Dr. Mohammed Safwat Raslan',
        'name_ar' => 'صفوت رسلان',
        'description_ar' => 'حاكم مصرف سوريا المركزي',
        'is_active' => true,
    ]);
    $poll = Poll::factory()->create(['slug' => Poll::coreSlug(), 'is_active' => true]);
    $candidate = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'محمد صفوت رسلان',
        'title' => 'حاكم مصرف سوريا المركزي',
        'status' => 'active',
    ]);
    $houseMember = HouseMember2026::create([
        'member_number' => 999,
        'name_ar' => 'محمد رسلان',
        'governorate_ar' => 'حمص',
        'gender' => 'M',
        'status' => 'active',
    ]);

    // Speaker carries official_entity_id, candidate_id, and house_member_id, while its name is a short variant
    $speaker = PromiseSpeaker::factory()->create([
        'name' => 'محمد رسلان',
        'official_entity_id' => $entity->id,
        'candidate_id' => $candidate->id,
        'house_member_id' => $houseMember->id,
        'status' => 'approved',
    ]);

    $official = GovtOfficial::create([
        'slug' => 'mohammad-safwat-raslan',
        'full_name_ar' => 'محمد صفوت عبد الحميد رسلان',
        'display_name_ar' => 'محمد صفوت رسلان',
        'full_name_en' => 'Mohammed Safwat Raslan',
        'office_status' => 'in_office',
        'highest_tier' => 'agency_head',
        'publish_status' => 'published',
        'published_at' => now(),
    ]);

    $importer = app(GovtCvImportService::class);
    $matchedCount = $importer->autoLinkKnownRecords();

    $official->refresh();
    expect($matchedCount)->toBe(4)
        ->and($official->official_entity_id)->toBe($entity->id)
        ->and($official->promise_speaker_id)->toBe($speaker->id)
        ->and($official->candidate_id)->toBe($candidate->id)
        ->and($official->house_member_id)->toBe($houseMember->id);

    $this->getJson('/api/v1/govtcvs/mohammad-safwat-raslan')
        ->assertOk()
        ->assertJsonPath('official_entity_link.entity_id', 'pf-safwat-raslan')
        ->assertJsonPath('official_entity_link.href', '/syofficial?q='.urlencode('صفوت رسلان'))
        ->assertJsonPath('official_entity_link.label', 'الحسابات الرسمية الموثّقة (صفوت رسلان)')
        ->assertJsonPath('house_link.href', '/house')
        ->assertJsonPath('house_link.label', 'عضو في مجلس الشعب 2026')
        ->assertJsonPath('house_link.member_name', 'محمد رسلان')
        ->assertJsonPath('tierlist_link.href', '/tierlist');
});
