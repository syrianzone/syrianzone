<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Agents\ApiTokenIssuer;
use App\Support\Agents\InvalidTokenAbilities;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * HTTP adapter for agent API tokens, for the Inertia dashboard.
 *
 * Lives beside the other /admin/* sections rather than in Filament, so token
 * management sits with the rest of the admin UI. The Filament resource that used
 * to own this was removed: two UIs for one job drift, and this is the one people
 * actually visit.
 *
 * Superadmin-only, matching the access control the Filament panel applied
 * (User::canAccessPanel()). Minting a token is privilege-granting, so it does
 * not go to module admins. Routes are wrapped in the `superadmin` middleware.
 *
 * All the actual rules live in ApiTokenIssuer / TokenIssuer; this class only
 * validates shape, maps refusals to responses, and shapes the list.
 */
class ApiTokenAdminController extends Controller
{
    public function renderIndex()
    {
        return inertia('Admin/ApiTokens/Index', [
            'tokens' => $this->listTokens(),
            'owners' => app(ApiTokenIssuer::class)->eligibleOwners()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ])->values(),
            'capabilityGroups' => PermissionCatalogue::groupMeta(),
            'capabilities' => PermissionCatalogue::groups(),
            'ttlOptions' => collect(TokenIssuer::TTL_OPTIONS)
                ->map(fn (int $days) => ['value' => $days.'d', 'label' => $days === 1 ? 'يوم واحد' : $days.' يوم'])
                ->values(),
            'endpoint' => url('/mcp/admin'),
        ]);
    }

    /**
     * Mint a token and hand the plaintext back exactly once.
     *
     * The response is JSON rather than a redirect because the plaintext cannot
     * be re-derived: only its hash is stored, so a redirect-and-reload would
     * lose it. The page shows it in a copyable block and never asks again.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'name' => 'required|string|max:255',
            'ttl' => ['required', Rule::in(array_keys(TokenIssuer::TTL_OPTIONS))],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => [Rule::in(PermissionCatalogue::all())],
        ]);

        $owner = User::findOrFail($validated['user_id']);

        try {
            $issued = app(ApiTokenIssuer::class)->issueFromFormData([
                'tokenable_id' => $owner->id,
                'name' => $validated['name'],
                'ttl' => $validated['ttl'],
                ...collect(PermissionCatalogue::groupMeta())
                    ->mapWithKeys(fn (array $meta, string $group) => [
                        'perm_'.$group => array_values(array_filter(
                            $validated['permissions'],
                            fn (string $permission) => str_starts_with($permission, $group.'.'),
                        )),
                    ])
                    ->all(),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->errors()[array_key_first($e->errors())][0] ?? 'تعذّر إصدار الرمز'], 422);
        } catch (InvalidTokenAbilities $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if ($issued['abilities'] === []) {
            // The owner holds none of the requested capabilities, so the token
            // would be inert. Refuse rather than mint a credential that cannot
            // do anything and looks like it works.
            $issued['token']->accessToken->delete();

            return response()->json([
                'message' => 'المستخدم المحدد لا يملك أياً من هذه الصلاحيات، لم يُنشأ رمز.',
            ], 422);
        }

        return response()->json([
            'plain_text_token' => $issued['token']->plainTextToken,
            'abilities' => $issued['abilities'],
            'dropped' => $issued['dropped'],
            'expires_at' => $issued['token']->accessToken->expires_at?->toIso8601String(),
            'message' => $issued['dropped'] === []
                ? 'تم إنشاء الرمز. انسخه الآن — لن يظهر مرة أخرى.'
                : 'تم إنشاء الرمز. تم تجاهل: '.implode('، ', $issued['dropped']).' (لا يملكها المستخدم).',
        ], 201);
    }

    public function destroy(int $id)
    {
        $token = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->findOrFail($id);

        $name = $token->name;
        $token->delete();

        return response()->json(['message' => "تم إبطال الرمز «{$name}»"]);
    }

    /**
     * Revoke every token belonging to one user. The right move on a suspected
     * leak, since a leaked token is usually not the only one.
     */
    public function revokeAllForUser(int $userId)
    {
        $user = User::findOrFail($userId);

        $count = app(TokenIssuer::class)->revokeAllFor($user);

        return response()->json(['message' => "تم إبطال {$count} رمز"]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function listTokens()
    {
        return PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->with('tokenable:id,name,role,is_banned')
            ->latest('id')
            ->limit(200)
            ->get()
            ->map(fn (PersonalAccessToken $token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'owner' => $token->tokenable ? [
                    'id' => $token->tokenable->id,
                    'name' => $token->tokenable->name,
                    'role' => $token->tokenable->role,
                ] : null,
                'owner_banned' => (bool) $token->tokenable?->is_banned,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'expires_at' => $token->expires_at?->toIso8601String(),
                'is_expired' => $token->expires_at !== null && $token->expires_at->isPast(),
                'created_at' => $token->created_at?->toIso8601String(),
            ])
            ->values();
    }
}
