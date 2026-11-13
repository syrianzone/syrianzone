<?php

namespace App\Http\Controllers;

use App\Models\GovApp;
use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class GovAppController extends Controller
{
    public function index(GovAppPresenter $presenter)
    {
        $apps = Cache::remember(GovAppService::APPS_CACHE_KEY, 600, function () use ($presenter) {
            if (GovApp::count() === 0) {
                try {
                    (new \Database\Seeders\GovAppsSeeder())->run();
                } catch (\Exception $e) {
                }
            }

            return $presenter->publicItems(GovApp::where('is_active', true)->orderBy('order_column')->get());
        });

        return Inertia::render('GovApps/Index', [
            'initialData' => $apps,
        ]);
    }
}
