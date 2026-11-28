<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Crossing;
use App\Models\HouseMember2026;
use App\Models\SyrianSite;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class CivicAdminPagesController extends Controller
{
    public function crossings(): Response
    {
        return Inertia::render('Admin/Crossings/Index', [
            'crossings' => Schema::hasTable('crossings') ? Crossing::ordered()->get() : [],
        ]);
    }

    public function sites(): Response
    {
        return Inertia::render('Admin/Sites/Index', [
            'sites' => Schema::hasTable('syrian_sites') ? SyrianSite::ordered()->get() : [],
        ]);
    }

    public function house(): Response
    {
        return Inertia::render('Admin/House/Index', [
            'members' => Schema::hasTable('house_members_2026')
                ? HouseMember2026::query()
                    ->orderBy('governorate_ar')
                    ->orderBy('name_ar')
                    ->get()
                : [],
        ]);
    }
}
