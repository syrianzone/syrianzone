<?php

use App\Models\Ballot;
use App\Models\Poll;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

test('poll private data pruning removes expired identifiers but keeps anonymous ballots', function () {
    Carbon::setTestNow('2026-07-16 12:00:00 UTC');
    $poll = Poll::factory()->create();
    $oldBallot = Ballot::create([
        'ip_hash' => hash('sha256', '192.0.2.10'),
        'poll_id' => $poll->id,
        'user_agent' => hash('sha256', 'old-client'),
        'vote_day' => now()->subDays(45),
        'voter_key' => hash('sha256', 'old-installation'),
    ]);
    $oldBallot->forceFill([
        'created_at' => now()->subDays(45),
        'updated_at' => now()->subDays(45),
    ])->save();
    $currentBallot = Ballot::create([
        'ip_hash' => hash('sha256', '192.0.2.11'),
        'poll_id' => $poll->id,
        'user_agent' => hash('sha256', 'current-client'),
        'vote_day' => now()->subDays(5),
        'voter_key' => hash('sha256', 'current-installation'),
    ]);

    foreach ([
        [
            'created_at' => now()->subDays(45),
            'installation_hash' => hash('sha256', 'old-installation'),
            'ip_hash' => hash('sha256', '192.0.2.10'),
            'updated_at' => now()->subDays(45),
            'vote_day' => now()->subDays(45)->toDateString(),
        ],
        [
            'created_at' => now()->subDays(5),
            'installation_hash' => hash('sha256', 'current-installation'),
            'ip_hash' => hash('sha256', '192.0.2.11'),
            'updated_at' => now()->subDays(5),
            'vote_day' => now()->subDays(5)->toDateString(),
        ],
    ] as $receipt) {
        DB::table('mobile_poll_vote_receipts')->insert([
            ...$receipt,
            'poll_id' => $poll->id,
        ]);
    }

    $this->artisan('polls:prune-private-data --days=30')
        ->expectsOutputToContain('Pruned 1 ballot')
        ->assertSuccessful();

    expect($oldBallot->fresh()->voter_key)->toBe('pruned')
        ->and($oldBallot->fresh()->ip_hash)->toBeNull()
        ->and($oldBallot->fresh()->user_agent)->toBeNull()
        ->and($currentBallot->fresh()->voter_key)->toBe(hash('sha256', 'current-installation'))
        ->and($currentBallot->fresh()->ip_hash)->toBe(hash('sha256', '192.0.2.11'));

    $this->assertDatabaseMissing('mobile_poll_vote_receipts', [
        'installation_hash' => hash('sha256', 'old-installation'),
    ]);
    $this->assertDatabaseHas('mobile_poll_vote_receipts', [
        'installation_hash' => hash('sha256', 'current-installation'),
    ]);
});
