<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GuessWhoSignalingEvent implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $roomCode,
        public string $targetSession,
        public string $senderSession,
        public string $type, // offer | answer | candidate
        public mixed $data
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel("guesswho.{$this->roomCode}")
        ];
    }

    public function broadcastAs(): string
    {
        return 'signal';
    }
}
