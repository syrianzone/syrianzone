<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * The authoritative slice of a Guess Who game the clients are allowed to see:
 * whose turn it is, the phase, the winner, and the last guess. Broadcast to the
 * whole room (not `toOthers`) so the player who acted stays in sync too.
 */
class GuessWhoStateEvent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $roomCode,
        public ?string $turn,
        public string $status,
        public ?string $winner,
        public ?array $guess = null
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel("guesswho.{$this->roomCode}")
        ];
    }

    public function broadcastAs(): string
    {
        return 'state';
    }

    public function broadcastWith(): array
    {
        return [
            'turn' => $this->turn,
            'status' => $this->status,
            'winner' => $this->winner,
            'guess' => $this->guess,
        ];
    }
}
