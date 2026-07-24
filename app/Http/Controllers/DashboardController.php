<?php

namespace App\Http\Controllers;

use App\Models\Poll;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\AvatarService;
use App\Services\UserDeletionService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Render the unified user dashboard index page.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $data = [
            'role' => $user->role,
        ];

        // 1. All roles can view cities for submissions/management
        $citiesPath = resource_path('js/Pages/Transit/_data/cities.json');
        $cities = file_exists($citiesPath) ? json_decode(file_get_contents($citiesPath), true) : [];
        $data['cities'] = $cities;

        // 2. Normal Users see their own route submissions
        if ($user->role === 'user') {
            $data['myDrafts'] = RouteDraft::where('user_id', $user->id)
                ->with('city:id,name_ar,name_en')
                ->orderBy('created_at', 'desc')
                ->get();
        }

        // 3. Admins see Polls management data
        if ($user->role === 'admin' || $user->role === 'superadmin') {
            $data['polls'] = Poll::withCount('candidates')->get();
        }

        // 4. Admins and Transit Admins see all route drafts and published routes
        if ($user->role === 'admin' || $user->role === 'transit_admin' || $user->role === 'superadmin') {
            $data['allDrafts'] = RouteDraft::with(['user:id,name,email,is_banned', 'city:id,name_ar,name_en'])
                ->orderBy('created_at', 'desc')
                ->get();
            $data['publishedRoutes'] = Route::with('city:id,name_ar,name_en')->get();
        }

        return Inertia::render('Dashboard/Index', $data);
    }

    /**
     * Update user account details (name and email).
     */
    public function updateAccount(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,'.$user->id,
        ]);

        $user->update($data);

        return back()->with('success', 'تم تحديث الحساب بنجاح');
    }

    /**
     * Upload a new profile avatar, replacing any previously hosted one.
     */
    public function updateAvatar(Request $request, AvatarService $avatars)
    {
        $request->validate([
            'avatar' => [
                'bail',
                'required',
                'max:4096',
                function (string $attribute, mixed $value, callable $fail) use ($avatars) {
                    if ($value instanceof UploadedFile && $avatars->dimensionsExceedBudget($value)) {
                        $fail('أبعاد الصورة يجب أن تكون بين 64x64 و 6000x6000 بكسل');
                    }
                },
                'image',
                'mimes:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, callable $fail) use ($avatars) {
                    if (! $value instanceof UploadedFile || ! $avatars->dimensionsAreSafe($value)) {
                        $fail('أبعاد الصورة يجب أن تكون بين 64x64 و 6000x6000 بكسل');
                    }
                },
            ],
        ], [
            'avatar.required' => 'اختر صورة',
            'avatar.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 4 ميغابايت',
            'avatar.image' => 'الملف يجب أن يكون صورة',
            'avatar.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
            'avatar.max' => 'حجم الصورة يجب ألا يتجاوز 4 ميغابايت',
        ]);

        try {
            $url = $avatars->update($request->user(), $request->file('avatar'));
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر معالجة الصورة'], 422);
        }

        return response()->json(['avatar_url' => $url]);
    }

    /**
     * Soft delete user account and delegate owned polls/routes to superadmin.
     */
    public function deleteAccount(Request $request, UserDeletionService $deletion)
    {
        $user = $request->user();

        $deleted = $deletion->deleteAccountAndTransferOwnership($user);

        if (! $deleted) {
            return response()->json([
                'code' => 'last_superadmin',
                'message' => 'لا يمكن حذف آخر مشرف عام.',
            ], 409);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    /**
     * Ban or unban a user submitter (Admins/Transit Admins only).
     */
    public function toggleBan(Request $request, $id)
    {
        $actor = $request->user();
        if (! in_array($actor->role, ['admin', 'transit_admin', 'superadmin'], true)) {
            abort(403, 'Unauthorized.');
        }

        if ((string) $actor->id === (string) $id) {
            return response()->json([
                'code' => 'cannot_ban_self',
                'message' => 'You cannot change your own ban status.',
            ], 403);
        }

        $data = $request->validate([
            'is_banned' => ['sometimes', 'required', 'boolean'],
        ]);
        $result = DB::transaction(function () use ($actor, $data, $id): array {
            $target = User::query()->lockForUpdate()->findOrFail($id);

            if ($target->isSuperAdmin()) {
                return [
                    'code' => 'protected_superadmin',
                    'message' => 'Superadmin accounts cannot be banned here.',
                ];
            }
            if (! $this->canModerate($actor, $target)) {
                return [
                    'code' => 'insufficient_target_role',
                    'message' => 'You cannot change this account ban status.',
                ];
            }

            $isBanned = array_key_exists('is_banned', $data)
                ? (bool) $data['is_banned']
                : ! $target->is_banned;
            if ((bool) $target->is_banned !== $isBanned) {
                $target->forceFill(['is_banned' => $isBanned])->save();
            }
            if ($isBanned) {
                $target->tokens()->delete();
            }

            return ['target' => $target];
        });

        if (isset($result['code'])) {
            return response()->json($result, 403);
        }

        $target = $result['target'];

        return response()->json([
            'ok' => true,
            'is_banned' => (bool) $target->is_banned,
            'message' => $target->is_banned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم',
        ]);
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
}
