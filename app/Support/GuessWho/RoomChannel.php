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
     * The presence-channel member block for a player.
     *
     * @return array{id: string, session_id: string, name: string}
     */
    public static function member(string $sessionId, ?User $user): array
    {
        return [
            'id' => $sessionId,
            'session_id' => $sessionId,
            'name' => $user?->name ?? self::GUEST_NAME,
        ];
    }
}
