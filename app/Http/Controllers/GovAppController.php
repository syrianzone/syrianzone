<?php

namespace App\Http\Controllers;

use App\Models\GovApp;
use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use App\Support\Seo\SeoMeta;
use Database\Seeders\GovAppsSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class GovAppController extends Controller
{
    public function index(GovAppPresenter $presenter)
    {
        $apps = Cache::remember(GovAppService::APPS_CACHE_KEY, 600, function () use ($presenter) {
            if (GovApp::count() === 0) {
                try {
                    (new GovAppsSeeder)->run();
                } catch (\Exception $e) {
                }
            }

            return $presenter->publicItems(
                GovApp::with('officialEntity')->where('is_active', true)->orderBy('order_column')->get()
            );
        });

        return Inertia::render('GovApps/Index', [
            'initialData' => $apps,
        ]);
    }

    public function show(Request $request, string $id, GovAppPresenter $presenter)
    {
        $app = GovApp::with('officialEntity')
            ->where('id', $id)
            ->where('is_active', true)
            ->firstOrFail();

        SeoMeta::remember($request, 'govapp', $app);

        $related = GovApp::with('officialEntity')
            ->where('is_active', true)
            ->where('id', '!=', $app->id)
            ->orderByRaw('CASE WHEN official_entity_id IS NOT NULL AND official_entity_id = ? THEN 0 ELSE 1 END', [$app->official_entity_id ?? ''])
            ->orderBy('order_column')
            ->limit(4)
            ->get();

        return Inertia::render('GovApps/Show', [
            'app' => $presenter->publicDetail($app),
            'relatedApps' => $presenter->publicItems($related),
        ]);
    }
}
