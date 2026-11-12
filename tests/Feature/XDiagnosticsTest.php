<?php

use App\Exceptions\XApiException;
use App\Models\AnswerSocialPost;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.x_tierlist.enabled' => true,
        'services.x_tierlist.base_url' => 'https://api.x.test',
        'services.x_tierlist.api_key' => 'consumer-key',
        'services.x_tierlist.api_secret' => 'consumer-secret',
        'services.x_tierlist.access_token' => 'account-token',
        'services.x_tierlist.access_token_secret' => 'account-secret',
        'services.x_tierlist.expected_user_id' => 'expected-account-id',
    ]);
    Http::preventStrayRequests();
});

test('X status reports the HTTP rejection without disclosing the upstream response', function () {
    Http::fake([
        'api.x.test/2/users/me' => Http::response(['detail' => 'private-response-marker'], 401),
    ]);

    $this->artisan('tierlist:x-status')
        ->expectsOutput('X API rejected account verification (HTTP 401).')
        ->doesntExpectOutputToContain('private-response-marker')
        ->assertFailed();

    Http::assertSentCount(1);
});

test('card commands expose the upload status and never attempt a rejected post', function (string $command, string $argument, int $status) {
    Http::fake([
        'api.x.test/2/media/upload' => Http::response(['detail' => 'private-response-marker'], $status),
    ]);
    $image = tempnam(sys_get_temp_dir(), 'diagnostic-image');
    $text = tempnam(sys_get_temp_dir(), 'diagnostic-caption');
    file_put_contents($image, 'png-bytes');
    file_put_contents($text, $argument === 'meta' ? json_encode([
        'answer_id' => '10020000000000999',
        'question_id' => '10010000000000999',
        'caption' => 'A real answer caption',
    ]) : 'A real leaderboard caption');

    try {
        $message = $status === 429 ? 'X media upload is temporarily unavailable' : 'X API rejected the media upload';
        $this->artisan($command, ['image' => $image, $argument => $text])
            ->expectsOutput("{$message} (HTTP {$status}).")
            ->doesntExpectOutputToContain('private-response-marker')
            ->assertFailed();
        Http::assertSentCount(1);
        if ($command === 'answers:post-card') {
            expect(AnswerSocialPost::count())->toBe($status === 429 ? 0 : 1);
            if ($status !== 429) {
                expect(AnswerSocialPost::query()->sole()->last_error)->toBe("{$message} (HTTP {$status})");
            }
        }
    } finally {
        unlink($image);
        unlink($text);
    }
})->with([
    'tierlist invalid media' => ['tierlist:post-card', 'caption', 400],
    'answer unauthorized' => ['answers:post-card', 'meta', 401],
    'answer rate limited' => ['answers:post-card', 'meta', 429],
]);

test('X diagnostics retain a safe summary when no HTTP response exists', function () {
    expect((new XApiException('X account verification ended without a response'))->diagnosticMessage())
        ->toBe('X account verification ended without a response');
});
