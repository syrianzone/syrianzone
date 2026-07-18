<?php

namespace App\Events;

use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GuessWhoSignalingEvent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $roomCode,
        public string $targetSession,
        public string $senderSession,
        public string $type, // offer | answer | candidate
        public mixed $data,
        public int $generation = 0,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PresenceChannel("guesswho.{$this->roomCode}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'signal';
    }

    public function broadcastWith(): array
    {
        return [
            'data' => $this->data,
            'generation' => $this->generation,
            'sender_session' => $this->senderSession,
            'senderSession' => $this->senderSession,
            'target_session' => $this->targetSession,
            'targetSession' => $this->targetSession,
            'type' => $this->type,
        ];
    }
}
