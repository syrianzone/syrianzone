<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Services\DirectoryAdminAccess;
use App\Services\DirectoryImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

final class SyOfficialAdminController extends Controller
{
    private const SOCIAL_KEYS = [
        'website',
        'facebook',
        'facebook_secondary',
        'twitter',
        'twitter_secondary',
        'instagram',
        'instagram_secondary',
        'telegram',
        'telegram_secondary',
        'linkedin',
        'youtube',
        'whatsapp',
    ];

    public function __construct(
        private readonly DirectoryAdminAccess $access,
        private readonly DirectoryImageService $images,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->access->authorizeRead($request, 'syofficial');

        return response()->json(['data' => [
            'categories' => OfficialCategory::query()
                ->orderBy('order_column')
                ->orderBy('id')
                ->get()
                ->map(fn (OfficialCategory $category): array => $this->categoryResource($category))
                ->values(),
            'entities' => OfficialEntity::query()
                ->orderBy('order_column')
                ->orderBy('id')
                ->get()
                ->map(fn (OfficialEntity $entity): array => $this->entityResource($entity))
                ->values(),
        ]]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'create');
        $data = $request->validate([
            'icon' => ['nullable', 'string', 'max:64'],
            'id' => ['nullable', 'string', 'max:64', 'alpha_dash', Rule::unique('official_categories', 'id')],
            'is_active' => ['required', 'boolean'],
            'label_ar' => ['required', 'string', 'max:255'],
            'label_en' => ['required', 'string', 'max:255'],
        ]);
        $data['id'] ??= 'official_category_'.Str::lower((string) Str::ulid());

        $category = DB::transaction(function () use ($data): OfficialCategory {
            $data['order_column'] = ((int) OfficialCategory::query()->max('order_column')) + 1;

            return OfficialCategory::create($data);
        });
        $this->flushCache();

        return response()->json(['data' => $this->categoryResource($category)], 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'edit');
        $category = OfficialCategory::query()->findOrFail($id);
        $data = $request->validate([
            'icon' => ['nullable', 'string', 'max:64'],
            'is_active' => ['required', 'boolean'],
            'label_ar' => ['required', 'string', 'max:255'],
            'label_en' => ['required', 'string', 'max:255'],
        ]);
        $category->update($data);
        $this->flushCache();

        return response()->json(['data' => $this->categoryResource($category->fresh())]);
    }

    public function destroyCategory(Request $request, string $id): JsonResponse
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

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function storeEntity(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'create');
        $data = $this->validateEntity($request, true);
        $image = $request->file('image_file');
        $storedImage = $image instanceof UploadedFile
            ? $this->images->store($image, 'directories/syofficial')
            : null;

        try {
            $entity = DB::transaction(function () use ($data, $storedImage): OfficialEntity {
                return OfficialEntity::create([
                    'category_id' => $data['category_id'],
                    'description' => $data['description'] ?? null,
                    'description_ar' => $data['description_ar'] ?? null,
                    'id' => $data['id'],
                    'image' => $storedImage?->url,
                    'is_active' => $data['is_active'],
                    'name' => $data['name'],
                    'name_ar' => $data['name_ar'],
                    'order_column' => ((int) OfficialEntity::query()
                        ->where('category_id', $data['category_id'])
                        ->max('order_column')) + 1,
                    'socials' => $this->cleanUrls($data['socials'] ?? []),
                ]);
            });
        } catch (Throwable $error) {
            if ($storedImage !== null) {
                $this->images->discard($storedImage);
            }

            throw $error;
        }
        $this->flushCache();

        return response()->json(['data' => $this->entityResource($entity)], 201);
    }

    public function updateEntity(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'edit');
        OfficialEntity::query()->findOrFail($id);
        $data = $this->validateEntity($request, false);
        $image = $request->file('image_file');
        $storedImage = $image instanceof UploadedFile
            ? $this->images->store($image, 'directories/syofficial')
            : null;

        try {
            $entity = DB::transaction(function () use ($data, $id, $storedImage): OfficialEntity {
                $locked = OfficialEntity::query()->lockForUpdate()->findOrFail($id);
                $oldImage = $locked->image;
                $locked->update([
                    'category_id' => $data['category_id'],
                    'description' => $data['description'] ?? null,
                    'description_ar' => $data['description_ar'] ?? null,
                    'image' => $storedImage?->url ?? $oldImage,
                    'is_active' => $data['is_active'],
                    'name' => $data['name'],
                    'name_ar' => $data['name_ar'],
                    'socials' => $this->cleanUrls($data['socials'] ?? []),
                ]);
                if ($storedImage !== null) {
                    $this->queueEntityImageDeletion($oldImage, $locked->id);
                }

                return $locked;
            });
        } catch (Throwable $error) {
            if ($storedImage !== null) {
                $this->images->discard($storedImage);
            }

            throw $error;
        }
        $this->flushCache();

        return response()->json(['data' => $this->entityResource($entity->fresh())]);
    }

    public function updateEntityVisibility(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'toggle');
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $entity = OfficialEntity::query()->findOrFail($id);
        $entity->update(['is_active' => $data['is_active']]);
        $this->flushCache();

        return response()->json(['data' => $this->entityResource($entity->fresh())]);
    }

    public function destroyEntity(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'delete');
        DB::transaction(function () use ($id): void {
            $entity = OfficialEntity::query()->lockForUpdate()->findOrFail($id);
            $image = $entity->image;
            $entity->delete();
            $this->queueEntityImageDeletion($image, $entity->id);
        });
        $this->flushCache();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function reorderCategories(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'reorder');
        $data = $request->validate([
            'orders' => ['required', 'array', 'min:1'],
            'orders.*.id' => ['required', 'string', 'distinct', 'exists:official_categories,id'],
            'orders.*.order_column' => ['required', 'integer', 'min:0'],
        ]);
        DB::transaction(function () use ($data): void {
            foreach ($data['orders'] as $order) {
                OfficialCategory::query()
                    ->whereKey($order['id'])
                    ->update(['order_column' => $order['order_column']]);
            }
        });
        $this->flushCache();

        return response()->json(['data' => ['success' => true]]);
    }

    public function reorderEntities(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'syofficial', 'reorder');
        $data = $request->validate([
            'orders' => ['required', 'array', 'min:1'],
            'orders.*.id' => ['required', 'string', 'distinct', 'exists:official_entities,id'],
            'orders.*.order_column' => ['required', 'integer', 'min:0'],
        ]);
        DB::transaction(function () use ($data): void {
            foreach ($data['orders'] as $order) {
                OfficialEntity::query()
                    ->whereKey($order['id'])
                    ->update(['order_column' => $order['order_column']]);
            }
        });
        $this->flushCache();

        return response()->json(['data' => ['success' => true]]);
    }

    private function validateEntity(Request $request, bool $creating): array
    {
        $rules = [
            'category_id' => ['required', 'string', 'exists:official_categories,id'],
            'description' => ['nullable', 'string', 'max:5000'],
            'description_ar' => ['nullable', 'string', 'max:5000'],
            'image_file' => $this->images->rules(),
            'is_active' => ['required', 'boolean'],
            'name' => ['required', 'string', 'max:255'],
            'name_ar' => ['required', 'string', 'max:255'],
            'socials' => ['sometimes', 'array:'.implode(',', self::SOCIAL_KEYS)],
            'socials.*' => ['nullable', 'url:http,https', 'max:2048'],
        ];
        if ($creating) {
            $rules['id'] = [
                'required',
                'string',
                'max:128',
                'alpha_dash',
                Rule::unique('official_entities', 'id'),
            ];
        }

        return $request->validate($rules);
    }

    private function cleanUrls(array $urls): array
    {
        return array_map(
            static fn (string $url): string => trim($url),
            array_filter($urls, static fn (mixed $url): bool => is_string($url) && trim($url) !== ''),
        );
    }

    private function categoryResource(OfficialCategory $category): array
    {
        return [
            'icon' => $category->icon,
            'id' => $category->id,
            'is_active' => (bool) $category->is_active,
            'label_ar' => $category->label_ar,
            'label_en' => $category->label_en,
            'order_column' => (int) $category->order_column,
        ];
    }

    private function entityResource(OfficialEntity $entity): array
    {
        return [
            'category_id' => $entity->category_id,
            'description' => $entity->description,
            'description_ar' => $entity->description_ar,
            'id' => $entity->id,
            'image' => $entity->image,
            'is_active' => (bool) $entity->is_active,
            'name' => $entity->name,
            'name_ar' => $entity->name_ar,
            'order_column' => (int) $entity->order_column,
            'socials' => (object) ($entity->socials ?? []),
        ];
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
