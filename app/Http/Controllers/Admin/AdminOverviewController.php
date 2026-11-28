<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crossing;
use App\Models\DirectorySuggestion;
use App\Models\HouseMember2026;
use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\Poll;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\RouteDraft;
use App\Models\SyrianSite;
use App\Models\User;
use App\Services\Admin\IncomingSuggestionsOverviewService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class AdminOverviewController extends Controller
{
    private function canModule(User $user, string $module): bool
    {
        foreach ($user->effectivePermissions() as $capability) {
            if (str_starts_with($capability, $module.'.')) {
                return true;
            }
        }

        return false;
    }

    public function index(Request $request, IncomingSuggestionsOverviewService $incomingSuggestions): Response
    {
        $user = $request->user();

        if (! $user || (! $user->isSuperAdmin() && $user->effectivePermissions() === [])) {
            abort(403);
        }

        $pendingCounts = [];

        if ($incomingSuggestions->canAccess($user)) {
            $pendingCounts['suggestions'] = $incomingSuggestions->totalPendingCountFor($user);
        }

        if ($this->canModule($user, 'places')) {
            $pendingCounts['places'] = Place::where('status', 'pending')->count()
                + PlaceReport::where('status', 'open')->whereHas('place')->count();
        }

        if ($user->hasPermission('transit.review_drafts')) {
            $draftQuery = RouteDraft::where('status', 'pending');
            $allowedCities = $user->allowedTransitCities();
            if ($allowedCities !== null) {
                $draftQuery->whereIn('city_id', $allowedCities);
            }
            $pendingCounts['transit'] = $draftQuery->count();
        }

        if ($this->canModule($user, 'promises')) {
            $pendingCounts['promises'] = Promise::inReviewQueue()->count()
                + PromiseSpeaker::inReviewQueue()->count()
                + PromiseReport::inReviewQueue()->count();
        }

        $accessibleDirectoryModules = array_values(array_filter(
            DirectorySuggestion::MODULES,
            fn (string $module): bool => $this->canModule($user, $module),
        ));

        if ($accessibleDirectoryModules !== []) {
            $dirCounts = DirectorySuggestion::pending()
                ->whereIn('module', $accessibleDirectoryModules)
                ->selectRaw('module, count(*) as aggregate')
                ->groupBy('module')
                ->pluck('aggregate', 'module');

            foreach ($accessibleDirectoryModules as $module) {
                $pendingCounts[$module] = (int) ($dirCounts[$module] ?? 0);
            }
        }

        $stats = null;
        if ($user->isSuperAdmin()) {
            $stats = [
                'users' => User::count(),
                'polls' => Poll::count(),
                'crossings' => Schema::hasTable('crossings') ? Crossing::count() : 0,
                'sites' => Schema::hasTable('syrian_sites') ? SyrianSite::count() : 0,
                'house' => Schema::hasTable('house_members_2026') ? HouseMember2026::count() : 0,
            ];
        }

        return Inertia::render('Admin/Index', [
            'pendingCounts' => $pendingCounts,
            'stats' => $stats,
        ]);
    }

    public function polls(Request $request): Response
    {
        $polls = Poll::withCount('candidates')->latest()->get();

        return Inertia::render('Admin/Polls/Index', [
            'polls' => $polls,
        ]);
    }
}
