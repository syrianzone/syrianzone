<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;

const EXPECTED_CLAIM_IDS = [
    's01', 's02', 's18', 's08', 's12', 's22',
    's13', 's25', 's28', 's15', 's29', 's32',
];

test('GET /games/fakenews renders the Inertia page with initialStats', function () {
    if (! file_exists(public_path('build/manifest.json'))) {
        $this->withoutVite();
    }

    if (! file_exists(resource_path('js/Pages/FakeNewsTest/Index.tsx'))) {
        config()->set('inertia.testing.ensure_pages_exist', false);
    }

    $this->get('/games/fakenews')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('FakeNewsTest/Index')
            ->has('initialStats.claims', 12)
            ->where('initialStats.claims.s01', ['true' => 0, 'false' => 0])
            ->where('initialStats.scores.0', 0)
            ->where('initialStats.scores.12', 0)
            ->where('initialStats.total_runs', 0)
            ->where('initialStats.average_score', null));
});

test('GET /api/v1/fakenews/stats returns empty snapshot with all 12 claims and scores 0..12', function () {
    $response = $this->getJson('/api/v1/fakenews/stats')->assertOk();

    $data = $response->json();

    expect(array_keys($data['claims']))->toBe(EXPECTED_CLAIM_IDS);
    foreach (EXPECTED_CLAIM_IDS as $claimId) {
        expect($data['claims'][$claimId])->toBe(['true' => 0, 'false' => 0]);
    }

    $expectedScores = [];
    for ($score = 0; $score <= 12; $score++) {
        $expectedScores[(string) $score] = 0;
    }

    expect($data['scores'])->toBe($expectedScores)
        ->and($data['total_runs'])->toBe(0)
        ->and($data['average_score'])->toBeNull()
        ->and($response->getContent())->toContain('"scores":{"0":0');
});

test('POST /api/v1/fakenews/answer increments true and false counters and rejects unknown claim ids', function () {
    $this->postJson('/api/v1/fakenews/answer', [
        'claim_id' => 's01',
        'answer' => true,
    ])
        ->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('stats.claims.s01.true', 1)
        ->assertJsonPath('stats.claims.s01.false', 0);

    $this->postJson('/api/v1/fakenews/answer', [
        'claim_id' => 's01',
        'answer' => true,
    ])
        ->assertOk()
        ->assertJsonPath('stats.claims.s01.true', 2)
        ->assertJsonPath('stats.claims.s01.false', 0);

    $this->postJson('/api/v1/fakenews/answer', [
        'claim_id' => 's01',
        'answer' => false,
    ])
        ->assertOk()
        ->assertJsonPath('stats.claims.s01.true', 2)
        ->assertJsonPath('stats.claims.s01.false', 1);

    $this->postJson('/api/v1/fakenews/answer', [
        'claim_id' => 'unknown-id',
        'answer' => true,
    ])->assertStatus(422);

    $this->postJson('/api/v1/fakenews/answer', [
        'claim_id' => 's01',
        'answer' => 'not-a-boolean',
    ])->assertStatus(422);
});

test('POST /api/v1/fakenews/result increments score bucket, computes total_runs and average_score, and rejects out-of-range scores', function () {
    $this->postJson('/api/v1/fakenews/result', ['score' => 8])
        ->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('stats.scores.8', 1)
        ->assertJsonPath('stats.total_runs', 1)
        ->assertJsonPath('stats.average_score', 8);

    $this->postJson('/api/v1/fakenews/result', ['score' => 9])
        ->assertOk()
        ->assertJsonPath('stats.scores.9', 1)
        ->assertJsonPath('stats.total_runs', 2)
        ->assertJsonPath('stats.average_score', 8.5);

    $this->postJson('/api/v1/fakenews/result', ['score' => 9])
        ->assertOk()
        ->assertJsonPath('stats.scores.9', 2)
        ->assertJsonPath('stats.total_runs', 3)
        ->assertJsonPath('stats.average_score', 8.67);

    $this->postJson('/api/v1/fakenews/result', ['score' => -1])->assertStatus(422);
    $this->postJson('/api/v1/fakenews/result', ['score' => 13])->assertStatus(422);
    $this->postJson('/api/v1/fakenews/result', ['score' => 5.5])->assertStatus(422);
    $this->postJson('/api/v1/fakenews/result', ['score' => 'invalid'])->assertStatus(422);
});

test('stats tables store no user_id or identifying columns even when actingAs a user', function () {
    expect(Schema::getColumnListing('fake_news_claim_stats'))
        ->toBe(['claim_id', 'true_count', 'false_count']);

    expect(Schema::getColumnListing('fake_news_score_stats'))
        ->toBe(['score', 'runs_count']);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/fakenews/answer', [
            'claim_id' => 's18',
            'answer' => false,
        ])
        ->assertOk()
        ->assertJsonPath('stats.claims.s18.false', 1);

    $this->actingAs($user)
        ->postJson('/api/v1/fakenews/result', ['score' => 12])
        ->assertOk()
        ->assertJsonPath('stats.scores.12', 1)
        ->assertJsonPath('stats.total_runs', 1)
        ->assertJsonPath('stats.average_score', 12);

    expect(DB::table('fake_news_claim_stats')->get()->all())
        ->toHaveCount(1);
    expect(DB::table('fake_news_score_stats')->get()->all())
        ->toHaveCount(1);
});
