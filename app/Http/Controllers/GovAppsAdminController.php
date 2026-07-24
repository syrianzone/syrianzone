<?php

namespace App\Http\Controllers;

use App\Models\GovApp;
use App\Services\DirectoryAdminAccess;
use App\Services\DirectoryImageService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class GovAppsAdminController extends Controller
{
    public function __construct(
        private readonly DirectoryAdminAccess $access,
        private readonly DirectoryImageService $images,
    ) {}

    /**
     * Render the admin management dashboard for GovApps.
     */
    public function renderIndex(Request $request)
    {
        $this->access->authorizeRead($request, 'govapps');
        $apps = GovApp::orderBy('order_column')->get();

        return inertia('Admin/GovApps/Index', [
            'apps' => $apps,
        ]);
    }

    /**
     * Store a new GovApp.
     */
    public function store(Request $request)
    {
        $this->access->authorizeAction($request, 'govapps', 'create');
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:gov_apps,id|alpha_dash',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => $this->images->rules(),
            'links' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $icon = $request->file('icon_file');
        $storedIcon = $icon instanceof UploadedFile
            ? $this->images->store($icon, 'directories/govapps')
            : null;
        $links = array_filter($validated['links'] ?? [], fn ($url) => ! empty($url) && is_string($url) && ! empty(trim($url)));

        try {
            DB::transaction(function () use ($links, $storedIcon, $validated): void {
                GovApp::create([
                    'id' => $validated['id'],
                    'name' => $validated['name'],
                    'name_ar' => $validated['name_ar'],
                    'description' => $validated['description'] ?? null,
                    'description_ar' => $validated['description_ar'] ?? null,
                    'icon' => $storedIcon?->url,
                    'images' => [],
                    'links' => $links,
                    'order_column' => ((int) GovApp::query()->max('order_column')) + 1,
                    'is_active' => $validated['is_active'] ?? true,
                ]);
            });
        } catch (Throwable $error) {
            if ($storedIcon !== null) {
                $this->images->discard($storedIcon);
            }

            throw $error;
        }

        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة التطبيق الحكومي بنجاح');
    }

    /**
     * Update an existing GovApp.
     */
    public function update(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'govapps', 'edit');
        GovApp::query()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => $this->images->rules(),
            'links' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $icon = $request->file('icon_file');
        $storedIcon = $icon instanceof UploadedFile
            ? $this->images->store($icon, 'directories/govapps')
            : null;
        $links = array_filter($validated['links'] ?? [], fn ($url) => ! empty($url) && is_string($url) && ! empty(trim($url)));

        try {
            DB::transaction(function () use ($id, $links, $request, $storedIcon, $validated): void {
                $app = GovApp::query()->lockForUpdate()->findOrFail($id);
                $nextIsActive = (bool) ($validated['is_active'] ?? $app->is_active);
                if ($nextIsActive !== (bool) $app->is_active) {
                    $this->access->authorizeAction($request, 'govapps', 'toggle');
                }
                $oldIcon = $app->icon;
                $app->update([
                    'name' => $validated['name'],
                    'name_ar' => $validated['name_ar'],
                    'description' => $validated['description'] ?? null,
                    'description_ar' => $validated['description_ar'] ?? null,
                    'icon' => $storedIcon?->url ?? $oldIcon,
                    'links' => $links,
                    'is_active' => $validated['is_active'] ?? $app->is_active,
                ]);
                if ($storedIcon !== null) {
                    $this->queueIconDeletion($oldIcon, $app->id);
                }
            });
        } catch (Throwable $error) {
            if ($storedIcon !== null) {
                $this->images->discard($storedIcon);
            }

            throw $error;
        }

        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث بيانات التطبيق بنجاح');
    }

    /**
     * Delete a GovApp.
     */
    public function destroy(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'govapps', 'delete');
        DB::transaction(function () use ($id): void {
            $app = GovApp::query()->lockForUpdate()->findOrFail($id);
            $icon = $app->icon;
            $app->delete();
            $this->queueIconDeletion($icon, $app->id);
        });
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف التطبيق بنجاح');
    }

    /**
     * Reorder Apps (Drag-and-Drop)
     */
    public function reorder(Request $request)
    {
        $this->access->authorizeAction($request, 'govapps', 'reorder');
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:gov_apps,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        foreach ($validated['orders'] as $item) {
            GovApp::where('id', $item['id'])->update(['order_column' => $item['order_column']]);
        }

        $this->flushCache();

        return response()->json(['message' => 'تم إعادة الترتيب بنجاح']);
    }

    private function flushCache(): void
    {
        Cache::forget('govapps:db_apps_v1');
    }

    private function queueIconDeletion(?string $url, string $id): void
    {
        $this->images->queueManagedUrlDeletion($url, 'directories/govapps');
        $this->images->queueLegacyWebUrlDeletion($url, 'govapps', $id);
    }
}
