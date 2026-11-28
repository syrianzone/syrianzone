<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\Users\UserModerationException;
use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\User;
use App\Services\Users\UserModerationService;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UsersAdminController extends Controller
{
    private const ALLOWED_ROLES = ['superadmin', 'user'];

    private const ALLOWED_STATUSES = ['all', 'active', 'banned', 'trashed'];

    /**
     * Role options and their Arabic labels (mirrors UserResource::roleOptions).
     *
     * @return array<string, string>
     */
    public static function roleOptions(): array
    {
        return [
            'superadmin' => 'مدير عام (وصول كامل غير مقيد)',
            'user' => 'مستخدم عادي',
        ];
    }

    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $role = (string) $request->query('role', 'all');
        $status = (string) $request->query('status', 'all');

        if (! in_array($role, ['all', ...self::ALLOWED_ROLES], true)) {
            $role = 'all';
        }

        if (! in_array($status, self::ALLOWED_STATUSES, true)) {
            $status = 'all';
        }

        $query = match ($status) {
            'trashed' => User::onlyTrashed(),
            'active' => User::query()->where('is_banned', false),
            'banned' => User::query()->where('is_banned', true),
            default => User::withTrashed(),
        };

        if ($role !== 'all') {
            $query->where('role', $role);
        }

        if ($q !== '') {
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($sub) use ($like) {
                $sub->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            });
        }

        $users = $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (User $user): array => $this->serializeUser($user));

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'filters' => [
                'q' => $q,
                'role' => $role,
                'status' => $status,
            ],
            'permissionGroups' => PermissionCatalogue::groups(),
            'permissionGroupMeta' => PermissionCatalogue::groupMeta(),
            'cities' => City::query()->orderBy('name_ar')->get(['id', 'name_ar']),
            'roleOptions' => self::roleOptions(),
            'canManageUsers' => (bool) $request->user()?->isSuperAdmin(),
            'canBanUsers' => true,
        ]);
    }

    public function store(Request $request, UserModerationService $moderation): JsonResponse
    {
        $data = $request->validate($this->rules(isUpdate: false));

        $wantsBanned = (bool) ($data['is_banned'] ?? false);
        if ($data['role'] === 'superadmin' && $wantsBanned) {
            throw UserModerationException::targetIsSuperadmin($data['name']);
        }

        $permissions = $this->mergePermissions($data['permissions'] ?? [], []);
        $permissionScopes = $this->mergePermissionScopes($data['transit_scope'] ?? [], []);

        $user = DB::transaction(function () use ($data, $permissions, $permissionScopes, $wantsBanned, $moderation, $request): User {
            $created = User::create([
                'name' => trim($data['name']),
                'email' => trim($data['email']),
                'password' => Hash::make($data['password']),
                'role' => $data['role'],
                'is_banned' => false,
                'permissions' => $permissions,
                'permission_scopes' => $permissionScopes,
            ]);

            if ($wantsBanned) {
                $moderation->setBanned($created, true, $request->user());
            }

            return $created->fresh();
        });

        return response()->json([
            'ok' => true,
            'user' => $this->serializeUser($user),
            'message' => 'تم إنشاء المستخدم بنجاح',
        ], 201);
    }

    public function update(Request $request, int $id, UserModerationService $moderation): JsonResponse
    {
        $user = User::withTrashed()->findOrFail($id);
        $data = $request->validate($this->rules($user, isUpdate: true));

        if ($user->isSuperAdmin() && $data['role'] !== 'superadmin' && ! $this->hasOtherSuperAdmin($user)) {
            return response()->json([
                'ok' => false,
                'message' => 'لا يمكن تغيير دور آخر مدير عام في النظام',
            ], 422);
        }

        $hasBanChange = array_key_exists('is_banned', $data);
        $targetBanned = $hasBanChange ? (bool) $data['is_banned'] : (bool) $user->is_banned;

        if ($data['role'] === 'superadmin' && $targetBanned) {
            throw UserModerationException::targetIsSuperadmin($data['name']);
        }

        $updated = DB::transaction(function () use ($user, $data, $hasBanChange, $targetBanned, $moderation, $request): User {
            $user->name = trim($data['name']);
            $user->email = trim($data['email']);
            $user->role = $data['role'];

            if (filled($data['password'] ?? null)) {
                $user->password = Hash::make($data['password']);
            }

            if (array_key_exists('permissions', $data)) {
                $user->permissions = $this->mergePermissions(
                    is_array($data['permissions']) ? $data['permissions'] : [],
                    is_array($user->permissions) ? $user->permissions : [],
                );
            }

            if (array_key_exists('transit_scope', $data)) {
                $user->permission_scopes = $this->mergePermissionScopes(
                    is_array($data['transit_scope']) ? $data['transit_scope'] : [],
                    is_array($user->permission_scopes) ? $user->permission_scopes : [],
                );
            }

            $user->save();

            // Enforce ban changes through UserModerationService so superadmin/self-ban
            // refusals and session/token revocation match every other surface.
            if ($hasBanChange && $targetBanned !== (bool) $user->is_banned) {
                $moderation->setBanned($user, $targetBanned, $request->user());
            }

            return $user->fresh();
        });

        return response()->json([
            'ok' => true,
            'user' => $this->serializeUser($updated),
            'message' => 'تم تحديث بيانات المستخدم بنجاح',
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($request->user()?->is($user)) {
            return response()->json([
                'ok' => false,
                'message' => 'لا يمكنك حذف حسابك الخاص',
            ], 422);
        }

        if ($user->isSuperAdmin() && ! $this->hasOtherSuperAdmin($user)) {
            return response()->json([
                'ok' => false,
                'message' => 'لا يمكن حذف آخر مدير عام في النظام',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'ok' => true,
            'message' => 'تم حذف المستخدم بنجاح',
        ]);
    }

    public function restore(int $id): JsonResponse
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();

        return response()->json([
            'ok' => true,
            'user' => $this->serializeUser($user->fresh()),
            'message' => 'تم استعادة المستخدم بنجاح',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?User $user = null, bool $isUpdate = false): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'password' => $isUpdate
                ? ['nullable', 'string', 'min:8', 'max:255']
                : ['required', 'string', 'min:8', 'max:255'],
            'role' => ['required', 'string', Rule::in(self::ALLOWED_ROLES)],
            'is_banned' => ['sometimes', 'boolean'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string'],
            'transit_scope' => ['sometimes', 'array'],
            'transit_scope.*' => ['string', 'exists:cities,id'],
        ];
    }

    /**
     * Merge selected known capabilities with any unknown capabilities already
     * stored on the user (such as '*' or future module capabilities), matching
     * UserResource::mergePermissionFormData().
     *
     * @param  array<int, mixed>  $submitted
     * @param  array<int, mixed>  $existing
     * @return array<int, string>
     */
    private function mergePermissions(array $submitted, array $existing): array
    {
        $known = PermissionCatalogue::all();

        $selected = array_values(array_filter(
            $known,
            fn (string $capability): bool => in_array($capability, $submitted, true),
        ));

        $existingStrings = array_values(array_filter(
            $existing,
            fn ($item): bool => is_string($item) && $item !== '',
        ));

        $unknown = array_values(array_diff($existingStrings, $known));

        return array_values(array_unique(array_merge($selected, $unknown)));
    }

    /**
     * Merge submitted transit city scopes into permission_scopes while keeping
     * any non-transit module scopes intact, matching UserResource::mergePermissionFormData().
     *
     * @param  array<int, mixed>  $transitScope
     * @param  array<string, mixed>  $existingScopes
     * @return array<string, array<int, string>>|null
     */
    private function mergePermissionScopes(array $transitScope, array $existingScopes): ?array
    {
        $cleanCities = array_values(array_unique(array_filter(
            array_map(fn ($city): string => is_string($city) ? trim($city) : '', $transitScope),
            fn (string $city): bool => $city !== '',
        )));

        if ($cleanCities !== []) {
            $existingScopes['transit'] = $cleanCities;
        } else {
            unset($existingScopes['transit']);
        }

        return $existingScopes === [] ? null : $existingScopes;
    }

    private function hasOtherSuperAdmin(User $excluding): bool
    {
        return User::query()
            ->where('role', 'superadmin')
            ->where('id', '!=', $excluding->id)
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        $scopes = is_array($user->permission_scopes) ? $user->permission_scopes : [];
        $transitScope = is_array($scopes['transit'] ?? null)
            ? array_values(array_filter($scopes['transit'], fn ($city): bool => is_string($city) && $city !== ''))
            : [];

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'is_banned' => (bool) $user->is_banned,
            'avatar_url' => $user->avatar_url,
            'permissions' => is_array($user->permissions) ? array_values($user->permissions) : [],
            'effective_permissions' => $user->effectivePermissions(),
            'permission_scopes' => $user->permission_scopes,
            'transit_scope' => $transitScope,
            'created_at' => $user->created_at?->toIso8601String(),
            'deleted_at' => $user->deleted_at?->toIso8601String(),
        ];
    }
}
