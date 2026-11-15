<?php

namespace App\Services\Users;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use App\Support\Permissions\UserPermissionForm;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserAdministrationService
{
    public function __construct(private readonly UserModerationService $moderation) {}

    public static function allows(?User $actor): bool
    {
        return $actor !== null && ! $actor->trashed() && $actor->isSuperAdmin() && ! $actor->is_banned;
    }

    public function version(User $user): string
    {
        return hash('sha256', json_encode([
            $user->id, $user->name, $user->email, $user->role, (bool) $user->is_banned,
            $user->permissions, $user->permission_scopes, $user->getRawOriginal('password'),
            $user->deleted_at?->toISOString(), $user->updated_at?->toISOString(),
        ], JSON_THROW_ON_ERROR));
    }

    public function present(User $user, int $actorId): array
    {
        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role,
            'is_banned' => (bool) $user->is_banned, 'permissions' => array_values($user->permissions ?? []),
            'effective_permissions' => $user->effectivePermissions(), 'permission_scopes' => (object) ($user->permission_scopes ?? []),
            'stored_transit_scope' => array_values($user->permission_scopes['transit'] ?? []),
            'transit_scope' => $user->allowedTransitCities(), 'created_at' => $user->created_at?->toISOString(),
            'deleted_at' => $user->deleted_at?->toISOString(), 'version' => $this->version($user),
            'is_self' => $user->id === $actorId,
            'actions' => ['edit' => true, 'delete' => ! $user->trashed(), 'restore' => $user->trashed(),
                'force_delete' => $user->trashed(), 'change_ban' => ! $user->isSuperAdmin()],
        ];
    }

    public function create(User $actor, array $data): User
    {
        return $this->locked($actor, [], function () use ($data) {
            abort_if($data['role'] === 'superadmin' && $data['is_banned'], 403, 'لا يمكن حظر مدير عام.');

            return User::create($this->formData($data));
        });
    }

    public function update(User $actor, int $id, array $data): User
    {
        return $this->locked($actor, [$id], function (User $freshActor, Collection $users) use ($id, $data) {
            $user = $users->get($id);
            $this->checkVersion($user, $data['version']);
            $attributes = $this->formData($data, $user);
            $banned = $attributes['is_banned'];
            unset($attributes['is_banned']);
            if ((bool) $user->is_banned !== $banned) {
                $this->moderation->setBanned($user, $banned, $freshActor);
            }
            abort_if($attributes['role'] === 'superadmin' && $banned, 403, 'لا يمكن حظر مدير عام.');
            $user->fill($attributes)->save();

            return $user->fresh();
        });
    }

    public function mutate(User $actor, array $ids, array $versions, string $action, bool $bulk = false): array
    {
        return $this->locked($actor, $ids, function (User $freshActor, Collection $users) use ($ids, $versions, $action, $bulk) {
            foreach ($ids as $id) {
                $user = $users->get($id);
                $this->checkVersion($user, $versions[$id] ?? '');
                if (! $bulk) {
                    abort_if($action === 'delete' && $user->trashed() || $action !== 'delete' && ! $user->trashed(), 422, 'تغيّرت حالة المستخدم. أعد قراءة السجل أولاً.');
                }
            }
            foreach ($ids as $id) {
                $user = $users->get($id);
                match ($action) {
                    'delete' => $user->delete(),
                    'restore' => $user->restore(),
                    'force-delete' => $user->forceDelete(),
                };
            }

            return $ids;
        });
    }

    private function checkVersion(User $user, string $version): void
    {
        abort_unless(hash_equals($this->version($user), $version), 409, 'تغيّر سجل المستخدم منذ فتحه. أعد قراءته قبل الحفظ.');
    }

    private function formData(array $data, ?User $existing = null): array
    {
        $grouped = [];
        foreach (PermissionCatalogue::groups() as $group => $permissions) {
            $grouped['perm_'.$group] = array_values(array_intersect(array_keys($permissions), $data['permissions']));
        }
        $grouped['permissions'] = $existing?->permissions ?? [];
        $grouped['transit_scope'] = $data['transit_scope'];
        $merged = UserPermissionForm::mergePermissionFormData($grouped, $existing?->permission_scopes ?? []);
        $result = array_intersect_key($data, array_flip(['name', 'email', 'role', 'is_banned']));
        $result['permissions'] = $merged['permissions'];
        $result['permission_scopes'] = $merged['permission_scopes'];
        if (filled($data['password'] ?? null)) {
            $result['password'] = Hash::make($data['password']);
        }

        return $result;
    }

    private function locked(User $actor, array $ids, Closure $action): mixed
    {
        return DB::transaction(function () use ($actor, $ids, $action) {
            $users = User::withTrashed()->whereIn('id', array_unique([$actor->id, ...$ids]))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $freshActor = $users->get($actor->id);
            abort_unless(self::allows($freshActor), 403, 'لا تملك صلاحية إدارة المستخدمين.');
            foreach ($ids as $id) {
                abort_unless($users->has($id), 404);
            }

            return $action($freshActor, $users);
        });
    }
}
