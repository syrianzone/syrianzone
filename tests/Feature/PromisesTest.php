<?php

use App\Models\Candidate;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\PromiseVote;
use App\Models\User;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;

test('the list shows only published promises, with the derived overdue state and stats', function () {
    $open = Promise::factory()->published()->create(['title' => 'وعد مفتوح']);
    $late = Promise::factory()->published()->overdue()->create(['title' => 'وعد متأخر']);
    Promise::factory()->create(['title' => 'اقتراح غير منشور']);

    $this->get('/promises')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Promises/Index')
            ->has('promises', 2)
            // Most urgent first: the overdue promise leads the list.
            ->where('promises.0.number', $late->number)
            ->where('promises.0.state', 'overdue')
            ->where('promises.0.status', 'pending')
            ->where('promises.1.number', $open->number)
            ->where('stats.total', 2)
            ->where('stats.overdue', 1)
            ->where('stats.open', 1)
        );
});

test('a promise with no deadline counts up from the day it was made', function () {
    $promise = Promise::factory()->published()->withoutDeadline()->create([
        'statement_date' => Promise::today()->subDays(40)->format('Y-m-d'),
    ]);

    $this->get('/promises')->assertInertia(fn (Assert $page) => $page
        ->where('promises.0.number', $promise->number)
        ->where('promises.0.daysLeft', null)
        ->where('promises.0.daysSince', 40)
        ->where('promises.0.state', 'pending')
    );
});

test('the detail page renders published promises and 404s otherwise', function () {
    $published = Promise::factory()->published()->create();
    $draft = Promise::factory()->create(['number' => 999]);

    $this->get("/promises/{$published->number}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Promises/Show')
            ->where('promise.number', $published->number)
            ->has('promise.sources', 1)
            ->where('promise.votingOpen', true)
            ->missing('promise.votes.voter_key')
        );

    $this->get("/promises/{$draft->number}")->assertNotFound();
    $this->get('/promises/424242')->assertNotFound();
});

test('suggesting a promise requires sign-in', function () {
    $this->postJson('/api/v1/promises', [])->assertUnauthorized();
});

test('a signed-in visitor can suggest a promise with a new person; both wait for review', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/promises', [
        'speaker_name' => 'متحدث رسمي جديد',
        'speaker_title' => 'المتحدث باسم وزارة ما',
        'title' => 'افتتاح الجسر قبل الشتاء',
        'quote' => 'سنفتتح الجسر قبل حلول الشتاء',
        'statement_date' => '2025-09-01',
        'statement_venue' => 'press_conference',
        'deadline_wording' => 'قبل الشتاء',
        'source_urls' => ['https://example.com/news/1'],
        'note' => 'سمعته في المؤتمر',
    ])->assertCreated();

    $promise = Promise::sole();
    expect($promise->review_status)->toBe('pending')
        ->and($promise->origin)->toBe('public')
        ->and($promise->number)->toBeNull()
        ->and($promise->submitted_by)->toBe($user->id)
        ->and($promise->submitter_note)->toBe('سمعته في المؤتمر')
        ->and($promise->sources)->toHaveCount(1)
        ->and($promise->speaker->status)->toBe('pending')
        ->and($promise->speaker->submitted_by)->toBe($user->id);

    // Nothing reaches the public page until an editor publishes it.
    $this->get('/promises')->assertInertia(fn (Assert $page) => $page->has('promises', 0));
});

test('a suggestion must fall inside the tracker period and cite a source', function () {
    $user = User::factory()->create();
    $speaker = PromiseSpeaker::factory()->create();

    $this->actingAs($user)->postJson('/api/v1/promises', [
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => 'وعد قديم',
        'quote' => 'نص',
        'statement_date' => '2024-11-30',
        'source_urls' => [],
    ])->assertUnprocessable()->assertJsonValidationErrors(['statement_date', 'source_urls']);
});

test('a visitor cannot attach a suggestion to someone else\'s pending speaker', function () {
    $user = User::factory()->create();
    $theirs = PromiseSpeaker::factory()->pending()->create(['submitted_by' => User::factory()->create()->id]);

    $this->actingAs($user)->postJson('/api/v1/promises', [
        'speaker_ref' => 'speaker:'.$theirs->id,
        'title' => 'وعد',
        'quote' => 'نص الوعد',
        'statement_date' => '2025-09-01',
        'source_urls' => ['https://example.com/x'],
    ])->assertUnprocessable();

    expect(Promise::count())->toBe(0);
});

test('banned accounts cannot suggest or report', function () {
    $user = User::factory()->create(['is_banned' => true]);
    $promise = Promise::factory()->published()->create();

    $this->actingAs($user)->postJson('/api/v1/promises', [
        'speaker_name' => 'شخص',
        'title' => 'وعد',
        'quote' => 'نص',
        'statement_date' => '2025-09-01',
        'source_urls' => ['https://example.com/x'],
    ])->assertForbidden();

    $this->actingAs($user)->postJson("/api/v1/promises/{$promise->number}/reports", [
        'kind' => 'error',
        'body' => 'التاريخ المذكور غير صحيح',
    ])->assertForbidden();
});

test('a progress report needs a source and lands in the review queue', function () {
    $user = User::factory()->create();
    $promise = Promise::factory()->published()->create();

    $this->actingAs($user)->postJson("/api/v1/promises/{$promise->number}/reports", [
        'kind' => 'progress',
        'body' => 'افتُتح الجسر اليوم بحسب الخبر',
    ])->assertUnprocessable()->assertJsonValidationErrors('source_url');

    $this->actingAs($user)->postJson("/api/v1/promises/{$promise->number}/reports", [
        'kind' => 'progress',
        'body' => 'افتُتح الجسر اليوم بحسب الخبر',
        'source_url' => 'https://example.com/opened',
    ])->assertCreated();

    expect(PromiseReport::sole())
        ->status->toBe('pending')
        ->user_id->toBe($user->id);
});

test('guests can vote once per device and change their answer', function () {
    $promise = Promise::factory()->published()->create();

    $this->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => true, 'device_id' => 'device-a'])
        ->assertOk()->assertJson(['votes' => ['yes' => 1, 'no' => 0]]);
    $this->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => false, 'device_id' => 'device-b'])
        ->assertOk()->assertJson(['votes' => ['yes' => 1, 'no' => 1]]);
    // Same device changes its mind: still two votes.
    $this->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => false, 'device_id' => 'device-a'])
        ->assertOk()->assertJson(['votes' => ['yes' => 0, 'no' => 2]]);

    expect(PromiseVote::count())->toBe(2);

    // Stored identities are HMACs, never the raw device id or IP.
    $raw = PromiseVote::query()->pluck('voter_key')->all();
    expect($raw)->not->toContain('device-a')
        ->and(PromiseVote::first()->ip_hash)->not->toBe('127.0.0.1');
});

test('a guest vote without a device id is refused', function () {
    $promise = Promise::factory()->published()->create();

    $this->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => true])->assertUnprocessable();
});

test('voting closes once a verdict is set', function () {
    $promise = Promise::factory()->published()->create(['status' => 'fulfilled']);

    $this->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => true, 'device_id' => 'd'])
        ->assertStatus(409);
});

test('public speaker search offers approved speakers and publicly listed officials only', function () {
    $tierList = Poll::factory()->create(['slug' => Poll::coreSlug()]);
    $draftPoll = Poll::factory()->create(['is_active' => false]);
    PromiseSpeaker::factory()->create(['name' => 'سامر المعتمد']);
    PromiseSpeaker::factory()->pending()->create(['name' => 'سامر المقترح']);
    Candidate::factory()->create(['poll_id' => $tierList->id, 'name' => 'سامر الوزير', 'title' => 'وزير']);
    $hidden = Candidate::factory()->create(['poll_id' => $draftPoll->id, 'name' => 'سامر المخفي']);
    $category = OfficialCategory::create(['id' => 'ministers', 'label_ar' => 'الوزراء', 'label_en' => 'Ministers', 'is_active' => true]);
    OfficialEntity::create(['id' => 'min-off', 'category_id' => $category->id, 'name' => 'Samer Off', 'name_ar' => 'سامر الموقوف', 'is_active' => false]);

    $names = collect($this->getJson('/api/v1/promises/speakers?'.http_build_query(['q' => 'سامر']))->assertOk()->json('speakers'))->pluck('name');

    expect($names)->toContain('سامر المعتمد')
        ->toContain('سامر الوزير')
        ->not->toContain('سامر المقترح')
        ->not->toContain('سامر المخفي')
        ->not->toContain('سامر الموقوف');

    $initialNames = collect($this->getJson('/api/v1/promises/speakers?q=')->assertOk()->json('speakers'))->pluck('name');
    expect($initialNames)->toContain('سامر المعتمد')
        ->toContain('سامر الوزير')
        ->not->toContain('سامر المقترح')
        ->not->toContain('سامر المخفي')
        ->not->toContain('سامر الموقوف');

    // Nor can a suggestion attach to someone the site does not list.
    $this->actingAs(User::factory()->create())->postJson('/api/v1/promises', [
        'speaker_ref' => 'candidate:'.$hidden->id,
        'title' => 'وعد',
        'quote' => 'نص الوعد',
        'statement_date' => '2025-09-01',
        'source_urls' => ['https://example.com/x'],
    ])->assertUnprocessable();
});

test('detail pages resolve their own title, canonical and Article schema', function () {
    $promise = Promise::factory()->published()->create(['title' => 'كهرباء 24 ساعة']);

    $meta = SeoMeta::resolve(Request::create("/promises/{$promise->number}", 'GET'));

    expect($meta['title'])->toContain('كهرباء 24 ساعة')
        ->and($meta['canonical'])->toEndWith("/promises/{$promise->number}")
        ->and($meta['robots'])->toBe('index, follow')
        ->and($meta['json_ld'])->toContain('"@type":"Article"');
});

test('the sitemap lists published promises only', function () {
    Cache::flush();
    $published = Promise::factory()->published()->create();
    Promise::factory()->create(['number' => 777]);

    $xml = $this->get('/sitemap.xml')->assertOk()->getContent();

    expect($xml)->toContain('/promises</loc>')
        ->toContain("/promises/{$published->number}</loc>")
        ->not->toContain('/promises/777</loc>');
});

test('titles from visitors cannot break out of the JSON-LD script', function () {
    $promise = Promise::factory()->published()->create(['title' => 'وعد</script><script>alert(1)</script>']);

    $html = $this->get("/promises/{$promise->number}")->assertOk()->getContent();
    $jsonLd = SeoMeta::resolve(Request::create("/promises/{$promise->number}", 'GET'))['json_ld'];

    expect($jsonLd)->not->toContain('</script>')
        ->and($jsonLd)->toContain('\\u003C/script\\u003E')
        ->and($html)->not->toContain('<script>alert(1)</script>');
});

test('unpublished, deleted or oversized numbers are not reachable by visitors', function () {
    $draft = Promise::factory()->create(['number' => 41]);
    $deleted = Promise::factory()->published()->create();
    $deleted->delete();

    $this->get('/promises/41')->assertNotFound();
    $this->get("/promises/{$deleted->number}")->assertNotFound();
    $this->get('/promises/99999999999999999999')->assertNotFound();
    $this->postJson('/api/v1/promises/41/vote', ['believes' => true, 'device_id' => 'd'])->assertNotFound();
    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/promises/41/reports', ['kind' => 'error', 'body' => 'التاريخ غير صحيح هنا'])
        ->assertNotFound();

    $this->get('/promises')->assertInertia(fn (Assert $page) => $page->has('promises', 0));
    expect($draft->fresh()->review_status)->toBe('pending');
});

test('a signed-in visitor has one vote across devices', function () {
    $user = User::factory()->create();
    $promise = Promise::factory()->published()->create();

    $this->actingAs($user)->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => true, 'device_id' => 'phone']);
    $this->actingAs($user)->postJson("/api/v1/promises/{$promise->number}/vote", ['believes' => true, 'device_id' => 'laptop'])
        ->assertOk()->assertJson(['votes' => ['yes' => 1, 'no' => 0]]);
});

test('public validation messages are in Arabic', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/v1/promises', [])
        ->assertUnprocessable()
        ->assertJsonPath('errors.title.0', 'اكتب عنواناً مختصراً للوعد')
        ->assertJsonPath('errors.source_urls.0', 'أضف رابطاً واحداً على الأقل للمصدر');
});
