<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Database\Seeders\SyOfficialSeeder;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class SyOfficialController extends Controller
{
    /**
     * Display the official accounts page.
     */
    public function index(): Response
    {
        // If database is empty, auto seed initial dataset
        if (OfficialCategory::count() === 0) {
            try {
                (new SyOfficialSeeder)->run();
            } catch (\Exception $e) {
                // Fail gracefully
            }
        }

        $categories = Cache::remember('syofficial:db_categories_v2', 600, function () {
            return OfficialCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });

        $entities = Cache::remember('syofficial:db_entities_v2', 600, function () {
            return OfficialEntity::with('category')
                ->where('is_active', true)
                ->whereHas('category', function ($q) {
                    $q->where('is_active', true);
                })
                ->orderBy('order_column')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'name_ar' => $item->name_ar,
                        'description' => $item->description ?? '',
                        'description_ar' => $item->description_ar ?? '',
                        'image' => $item->image,
                        'category' => $item->category_id,
                        'socials' => (object) ($item->socials ?? []),
                    ];
                })
                ->toArray();
        });

        return Inertia::render('SyOfficial/Index', [
            'initialData' => $entities,
            'categories' => $categories,
        ]);
    }
}
