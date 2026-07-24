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
        // If database is empty, auto seed initial dataset
        if (OfficialCategory::count() === 0) {
            try {
                (new \Database\Seeders\SyOfficialSeeder())->run();
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
                    $image = $item->image;
                    if ($image && !str_starts_with($image, 'http') && !str_starts_with($image, '/')) {
                        $r2Url = env('R2_PUBLIC_URL') ?: (config('filesystems.disks.r2.url') ?: 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev');
                        $image = rtrim($r2Url, '/') . '/syofficial/entities/' . basename($image);
                    }
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'name_ar' => $item->name_ar,
                        'description' => $item->description ?? '',
                        'description_ar' => $item->description_ar ?? '',
                        'image' => $image,
                        'category' => $item->category_id,
                        'socials' => (object)($item->socials ?? []),
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
