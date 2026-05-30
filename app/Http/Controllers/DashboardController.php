<?php

namespace App\Http\Controllers;

use App\Models\Poll;
use App\Models\Route;
use App\Models\RouteDraft;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
        ]);

        $user->update($data);

        return back()->with('success', 'تم تحديث الحساب بنجاح');
    }

    /**
     * Soft delete user account and delegate owned polls/routes to superadmin.
     */
    public function deleteAccount(Request $request)
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

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $user->delete(); // Triggers soft delete

        return response()->json(['ok' => true]);
    }

    /**
     * Ban or unban a user submitter (Admins/Transit Admins only).
     */
    public function toggleBan(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'admin' && $user->role !== 'transit_admin' && $user->role !== 'superadmin') {
            abort(403, 'Unauthorized.');
        }

        $userToBan = User::findOrFail($id);

        if ($userToBan->isSuperAdmin()) {
            return response()->json(['message' => 'Cannot ban a superadmin'], 403);
        }

        $userToBan->update(['is_banned' => !$userToBan->is_banned]);

        return response()->json([
            'ok' => true,
            'is_banned' => $userToBan->is_banned,
            'message' => $userToBan->is_banned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم'
        ]);
    }
}
