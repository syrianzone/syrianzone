<?php

namespace App\Http\Controllers;

use App\Models\GovApp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class GovAppsAdminController extends Controller
{
    /**
     * Render the admin management dashboard for GovApps.
     */
    public function renderIndex()
    {
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
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:gov_apps,id|alpha_dash',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => 'nullable|image|max:5120',
            'links' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $iconPath = null;
        if ($request->hasFile('icon_file')) {
            $iconPath = $this->uploadIcon($request->file('icon_file'), $validated['id']);
        }

        $links = array_filter($validated['links'] ?? [], fn($url) => !empty($url) && is_string($url) && !empty(trim($url)));

        GovApp::create([
            'id' => $validated['id'],
            'name' => $validated['name'],
            'name_ar' => $validated['name_ar'],
            'description' => $validated['description'] ?? null,
            'description_ar' => $validated['description_ar'] ?? null,
            'icon' => $iconPath,
            'images' => [],
            'links' => $links,
            'order_column' => $maxOrder + 1,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة التطبيق الحكومي بنجاح');
    }

    /**
     * Update an existing GovApp.
     */
    public function update(Request $request, string $id)
    {
        $app = GovApp::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => 'nullable|image|max:5120',
            'links' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $iconPath = $app->icon;
        if ($request->hasFile('icon_file')) {
            $iconPath = $this->uploadIcon($request->file('icon_file'), $id);
        }

        $links = array_filter($validated['links'] ?? [], fn($url) => !empty($url) && is_string($url) && !empty(trim($url)));

        $app->update([
            'name' => $validated['name'],
            'name_ar' => $validated['name_ar'],
            'description' => $validated['description'] ?? null,
            'description_ar' => $validated['description_ar'] ?? null,
            'icon' => $iconPath,
            'links' => $links,
            'is_active' => $validated['is_active'] ?? $app->is_active,
        ]);

        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث بيانات التطبيق بنجاح');
    }

    /**
     * Delete a GovApp.
     */
    public function destroy(string $id)
    {
        $app = GovApp::findOrFail($id);
        $app->delete();
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف التطبيق بنجاح');
    }

    /**
     * Reorder Apps (Drag-and-Drop)
     */
    public function reorder(Request $request)
    {
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

    /**
     * Helper to upload icon to R2 or public disk
     */
    private function uploadIcon($file, string $appId): string
    {
        $disk = config('filesystems.media_disk', 'r2');
        if (!config("filesystems.disks.{$disk}")) {
            $disk = 'public';
        }

        $fileName = "govapps/{$appId}_" . time() . ".webp";

        if (function_exists('imagecreatefromstring')) {
            $imageStr = file_get_contents($file->getRealPath());
            $im = @imagecreatefromstring($imageStr);
            if ($im !== false) {
                $targetW = 200;
                $targetH = 200;

                $canvas = imagecreatetruecolor($targetW, $targetH);
                imagealphablending($canvas, false);
                imagesavealpha($canvas, true);
                $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
                imagefilledrectangle($canvas, 0, 0, $targetW, $targetH, $transparent);

                imagecopyresampled($canvas, $im, 0, 0, 0, 0, $targetW, $targetH, imagesx($im), imagesy($im));

                ob_start();
                imagewebp($canvas, null, 85);
                imagedestroy($canvas);
                imagedestroy($im);
                $webpContent = ob_get_clean();

                Storage::disk($disk)->put($fileName, $webpContent, 'public');
                return Storage::disk($disk)->url($fileName);
            }
        }

        $path = $file->storeAs('govapps', "{$appId}_" . time() . "." . $file->getClientOriginalExtension(), $disk);
        return Storage::disk($disk)->url($path);
    }

    private function flushCache(): void
    {
        Cache::forget('govapps:db_apps_v1');
    }
}
