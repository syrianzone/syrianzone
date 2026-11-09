<?php

use App\Models\Candidate;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSector;
use App\Models\PromiseSpeaker;
use App\Models\User;
use App\Services\Promises\SpeakerDirectory;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

/*
|--------------------------------------------------------------------------
| Promises tracker (عداد الوعود): admin, review queue and import
|--------------------------------------------------------------------------
*/

function promisePayload(array $overrides = []): array
{
    $speaker = PromiseSpeaker::factory()->create();

    return array_merge([
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => 'إعادة تأهيل المحطة',
        'quote' => 'سنعيد تأهيل المحطة خلال ستة أشهر',
        'statement_date' => '2025-07-01',
        'statement_venue' => 'tv_interview',
        'deadline_wording' => 'خلال ستة أشهر',
        'deadline_date' => '2026-01-01',
        'sector_id' => 'electricity',
        'is_national' => false,
        'governorates' => ['aleppo', 'homs'],
        'tags' => ['#الكهرباء', 'محطات'],
        'sources' => [
            ['url' => 'https://example.com/a', 'type' => 'tv_interview', 'published_date' => '2025-07-01'],
            ['url' => 'https://example.com/b', 'type' => 'news_article', 'published_date' => '2025-07-03'],
        ],
    ], $overrides);
}

test('guests and accounts without the promises module are kept out', function () {
    $promise = Promise::factory()->create();
    $outsider = moduleStaff('places');

    $this->getJson('/api/v1/admin/promises/speakers/search')->assertUnauthorized();
    $this->actingAs($outsider)->get('/admin/promises')->assertForbidden();
    $this->actingAs($outsider)->postJson('/api/v1/admin/promises', [])->assertForbidden();
    $this->actingAs($outsider)->postJson("/api/v1/admin/promises/{$promise->id}/publish")->assertForbidden();
});

test('each action needs its own capability', function () {
    $editorOnly = User::factory()->create(['role' => 'user', 'permissions' => ['promises.edit']]);
    $promise = Promise::factory()->create();

    $this->actingAs($editorOnly)->get('/admin/promises')->assertOk();
    $this->actingAs($editorOnly)->postJson("/api/v1/admin/promises/{$promise->id}/publish")->assertForbidden();
    $this->actingAs($editorOnly)->postJson("/api/v1/admin/promises/{$promise->id}/status", [])->assertForbidden();
    $this->actingAs($editorOnly)->deleteJson("/api/v1/admin/promises/{$promise->id}")->assertForbidden();
    $this->actingAs($editorOnly)->get('/admin/promises/review')->assertForbidden();
});

test('staff create promises as unpublished drafts with sources, scope and tags', function () {
    $staff = moduleStaff('promises');

    $this->actingAs($staff)->postJson('/api/v1/admin/promises', promisePayload())->assertCreated();

    $promise = Promise::sole();
    expect($promise->review_status)->toBe('pending')
        ->and($promise->number)->toBeNull()
        ->and($promise->is_national)->toBeFalse()
        ->and($promise->governorates())->toEqualCanonicalizing(['aleppo', 'homs'])
        ->and($promise->tags())->toEqualCanonicalizing(['الكهرباء', 'محطات'])
        ->and($promise->sources)->toHaveCount(2)
        ->and($promise->sources->first()->is_primary)->toBeTrue();
});

test('a deadline cannot precede the statement and statements must be in the tracker period', function () {
    $staff = moduleStaff('promises');

    $this->actingAs($staff)->postJson('/api/v1/admin/promises', promisePayload([
        'statement_date' => '2024-01-01',
        'deadline_date' => '2023-12-01',
    ]))->assertUnprocessable()->assertJsonValidationErrors(['statement_date', 'deadline_date']);
});

test('publishing assigns sequential public numbers that survive unpublishing', function () {
    $staff = moduleStaff('promises');
    [$a, $b] = Promise::factory()->count(2)->create();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$a->id}/publish")->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$b->id}/publish")->assertOk();

    expect($a->fresh()->number)->toBe(1)->and($b->fresh()->number)->toBe(2);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$a->id}/unpublish")->assertOk();
    $this->get('/promises/1')->assertNotFound();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$a->id}/publish")->assertOk();
    expect($a->fresh()->number)->toBe(1);
});

test('publishing approves a pending speaker but refuses a rejected one', function () {
    $staff = moduleStaff('promises');
    $pending = Promise::factory()->create(['speaker_id' => PromiseSpeaker::factory()->pending()->create()->id]);
    $rejected = Promise::factory()->create(['speaker_id' => PromiseSpeaker::factory()->create(['status' => 'rejected'])->id]);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$pending->id}/publish")->assertOk();
    expect($pending->fresh()->speaker->status)->toBe('approved');

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$rejected->id}/publish")->assertUnprocessable();
});

test('a status change needs a source and is logged publicly', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'broken',
        'happened_on' => '2026-01-05',
    ])->assertUnprocessable()->assertJsonValidationErrors('source_url');

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'fulfilled',
        'happened_on' => '2026-01-05',
        'body' => 'افتُتحت المحطة',
        'source_url' => 'https://example.com/opened',
    ])->assertOk();

    $promise->refresh();
    expect($promise->status)->toBe('fulfilled')
        ->and($promise->resolved_at->format('Y-m-d'))->toBe('2026-01-05');

    $entry = $promise->updates()->sole();
    expect($entry->type)->toBe('status_change')
        ->and($entry->status_from)->toBe('pending')
        ->and($entry->status_to)->toBe('fulfilled');

    // Reopening clears the verdict date; the log keeps both entries.
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'in_progress',
        'happened_on' => '2026-01-06',
        'source_url' => 'https://example.com/correction',
    ])->assertOk();
    expect($promise->fresh()->resolved_at)->toBeNull()
        ->and($promise->updates()->count())->toBe(2);
});

test('status changes cannot be deleted from the public log, other entries can', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create(['target_value' => 12, 'target_unit' => 'ساعة']);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'in_progress', 'happened_on' => '2025-08-01', 'source_url' => 'https://example.com/s',
    ])->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/updates", [
        'type' => 'progress', 'happened_on' => '2025-09-01', 'value' => 6,
    ])->assertUnprocessable(); // progress needs a source

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/updates", [
        'type' => 'progress', 'happened_on' => '2025-09-01', 'value' => 6, 'source_url' => 'https://example.com/p',
    ])->assertOk();

    $status = $promise->updates()->where('type', 'status_change')->sole();
    $progress = $promise->updates()->where('type', 'progress')->sole();

    $this->actingAs($staff)->deleteJson("/api/v1/admin/promises/{$promise->id}/updates/{$status->id}")->assertStatus(409);
    $this->actingAs($staff)->deleteJson("/api/v1/admin/promises/{$promise->id}/updates/{$progress->id}")->assertOk();
});

test('progress readings drive the public progress bar', function () {
    $promise = Promise::factory()->published()->create([
        'target_value' => 12, 'target_unit' => 'ساعة', 'baseline_value' => 4,
    ]);
    $promise->updates()->create([
        'type' => 'progress', 'happened_on' => '2025-09-01', 'value' => 8, 'source_url' => 'https://example.com/p',
    ]);

    $this->get("/promises/{$promise->number}")->assertInertia(fn (Assert $page) => $page
        ->where('promise.target.current', 8)
        ->where('promise.target.percent', 50)
    );
});

test('publishing a restatement postpones the open original', function () {
    $staff = moduleStaff('promises');
    $original = Promise::factory()->published()->overdue()->create();
    $restated = Promise::factory()->create(['restates_promise_id' => $original->id, 'statement_date' => '2025-10-01']);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$restated->id}/publish")->assertOk();

    $original->refresh();
    expect($original->status)->toBe('postponed')
        ->and($original->updates()->sole()->source_url)->toBe($restated->sources()->first()->url);

    $this->get("/promises/{$original->number}")->assertInertia(fn (Assert $page) => $page
        ->where('promise.restatedBy.number', $restated->fresh()->number)
    );
});

test('the review queue resolves speakers and reports', function () {
    $staff = moduleStaff('promises');
    $speaker = PromiseSpeaker::factory()->pending()->create();
    $promise = Promise::factory()->published()->create();
    $progress = PromiseReport::create([
        'promise_id' => $promise->id, 'user_id' => User::factory()->create()->id, 'kind' => 'progress',
        'body' => 'بدأ العمل في المحطة', 'source_url' => 'https://example.com/work', 'status' => 'pending',
    ]);
    $error = PromiseReport::create([
        'promise_id' => $promise->id, 'user_id' => User::factory()->create()->id, 'kind' => 'error',
        'body' => 'التاريخ خاطئ', 'status' => 'pending',
    ]);

    $this->actingAs($staff)->get('/admin/promises/review')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Admin/Promises/Review')
        ->has('speakers', 1)
        ->has('reports', 2)
    );

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/speakers/{$speaker->id}/approve")->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/reports/{$progress->id}/accept")->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/reports/{$error->id}/dismiss")->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/reports/{$error->id}/accept")->assertStatus(409);

    expect($speaker->fresh()->status)->toBe('approved')
        ->and($promise->updates()->sole()->source_url)->toBe('https://example.com/work');
});

test('a person already in the tier list becomes one linked speaker however often picked', function () {
    $candidate = Candidate::factory()->create(['name' => 'وزير المثال', 'title' => 'وزير المثال']);
    $directory = app(SpeakerDirectory::class);

    $first = $directory->resolve('candidate:'.$candidate->id, forStaff: true);
    $again = $directory->resolve('candidate:'.$candidate->id, forStaff: true);

    expect($first->id)->toBe($again->id)
        ->and($first->status)->toBe('approved')
        ->and(PromiseSpeaker::count())->toBe(1)
        // Once linked, searching returns the speaker, not the raw candidate.
        ->and(collect($directory->search('المثال'))->pluck('ref')->all())->toBe(['speaker:'.$first->id]);
});

test('free-text names match directory entries despite titles and spelling', function () {
    $candidate = Candidate::factory()->create(['name' => 'د. عبدالقادر الحصرية']);

    expect(app(SpeakerDirectory::class)->findExisting('عبد القادر الحصرية'))->toBe('candidate:'.$candidate->id)
        ->and(app(SpeakerDirectory::class)->findExisting('شخص غير معروف تماماً'))->toBeNull();
});

test('speakers and sectors in use cannot be deleted', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->create();

    $this->actingAs($staff)->deleteJson("/api/v1/admin/promises/speakers/{$promise->speaker_id}")->assertUnprocessable();
    $this->actingAs($staff)->deleteJson('/api/v1/admin/promises/sectors/electricity')->assertUnprocessable();
    $this->actingAs($staff)->deleteJson('/api/v1/admin/promises/sectors/health')->assertOk();
});

test('the research import lands everything unpublished and is idempotent', function () {
    $file = tempnam(sys_get_temp_dir(), 'promises').'.json';
    file_put_contents($file, json_encode([[
        'title_ar' => 'افتتاح مطار جديد',
        'summary_ar' => 'سياق',
        'quote' => 'سنفتتح المطار',
        'quote_is_verbatim' => false,
        'speaker_name_ar' => 'شخص الاختبار',
        'speaker_title_ar' => 'وزير النقل',
        'institution_ar' => 'وزارة غير موجودة',
        'statement_date' => '2025-05-01',
        'statement_venue' => 'press_conference',
        'deadline_wording_ar' => 'نهاية العام',
        'deadline_date' => '2025-12-31',
        'deadline_reasoning' => 'نهاية السنة الميلادية',
        'target' => null,
        'sector' => 'transport',
        'governorates' => ['دمشق'],
        'tags_ar' => ['مطارات'],
        'status_assessment' => 'broken',
        'status_evidence' => [
            ['date' => '2025-11-01', 'note_ar' => 'تأجيل', 'url' => 'https://example.com/1', 'verified' => true],
            ['date' => '2026-01-10', 'note_ar' => 'لم يُفتتح', 'url' => 'https://example.com/2', 'verified' => false, 'supports_verdict' => true],
        ],
        'sources' => [['url' => 'https://example.com/src', 'outlet' => 'سانا', 'type' => 'press_conference', 'published_date' => '2025-05-01', 'language' => 'ar', 'archive_url' => null, 'verified' => true]],
        'confidence' => 'medium',
        'notes' => 'تحقق من التاريخ',
    ]], JSON_UNESCAPED_UNICODE));

    $this->artisan('promises:import-research', ['path' => $file])->assertSuccessful();
    $this->artisan('promises:import-research', ['path' => $file])->assertSuccessful();

    $promise = Promise::sole();
    expect($promise->review_status)->toBe('pending')
        ->and($promise->origin)->toBe('research')
        ->and($promise->status)->toBe('broken')
        ->and($promise->governorates())->toBe(['damascus'])
        ->and($promise->speaker->status)->toBe('pending')
        ->and($promise->updates()->pluck('type')->all())->toEqualCanonicalizing(['note', 'status_change'])
        ->and($promise->submitter_note)->toContain('درجة الثقة: medium')
        ->toContain('https://example.com/2')
        ->toContain('وزارة غير موجودة');

    @unlink($file);

    Promise::withTrashed()->forceDelete();
    $this->artisan('promises:import-research')->assertSuccessful();
    expect(Promise::count())->toBe(14);
});

test('before publication the latest status change can be undone to fix its date', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->create(['deadline_date' => '2026-01-01']);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'fulfilled', 'happened_on' => '2026-08-05', 'source_url' => 'https://example.com/late-report',
    ])->assertOk();
    $wrong = $promise->updates()->sole();

    $this->actingAs($staff)->deleteJson("/api/v1/admin/promises/{$promise->id}/status/{$wrong->id}")->assertOk();
    expect($promise->fresh())->status->toBe('pending')->resolved_at->toBeNull();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'fulfilled', 'happened_on' => '2026-01-01', 'source_url' => 'https://example.com/launch',
    ])->assertOk();
    expect($promise->fresh()->counter())->toBe(['mode' => 'ontime', 'value' => null]);
});

test('status changes are dated in order and only rulers can undo one', function () {
    $staff = moduleStaff('promises');
    $editorOnly = User::factory()->create(['role' => 'user', 'permissions' => ['promises.edit']]);
    $promise = Promise::factory()->create(['statement_date' => '2025-06-01']);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'in_progress', 'happened_on' => '2025-05-01', 'source_url' => 'https://example.com/early',
    ])->assertUnprocessable();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'fulfilled', 'happened_on' => '2025-08-05', 'source_url' => 'https://example.com/done',
    ])->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'in_progress', 'happened_on' => '2025-03-01', 'source_url' => 'https://example.com/back',
    ])->assertUnprocessable();

    $entry = $promise->updates()->sole();
    $this->actingAs($editorOnly)->deleteJson("/api/v1/admin/promises/{$promise->id}/status/{$entry->id}")->assertForbidden();
    $this->actingAs($editorOnly)->deleteJson("/api/v1/admin/promises/{$promise->id}/updates/{$entry->id}")->assertStatus(409);
});

test('a promise that was ever public keeps its verdicts, even after unpublishing', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/status", [
        'status' => 'broken', 'happened_on' => Promise::today()->format('Y-m-d'), 'source_url' => 'https://example.com/b',
    ])->assertOk();
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/unpublish")->assertOk();

    $entry = $promise->updates()->sole();
    $this->actingAs($staff)->deleteJson("/api/v1/admin/promises/{$promise->id}/status/{$entry->id}")->assertStatus(409);
    expect($promise->fresh()->status)->toBe('broken');
});

test('publishing needs a source and a reviewer cannot reject a speaker with public promises', function () {
    $staff = moduleStaff('promises');
    $bare = Promise::factory()->create();
    $bare->sources()->delete();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$bare->id}/publish")->assertUnprocessable();

    $speaker = PromiseSpeaker::factory()->pending()->create();
    Promise::factory()->published()->create(['speaker_id' => $speaker->id]);
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/speakers/{$speaker->id}/reject")->assertUnprocessable();
});

test('reports on deleted promises leave the queue and cannot be accepted', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create();
    $report = PromiseReport::create([
        'promise_id' => $promise->id, 'user_id' => User::factory()->create()->id, 'kind' => 'progress',
        'body' => 'بدأ العمل', 'source_url' => 'https://example.com/w', 'status' => 'pending',
    ]);
    $promise->delete();

    $this->actingAs($staff)->get('/admin/promises/review')->assertInertia(fn (Assert $page) => $page
        ->has('reports', 0)
        ->where('queueCount', 0)
    );
    $this->actingAs($staff)->postJson("/api/v1/admin/promises/reports/{$report->id}/accept")->assertNotFound();
});

test('a restatement link must point at a published promise and the successor shown is the published one', function () {
    $staff = moduleStaff('promises');
    $original = Promise::factory()->published()->create();
    $draftTarget = Promise::factory()->create();
    Promise::factory()->create(['restates_promise_id' => $original->id]);

    $this->actingAs($staff)->putJson("/api/v1/admin/promises/{$original->id}", promisePayload([
        'restates_promise_id' => $draftTarget->id,
    ]))->assertUnprocessable()->assertJsonPath('errors.restates_promise_id.0', 'يجب أن يكون الوعد السابق منشوراً');

    $this->get("/promises/{$original->number}")->assertInertia(fn (Assert $page) => $page->where('promise.restatedBy', null));
});

test('staff can update a promise and its tags are de-duplicated as the database compares them', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create(['speaker_title' => 'وزير سابق']);

    $this->actingAs($staff)->putJson("/api/v1/admin/promises/{$promise->id}", promisePayload([
        'speaker_ref' => 'speaker:'.$promise->speaker_id,
        'speaker_title' => null,
        'title' => 'عنوان معدّل',
        'tags' => ['Gaza', 'gaza', 'إعمار', 'اعمار'],
        'target_value' => 1e17,
    ]))->assertUnprocessable()->assertJsonValidationErrors('target_value');

    $this->actingAs($staff)->putJson("/api/v1/admin/promises/{$promise->id}", promisePayload([
        'speaker_ref' => 'speaker:'.$promise->speaker_id,
        'speaker_title' => null,
        'title' => 'عنوان معدّل',
        'tags' => ['Gaza', 'gaza', 'إعمار', 'اعمار'],
    ]))->assertOk();

    $promise->refresh();
    expect($promise->title)->toBe('عنوان معدّل')
        ->and($promise->speaker_title)->toBe('وزير سابق')
        ->and($promise->tags())->toBe(['Gaza', 'إعمار']);
});

test('links staff enter must be web addresses', function () {
    $staff = moduleStaff('promises');

    $this->actingAs($staff)->postJson('/api/v1/admin/promises', promisePayload([
        'sources' => [['url' => 'https://example.com/a', 'type' => 'news_article', 'screenshot_url' => 'javascript:alert(1)']],
    ]))->assertUnprocessable()->assertJsonValidationErrors('sources.0.screenshot_url');

    $this->actingAs($staff)->postJson('/api/v1/admin/promises/speakers', [
        'name' => 'متحدث', 'image_url' => 'javascript:alert(1)', 'x_handle' => 'evil.com/x',
    ])->assertUnprocessable()->assertJsonValidationErrors(['image_url', 'x_handle']);

    $this->actingAs($staff)->postJson('/api/v1/admin/promises/speakers', [
        'name' => 'متحدث', 'image_url' => '/storage/images/promises/speakers/a.webp', 'x_handle' => '@spokes_person',
    ])->assertCreated()->assertJsonPath('speaker.xHandle', 'spokes_person');
});

test('sectors can be toggled and reordered', function () {
    $staff = moduleStaff('promises');

    $this->actingAs($staff)->patchJson('/api/v1/admin/promises/sectors/health/toggle')->assertOk()->assertJson(['isActive' => false]);
    $this->actingAs($staff)->postJson('/api/v1/admin/promises/sectors/reorder', ['ids' => ['other', 'electricity']])->assertOk();

    expect(PromiseSector::find('other')->order_column)->toBe(0)
        ->and(PromiseSector::find('electricity')->order_column)->toBe(1);
});

test('the counter freezes on the verdict and counts in Syrian days', function () {
    // 21:30 UTC on 31 Dec is already 1 Jan in Damascus (UTC+3).
    $this->travelTo(CarbonImmutable::parse('2025-12-31 21:30:00', 'UTC'));

    $due = fn (array $attrs) => Promise::factory()->create($attrs + ['statement_date' => '2025-06-01', 'deadline_date' => '2026-01-01']);

    expect($due([])->counter())->toBe(['mode' => 'today', 'value' => 0])
        ->and($due(['deadline_date' => '2026-01-11'])->counter())->toBe(['mode' => 'left', 'value' => 10])
        ->and($due(['deadline_date' => '2025-12-30'])->counter())->toBe(['mode' => 'overdue', 'value' => 2])
        ->and($due(['status' => 'fulfilled', 'resolved_at' => '2025-12-25'])->counter())->toBe(['mode' => 'early', 'value' => 7])
        ->and($due(['status' => 'partially_fulfilled', 'resolved_at' => '2026-01-01'])->counter())->toBe(['mode' => 'ontime', 'value' => null])
        ->and($due(['status' => 'fulfilled', 'resolved_at' => '2026-01-01', 'deadline_date' => '2025-12-01'])->counter())->toBe(['mode' => 'late', 'value' => 31])
        ->and($due(['status' => 'fulfilled', 'resolved_at' => '2025-06-11', 'deadline_date' => null])->counter())->toBe(['mode' => 'took', 'value' => 10])
        ->and($due(['deadline_date' => null])->counter())->toBe(['mode' => 'since', 'value' => 214]);
});

test('every closed verdict freezes on its date instead of counting on', function () {
    $verdicts = fn () => [
        Promise::factory()->create(['status' => 'broken', 'deadline_date' => '2025-12-01', 'resolved_at' => '2025-12-11'])->counter(),
        Promise::factory()->create(['status' => 'postponed', 'deadline_date' => '2025-12-01', 'resolved_at' => '2025-11-21'])->counter(),
        Promise::factory()->create(['status' => 'retracted', 'deadline_date' => null, 'statement_date' => '2025-06-01', 'resolved_at' => '2025-06-21'])->counter(),
        Promise::factory()->create(['status' => 'broken', 'resolved_at' => null])->counter(),
    ];

    $this->travelTo(CarbonImmutable::parse('2026-01-15 12:00:00', 'UTC'));
    $before = $verdicts();
    $this->travelTo(CarbonImmutable::parse('2026-09-15 12:00:00', 'UTC'));

    expect($verdicts())->toBe($before)
        ->and($before)->toBe([
            ['mode' => 'late', 'value' => 10],
            ['mode' => 'early', 'value' => 10],
            ['mode' => 'took', 'value' => 20],
            ['mode' => 'closed', 'value' => null],
        ]);
});

test('linking a restatement postpones the original only for staff who may rule', function () {
    $editorOnly = User::factory()->create(['role' => 'user', 'permissions' => ['promises.edit']]);
    $ruler = moduleStaff('promises');
    $original = Promise::factory()->published()->overdue()->create();
    $restatement = Promise::factory()->published()->create(['statement_date' => '2025-10-01']);
    $payload = fn () => promisePayload([
        'speaker_ref' => 'speaker:'.$restatement->speaker_id,
        'statement_date' => '2025-10-01',
        'deadline_date' => '2026-06-01',
        'restates_promise_id' => $original->id,
    ]);

    $this->actingAs($editorOnly)->putJson("/api/v1/admin/promises/{$restatement->id}", $payload())->assertOk();
    expect($restatement->fresh()->restates_promise_id)->toBe($original->id)
        ->and($original->fresh()->status)->toBe('pending');

    $this->actingAs($ruler)->putJson("/api/v1/admin/promises/{$restatement->id}", array_merge($payload(), ['restates_promise_id' => null]))->assertOk();
    $this->actingAs($ruler)->putJson("/api/v1/admin/promises/{$restatement->id}", $payload())->assertOk();
    expect($original->fresh()->status)->toBe('postponed');
});

test('the log never precedes the statement and the statement cannot move past the log', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->create(['statement_date' => '2025-06-01']);

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/updates", [
        'type' => 'note', 'happened_on' => '2025-05-01', 'body' => 'قبل التصريح',
    ])->assertUnprocessable();

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/updates", [
        'type' => 'note', 'happened_on' => '2025-07-01', 'body' => 'بعد التصريح',
    ])->assertOk();

    $this->actingAs($staff)->putJson("/api/v1/admin/promises/{$promise->id}", promisePayload([
        'speaker_ref' => 'speaker:'.$promise->speaker_id,
        'statement_date' => '2025-08-01',
        'deadline_date' => '2026-01-01',
    ]))->assertUnprocessable()->assertJsonPath('message', 'لا يمكن أن يأتي تاريخ التصريح بعد أول بند في سجل الوعد (2025-07-01)');
});

test('a change to the public log moves the promise\'s last-updated date', function () {
    $staff = moduleStaff('promises');
    $promise = Promise::factory()->published()->create();
    $promise->forceFill(['updated_at' => now()->subWeek()])->saveQuietly();
    $before = $promise->fresh()->updated_at;

    $this->actingAs($staff)->postJson("/api/v1/admin/promises/{$promise->id}/updates", [
        'type' => 'note', 'happened_on' => Promise::today()->format('Y-m-d'), 'body' => 'تحديث',
    ])->assertOk();

    expect($promise->fresh()->updated_at->greaterThan($before))->toBeTrue();
});

test('a target whose baseline equals it shows no progress percentage', function () {
    $promise = Promise::factory()->published()->create(['target_value' => 1150, 'target_unit' => 'مخيم', 'baseline_value' => 1150]);
    $promise->updates()->create(['type' => 'progress', 'happened_on' => '2025-09-01', 'value' => 1, 'source_url' => 'https://example.com/p']);

    $this->get("/promises/{$promise->number}")->assertInertia(fn (Assert $page) => $page
        ->where('promise.target.current', 1)
        ->where('promise.target.percent', null)
    );
});

test('the import takes the verdict only from marked evidence and fails loudly on bad rows', function () {
    $file = tempnam(sys_get_temp_dir(), 'promises').'.json';
    $row = fn (string $title, array $evidence, string $date = '2025-05-01') => [
        'title_ar' => $title, 'quote' => 'نص', 'quote_is_verbatim' => true, 'speaker_name_ar' => 'شخص الاختبار',
        'statement_date' => $date, 'statement_venue' => 'speech', 'deadline_date' => '2025-12-31',
        'sector' => 'transport', 'governorates' => ['national'], 'status_assessment' => 'fulfilled',
        'status_evidence' => $evidence,
        'sources' => [['url' => 'https://example.com/src', 'type' => 'speech']],
    ];
    file_put_contents($file, json_encode([
        $row('بلا دليل معلَّم', [['date' => '2025-06-01', 'note_ar' => 'خبر', 'url' => 'https://example.com/a']]),
        $row('دليل معلَّم بتاريخ الحدث', [
            ['date' => '2025-06-01', 'note_ar' => 'تأجيل محتمل', 'url' => 'https://example.com/b'],
            ['date' => '2025-07-20', 'note_ar' => 'افتُتح', 'url' => 'https://example.com/c', 'supports_verdict' => true, 'event_date' => '2025-07-15'],
        ]),
        $row('دليل قبل التصريح', [['date' => '2025-01-01', 'note_ar' => 'قديم', 'url' => 'https://example.com/d']], '2025-05-01'),
    ], JSON_UNESCAPED_UNICODE));

    $this->artisan('promises:import-research', ['path' => $file])->assertFailed();

    $unmarked = Promise::where('title', 'بلا دليل معلَّم')->sole();
    $marked = Promise::where('title', 'دليل معلَّم بتاريخ الحدث')->sole();

    expect($unmarked->status)->toBe('pending')
        ->and($unmarked->submitter_note)->toContain('لم يُحدَّد الدليل الذي يثبته')
        ->and($marked->status)->toBe('fulfilled')
        ->and($marked->resolved_at->format('Y-m-d'))->toBe('2025-07-15')
        ->and(Promise::where('title', 'دليل قبل التصريح')->exists())->toBeFalse();

    @unlink($file);
});
