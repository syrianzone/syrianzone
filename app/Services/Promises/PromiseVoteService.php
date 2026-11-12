<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseVote;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * "Will it be kept?" votes.
 *
 * The voter key is an HMAC (keyed by the app key) of the signed-in user id,
 * or of the client device id for guests, so the stored value cannot be
 * reversed or correlated with another table. The IP is stored the same way
 * as a fraud signal only. Like tier-list ballots, the device id is
 * client-controlled, so the `voting` rate limiter is the real flood guard;
 * the unique index only stops accidental double counting.
 *
 * A voter may change their answer while the promise is open. Voting closes
 * when an editor sets a verdict.
 *
 * The /promises list shows a tally on every card. Those come from one grouped
 * query, cached briefly and dropped on each vote, so the list never runs a
 * query per card and a vote never touches the (much heavier) index cache.
 */
class PromiseVoteService
{
    public const TALLIES_TTL_SECONDS = 60;

    private const TALLIES_KEY = 'promises:vote-tallies:v1';

    private const TALLY_SQL = 'SUM(CASE WHEN believes THEN 1 ELSE 0 END) AS yes, SUM(CASE WHEN believes THEN 0 ELSE 1 END) AS no';

    /**
     * @return array{yes: int, no: int}
     */
    public function cast(Promise $promise, bool $believes, ?User $user, ?string $deviceId, ?string $ip): array
    {
        if (! $promise->isOpen()) {
            throw PromiseActionException::votingClosed();
        }

        $voterKey = $this->voterKey($user, $deviceId);

        // One atomic statement on the (promise_id, voter_key) unique index: a
        // first vote inserts, a changed mind updates, and two concurrent first
        // votes from the same voter cannot collide.
        PromiseVote::upsert(
            [[
                'promise_id' => $promise->id,
                'voter_key' => $voterKey,
                'believes' => $believes,
                'ip_hash' => $ip ? $this->hmac('ip:'.$ip) : null,
            ]],
            ['promise_id', 'voter_key'],
            ['believes', 'ip_hash', 'updated_at'],
        );

        Cache::forget(self::TALLIES_KEY);

        return $this->tally($promise);
    }

    /**
     * @return array{yes: int, no: int}
     */
    public function tally(Promise $promise): array
    {
        $row = PromiseVote::query()
            ->where('promise_id', $promise->id)
            ->selectRaw(self::TALLY_SQL)
            ->first();

        return ['yes' => (int) ($row->yes ?? 0), 'no' => (int) ($row->no ?? 0)];
    }

    /**
     * Every promise's tally, keyed by promise id; promises nobody has voted
     * on are absent. The TTL bounds the one race a forget cannot close: a
     * rebuild that read just before a vote committed.
     *
     * @return array<string, array{yes: int, no: int}>
     */
    public function tallies(): array
    {
        return Cache::remember(self::TALLIES_KEY, self::TALLIES_TTL_SECONDS, fn () => PromiseVote::query()
            ->toBase()
            ->groupBy('promise_id')
            ->selectRaw('promise_id, '.self::TALLY_SQL)
            ->get()
            ->mapWithKeys(fn ($row) => [$row->promise_id => ['yes' => (int) $row->yes, 'no' => (int) $row->no]])
            ->all());
    }

    private function voterKey(?User $user, ?string $deviceId): string
    {
        if ($user) {
            return $this->hmac('user:'.$user->id);
        }

        if (blank($deviceId)) {
            throw PromiseActionException::missingVoter();
        }

        return $this->hmac('device:'.$deviceId);
    }

    private function hmac(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }
}
