<?php

namespace App\Http\Controllers;

use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SiteNavigationAdminController extends Controller
{
    public function renderIndex()
    {
        return inertia('Admin/Navigation/Index', [
            'navigation' => SiteSetting::getNavigation(),
            'defaults' => SiteSetting::navigationDefaults(),
        ]);
    }

    public function show(Request $request)
    {
        $navigation = SiteSetting::getNavigation();
        $surface = $request->query('surface');
        $includeDisabled = $request->boolean('include_disabled');

        $items = array_values(array_filter($navigation['items'], function (array $item) use ($surface, $includeDisabled): bool {
            if (! $includeDisabled && empty($item['enabled'])) {
                return false;
            }

            if (is_string($surface) && $surface !== '') {
                $surfaces = isset($item['surfaces']) && is_array($item['surfaces']) ? $item['surfaces'] : [];

                return in_array($surface, $surfaces, true);
            }

            return true;
        }));

        return response()->json([
            'navbarTopCount' => $navigation['navbarTopCount'],
            'useSeparateNavbarOrder' => $navigation['useSeparateNavbarOrder'],
            'navbarOrder' => $navigation['navbarOrder'],
            'items' => $items,
            'version' => $navigation['version'],
        ]);
    }

    public function update(Request $request)
    {
        $rawItems = $request->input('items');
        if ($request->boolean('reset') || ($request->has('items') && is_array($rawItems) && count($rawItems) === 0)) {
            SiteSetting::where('key', SiteSetting::SITE_NAVIGATION_KEY)->delete();
            SiteSetting::flushNavigationCache();

            $fresh = SiteSetting::getNavigation();

            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return response()->json([
                    'status' => 'ok',
                    'navigation' => $fresh,
                ]);
            }

            return redirect()->back()->with('success', 'تمت استعادة الترتيب الافتراضي للأقسام والقوائم');
        }

        $validated = $request->validate([
            'navbarTopCount' => 'nullable|integer|min:1|max:10',
            'useSeparateNavbarOrder' => 'nullable|boolean',
            'navbarOrder' => 'nullable|array|max:100',
            'navbarOrder.*' => 'required|string|max:500',
            'items' => 'required|array|min:1|max:100',
            'items.*.id' => 'required|string|max:500',
            'items.*.title' => 'nullable|string|max:80',
            'items.*.text' => 'nullable|string|max:80',
            'items.*.subtitle' => 'nullable|string|max:200',
            'items.*.href' => 'nullable|string|max:2048',
            'items.*.type' => 'nullable|string|in:native,web,webview,internal,external',
            'items.*.target' => 'nullable|string|max:2048',
            'items.*.iconKey' => 'nullable|string|max:50',
            'items.*.iconUrl' => 'nullable|string|max:2048',
            'items.*.image' => 'nullable|string|max:2048',
            'items.*.isFlag' => 'nullable|boolean',
            'items.*.external' => 'nullable|boolean',
            'items.*.isInternal' => 'nullable|boolean',
            'items.*.enabled' => 'nullable|boolean',
            'items.*.showOnHome' => 'nullable|boolean',
            'items.*.showInNavbar' => 'nullable|boolean',
            'items.*.surfaces' => 'nullable|array|max:10',
            'items.*.surfaces.*' => 'string|max:50',
            'items.*.subCategories' => 'nullable|array|max:30',
            'items.*.subCategories.*.id' => 'nullable|string|max:120',
            'items.*.subCategories.*.title' => 'required_with:items.*.subCategories|string|max:80',
            'items.*.subCategories.*.subtitle' => 'nullable|string|max:200',
            'items.*.subCategories.*.href' => 'nullable|string|max:2048',
            'items.*.subCategories.*.type' => 'nullable|string|in:native,web,webview,internal,external',
            'items.*.subCategories.*.target' => 'nullable|string|max:2048',
            'items.*.subCategories.*.iconKey' => 'nullable|string|max:50',
            'items.*.subCategories.*.iconUrl' => 'nullable|string|max:2048',
            'items.*.isCustom' => 'nullable|boolean',
        ]);

        $builtInById = [];
        $builtInByHref = [];
        foreach (SiteSetting::defaultNavigationItems() as $builtIn) {
            $builtInById[$builtIn['id']] = $builtIn;
            $builtInByHref[$builtIn['href']] = $builtIn;
        }

        foreach ($validated['items'] as $idx => $item) {
            $title = trim((string) ($item['title'] ?? $item['text'] ?? ''));
            if ($title === '') {
                throw ValidationException::withMessages([
                    "items.{$idx}.text" => 'الاسم مطلوب لكل عنصر.',
                ]);
            }

            $href = trim((string) ($item['href'] ?? $item['target'] ?? ''));
            if ($href !== '' && ! str_starts_with($href, '/') && ! str_starts_with($href, 'https://') && ! str_starts_with($href, 'http://') && ($item['type'] ?? '') !== 'native') {
                throw ValidationException::withMessages([
                    "items.{$idx}.href" => 'يجب أن يبدأ الرابط بـ / للروابط الداخلية أو https:// للروابط الخارجية.',
                ]);
            }
        }

        $row = SiteSetting::firstOrNew(['key' => SiteSetting::SITE_NAVIGATION_KEY]);
        $current = is_array($row->value) ? $row->value : SiteSetting::navigationDefaults();

        $normalizedItems = [];
        foreach ($validated['items'] as $idx => $item) {
            $rawId = trim((string) $item['id']);
            $rawHref = trim((string) ($item['href'] ?? ''));
            $base = $builtInById[$rawId] ?? $builtInByHref[$rawId] ?? ($rawHref !== '' ? ($builtInByHref[$rawHref] ?? null) : null);
            if ($base !== null) {
                $item['id'] = $base['id'];
            }
            $normalizedItems[] = SiteSetting::normalizeNavigationItem($item, (int) $idx, $base === null, $base);
        }

        $allIds = array_values(array_map(fn (array $item) => $item['id'], $normalizedItems));
        $navbarOrder = [];
        if (isset($validated['navbarOrder']) && is_array($validated['navbarOrder'])) {
            foreach ($validated['navbarOrder'] as $navId) {
                $navIdStr = (string) $navId;
                $resolvedId = isset($builtInById[$navIdStr])
                    ? $navIdStr
                    : ($builtInByHref[$navIdStr]['id'] ?? $navIdStr);
                if (in_array($resolvedId, $allIds, true) && ! in_array($resolvedId, $navbarOrder, true)) {
                    $navbarOrder[] = $resolvedId;
                }
            }
        } else {
            $navbarOrder = $allIds;
        }

        foreach ($allIds as $id) {
            if (! in_array($id, $navbarOrder, true)) {
                $navbarOrder[] = $id;
            }
        }

        $row->value = [
            'navbarTopCount' => (int) ($validated['navbarTopCount'] ?? $current['navbarTopCount'] ?? 4),
            'useSeparateNavbarOrder' => (bool) ($validated['useSeparateNavbarOrder'] ?? $current['useSeparateNavbarOrder'] ?? false),
            'navbarOrder' => $navbarOrder,
            'items' => $normalizedItems,
            'version' => (int) ($current['version'] ?? 0) + 1,
        ];
        $row->updated_by = $request->user()?->id;
        $row->save();

        SiteSetting::flushNavigationCache();

        $fresh = SiteSetting::getNavigation();

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                'status' => 'ok',
                'navigation' => $fresh,
            ]);
        }

        return redirect()->back()->with('success', 'تم حفظ ترتيب وإعدادات الأقسام والقوائم بنجاح');
    }
}
