<?php

namespace App\Support\Agents;

use App\Models\User;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Translates the ApiTokenResource form shape into a TokenIssuer call.
 *
 * Kept out of the Filament page so the "flatten grouped checkboxes, clamp to the
 * owner's real permissions, refuse the wildcard" sequence is testable without
 * booting a panel.
 */
final class ApiTokenIssuer
{
    public function __construct(private readonly TokenIssuer $tokens) {}

    /**
     * @param  array<string, mixed>  $data  Raw form state: tokenable_id, name,
     *                                      ttl, and perm_<module> arrays.
     * @return array{token: NewAccessToken, abilities: array<int, string>, dropped: array<int, string>, owner: User}
     */
    public function issueFromFormData(array $data): array
    {
        $owner = User::find($data['tokenable_id'] ?? null);

        if (! $owner instanceof User) {
            throw ValidationException::withMessages([
                'tokenable_id' => 'اختر مستخدماً صالحاً.',
            ]);
        }

        if ($owner->is_banned) {
            throw ValidationException::withMessages([
                'tokenable_id' => 'لا يمكن إصدار رمز لمستخدم محظور.',
            ]);
        }

        $name = trim((string) ($data['name'] ?? ''));

        if ($name === '') {
            throw ValidationException::withMessages([
                'name' => 'أعطِ الرمز اسماً يوضّح أين سيُستخدم.',
            ]);
        }

        $issued = $this->tokens->issue(
            owner: $owner,
            name: $name,
            abilities: $this->collectAbilities($data),
            ttl: (string) ($data['ttl'] ?? TokenIssuer::DEFAULT_TTL),
        );

        return [...$issued, 'owner' => $owner];
    }

    /**
     * Flatten the grouped checkbox state into a flat ability list.
     *
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    public function collectAbilities(array $data): array
    {
        $abilities = [];

        foreach ($data as $key => $value) {
            if (is_string($key) && str_starts_with($key, 'perm_') && is_array($value)) {
                $abilities = [...$abilities, ...array_values($value)];
            }
        }

        return $abilities;
    }
}
