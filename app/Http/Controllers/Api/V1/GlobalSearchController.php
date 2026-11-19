<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialEntity;
use App\Models\PhonebookEntry;
use App\Models\Place;
use App\Models\Route;
use App\Support\ArabicSearch;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    public function search(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([
                'routes' => [],
                'places' => [],
                'phonebook' => [],
                'officials' => [],
                'govapps' => [],
                'govtcvs' => [],
            ]);
        }

        $q = mb_substr($q, 0, 80);
        // Arabic text is compared folded to folded (`*_fold` columns); the
        // English and numeric columns keep the raw pattern. Both escape the
        // LIKE wildcards so a query containing % or _ stays a literal.
        $like = '%'.addcslashes($q, '%_\\').'%';
        $folded = ArabicSearch::fold($q);
        $foldLike = '%'.addcslashes($folded === '' ? $q : $folded, '%_\\').'%';

        $routes = Route::query()
            ->where('status', 'published')
            ->where(function ($query) use ($like, $foldLike) {
                $query->where('name_ar_fold', 'like', $foldLike)
                    ->orWhere('name_en', 'like', $like);
            })
            ->limit(5)
            ->get(['id', 'city_id', 'name_ar', 'name_en'])
            ->map(fn ($r) => [
                'id' => $r->id,
                'cityId' => $r->city_id,
                'nameAr' => $r->name_ar,
                'nameEn' => $r->name_en,
            ])
            ->values();

        $places = Place::query()
            ->where('status', 'approved')
            ->where(function ($query) use ($foldLike) {
                $query->where('name_fold', 'like', $foldLike)
                    ->orWhere('description_fold', 'like', $foldLike);
            })
            ->limit(5)
            ->get(['id', 'name', 'category'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'category' => $p->category,
            ])
            ->values();

        $phonebook = PhonebookEntry::query()
            ->where('is_active', true)
            ->where(function ($query) use ($like, $foldLike) {
                $query->where('name_ar_fold', 'like', $foldLike)
                    ->orWhere('name_en', 'like', $like)
                    ->orWhere('number', 'like', $like);
            })
            ->orderBy('order_column')
            ->limit(5)
            ->get(['id', 'name_ar', 'name_en', 'number'])
            ->map(fn ($e) => [
                'id' => $e->id,
                'nameAr' => $e->name_ar,
                'nameEn' => $e->name_en,
                'number' => $e->number,
            ])
            ->values();

        $officials = OfficialEntity::query()
            ->where('is_active', true)
            ->where(function ($query) use ($like, $foldLike) {
                $query->where('name_ar_fold', 'like', $foldLike)
                    ->orWhere('name', 'like', $like)
                    ->orWhere('description_ar_fold', 'like', $foldLike);
            })
            ->orderBy('order_column')
            ->limit(5)
            ->get(['id', 'name_ar', 'name', 'category_id'])
            ->map(fn ($o) => [
                'id' => $o->id,
                'nameAr' => $o->name_ar ?: $o->name,
                'nameEn' => $o->name,
                'categoryId' => $o->category_id,
            ])
            ->values();

        $govapps = GovApp::query()
            ->where('is_active', true)
            ->where(function ($query) use ($like, $foldLike) {
                $query->where('name_ar_fold', 'like', $foldLike)
                    ->orWhere('name', 'like', $like)
                    ->orWhere('description_ar_fold', 'like', $foldLike);
            })
            ->orderBy('order_column')
            ->limit(4)
            ->get(['id', 'name_ar', 'name'])
            ->map(fn ($g) => [
                'id' => $g->id,
                'nameAr' => $g->name_ar ?: $g->name,
                'nameEn' => $g->name,
            ])
            ->values();

        $govtcvs = GovtOfficial::published()
            ->with(['tenures:id,official_id,role_title_ar,institution_name_ar,status,started_at'])
            ->where(function ($query) use ($like, $foldLike) {
                $query->where('display_name_ar_fold', 'like', $foldLike)
                    ->orWhere('full_name_ar_fold', 'like', $foldLike)
                    ->orWhere('full_name_en', 'like', $like)
                    ->orWhereHas('aliases', fn ($a) => $a->where('alias_ar_fold', 'like', $foldLike))
                    ->orWhereHas('tenures', fn ($t) => $t->where('role_title_ar_fold', 'like', $foldLike));
            })
            ->orderByRaw("CASE WHEN office_status = 'in_office' THEN 0 ELSE 1 END")
            ->orderBy('display_name_ar')
            ->limit(6)
            ->get(['id', 'slug', 'display_name_ar', 'full_name_ar', 'honorific_ar', 'office_status'])
            ->map(function (GovtOfficial $official) {
                $primaryTenure = $official->tenures->first();

                return [
                    'id' => $official->id,
                    'slug' => $official->slug,
                    'nameAr' => $official->display_name_ar ?: $official->full_name_ar,
                    'honorificAr' => $official->honorific_ar,
                    'roleTitleAr' => $primaryTenure?->role_title_ar,
                    'institutionNameAr' => $primaryTenure?->institution_name_ar,
                    'officeStatus' => $official->office_status,
                ];
            })
            ->values();

        return response()->json([
            'routes' => $routes,
            'places' => $places,
            'phonebook' => $phonebook,
            'officials' => $officials,
            'govapps' => $govapps,
            'govtcvs' => $govtcvs,
        ]);
    }
}
