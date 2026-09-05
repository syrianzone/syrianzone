<?php

namespace App\Http\Controllers;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class SyOfficialAdminController extends Controller
{
    /**
     * Render the admin management dashboard for SyOfficial.
     */
    public function renderIndex()
    {
        $categories = OfficialCategory::orderBy('order_column')->get();
        $entities = OfficialEntity::with('category')
            ->orderBy('order_column')
            ->get();

        return inertia('Admin/SyOfficial/Index', [
            'categories' => $categories,
            'entities' => $entities,
        ]);
    }

    /**
     * Category CRUD: Store
     */
    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64|unique:official_categories,id|alpha_dash',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        $maxOrder = OfficialCategory::max('order_column') ?? 0;
        $validated['order_column'] = $maxOrder + 1;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $category = OfficialCategory::create($validated);
        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة الفئة بنجاح');
    }

    /**
     * Category CRUD: Update
     */
    public function updateCategory(Request $request, string $id)
    {
        $category = OfficialCategory::findOrFail($id);

        $validated = $request->validate([
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        $category->update($validated);
        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث الفئة بنجاح');
    }

    /**
     * Category CRUD: Delete
     */
    public function destroyCategory(string $id)
    {
        $category = OfficialCategory::findOrFail($id);
        $category->delete();
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الفئة بنجاح');
    }

    /**
     * Entity CRUD: Store
     */
    public function storeEntity(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:official_entities,id|alpha_dash',
            'category_id' => 'required|exists:official_categories,id',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'image_file' => 'nullable|image|max:5120', // Max 5MB
            'socials' => 'nullable|array',
            'socials.*' => 'nullable|string|max:2048|starts_with:http://,https://',
            'is_active' => 'boolean',
        ]);

        $imagePath = null;
        if ($request->hasFile('image_file')) {
            $imagePath = $this->uploadImage($request->file('image_file'), $validated['id']);
        }

        $maxOrder = OfficialEntity::where('category_id', $validated['category_id'])->max('order_column') ?? 0;
        $socials = array_filter($validated['socials'] ?? [], fn($url) => is_string($url) && (str_starts_with(trim($url), 'http://') || str_starts_with(trim($url), 'https://')));

        OfficialEntity::create([
            'id' => $validated['id'],
            'category_id' => $validated['category_id'],
            'name' => $validated['name'],
            'name_ar' => $validated['name_ar'],
            'description' => $validated['description'] ?? null,
            'description_ar' => $validated['description_ar'] ?? null,
            'image' => $imagePath ?? 'images/governorates/placeholder.webp',
            'socials' => $socials,
            'order_column' => $maxOrder + 1,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة الجهة الرسمية بنجاح');
    }

    /**
     * Entity CRUD: Update
     */
    public function updateEntity(Request $request, string $id)
    {
        $entity = OfficialEntity::findOrFail($id);

        $validated = $request->validate([
            'category_id' => 'required|exists:official_categories,id',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'image_file' => 'nullable|image|max:5120',
            'socials' => 'nullable|array',
            'socials.*' => 'nullable|string|max:2048|starts_with:http://,https://',
            'is_active' => 'boolean',
        ]);

        if ($request->hasFile('image_file')) {
            $validated['image'] = $this->uploadImage($request->file('image_file'), $id);
        }

        $socials = array_filter($validated['socials'] ?? [], fn($url) => is_string($url) && (str_starts_with(trim($url), 'http://') || str_starts_with(trim($url), 'https://')));

        $entity->update([
            'category_id' => $validated['category_id'],
            'name' => $validated['name'],
            'name_ar' => $validated['name_ar'],
            'description' => $validated['description'] ?? null,
            'description_ar' => $validated['description_ar'] ?? null,
            'image' => $validated['image'] ?? $entity->image,
            'socials' => $socials,
            'is_active' => $validated['is_active'] ?? $entity->is_active,
        ]);

        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث البيانات بنجاح');
    }

    /**
     * Entity CRUD: Delete
     */
    public function destroyEntity(string $id)
    {
        $entity = OfficialEntity::findOrFail($id);
        $entity->delete();
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الجهة الرسمية بنجاح');
    }

    /**
     * Reorder Categories (Drag-and-Drop)
     */
    public function reorderCategories(Request $request)
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_categories,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        foreach ($validated['orders'] as $item) {
            OfficialCategory::where('id', $item['id'])->update(['order_column' => $item['order_column']]);
        }

        $this->flushCache();

        return response()->json(['message' => 'تم إعادة الترتيب بنجاح']);
    }

    /**
     * Reorder Entities (Drag-and-Drop)
     */
    public function reorderEntities(Request $request)
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_entities,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        foreach ($validated['orders'] as $item) {
            OfficialEntity::where('id', $item['id'])->update(['order_column' => $item['order_column']]);
        }

        $this->flushCache();

        return response()->json(['message' => 'تم إعادة الترتيب بنجاح']);
    }

    /**
     * Helper to upload image to R2 or public disk
     */
    private function uploadImage($file, string $entityId): string
    {
        $disk = config('filesystems.media_disk', 'r2');
        if (!config("filesystems.disks.{$disk}")) {
            $disk = 'public';
        }

        $fileName = "syofficial/entities/{$entityId}_" . time() . ".webp";

        // Read image file, resize to 200x200 max resolution, and convert to optimized webp
        if (function_exists('imagecreatefromstring')) {
            $imageStr = file_get_contents($file->getRealPath());
            $im = @imagecreatefromstring($imageStr);
            if ($im !== false) {
                $origW = imagesx($im);
                $origH = imagesy($im);
                $targetW = 200;
                $targetH = 200;

                if ($origW > $origH) {
                    $srcW = $origH;
                    $srcH = $origH;
                    $srcX = (int) (($origW - $origH) / 2);
                    $srcY = 0;
                } else {
                    $srcW = $origW;
                    $srcH = $origW;
                    $srcX = 0;
                    $srcY = (int) (($origH - $origW) / 2);
                }

                $canvas = imagecreatetruecolor($targetW, $targetH);
                imagealphablending($canvas, false);
                imagesavealpha($canvas, true);
                $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
                imagefilledrectangle($canvas, 0, 0, $targetW, $targetH, $transparent);

                imagecopyresampled($canvas, $im, 0, 0, $srcX, $srcY, $targetW, $targetH, $srcW, $srcH);

                ob_start();
                imagewebp($canvas, null, 85);
                imagedestroy($canvas);
                imagedestroy($im);
                $webpContent = ob_get_clean();

                Storage::disk($disk)->put($fileName, $webpContent, 'public');
                return Storage::disk($disk)->url($fileName);
            }
        }

        // Fallback standard file store
        $path = $file->storeAs('syofficial/entities', "{$entityId}_" . time() . "." . $file->getClientOriginalExtension(), $disk);
        return Storage::disk($disk)->url($path);
    }

    private function flushCache(): void
    {
        Cache::forget('syofficial:db_categories_v2');
        Cache::forget('syofficial:db_entities_v2');
    }
}
