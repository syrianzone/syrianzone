<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Support\Agents\TokenAbilities;

class MobileSessionTokens
{
    /** @return array<string, mixed> */
    public function issue(User $user, ?string $deviceName = null): array
    {
        $deviceName = trim((string) $deviceName) ?: 'mobile';
        $token = $user->createToken($deviceName, [TokenAbilities::MOBILE]);

        return [
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $token->accessToken->expires_at?->toIso8601String(),
            'user' => $user->toAuthPayload(),
        ];
    }
}
