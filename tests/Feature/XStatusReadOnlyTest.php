<?php

use App\Models\AnswerSocialPost;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

test('X status rejects a wrong account without changing failed delivery data or exposing remote fields', function () {
    config([
        'services.x_tierlist.enabled' => true,
        'services.x_tierlist.base_url' => 'https://api.x.test',
        'services.x_tierlist.api_key' => 'private-consumer-key',
        'services.x_tierlist.api_secret' => 'private-consumer-secret',
        'services.x_tierlist.access_token' => 'private-account-token',
        'services.x_tierlist.access_token_secret' => 'private-account-secret',
        'services.x_tierlist.expected_user_id' => 'expected-account-id',
    ]);
    $post = AnswerSocialPost::create([
        'answer_id' => '10020000000000998',
        'question_id' => '10010000000000998',
        'title' => 'An existing answer',
        'url' => 'https://answers.syrian.zone/questions/10010000000000998/10020000000000998',
        'caption' => 'An existing answer',
        'status' => 'failed',
        'last_error' => 'X API rejected the media upload (HTTP 401)',
    ]);
    $before = $post->fresh()->getAttributes();
    Http::preventStrayRequests();
    Http::fake([
        'api.x.test/2/users/me' => Http::response([
            'data' => ['id' => 'private-wrong-account-id', 'name' => 'private-remote-name'],
            'detail' => 'private-response-marker',
        ], 200),
    ]);
    DB::enableQueryLog();
    DB::flushQueryLog();

    try {
        $this->artisan('tierlist:x-status')
            ->expectsOutput('X credentials belong to an unexpected account (HTTP 200).')
            ->doesntExpectOutputToContain('private-')
            ->assertFailed();

        expect(DB::getQueryLog())->toBe([]);
    } finally {
        DB::disableQueryLog();
        DB::flushQueryLog();
    }
    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request->method() === 'GET'
        && $request->url() === 'https://api.x.test/2/users/me');
    expect($post->fresh()->getAttributes())->toBe($before);
});
