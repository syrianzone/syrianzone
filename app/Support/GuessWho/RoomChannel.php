<?php

namespace App\Support\GuessWho;

use App\Models\GuessWhoGame;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Who may listen to a Guess Who room channel.
 *
 * The rule is asked twice: by the channel definition in `routes/channels.php`
 * (Laravel's own broadcasting auth) and by `GuessWhoController@authenticateBroadcasting`,
 * which signs the connection itself because the players are guests — Laravel's
 * broadcaster refuses a guarded channel without an authenticated user. The
 * lookup and the membership test therefore live here, so the two entry points
 * cannot drift; only the signing differs between them.
 */
final class RoomChannel
{
    /** Presence name for a player who is not signed in. */
    public const GUEST_NAME = 'لاعب ضيف';

    private const SESSION_HEADER = 'X-Guess-Who-Session-ID';

    /** The guest session the request claims: header, then body, then server session. */
    public static function sessionId(Request $request): ?string
    {
        $sessionId = $request->header(self::SESSION_HEADER);

        if (! is_string($sessionId) || $sessionId === '') {
            $sessionId = $request->input('session_id');
        }

        if (! is_string($sessionId) || $sessionId === '') {
            $sessionId = $request->hasSession() ? $request->session()->get('guess_who_session_id') : null;
        }

        return is_string($sessionId) && $sessionId !== '' ? $sessionId : null;
    }

    /**
     * The session id when it holds one of the room's two player slots.
     *
     * Returns the id rather than a bool so callers cannot proceed with an
     * unverified (or missing) session by accident.
     */
    public static function verifiedSession(GuessWhoGame $game, ?string $sessionId): ?string
    {
        if ($sessionId === null) {
            return null;
        }

        return $game->player_1_session === $sessionId || $game->player_2_session === $sessionId
            ? $sessionId
            : null;
    }

    /**
     * The public name of a player's slot: `player_1` or `player_2`.
     *
     * The session id is the player's only credential (it authorises moves and
     * reads their secret), so nothing that reaches the other player may carry
     * it. Everything broadcast to the room identifies players by slot instead.
     */
    public static function role(GuessWhoGame $game, ?string $sessionId): ?string
    {
        if ($sessionId === null || $sessionId === '') {
            return null;
        }

        return match ($sessionId) {
            $game->player_1_session => 'player_1',
            $game->player_2_session => 'player_2',
            default => null,
        };
    }

    /**
     * The presence-channel member block for a player, keyed by slot.
     *
     * @return array{id: string, player: string, name: string}
     */
    public static function member(string $role, ?User $user): array
    {
        return [
            'id' => $role,
            'player' => $role,
            'name' => $user?->name ?? self::GUEST_NAME,
        ];
    }
}
