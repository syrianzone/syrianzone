<?php

use App\Models\AnswerSocialPost;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Carbon::setTestNow('2026-09-01 12:00:00');

    config([
        'services.x_tierlist.enabled' => true,
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

function answerCardFiles(array $metaOverrides = []): array
{
    $image = tempnam(sys_get_temp_dir(), 'answer-card').'.png';
    file_put_contents($image, 'png-bytes');

    $meta = tempnam(sys_get_temp_dir(), 'answer-meta').'.json';
    file_put_contents($meta, json_encode(array_merge([
        'answer_id' => '10020000000000151',
        'question_id' => '10010000000000149',
        'title' => 'كيف أجدد جواز السفر؟',
        'url' => 'https://answers.syrian.zone/questions/10010000000000149/10020000000000151',
        'caption' => "كيف أجدد جواز السفر؟\n\nhttps://answers.syrian.zone/questions/10010000000000149/10020000000000151",
    ], $metaOverrides), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

    return [$image, $meta];
}

function fakeAnswerCardHappyPath(): void
{
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        return match ($request->url()) {
            'https://api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
            'https://api.x.test/2/media/upload' => Http::response(['data' => ['id' => 'media-77']], 201),
            default => Http::response(['data' => ['id' => 'post-88']], 201),
        };
    });
}

test('posts a card and records the row', function () {
    fakeAnswerCardHappyPath();
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->expectsOutput('Posted post-88 with media media-77.')
        ->assertSuccessful();

    $row = AnswerSocialPost::query()->sole();
    expect($row->answer_id)->toBe('10020000000000151')
        ->and($row->question_id)->toBe('10010000000000149')
        ->and($row->status)->toBe('posted')
        ->and($row->x_post_id)->toBe('post-88')
        ->and($row->posted_at->toDateTimeString())->toBe('2026-09-01 12:00:00');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.x.test/2/media/upload'
            && str_contains($request->body(), 'png-bytes');
    });
    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.x.test/2/tweets'
            && str_contains($request['text'], 'كيف أجدد جواز السفر؟')
            && $request['media']['media_ids'] === ['media-77'];
    });
});

test('skips an already recorded answer without network calls', function () {
    Http::preventStrayRequests();
    AnswerSocialPost::create([
        'answer_id' => '10020000000000151',
        'question_id' => '10010000000000149',
        'title' => 'كيف أجدد جواز السفر؟',
        'url' => 'https://answers.syrian.zone/questions/10010000000000149/10020000000000151',
        'caption' => 'سبق نشره',
        'status' => 'posted',
    ]);
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->expectsOutput('answer 10020000000000151 already handled (posted), skipping.')
        ->assertSuccessful();

    Http::assertNothingSent();
    expect(AnswerSocialPost::count())->toBe(1);
});

test('does not retry a failed row', function () {
    Http::preventStrayRequests();
    AnswerSocialPost::create([
        'answer_id' => '10020000000000151',
        'question_id' => '10010000000000149',
        'title' => 'كيف أجدد جواز السفر؟',
        'url' => 'https://answers.syrian.zone/questions/10010000000000149/10020000000000151',
        'caption' => 'محاولة فاشلة',
        'status' => 'failed',
    ]);
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->expectsOutput('answer 10020000000000151 already handled (failed), skipping.')
        ->assertSuccessful();

    Http::assertNothingSent();
});

test('fails closed when x posting is unconfigured', function () {
    config(['services.x_tierlist.enabled' => false]);
    Http::preventStrayRequests();
    // Real files, so only the config gate can produce the failure exit.
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->assertExitCode(1);

    Http::assertNothingSent();
    expect(AnswerSocialPost::count())->toBe(0);
});

test('rejects meta without answer_id', function () {
    Http::preventStrayRequests();
    [$image, $meta] = answerCardFiles(['answer_id' => '']);

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->assertExitCode(1);

    Http::assertNothingSent();
    expect(AnswerSocialPost::count())->toBe(0);
});

test('records a permanent failure and does not lose the claim', function () {
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        return match ($request->url()) {
            'https://api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
            'https://api.x.test/2/media/upload' => Http::response(['data' => ['id' => 'media-77']], 201),
            default => Http::response([], 403),
        };
    });
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->assertExitCode(1);

    $row = AnswerSocialPost::query()->sole();
    expect($row->status)->toBe('failed')
        ->and($row->last_error)->not->toBeNull()
        ->and($row->last_error)->toContain('403');
});

test('a transient upload failure releases the claim for the next run', function () {
    Http::preventStrayRequests();
    Http::fake([
        'api.x.test/2/media/upload' => Http::response([], 500),
    ]);
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->assertExitCode(1);

    // Nothing was posted, so nothing may stay claimed.
    expect(AnswerSocialPost::count())->toBe(0);
});

test('an out-of-credits 402 releases the claim instead of freezing it', function () {
    Http::preventStrayRequests();
    Http::fake(function ($request) {
        return match ($request->url()) {
            'https://api.x.test/2/users/me' => Http::response(['data' => ['id' => 'expected-account-id']], 200),
            'https://api.x.test/2/media/upload' => Http::response(['data' => ['id' => 'media-77']], 201),
            default => Http::response([], 402),
        };
    });
    [$image, $meta] = answerCardFiles();

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->assertExitCode(1);

    // The cap resets; the answer must stay eligible for the next run.
    expect(AnswerSocialPost::count())->toBe(0);
});

test('release deletes a failed row so the next run retries', function () {
    AnswerSocialPost::create([
        'answer_id' => '10020000000000155',
        'question_id' => '10010000000000149',
        'title' => 'عنوان',
        'url' => 'https://answers.syrian.zone/questions/10010000000000149/10020000000000155',
        'caption' => 'عنوان',
        'status' => 'failed',
        'last_error' => 'X API rejected the post (HTTP 403)',
    ]);

    $this->artisan('answers:release-card', ['answer_id' => '10020000000000155'])
        ->assertSuccessful();

    expect(AnswerSocialPost::count())->toBe(0);
});

test('release refuses posted and sending rows', function () {
    foreach (['posted', 'sending'] as $status) {
        AnswerSocialPost::create([
            'answer_id' => "1002000000000015{$status}",
            'question_id' => '10010000000000149',
            'title' => 'عنوان',
            'url' => 'https://answers.syrian.zone/questions/x',
            'caption' => 'عنوان',
            'status' => $status,
        ]);

        $this->artisan('answers:release-card', ['answer_id' => "1002000000000015{$status}"])
            ->assertExitCode(1);
    }

    expect(AnswerSocialPost::count())->toBe(2);
});

test('card status lists recorded rows with their errors', function () {
    AnswerSocialPost::create([
        'answer_id' => '10020000000000155',
        'question_id' => '10010000000000149',
        'title' => 'عنوان',
        'url' => 'https://answers.syrian.zone/questions/x',
        'caption' => 'عنوان',
        'status' => 'failed',
        'last_error' => 'X API rejected the post (HTTP 403)',
    ]);

    // One assertion only: a single output line satisfies at most one
    // expectsOutputToContain expectation.
    $this->artisan('answers:card-status')
        ->expectsOutputToContain('10020000000000155  failed')
        ->assertSuccessful();
});

test('warns on an overweight caption but still posts', function () {
    fakeAnswerCardHappyPath();
    [$image, $meta] = answerCardFiles(['caption' => str_repeat('ط', 300)]);

    $this->artisan('answers:post-card', ['image' => $image, 'meta' => $meta])
        ->expectsOutput('Caption weighs 300 characters; a standard account will reject it.')
        ->assertSuccessful();

    expect(AnswerSocialPost::query()->sole()->status)->toBe('posted');
});
