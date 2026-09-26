<?php

namespace App\Http\Controllers;

use App\Exceptions\Users\UserModerationException;
use App\Models\Poll;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\AvatarService;
use App\Services\Users\UserModerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Whether the user holds any capability in a module.
     *
     * Resolved from the permissions list rather than the role, so a grant made
     * per user is honoured. There is no polls_admin role, so role-gating this
     * is what made the polls capabilities unusable outside `admin`.
     */
    private function canModule(User $user, string $module): bool
    {
        foreach ($user->effectivePermissions() as $capability) {
            if (str_starts_with($capability, $module.'.')) {
                return true;
            }
        }

        return false;
    }

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

        // 3. Anyone holding a polls capability sees Polls management data.
        //
        // This was `role === 'admin' || role === 'superadmin'`, while the
        // dashboard's own tab is gated on capabilities
        // (canModule(perms, 'polls')). A user granted polls.create therefore
        // saw the tab, could create a poll, and was handed an empty list — the
        // capability was half-wired, because there is no polls_admin role and an
        // explicit grant to a `user` account is the only way to hold one.
        if ($this->canModule($user, 'polls')) {
            $data['polls'] = Poll::withCount('candidates')->get();
        }

        // 4. Transit reviewers see all route drafts and published routes.
        //
        // Same role-vs-capability split as above: the sidebar link is gated on
        // effective_permissions, so a user holding transit.review_drafts was
        // sent here and then given no data. The full drafts/route payloads are
        // only consumed by the transit admin page, which fetches its own
        // scoped data; sharing them here duplicated it without the governorate
        // scoping, so the condition is kept narrow to match.
        if ($user->hasPermission('transit.review_drafts')) {
            $data['allDrafts'] = RouteDraft::with(['user:id,name,email,is_banned', 'city:id,name_ar,name_en'])
                ->orderBy('created_at', 'desc')
                ->limit(500)
                ->get();
            $data['publishedRoutes'] = Route::with('city:id,name_ar,name_en')->limit(1000)->get();
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
        // dimensions reads the header only (getimagesize), so it cheaply blocks
        // decompression bombs before GD ever allocates width*height*4 bytes
        $request->validate([
            'avatar' => 'required|image|mimes:jpg,jpeg,png,webp|max:4096|dimensions:min_width=64,min_height=64,max_width=6000,max_height=6000',
        ], [
            'avatar.required' => 'اختر صورة',
            'avatar.uploaded' => 'تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز 4 ميغابايت',
            'avatar.image' => 'الملف يجب أن يكون صورة',
            'avatar.mimes' => 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP',
            'avatar.max' => 'حجم الصورة يجب ألا يتجاوز 4 ميغابايت',
            'avatar.dimensions' => 'أبعاد الصورة يجب أن تكون بين 64x64 و 6000x6000 بكسل',
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
    public function deleteAccount(Request $request, AvatarService $avatars)
    {
        $user = $request->user();

        // Locate first active superadmin to delegate data to
        $superadmin = User::where('role', 'superadmin')
            ->whereNull('deleted_at')
            ->first();

        if ($superadmin && $superadmin->id !== $user->id) {
            // Delegate polls
            Poll::where('user_id', $user->id)->update(['user_id' => $superadmin->id]);
            // Delegate routes
            Route::where('user_id', $user->id)->update(['user_id' => $superadmin->id]);
        }

        // Remove hosted avatars so R2 does not keep avatars/{id}/* forever.
        $avatars->deleteForUser($user);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $user->delete(); // Triggers soft delete

        return response()->json(['ok' => true]);
    }

    /**
     * Ban or unban a user submitter. Requires the `users.ban` capability,
     * enforced by the users_admin middleware on the route.
     */
    public function toggleBan(Request $request, $id, UserModerationService $moderation)
    {
        // Authorisation is the `users.ban` capability, enforced by the
        // users_admin middleware on the route. The role list that used to be
        // checked here is gone: a role cannot be granted to one person without
        // granting it to everyone who shares it, and it listed transit_admin,
        // which had no business reaching user moderation.
        //
        // The refusals themselves live in the service, shared with the agent
        // tool, so the dashboard and the MCP surface cannot diverge on who is
        // bannable.
        $userToBan = User::findOrFail($id);

        try {
            $userToBan = $moderation->toggleBanned($userToBan, $request->user());
        } catch (UserModerationException $e) {
            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        }

        return response()->json([
            'ok' => true,
            'is_banned' => $userToBan->is_banned,
            'message' => $userToBan->is_banned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم',
        ]);
    }
}
