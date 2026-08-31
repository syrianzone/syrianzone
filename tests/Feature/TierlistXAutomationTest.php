<?php

use App\Exceptions\XAmbiguousException;
use App\Exceptions\XConfigurationException;
use App\Exceptions\XPermanentException;
use App\Exceptions\XTransientException;
use App\Jobs\PostTierlistChangeToX;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\TierlistSocialPost;
use App\Models\TierlistSocialState;
use App\Services\TierlistChangeDetector;
use App\Services\TierlistLeaderboard;
use App\Services\TierlistPostText;
use App\Services\TierlistSocialOutbox;
use App\Services\XApiClient;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Carbon::setTestNow('2026-08-30 12:00:00');

    config([
        'services.x_tierlist.enabled' => true,
        'services.x_tierlist.poll_slug' => 'best-ministers',
        'services.x_tierlist.settle_minutes' => 15,
        'services.x_tierlist.min_post_interval_minutes' => 60,
        'services.x_tierlist.daily_post_limit' => 4,
        'services.x_tierlist.base_url' => 'https://api.x.test',
        'services.x_tierlist.api_key' => 'consumer-key',
        'services.x_tierlist.api_secret' => 'consumer-secret',
        'services.x_tierlist.access_token' => 'account-token',
        'services.x_tierlist.access_token_secret' => 'account-secret',
        'services.x_tierlist.expected_user_id' => 'expected-account-id',
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

function tierlistAutomationFixture(): array
{
    $poll = Poll::factory()->create(['slug' => 'best-ministers']);
    $group = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'الوزراء',
        'key' => 'minister',
    ]);

    $candidates = collect([
        ['id' => '00000000-0000-4000-8000-000000000001', 'name' => 'ألف', 'sort' => 1, 'score' => 12],
        ['id' => '00000000-0000-4000-8000-000000000002', 'name' => 'باء', 'sort' => 2, 'score' => 9],
        ['id' => '00000000-0000-4000-8000-000000000003', 'name' => 'جيم', 'sort' => 3, 'score' => 6],
        ['id' => '00000000-0000-4000-8000-000000000004', 'name' => 'دال', 'sort' => 4, 'score' => 3],
    ])->map(function (array $data) use ($poll, $group) {
        $candidate = Candidate::factory()->create([
            'id' => $data['id'],
            'poll_id' => $poll->id,
            'candidate_group_id' => $group->id,
            'name' => $data['name'],
            'sort' => $data['sort'],
        ]);

        tierlistSetScore($poll, $candidate, $data['score']);

        return $candidate;
    });

    return compact('poll', 'group', 'candidates');
}

function tierlistSetScore(Poll $poll, Candidate $candidate, int $score, int $votes = 3): void
{
    DB::table('daily_scores')->updateOrInsert([
        'poll_id' => $poll->id,
        'candidate_id' => $candidate->id,
        'day' => now()->startOfDay(),
    ], [
        'votes' => $votes,
        'score' => $score,
        'updated_at' => now(),
    ]);
}

function tierlistSettledPost(): TierlistSocialPost
{
    Queue::fake();
    config(['services.x_tierlist.settle_minutes' => 0]);
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);

    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);
    $detector->detect($poll);

    return TierlistSocialPost::query()->sole();
}

function tierlistOAuthParameters(string $header): array
{
    preg_match_all('/([a-z_]+)="([^"]*)"/', $header, $matches, PREG_SET_ORDER);

    return collect($matches)->mapWithKeys(fn (array $match) => [
        rawurldecode($match[1]) => rawurldecode($match[2]),
    ])->all();
}

function tierlistExpectedOAuthSignature(array $parameters, string $method, string $url): string
{
    unset($parameters['oauth_signature']);
    ksort($parameters);
    $parameterString = collect($parameters)
        ->map(fn ($value, $key) => rawurlencode((string) $key).'='.rawurlencode((string) $value))
        ->implode('&');
    $signatureBase = strtoupper($method).'&'.rawurlencode($url).'&'.rawurlencode($parameterString);
    $signingKey = rawurlencode('consumer-secret').'&'.rawurlencode('account-secret');

    return base64_encode(hash_hmac('sha1', $signatureBase, $signingKey, true));
}

function tierlistFakeX(array $postBody, int $postStatus): void
{
    Http::fake(function ($request) use ($postBody, $postStatus) {
        if ($request->url() === 'https://api.x.test/2/users/me') {
            return Http::response(['data' => ['id' => 'expected-account-id']], 200);
        }

        return Http::response($postBody, $postStatus);
    });
}

test('leaderboard uses deterministic tie breakers', function () {
    ['poll' => $poll, 'group' => $group] = tierlistAutomationFixture();

    Candidate::query()->delete();
    DB::table('daily_scores')->delete();

    $candidates = collect([
        ['id' => '00000000-0000-4000-8000-000000000003', 'sort' => 1, 'votes' => 4, 'score' => 20],
        ['id' => '00000000-0000-4000-8000-000000000002', 'sort' => 1, 'votes' => 4, 'score' => 20],
        ['id' => '00000000-0000-4000-8000-000000000001', 'sort' => 0, 'votes' => 2, 'score' => 10],
        ['id' => '00000000-0000-4000-8000-000000000004', 'sort' => 5, 'votes' => 5, 'score' => 20],
    ])->map(function (array $data) use ($poll, $group) {
        $candidate = Candidate::factory()->create([
            'id' => $data['id'],
            'poll_id' => $poll->id,
            'candidate_group_id' => $group->id,
            'sort' => $data['sort'],
        ]);
        tierlistSetScore($poll, $candidate, $data['score'], $data['votes']);

        return $candidate;
    });

    $ranked = app(TierlistLeaderboard::class)->build($poll)['rankings']['ministers'];

    expect(collect($ranked)->pluck('candidateId')->all())->toBe([
        $candidates[1]->id,
        $candidates[0]->id,
        $candidates[2]->id,
        $candidates[3]->id,
    ]);
});

test('snapshot hash only changes when order changes', function () {
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $leaderboard = app(TierlistLeaderboard::class);

    $before = $leaderboard->snapshot($poll);
    tierlistSetScore($poll, $candidates[0], 13);
    $scoreOnlyChange = $leaderboard->snapshot($poll);
    tierlistSetScore($poll, $candidates[1], 15);
    $orderChange = $leaderboard->snapshot($poll);

    expect($scoreOnlyChange['hash'])->toBe($before['hash'])
        ->and($orderChange['hash'])->not->toBe($before['hash']);
});

test('detector records the first snapshot without posting', function () {
    Queue::fake();
    ['poll' => $poll] = tierlistAutomationFixture();

    $result = app(TierlistChangeDetector::class)->detect($poll);

    $state = TierlistSocialState::query()->sole();
    expect($result)->toBeNull()
        ->and($state->observed_hash)->toBe($state->published_hash)
        ->and(TierlistSocialPost::query()->count())->toBe(0);
    Queue::assertNothingPushed();
});

test('detector waits for a stable change', function () {
    Queue::fake();
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);

    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);

    $this->travel(14)->minutes();
    expect($detector->detect($poll))->toBeNull();

    $this->travel(1)->minutes();
    $post = $detector->detect($poll);

    expect($post)->toBeInstanceOf(TierlistSocialPost::class)
        ->and(TierlistSocialPost::query()->count())->toBe(1);
    Queue::assertNothingPushed();

    expect(app(TierlistSocialOutbox::class)->relayPending($poll))->toBe(1);
    Queue::assertPushed(PostTierlistChangeToX::class, function ($job) use ($poll, $post) {
        return $job->postId === $post->id && $job->pollId === $poll->id;
    });
});

test('detector discards a reverted change', function () {
    Queue::fake();
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);

    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[1], 9);
    $detector->detect($poll);
    $this->travel(20)->minutes();
    $detector->detect($poll);

    expect(TierlistSocialPost::query()->count())->toBe(0);
    Queue::assertNothingPushed();
});

test('detector deduplicates a settled transition', function () {
    Queue::fake();
    config(['services.x_tierlist.settle_minutes' => 0]);
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);

    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);
    $detector->detect($poll);
    $detector->detect($poll);

    expect(TierlistSocialPost::query()->count())->toBe(1);
    Queue::assertNothingPushed();
});

test('outbox relay recovers a pending announcement', function () {
    $post = tierlistSettledPost();
    Queue::fake();

    expect(app(TierlistSocialOutbox::class)->relayPending(Poll::findOrFail($post->poll_id)))->toBe(1);
    Queue::assertPushed(PostTierlistChangeToX::class, 1);
});

test('post text fits the X limit', function () {
    $longName = str_repeat('اسم طويل ', 40);
    $longTitle = str_repeat('منصب طويل ', 30);
    $before = [[
        'key' => 'ministers',
        'name' => 'الوزراء',
        'candidates' => [
            ['id' => 'a', 'name' => $longName, 'title' => $longTitle, 'x_handle' => 'A_Very_Long_H15', 'rank' => 1],
            ['id' => 'b', 'name' => $longName, 'title' => $longTitle, 'x_handle' => 'B_Very_Long_H15', 'rank' => 2],
        ],
    ]];
    $after = [[
        'key' => 'ministers',
        'name' => 'الوزراء',
        'candidates' => [
            ['id' => 'b', 'name' => $longName, 'title' => $longTitle, 'x_handle' => 'B_Very_Long_H15', 'rank' => 1],
            ['id' => 'a', 'name' => $longName, 'title' => $longTitle, 'x_handle' => 'A_Very_Long_H15', 'rank' => 2],
        ],
    ]];

    $text = app(TierlistPostText::class)->make($before, $after);

    expect(mb_strlen($text))->toBeLessThanOrEqual(280)
        ->and($text)->toContain('https://syrian.zone/tierlist');
});

test('post text announces the top riser and faller with handles', function () {
    $before = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'a', 'name' => 'أحمد الشرع', 'title' => 'رئيس الجمهورية', 'x_handle' => 'AH_AlSharaa', 'rank' => 1],
            ['id' => 'b', 'name' => 'أسعد حسن الشيباني', 'title' => 'وزير الخارجية', 'x_handle' => 'AsaadHShaibani', 'rank' => 2],
            ['id' => 'c', 'name' => 'أنس خطاب', 'title' => 'وزير الداخلية', 'x_handle' => 'Anas_Khattab_sy', 'rank' => 3],
        ],
    ]];
    $after = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'c', 'name' => 'أنس خطاب', 'title' => 'وزير الداخلية', 'x_handle' => 'Anas_Khattab_sy', 'rank' => 1],
            ['id' => 'a', 'name' => 'أحمد الشرع', 'title' => 'رئيس الجمهورية', 'x_handle' => 'AH_AlSharaa', 'rank' => 2],
            ['id' => 'b', 'name' => 'أسعد حسن الشيباني', 'title' => 'وزير الخارجية', 'x_handle' => 'AsaadHShaibani', 'rank' => 3],
        ],
    ]];

    $text = app(TierlistPostText::class)->make($before, $after);

    expect($text)->toBe(
        "تغيّر جديد في ترتيب تقييم الحكومة السورية 📊\n\n"
        ."⬆️ صعود أنس خطاب وزير الداخلية @Anas_Khattab_sy من المركز 3 إلى المركز 1\n"
        ."⬇️ تراجع أحمد الشرع رئيس الجمهورية @AH_AlSharaa من المركز 1 إلى المركز 2\n\n"
        ."صوّت الآن:\nhttps://syrian.zone/tierlist"
    );
});

test('post text omits a missing title and handle', function () {
    $before = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'a', 'name' => 'ألف', 'title' => null, 'x_handle' => null, 'rank' => 1],
            ['id' => 'b', 'name' => 'باء', 'title' => null, 'x_handle' => null, 'rank' => 2],
        ],
    ]];
    $after = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'b', 'name' => 'باء', 'title' => null, 'x_handle' => null, 'rank' => 1],
            ['id' => 'a', 'name' => 'ألف', 'title' => null, 'x_handle' => null, 'rank' => 2],
        ],
    ]];

    $text = app(TierlistPostText::class)->make($before, $after);

    expect($text)->toContain("⬆️ صعود باء من المركز 2 إلى المركز 1")
        ->and($text)->toContain("⬇️ تراجع ألف من المركز 1 إلى المركز 2")
        ->and($text)->not->toContain('@');
});

test('post text returns null when no candidate moved', function () {
    $before = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'a', 'name' => 'ألف', 'rank' => 1],
            ['id' => 'b', 'name' => 'باء', 'rank' => 2],
        ],
    ]];
    $after = [[
        'key' => 'ministers',
        'name' => 'الحكومة',
        'candidates' => [
            ['id' => 'a', 'name' => 'ألف', 'rank' => 1],
        ],
    ]];

    expect(app(TierlistPostText::class)->make($before, $after))->toBeNull();
});

test('snapshot ignores the jolani group', function () {
    ['poll' => $poll] = tierlistAutomationFixture();
    $leaderboard = app(TierlistLeaderboard::class);
    $before = $leaderboard->snapshot($poll);

    $jolani = CandidateGroup::factory()->create([
        'poll_id' => $poll->id,
        'name' => 'شخصيات الجولاني',
        'key' => 'jolani',
    ]);
    $candidate = Candidate::factory()->create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $jolani->id,
        'category' => 'jolani',
    ]);
    tierlistSetScore($poll, $candidate, 21);

    $after = $leaderboard->snapshot($poll);

    expect($after['hash'])->toBe($before['hash'])
        ->and(collect($after['groups'])->pluck('key')->all())->not->toContain('jolani');
});

test('detector adopts an unnameable order change without posting', function () {
    Queue::fake();
    config(['services.x_tierlist.settle_minutes' => 0]);
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);

    $detector->detect($poll);
    $candidates[3]->update(['status' => 'archived', 'term_ended_at' => now()->toDateString()]);
    $detector->detect($poll);
    $detector->detect($poll);

    $state = TierlistSocialState::query()->sole();
    expect(TierlistSocialPost::query()->count())->toBe(0)
        ->and($state->published_hash)->toBe($state->observed_hash);
    Queue::assertNothingPushed();
});

test('X job persists the remote post id', function () {
    $post = tierlistSettledPost();
    Http::preventStrayRequests();
    config(['services.x_tierlist.base_url' => 'https://api.x.test/']);
    tierlistFakeX(['data' => ['id' => '19384756']], 201);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    $post->refresh();
    expect($post->status)->toBe('posted')
        ->and($post->x_post_id)->toBe('19384756')
        ->and($post->posted_at)->not->toBeNull()
        ->and(TierlistSocialState::query()->sole()->published_hash)->toBe($post->after_hash);

    Http::assertSent(function ($request) use ($post) {
        $authorization = $request->header('Authorization')[0] ?? '';
        $oauth = tierlistOAuthParameters($authorization);

        return in_array($request->url(), [
            'https://api.x.test/2/users/me',
            'https://api.x.test/2/tweets',
        ], true)
            && ($request->method() !== 'POST' || $request['text'] === $post->text)
            && str_starts_with($authorization, 'OAuth ')
            && str_contains($authorization, 'oauth_consumer_key="consumer-key"')
            && str_contains($authorization, 'oauth_signature_method="HMAC-SHA1"')
            && str_contains($authorization, 'oauth_token="account-token"')
            && str_contains($authorization, 'oauth_version="1.0"')
            && str_contains($authorization, 'oauth_signature=')
            && ! str_contains($authorization, 'consumer-secret')
            && ! str_contains($authorization, 'account-secret')
            && hash_equals(
                tierlistExpectedOAuthSignature($oauth, $request->method(), $request->url()),
                $oauth['oauth_signature'] ?? '',
            );
    });

    Http::assertSentCount(2);
    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));
    Http::assertSentCount(2);
});

test('X client treats a successful response without a post id as ambiguous', function (array $response) {
    Http::preventStrayRequests();
    tierlistFakeX($response, 201);

    $exception = null;
    try {
        app(XApiClient::class)->createPost('اختبار');
    } catch (XAmbiguousException $caught) {
        $exception = $caught;
    }

    expect($exception)->toBeInstanceOf(XAmbiguousException::class)
        ->and($exception->getMessage())->toBe('X API accepted the request without a post ID')
        ->and($exception->statusCode)->toBe(201);
})->with([
    'missing data' => [[]],
    'empty id' => [['data' => ['id' => '']]],
    'numeric id' => [['data' => ['id' => 123]]],
]);

test('X client classifies retryable and permanent responses', function (int $status, string $exception) {
    Http::preventStrayRequests();
    tierlistFakeX([], $status);

    expect(fn () => app(XApiClient::class)->createPost('اختبار'))->toThrow($exception);
})->with([
    'rate limit' => [429, XTransientException::class],
    'server error' => [500, XAmbiguousException::class],
    'bad request' => [400, XPermanentException::class],
]);

test('X client uploads media and attaches it to the post', function () {
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        return match ($request->url()) {
            'https://api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
            'https://api.x.test/2/media/upload' => Http::response(['data' => ['id' => 'media-77', 'media_key' => '3_77']], 201),
            default => Http::response(['data' => ['id' => 'post-88']], 201),
        };
    });

    $client = app(XApiClient::class);
    $mediaId = $client->uploadMedia('png-bytes', 'card.png');
    $postId = $client->createPost('اختبار', [$mediaId]);

    expect($mediaId)->toBe('media-77')->and($postId)->toBe('post-88');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.x.test/2/media/upload'
            && str_starts_with($request->header('Authorization')[0] ?? '', 'OAuth ')
            && str_contains($request->body(), 'png-bytes')
            && str_contains($request->body(), 'tweet_image');
    });
    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.x.test/2/tweets'
            && $request['media']['media_ids'] === ['media-77'];
    });
});

test('X client classifies media upload failures', function (int $status, string $exception) {
    Http::preventStrayRequests();
    Http::fake(['api.x.test/2/media/upload' => Http::response([], $status)]);

    expect(fn () => app(XApiClient::class)->uploadMedia('bytes'))->toThrow($exception);
})->with([
    'rate limit' => [429, XTransientException::class],
    'server error' => [500, XTransientException::class],
    'bad request' => [400, XPermanentException::class],
]);

test('post-card command uploads the image and posts the caption', function () {
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        return match ($request->url()) {
            'https://api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
            'https://api.x.test/2/media/upload' => Http::response(['data' => ['id' => 'media-77']], 201),
            default => Http::response(['data' => ['id' => 'post-88']], 201),
        };
    });

    $image = tempnam(sys_get_temp_dir(), 'card');
    $caption = tempnam(sys_get_temp_dir(), 'caption');
    file_put_contents($image, 'png-bytes');
    file_put_contents($caption, "الأعلى تقييماً لهذا الأسبوع\n\nصوّت الآن:\nhttps://syrian.zone/tierlist");

    $this->artisan('tierlist:post-card', ['image' => $image, 'caption' => $caption])
        ->expectsOutput('Posted post-88 with media media-77.')
        ->assertSuccessful();
});

test('post-card command fails closed when X automation is disabled', function () {
    config(['services.x_tierlist.enabled' => false]);
    Http::preventStrayRequests();

    $this->artisan('tierlist:post-card', ['image' => '/nonexistent.png', 'caption' => '/nonexistent.txt'])
        ->assertExitCode(1);

    Http::assertNothingSent();
});

test('X client stays disabled until every credential is present', function () {
    $client = app(XApiClient::class);

    config(['services.x_tierlist.enabled' => false]);
    expect($client->isConfigured())->toBeFalse();

    config(['services.x_tierlist.enabled' => true]);
    foreach (['api_key', 'api_secret', 'access_token', 'access_token_secret', 'expected_user_id'] as $key) {
        $original = config("services.x_tierlist.{$key}");
        config(["services.x_tierlist.{$key}" => '   ']);
        expect($client->isConfigured())->toBeFalse();
        config(["services.x_tierlist.{$key}" => $original]);
    }

    expect($client->isConfigured())->toBeTrue();
});

test('X status verifies account credentials while announcements stay disabled', function () {
    config(['services.x_tierlist.enabled' => false]);
    Http::preventStrayRequests();
    Http::fake([
        'api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
    ]);

    $this->artisan('tierlist:x-status')
        ->expectsOutput('X credentials verified for user expected-account-id.')
        ->assertSuccessful();

    expect(app(XApiClient::class)->isConfigured())->toBeFalse();
    Http::assertSentCount(1);
});

test('X status fails without complete credentials', function () {
    config([
        'services.x_tierlist.enabled' => false,
        'services.x_tierlist.access_token_secret' => null,
    ]);
    Http::preventStrayRequests();

    $this->artisan('tierlist:x-status')
        ->expectsOutput('X credentials are incomplete.')
        ->assertExitCode(1);

    Http::assertNothingSent();
});

test('X client refuses credentials for another account', function () {
    Http::preventStrayRequests();
    Http::fake([
        'api.x.test/2/users/me' => Http::response(['data' => ['id' => 'wrong-account-id']], 200),
    ]);

    expect(fn () => app(XApiClient::class)->createPost('اختبار'))
        ->toThrow(XPermanentException::class, 'X credentials belong to an unexpected account');
    Http::assertSentCount(1);
});

test('X job skips a transition replaced before delivery', function () {
    $post = tierlistSettledPost();
    Http::preventStrayRequests();
    TierlistSocialState::query()->sole()->update([
        'observed_hash' => str_repeat('a', 64),
    ]);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('superseded');
    Http::assertNothingSent();
});

test('X job retries transient responses', function () {
    $post = tierlistSettledPost();
    Http::preventStrayRequests();
    tierlistFakeX(['title' => 'Rate limited'], 429);

    expect(fn () => (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class)))
        ->toThrow(XTransientException::class);

    expect($post->fresh()->status)->toBe('retrying')
        ->and($post->fresh()->attempts)->toBe(1)
        ->and($post->fresh()->last_http_status)->toBe(429);
});

test('X job stops on authentication failure', function () {
    $post = tierlistSettledPost();
    Exceptions::fake();
    Http::preventStrayRequests();
    Http::fake(['api.x.test/*' => Http::response(['title' => 'Unauthorized'], 401)]);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('failed')
        ->and($post->fresh()->last_http_status)->toBe(401);
    Exceptions::assertReported(XPermanentException::class);
});

test('X job marks ambiguous timeouts for review', function () {
    $post = tierlistSettledPost();
    Exceptions::fake();
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        if ($request->url() === 'https://api.x.test/2/users/me') {
            return Http::response(['data' => ['id' => 'expected-account-id']], 200);
        }

        return Http::failedConnection('timeout');
    });

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('needs_review')
        ->and($post->fresh()->last_error)->toBe('X create-post request ended without a response');
    Exceptions::assertReported(XAmbiguousException::class);
});

test('X job leaves a transition pending when configuration disappears', function () {
    $post = tierlistSettledPost();
    Exceptions::fake();
    Http::preventStrayRequests();
    config(['services.x_tierlist.access_token_secret' => null]);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('pending')
        ->and($post->fresh()->last_error)->toBe('X automation credentials are incomplete');
    Http::assertNothingSent();
    Exceptions::assertReported(XConfigurationException::class);
});

test('detector does not consume a transition with incomplete configuration', function () {
    Queue::fake();
    ['poll' => $poll] = tierlistAutomationFixture();
    config(['services.x_tierlist.expected_user_id' => null]);

    expect(app(TierlistChangeDetector::class)->detect($poll))->toBeNull()
        ->and(TierlistSocialState::query()->count())->toBe(0)
        ->and(TierlistSocialPost::query()->count())->toBe(0);
    Queue::assertNothingPushed();
});

test('X job never retries a row left in sending state', function () {
    $post = tierlistSettledPost();
    Http::preventStrayRequests();
    $post->update(['status' => 'sending']);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('needs_review')
        ->and($post->fresh()->last_error)->toBe('A previous delivery stopped while the X outcome was unknown');
    Http::assertNothingSent();
});

test('X job treats a server response after create-post as ambiguous', function () {
    $post = tierlistSettledPost();
    Exceptions::fake();
    Http::preventStrayRequests();
    tierlistFakeX(['title' => 'Unavailable'], 503);

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('needs_review')
        ->and($post->fresh()->last_http_status)->toBe(503);
    Exceptions::assertReported(XAmbiguousException::class);
});

test('successful delivery cannot roll published state backward', function () {
    $post = tierlistSettledPost();
    $newerHash = str_repeat('b', 64);
    Http::preventStrayRequests();
    Http::fake(function ($request) use ($newerHash) {
        if ($request->url() === 'https://api.x.test/2/users/me') {
            return Http::response(['data' => ['id' => 'expected-account-id']], 200);
        }

        TierlistSocialState::query()->sole()->update(['observed_hash' => $newerHash]);

        return Http::response(['data' => ['id' => '19384756']], 201);
    });

    (new PostTierlistChangeToX($post->id, $post->poll_id))->handle(app(XApiClient::class));

    expect($post->fresh()->status)->toBe('posted')
        ->and(TierlistSocialState::query()->sole()->published_hash)->toBe($post->before_hash)
        ->and(TierlistSocialState::query()->sole()->observed_hash)->toBe($newerHash);
});

test('posting budget enforces the minimum interval', function () {
    config([
        'services.x_tierlist.settle_minutes' => 0,
        'services.x_tierlist.min_post_interval_minutes' => 60,
    ]);
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);
    $detector->detect($poll);

    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);
    $detector->detect($poll);
    expect(TierlistSocialPost::query()->count())->toBe(1);

    $this->travel(65)->minutes();
    $firstPost = TierlistSocialPost::query()->sole();
    $firstPost->update([
        'status' => 'posted',
        'posted_at' => now(),
        'x_post_id' => 'first-post',
    ]);
    TierlistSocialState::query()->sole()->update([
        'published_hash' => $firstPost->after_hash,
        'published_snapshot' => $firstPost->after_snapshot,
        'published_at' => now(),
    ]);

    tierlistSetScore($poll, $candidates[2], 18);
    $detector->detect($poll);
    expect($detector->detect($poll))->toBeNull()
        ->and(TierlistSocialPost::query()->count())->toBe(1);

    $this->travel(60)->minutes();
    expect($detector->detect($poll))->toBeInstanceOf(TierlistSocialPost::class)
        ->and(TierlistSocialPost::query()->count())->toBe(2);
});

test('posting budget enforces the daily limit', function () {
    config([
        'services.x_tierlist.settle_minutes' => 0,
        'services.x_tierlist.min_post_interval_minutes' => 0,
        'services.x_tierlist.daily_post_limit' => 1,
    ]);
    ['poll' => $poll, 'candidates' => $candidates] = tierlistAutomationFixture();
    $detector = app(TierlistChangeDetector::class);
    $detector->detect($poll);

    tierlistSetScore($poll, $candidates[1], 15);
    $detector->detect($poll);
    $detector->detect($poll);
    tierlistSetScore($poll, $candidates[2], 18);
    $detector->detect($poll);

    expect($detector->detect($poll))->toBeNull()
        ->and(TierlistSocialPost::query()->count())->toBe(1);
});
