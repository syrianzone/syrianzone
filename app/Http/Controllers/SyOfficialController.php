<?php

namespace App\Http\Controllers;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class SyOfficialController extends Controller
{
    /**
     * Display the official accounts page.
     */
    public function index(SyOfficialPresenter $presenter)
    {
        $categories = Cache::remember(SyOfficialDirectoryService::CATEGORIES_CACHE_KEY, 600, function () {
            // Seed an empty directory on first use. Checked here, inside the
            // cached read, so a warm page does not count the table on every hit.
            if (OfficialCategory::count() === 0) {
                try {
                    (new \Database\Seeders\SyOfficialSeeder())->run();
                } catch (\Exception $e) {
                    // Fail gracefully
                }
            }

            return OfficialCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });

        $entities = Cache::remember(SyOfficialDirectoryService::ENTITIES_CACHE_KEY, 600, function () use ($presenter) {
            return $presenter->publicEntities(
                OfficialEntity::with('category')
                    ->where('is_active', true)
                    ->whereHas('category', function ($q) {
                        $q->where('is_active', true);
                    })
                    ->orderBy('order_column')
                    ->get()
            );
        });

        return Inertia::render('SyOfficial/Index', [
            'initialData' => $entities,
            'categories' => $categories,
        ]);
    }
}
