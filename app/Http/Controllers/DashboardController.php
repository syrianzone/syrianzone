<?php

namespace App\Http\Controllers;

use App\Models\CompassResult;
use App\Models\DirectorySuggestion;
use App\Models\Place;
use App\Models\PlaceSave;
use App\Models\Poll;
use App\Models\QuranBookmark;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\Admin\IncomingSuggestionsOverviewService;
use App\Services\AvatarService;
use App\Services\Users\UserModerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Draft columns the dashboard lists. `geojson` (the full drawn route, often
     * the bulk of the row) is left out: the dashboard never reads it, and the
     * transit admin page and the studio fetch it themselves when a draft is
     * opened.
     */
    private const DRAFT_LIST_COLUMNS = [
        'id', 'user_id', 'city_id', 'route_id', 'name_ar', 'name_en', 'price', 'notes',
        'status', 'rejection_reason', 'color_index', 'created_at', 'updated_at',
    ];

    private const HUB_LIST_LIMIT = 30;

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

    public function index(Request $request, IncomingSuggestionsOverviewService $incomingSuggestions)
    {
        $user = $request->user();
        $hasAdminAccess = $user->isSuperAdmin() || $user->effectivePermissions() !== [];

        $data = [
            'role' => $user->role,
            'hasAdminAccess' => $hasAdminAccess,
            'incomingSuggestionsCount' => $incomingSuggestions->canAccess($user)
                ? $incomingSuggestions->totalPendingCountFor($user)
                : 0,
            // Studio submissions are open to every account (the endpoint takes
            // anonymous drafts too), so the rule is "not banned", not a role.
            'canSubmitTransit' => ! $user->is_banned,
            // The account's own drafts, whoever it is.
            'myDrafts' => RouteDraft::where('user_id', $user->id)
                ->select(self::DRAFT_LIST_COLUMNS)
                ->with('city:id,name_ar,name_en')
                ->orderBy('created_at', 'desc')
                ->limit(self::HUB_LIST_LIMIT)
                ->get(),
            'myPlaces' => Schema::hasTable('places')
                ? Place::where('user_id', $user->id)
                    ->select(['id', 'name', 'category', 'status', 'rejection_reason', 'created_at'])
                    ->orderBy('created_at', 'desc')
                    ->limit(self::HUB_LIST_LIMIT)
                    ->get()
                    ->map(fn (Place $place) => [
                        'id' => $place->id,
                        'name' => $place->name,
                        'category' => $place->category,
                        'status' => $place->status,
                        'rejection_reason' => $place->rejection_reason,
                        'public_path' => $place->status === 'approved' ? $place->publicPath() : null,
                        'created_at' => $place->created_at?->toIso8601String(),
                    ])
                    ->values()
                : [],
            'mySuggestions' => Schema::hasTable('directory_suggestions')
                ? DirectorySuggestion::where('user_id', $user->id)
                    ->select(['id', 'module', 'kind', 'target_label', 'title', 'status', 'resolution_note', 'created_at'])
                    ->orderBy('created_at', 'desc')
                    ->limit(self::HUB_LIST_LIMIT)
                    ->get()
                    ->map(fn (DirectorySuggestion $suggestion) => [
                        'id' => $suggestion->id,
                        'module' => $suggestion->module,
                        'kind' => $suggestion->kind,
                        'target_label' => $suggestion->target_label,
                        'title' => $suggestion->title,
                        'status' => $suggestion->status,
                        'resolution_note' => $suggestion->resolution_note,
                        'created_at' => $suggestion->created_at?->toIso8601String(),
                    ])
                    ->values()
                : [],
            'savedPlaces' => Schema::hasTable('place_saves') && Schema::hasTable('places')
                ? PlaceSave::where('user_id', $user->id)
                    ->select(['id', 'place_id', 'created_at'])
                    ->with('place:id,name,category,status')
                    ->orderBy('created_at', 'desc')
                    ->limit(self::HUB_LIST_LIMIT)
                    ->get()
                    ->filter(fn (PlaceSave $save) => $save->place !== null)
                    ->map(fn (PlaceSave $save) => [
                        'id' => $save->id,
                        'place_id' => $save->place_id,
                        'created_at' => $save->created_at?->toIso8601String(),
                        'place' => [
                            'id' => $save->place->id,
                            'name' => $save->place->name,
                            'category' => $save->place->category,
                            'status' => $save->place->status,
                            'public_path' => $save->place->publicPath(),
                        ],
                    ])
                    ->values()
                : [],
            'quranBookmarks' => Schema::hasTable('quran_bookmarks')
                ? QuranBookmark::where('user_id', $user->id)
                    ->select(['id', 'surah', 'ayah', 'page', 'juz', 'created_at'])
                    ->orderBy('created_at', 'desc')
                    ->limit(self::HUB_LIST_LIMIT)
                    ->get()
                    ->map(fn (QuranBookmark $bookmark) => [
                        'id' => $bookmark->id,
                        'surah' => $bookmark->surah,
                        'ayah' => $bookmark->ayah,
                        'page' => $bookmark->page,
                        'juz' => $bookmark->juz,
                        'created_at' => $bookmark->created_at?->toIso8601String(),
                    ])
                    ->values()
                : [],
            'compassResults' => Schema::hasTable('compass_results')
                ? CompassResult::where('user_id', $user->id)
                    ->select(['id', 'share_id', 'top_figure', 'top_score', 'spectrum', 'answered', 'created_at'])
                    ->orderBy('created_at', 'desc')
                    ->limit(self::HUB_LIST_LIMIT)
                    ->get()
                    ->map(fn (CompassResult $result) => [
                        'id' => $result->id,
                        'share_id' => $result->share_id,
                        'top_figure' => $result->top_figure,
                        'top_score' => $result->top_score,
                        'spectrum' => $result->spectrum,
                        'answered' => $result->answered,
                        'created_at' => $result->created_at?->toIso8601String(),
                    ])
                    ->values()
                : [],
        ];

        // Anyone holding a polls capability keeps receiving Polls management data
        // so existing Inertia prop expectations remain satisfied.
        if ($this->canModule($user, 'polls')) {
            $data['polls'] = Poll::withCount('candidates')->get();
        }

        // Transit reviewers get no drafts or routes here: reviewing happens on
        // the transit admin page, which fetches its own, governorate-scoped
        // data.

        return Inertia::render('Dashboard/Index', $data);
    }

    public function updateAccount(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            // Google OAuth is the sole login mechanism: accept the unchanged email
            // submitted by the profile form, but reject attempts to change it so an
            // account cannot pre-claim another Google user's email address.
            'email' => [
                'sometimes',
                'nullable',
                'email',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($user): void {
                    if (is_string($value) && trim($value) !== '' && strcasecmp(trim($value), (string) $user->email) !== 0) {
                        $fail('لا يمكن تغيير البريد الإلكتروني المرتبط بحساب Google');
                    }
                },
            ],
        ], [
            'name.required' => 'اكتب الاسم',
            'name.string' => 'الاسم يجب أن يكون نصاً',
            'name.max' => 'الاسم يجب ألا يتجاوز 255 حرفاً',
            'email.email' => 'أدخل بريداً إلكترونياً صالحاً',
            'email.max' => 'البريد الإلكتروني يجب ألا يتجاوز 255 حرفاً',
        ]);

        $user->update(['name' => $data['name']]);

        if ($request->bearerToken() !== null) {
            return response()->json([
                'ok' => true,
                'message' => 'تم تحديث الحساب بنجاح',
                'user' => $user->fresh()?->toAuthPayload(),
            ]);
        }

        return back()->with('success', 'تم تحديث الحساب بنجاح');
    }

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

    public function deleteAccount(Request $request, AvatarService $avatars)
    {
        $user = $request->user();

        $superadmin = User::where('role', 'superadmin')
            ->whereNull('deleted_at')
            ->first();

        if ($superadmin && $superadmin->id !== $user->id) {
            Poll::where('user_id', $user->id)->update(['user_id' => $superadmin->id]);
            Route::where('user_id', $user->id)->update(['user_id' => $superadmin->id]);
        }

        // Remove hosted avatars so R2 does not keep avatars/{id}/* forever.
        $avatars->deleteForUser($user);

        $user->tokens()->delete();

        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $user->delete(); // Triggers soft delete

        return response()->json(['ok' => true]);
    }

    /**
     * Ban or unban a user submitter. Requires the `users.ban` capability,
     * enforced by the users_admin middleware on the route.
     */
    public function toggleBan(Request $request, $id, UserModerationService $moderation)
    {
        $userToBan = User::findOrFail($id);

        $userToBan = $moderation->toggleBanned($userToBan, $request->user());

        return response()->json([
            'ok' => true,
            'is_banned' => $userToBan->is_banned,
            'message' => $userToBan->is_banned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم',
        ]);
    }
}
