<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserDeletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (User $user): array => $this->userData($user))
            ->values();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $email = $request->input('email');
        $name = $request->input('name');
        $request->merge([
            'email' => is_string($email) ? mb_strtolower(trim($email)) : $email,
            'name' => is_string($name) ? trim($name) : $name,
        ]);
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique(User::class, 'email')],
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(['user', 'admin', 'transit_admin'])],
        ]);

        $user = User::create([
            'email' => $data['email'],
            'name' => $data['name'],
            'password' => Str::random(40),
            'role' => $data['role'],
        ]);

        return response()->json(['data' => $this->userData($user)], 201);
    }

    public function destroy(User $user, UserDeletionService $deletion): JsonResponse
    {
        if (! $deletion->deleteAccountAndTransferOwnership($user)) {
            return response()->json([
                'code' => 'protected_superadmin',
                'message' => 'The final active superadmin cannot be deleted.',
            ], 403);
        }

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function toggleBan(Request $request, User $user): JsonResponse
    {
        if ($request->user()->is($user)) {
            return response()->json([
                'code' => 'cannot_ban_self',
                'message' => 'You cannot change your own ban status.',
            ], 403);
        }

        $data = $request->validate([
            'is_banned' => ['sometimes', 'required', 'boolean'],
        ]);
        $result = DB::transaction(function () use ($data, $request, $user): array {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);

            if ($lockedUser->isSuperAdmin()) {
                return [
                    'code' => 'protected_superadmin',
                    'message' => 'Superadmin accounts cannot be banned here.',
                ];
            }
            if (! $this->canModerate($request->user(), $lockedUser)) {
                return [
                    'code' => 'insufficient_target_role',
                    'message' => 'You cannot change this account ban status.',
                ];
            }

            $isBanned = array_key_exists('is_banned', $data)
              ? (bool) $data['is_banned']
              : ! $lockedUser->is_banned;

            if ((bool) $lockedUser->is_banned !== $isBanned) {
                $lockedUser->forceFill(['is_banned' => $isBanned])->save();
            }
            if ($isBanned) {
                $lockedUser->tokens()->delete();
            }

            return ['user' => $this->moderationData($lockedUser)];
        });

        if (isset($result['code'])) {
            return response()->json($result, 403);
        }

        return response()->json(['data' => $result]);
    }

    private function canModerate(User $actor, User $target): bool
    {
        $targetRoles = match ($actor->role) {
            'superadmin' => ['admin', 'transit_admin', 'user'],
            'admin' => ['transit_admin', 'user'],
            'transit_admin' => ['user'],
            default => [],
        };

        return in_array($target->role, $targetRoles, true);
    }

    private function moderationData(User $user): array
    {
        return [
            'id' => $user->id,
            'is_banned' => (bool) $user->is_banned,
            'name' => $user->name,
        ];
    }

    private function userData(User $user): array
    {
        return [
            'avatar_url' => $user->avatar_url,
            'created_at' => $user->created_at?->toIso8601String(),
            'email' => $user->email,
            'id' => $user->id,
            'is_banned' => (bool) $user->is_banned,
            'name' => $user->name,
            'role' => $user->role,
        ];
    }
}
