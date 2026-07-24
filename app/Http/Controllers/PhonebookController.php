<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use Database\Seeders\PhonebookSeeder;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class PhonebookController extends Controller
{
    /**
     * Display the official phonebook page.
     */
    public function index(): Response
    {
        // Auto seed database if empty
        if (PhonebookCategory::count() === 0) {
            try {
                (new PhonebookSeeder)->run();
            } catch (\Exception $e) {
                // Fail gracefully
            }
        }

        $categories = Cache::remember('phonebook:db_categories_v1', 600, function () {
            return PhonebookCategory::where('is_active', true)
                ->orderBy('order_column')
                ->get();
        });

        $entries = Cache::remember('phonebook:db_entries_v1', 600, function () {
            return PhonebookEntry::with('category')
                ->where('is_active', true)
                ->whereHas('category', function ($q) {
                    $q->where('is_active', true);
                })
                ->orderBy('order_column')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'category_id' => $item->category_id,
                        'category_ar' => $item->category?->label_ar ?? '',
                        'category_en' => $item->category?->label_en ?? '',
                        'name_ar' => $item->name_ar,
                        'name_en' => $item->name_en ?? '',
                        'number' => $item->number,
                        'is_whatsapp' => (bool) $item->is_whatsapp,
                        'source_url' => $item->source_url ?? '',
                    ];
                })
                ->toArray();
        });

        return Inertia::render('Phonebook/Index', [
            'initialData' => $entries,
            'categories' => $categories,
        ]);
    }
}
