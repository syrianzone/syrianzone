<?php

namespace App\Http\Controllers;

use App\Models\GovApp;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class GovAppController extends Controller
{
    /**
     * Render the public government applications directory page.
     */
    public function index()
    {
        $apps = Cache::remember('govapps:db_apps_v1', 600, function () {
            // Auto seed initial dataset if empty
            if (GovApp::count() === 0) {
                try {
                    (new \Database\Seeders\GovAppsSeeder())->run();
                } catch (\Exception $e) {
                    // Fail gracefully
                }
            }

            return GovApp::where('is_active', true)
                ->orderBy('order_column')
                ->get()
                ->map(function ($app) {
                    return [
                        'id' => $app->id,
                        'name' => $app->name_ar ?: $app->name,
                        'description' => $app->description_ar ?: $app->description,
                        'icon' => $app->icon,
                        'images' => $app->images ?? [],
                        'links' => $app->links ?? [
                            'official' => null,
                            'android' => null,
                            'apple' => null,
                        ],
                    ];
                })
                ->toArray();
        });

        return Inertia::render('GovApps/Index', [
            'initialData' => $apps,
        ]);
    }
}
