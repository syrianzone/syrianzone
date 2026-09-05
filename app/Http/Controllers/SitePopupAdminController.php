<?php

namespace App\Http\Controllers;

use App\Models\SiteSetting;
use Illuminate\Http\Request;

class SitePopupAdminController extends Controller
{
    public function renderIndex()
    {
        return inertia('Admin/SitePopup/Index', [
            'popup' => SiteSetting::getPopup(),
        ]);
    }

    public function show()
    {
        return response()->json(SiteSetting::getPopup());
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:100',
            'description' => 'required|string|max:500',
            'buttonText' => 'required|string|max:50',
            'dismissText' => 'required|string|max:50',
            'link' => 'required|url:https|max:2048',
            'enabled' => 'required|boolean',
        ]);

        $row = SiteSetting::firstOrNew(['key' => SiteSetting::HOMEPAGE_POPUP_KEY]);
        $current = is_array($row->value) ? $row->value : SiteSetting::defaults();
        $validated['version'] = (int) ($current['version'] ?? 0) + 1;
        $row->value = array_merge(SiteSetting::defaults(), $validated);
        $row->updated_by = $request->user()?->id;
        $row->save();

        SiteSetting::flushPopupCache();

        return redirect()->back()->with('success', 'تم حفظ إعدادات النافذة المنبثقة');
    }
}
