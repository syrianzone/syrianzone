<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseVote;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;

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
 */
class PromiseVoteService
{
    /**
     * @return array{yes: int, no: int}
     */
    public function cast(Promise $promise, bool $believes, ?User $user, ?string $deviceId, ?string $ip): array
    {
        if (! $promise->isOpen()) {
            throw PromiseActionException::votingClosed();
        }

        $voterKey = $this->voterKey($user, $deviceId);

        try {
            PromiseVote::updateOrCreate(
                ['promise_id' => $promise->id, 'voter_key' => $voterKey],
                ['believes' => $believes, 'ip_hash' => $ip ? $this->hmac('ip:'.$ip) : null],
            );
        } catch (UniqueConstraintViolationException) {
            // Two concurrent first votes from the same voter: the other one won.
            PromiseVote::where('promise_id', $promise->id)
                ->where('voter_key', $voterKey)
                ->update(['believes' => $believes]);
        }

        return $this->tally($promise);
    }

    /**
     * @return array{yes: int, no: int}
     */
    public function tally(Promise $promise): array
    {
        $row = PromiseVote::query()
            ->where('promise_id', $promise->id)
            ->selectRaw('SUM(CASE WHEN believes THEN 1 ELSE 0 END) AS yes, SUM(CASE WHEN believes THEN 0 ELSE 1 END) AS no')
            ->first();

        return ['yes' => (int) ($row->yes ?? 0), 'no' => (int) ($row->no ?? 0)];
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
