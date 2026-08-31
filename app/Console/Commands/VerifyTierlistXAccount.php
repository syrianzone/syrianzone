<?php

namespace App\Console\Commands;

use App\Exceptions\XApiException;
use App\Services\XApiClient;
use Illuminate\Console\Command;

class VerifyTierlistXAccount extends Command
{
    protected $signature = 'tierlist:x-status';

    protected $description = 'Verify the configured X account without publishing a post';

    public function handle(XApiClient $client): int
    {
        if (! $client->hasCredentials()) {
            $this->error('X credentials are incomplete.');

            return self::FAILURE;
        }

        try {
            $userId = $client->verifyExpectedUser();
        } catch (XApiException $exception) {
            $this->error($exception->getMessage().'.');

            return self::FAILURE;
        }

        $this->info("X credentials verified for user {$userId}.");

        return self::SUCCESS;
    }
}
