<?php

namespace App\Support\Agents;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Translates the admin form shape into a TokenIssuer call.
 *
 * Kept out of the controller and the page so the "flatten grouped checkboxes,
 * clamp to the owner's real permissions, refuse the wildcard" sequence is
 * testable without booting HTTP or a panel.
 */
final class ApiTokenIssuer
{
    public function __construct(private readonly TokenIssuer $tokens) {}

    /**
     * The users a token may be issued to: anyone who actually holds at least one
     * capability.
     *
     * Evaluated in PHP rather than SQL because "holds a capability" is a domain
     * predicate — role-implied prefixes, the '*' wildcard and the JSON array all
     * feed it — and expressing that in SQL would mean dialect-specific JSON
     * functions for no benefit on an admin-sized population.
     *
     * @return Collection<int, User>
     */
    public function eligibleOwners(): Collection
    {
        $capabilities = PermissionCatalogue::all();

        return User::query()
            ->get()
            ->filter(fn (User $user) => collect($capabilities)
                ->contains(fn (string $permission) => $user->hasPermission($permission)))
            ->sortBy('name')
            ->values();
    }

    /**
     * Translate the Filament form shape into a TokenIssuer call.
     *
     * Kept out of the Filament page so the "flatten grouped checkboxes, clamp to
     * the owner's real permissions, refuse the wildcard" sequence is testable
     * without booting a panel.
     *
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
