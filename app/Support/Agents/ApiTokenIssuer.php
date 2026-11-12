<?php

namespace App\Support\Agents;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

/**
 * Translates the admin form state into a TokenIssuer call.
 *
 * Kept out of the controller so the "clamp to the owner's real permissions,
 * refuse the wildcard" sequence is testable without booting HTTP.
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

        // Only an account that is a superadmin or stores at least one grant can
        // pass the check below, so everyone else is left in the database. The
        // PHP predicate still decides; this only keeps it off the whole table.
        return User::query()
            ->where(fn ($q) => $q->where('role', 'superadmin')->orWhereJsonLength('permissions', '>', 0))
            ->get()
            ->filter(fn (User $user) => collect($capabilities)
                ->contains(fn (string $permission) => $user->hasPermission($permission)))
            ->sortBy('name')
            ->values();
    }

    /**
     * Translate the admin form state into a TokenIssuer call.
     *
     * @param  array<string, mixed>  $data  Raw form state: tokenable_id, name,
     *                                      ttl, and the flat abilities list the
     *                                      form submitted.
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
            abilities: array_values(is_array($data['abilities'] ?? null) ? $data['abilities'] : []),
            ttl: (string) ($data['ttl'] ?? TokenIssuer::DEFAULT_TTL),
        );

        return [...$issued, 'owner' => $owner];
    }
}
