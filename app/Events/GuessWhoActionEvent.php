<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A Guess Who move relayed over Reverb, replacing the old WebRTC data channel.
 * The server forwards the action to the other player on the room's presence
 * channel; it does not yet validate the move itself (see the migration plan).
 */
class GuessWhoActionEvent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $roomCode,
        public string $senderSession,
        public string $action,
        public mixed $payload
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel("guesswho.{$this->roomCode}")
        ];
    }

    public function broadcastAs(): string
    {
        return 'action';
    }
}
