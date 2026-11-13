<?php

use App\Exceptions\Directories\DirectoryActionException;
use App\Exceptions\DomainActionException;
use App\Exceptions\Places\PlaceActionException;
use App\Exceptions\Transit\TransitActionException;
use App\Exceptions\Users\UserModerationException;
use App\Models\Poll;
use App\Models\User;
use Illuminate\Support\Facades\Route;

test('all domain action exceptions extend DomainActionException and map to HTTP status codes', function () {
    $placeEx = PlaceActionException::notPending('approved');
    $dirEx = new DirectoryActionException(DirectoryActionException::NOT_FOUND, 'Not found');
    $transitEx = new TransitActionException(TransitActionException::DRAFT_NOT_PENDING, 'Not pending');
    $userEx = UserModerationException::targetIsSuperadmin();

    expect($placeEx)->toBeInstanceOf(DomainActionException::class)
        ->and($placeEx->httpStatus())->toBe(400)
        ->and($dirEx)->toBeInstanceOf(DomainActionException::class)
        ->and($dirEx->httpStatus())->toBe(404)
        ->and($transitEx)->toBeInstanceOf(DomainActionException::class)
        ->and($transitEx->httpStatus())->toBe(400)
        ->and($userEx)->toBeInstanceOf(DomainActionException::class)
        ->and($userEx->httpStatus())->toBe(403);
});

test('central exception handler renders DomainActionException to standard JSON message', function () {
    Route::post('/_test/domain-error-400', function () {
        throw PlaceActionException::notPending('approved');
    });

    Route::get('/_test/domain-error-404', function () {
        throw new DirectoryActionException(DirectoryActionException::NOT_FOUND, 'العنصر غير موجود');
    });

    $this->postJson('/_test/domain-error-400')
        ->assertStatus(400)
        ->assertExactJson(['message' => 'Place is already approved']);

    $this->getJson('/_test/domain-error-404')
        ->assertStatus(404)
        ->assertJsonPath('message', 'العنصر غير موجود');
});

test('poll submit under-minimum selection is an Arabic validation refusal, not a legacy envelope', function () {
    $poll = Poll::create([
        'id' => '00000000-0000-0000-0000-000000000099',
        'title' => 'Error Contract Poll',
        'slug' => 'error-contract-poll',
        'is_active' => true,
        'timezone' => 'UTC',
    ]);

    $this->postJson('/api/submit', [
        'pollSlug' => $poll->slug,
        'tiers' => ['S' => ['only-one']],
        'deviceId' => 'device-standard-test-1234',
    ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'يجب اختيار 3 مرشحين على الأقل.')
        // The rule now lives in VotingService and refuses through the standard
        // validation envelope, so there is no second `error` copy of the text.
        ->assertJsonMissingPath('error');
});

test('voting rate limiter returns both standard message and legacy error key on 429', function () {
    $poll = Poll::create([
        'id' => '00000000-0000-0000-0000-000000000098',
        'title' => 'Rate Limit Poll',
        'slug' => 'rate-limit-poll',
        'is_active' => true,
        'timezone' => 'UTC',
    ]);

    for ($i = 0; $i < 10; $i++) {
        $this->postJson('/api/submit', [
            'pollSlug' => $poll->slug,
            'tiers' => ['S' => ['only-one']],
            'deviceId' => 'device-rate-limit-1234',
        ]);
    }

    $this->postJson('/api/submit', [
        'pollSlug' => $poll->slug,
        'tiers' => ['S' => ['only-one']],
        'deviceId' => 'device-rate-limit-1234',
    ])
        ->assertStatus(429)
        ->assertJsonPath('message', 'لقد وصلت إلى حد التصويت المسموح. يرجى المحاولة بعد قليل.')
        ->assertJsonPath('error', 'لقد وصلت إلى حد التصويت المسموح. يرجى المحاولة بعد قليل.')
        // The framework attaches the rate-limit headers only if the response
        // callback forwards them; the client reads Retry-After to say how long
        // to wait.
        ->assertHeader('Retry-After');
});

test('unauthenticated user settings and radio usage endpoints include standard message and legacy error', function () {
    $this->postJson('/api/user/settings', ['settings' => ['theme' => 'dark']])
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.')
        ->assertJsonPath('error', 'Unauthenticated');

    $this->postJson('/api/user/radio-usage', ['bytes' => 100, 'seconds' => 10])
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.')
        ->assertJsonPath('error', 'Unauthenticated');

    $this->postJson('/api/user/radio-usage/clear')
        ->assertStatus(401)
        ->assertJsonPath('message', 'Unauthenticated.')
        ->assertJsonPath('error', 'Unauthenticated');
});

test('user settings size caps are Arabic validation refusals, not the legacy envelope', function () {
    $user = User::factory()->create();

    $links = [];
    for ($i = 0; $i < 25; $i++) {
        $links[] = [
            'id' => "link-{$i}",
            'label' => str_repeat('أ', 50),
            'url' => 'https://example.com/'.str_repeat('a', 900),
        ];
    }

    $this->actingAs($user)
        ->postJson('/api/user/settings', [
            'settings' => [
                'customLinks' => $links,
            ],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'روابط الشاشة الرئيسية كبيرة جداً. احذف بعض الروابط ثم أعد المحاولة.')
        ->assertJsonValidationErrors('settings.customLinks')
        // Both caps are validation rules now, so the whole payload answers in
        // the standard envelope and there is no second `error` copy of an
        // English sentence for the client to throw away.
        ->assertJsonMissingPath('error');
});

test('guess who endpoints include both standard message and legacy error on refusals', function () {
    $this->postJson('/guesswho/room/non-existent-room/action', [
        'sender_session' => 'session-1',
        'action' => 'pass_turn',
    ])
        ->assertStatus(404)
        ->assertJsonPath('message', 'الغرفة غير موجودة.')
        ->assertJsonPath('error', 'الغرفة غير موجودة.');

    $this->postJson('/guesswho/broadcasting/auth', [])
        ->assertStatus(400)
        ->assertJsonPath('message', 'البيانات غير صالحة.')
        ->assertJsonPath('error', 'البيانات غير صالحة.');
});

test('app icon endpoint includes standard message while preserving icon null on 400', function () {
    $this->getJson('/api/app-icon?store=invalid')
        ->assertStatus(400)
        ->assertJsonPath('message', 'المتجر غير مدعوم.')
        ->assertJsonPath('icon', null);
});
