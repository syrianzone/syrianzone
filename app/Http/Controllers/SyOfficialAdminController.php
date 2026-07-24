<?php

namespace App\Http\Controllers;

use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\DirectoryAdminAccess;
use App\Services\DirectoryImageService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyOfficialAdminController extends Controller
{
    public function __construct(
        private readonly DirectoryAdminAccess $access,
        private readonly DirectoryImageService $images,
    ) {}

    /**
     * Render the admin management dashboard for SyOfficial.
     */
    public function renderIndex(Request $request)
    {
        $this->access->authorizeRead($request, 'syofficial');
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
        $this->access->authorizeAction($request, 'syofficial', 'create');
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
        $this->access->authorizeAction($request, 'syofficial', 'edit');
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
    public function destroyCategory(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'syofficial', 'delete');
        DB::transaction(function () use ($id): void {
            $category = OfficialCategory::query()->lockForUpdate()->findOrFail($id);
            $entities = OfficialEntity::query()
                ->where('category_id', $category->id)
                ->lockForUpdate()
                ->get(['id', 'image']);
            $category->delete();
            foreach ($entities as $entity) {
                $this->queueEntityImageDeletion($entity->image, $entity->id);
            }
        });
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الفئة بنجاح');
    }

    /**
     * Entity CRUD: Store
     */
    public function storeEntity(Request $request)
    {
        $this->access->authorizeAction($request, 'syofficial', 'create');
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:official_entities,id|alpha_dash',
            'category_id' => 'required|exists:official_categories,id',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'image_file' => $this->images->rules(),
            'socials' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $image = $request->file('image_file');
        $storedImage = $image instanceof UploadedFile
            ? $this->images->store($image, 'directories/syofficial')
            : null;
        $socials = array_filter($validated['socials'] ?? [], fn ($url) => ! empty($url) && is_string($url) && ! empty(trim($url)));

        try {
            DB::transaction(function () use ($socials, $storedImage, $validated): void {
                OfficialEntity::create([
                    'id' => $validated['id'],
                    'category_id' => $validated['category_id'],
                    'name' => $validated['name'],
                    'name_ar' => $validated['name_ar'],
                    'description' => $validated['description'] ?? null,
                    'description_ar' => $validated['description_ar'] ?? null,
                    'image' => $storedImage?->url ?? 'images/governorates/placeholder.webp',
                    'socials' => $socials,
                    'order_column' => ((int) OfficialEntity::query()
                        ->where('category_id', $validated['category_id'])
                        ->max('order_column')) + 1,
                    'is_active' => $validated['is_active'] ?? true,
                ]);
            });
        } catch (Throwable $error) {
            if ($storedImage !== null) {
                $this->images->discard($storedImage);
            }

            throw $error;
        }

        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة الجهة الرسمية بنجاح');
    }

    /**
     * Entity CRUD: Update
     */
    public function updateEntity(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'syofficial', 'edit');
        OfficialEntity::query()->findOrFail($id);

        $validated = $request->validate([
            'category_id' => 'required|exists:official_categories,id',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'image_file' => $this->images->rules(),
            'socials' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $image = $request->file('image_file');
        $storedImage = $image instanceof UploadedFile
            ? $this->images->store($image, 'directories/syofficial')
            : null;
        $socials = array_filter($validated['socials'] ?? [], fn ($url) => ! empty($url) && is_string($url) && ! empty(trim($url)));

        try {
            DB::transaction(function () use ($id, $socials, $storedImage, $validated): void {
                $entity = OfficialEntity::query()->lockForUpdate()->findOrFail($id);
                $oldImage = $entity->image;
                $entity->update([
                    'category_id' => $validated['category_id'],
                    'name' => $validated['name'],
                    'name_ar' => $validated['name_ar'],
                    'description' => $validated['description'] ?? null,
                    'description_ar' => $validated['description_ar'] ?? null,
                    'image' => $storedImage?->url ?? $oldImage,
                    'socials' => $socials,
                    'is_active' => $validated['is_active'] ?? $entity->is_active,
                ]);
                if ($storedImage !== null) {
                    $this->queueEntityImageDeletion($oldImage, $entity->id);
                }
            });
        } catch (Throwable $error) {
            if ($storedImage !== null) {
                $this->images->discard($storedImage);
            }

            throw $error;
        }

        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث البيانات بنجاح');
    }

    /**
     * Entity CRUD: Delete
     */
    public function destroyEntity(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'syofficial', 'delete');
        DB::transaction(function () use ($id): void {
            $entity = OfficialEntity::query()->lockForUpdate()->findOrFail($id);
            $image = $entity->image;
            $entity->delete();
            $this->queueEntityImageDeletion($image, $entity->id);
        });
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الجهة الرسمية بنجاح');
    }

    /**
     * Reorder Categories (Drag-and-Drop)
     */
    public function reorderCategories(Request $request)
    {
        $this->access->authorizeAction($request, 'syofficial', 'reorder');
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
        $this->access->authorizeAction($request, 'syofficial', 'reorder');
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

    private function flushCache(): void
    {
        Cache::forget('syofficial:db_categories_v2');
        Cache::forget('syofficial:db_entities_v2');
    }

    private function queueEntityImageDeletion(?string $url, string $id): void
    {
        $this->images->queueManagedUrlDeletion($url, 'directories/syofficial');
        $this->images->queueLegacyWebUrlDeletion($url, 'syofficial/entities', $id);
    }
}
