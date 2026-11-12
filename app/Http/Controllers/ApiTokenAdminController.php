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
 * Two modes, chosen by who is asking (the `agent_tokens` middleware decides
 * who may ask at all):
 *
 *  - A superadmin manages everyone's tokens, as before.
 *  - Any other capability holder manages only their own: the page lists their
 *    tokens, offers only the capabilities they hold, and every write is pinned
 *    to them. That is safe because a token is a ceiling, never a grant —
 *    TokenIssuer clamps it to the owner's live permissions.
 *
 * All the actual rules live in ApiTokenIssuer / TokenIssuer; this class only
 * validates shape, maps refusals to responses, and shapes the list.
 */
class ApiTokenAdminController extends Controller
{
    public function renderIndex(Request $request)
    {
        $actor = $request->user();
        $selfService = ! $actor->isSuperAdmin();

        $owners = $selfService
            ? collect([$actor])
            : app(ApiTokenIssuer::class)->eligibleOwners();

        return inertia('Admin/ApiTokens/Index', [
            'selfService' => $selfService,
            'tokens' => $this->listTokens($selfService ? $actor : null),
            'owners' => $owners
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ])->values(),
            'capabilityGroups' => PermissionCatalogue::groupMeta(),
            // A self-service user is only offered what they hold, so the form
            // never suggests a capability the issuer would drop.
            'capabilities' => $selfService
                ? $this->heldCapabilities($actor)
                : PermissionCatalogue::groups(),
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
        $actor = $request->user();

        $validated = $request->validate([
            // A self-service user can only mint for themselves, so the owner
            // defaults to them and any other id is refused below.
            'user_id' => [$actor->isSuperAdmin() ? 'required' : 'nullable', 'integer', Rule::exists('users', 'id')],
            'name' => 'required|string|max:255',
            'ttl' => ['required', Rule::in(array_keys(TokenIssuer::TTL_OPTIONS))],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => [Rule::in(PermissionCatalogue::all())],
        ]);

        if (! $actor->isSuperAdmin()
            && isset($validated['user_id'])
            && (int) $validated['user_id'] !== $actor->id) {
            return response()->json(['message' => 'يمكنك إصدار رموز لحسابك فقط.'], 403);
        }

        $owner = $actor->isSuperAdmin()
            ? User::findOrFail($validated['user_id'])
            : $actor;

        try {
            $issued = app(ApiTokenIssuer::class)->issueFromFormData([
                'tokenable_id' => $owner->id,
                'name' => $validated['name'],
                'ttl' => $validated['ttl'],
                'abilities' => $validated['permissions'],
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

    public function destroy(Request $request, int $id)
    {
        $actor = $request->user();

        $token = PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            // Someone else's token is a 404, not a 403, so ids cannot be probed.
            ->when(! $actor->isSuperAdmin(), fn ($q) => $q->where('tokenable_id', $actor->id))
            ->findOrFail($id);

        // This page manages agent tokens. A mobile app session is not listed
        // here, so it is not revocable from here either (except by superadmins).
        if (! $actor->isSuperAdmin() && $token->abilities === ['mobile']) {
            abort(404);
        }

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
    private function listTokens(?User $owner = null)
    {
        return PersonalAccessToken::query()
            ->where('tokenable_type', User::class)
            ->when($owner, fn ($q) => $q->where('tokenable_id', $owner->id))
            ->with('tokenable:id,name,role,is_banned')
            ->latest('id')
            ->limit(200)
            ->get()
            ->reject(fn (PersonalAccessToken $token) => $token->abilities === ['mobile'])
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

    /**
     * The catalogue narrowed to what $user holds, in the same grouped shape as
     * PermissionCatalogue::groups(). Groups the user holds nothing in are left
     * out.
     *
     * @return array<string, array<string, string>>
     */
    private function heldCapabilities(User $user): array
    {
        $held = $user->effectivePermissions();

        return collect(PermissionCatalogue::groups())
            ->map(fn (array $permissions) => array_filter(
                $permissions,
                fn (string $permission) => in_array($permission, $held, true),
                ARRAY_FILTER_USE_KEY,
            ))
            ->filter(fn (array $permissions) => $permissions !== [])
            ->all();
    }
}
