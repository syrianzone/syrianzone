<?php

namespace App\Http\Controllers;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class SyOfficialController extends Controller
{
    /**
     * Display the official accounts page.
     */
    public function index()
    {
        $entities = Cache::remember('syofficial:db_entities_v2', 600, function () {
            // If database is empty, auto seed initial dataset
            if (OfficialCategory::count() === 0) {
                try {
                    (new \Database\Seeders\SyOfficialSeeder())->run();
                } catch (\Exception $e) {
                    // Fail gracefully
                }
            }

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
                        'socials' => (object)($item->socials ?? []),
                    ];
                })
                ->toArray();
        });

        return Inertia::render('SyOfficial/Index', [
            'initialData' => $entities
        ]);
    }
}
