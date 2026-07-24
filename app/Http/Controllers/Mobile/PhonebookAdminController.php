<?php

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Services\DirectoryAdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class PhonebookAdminController extends Controller
{
    public function __construct(private readonly DirectoryAdminAccess $access) {}

    public function index(Request $request): JsonResponse
    {
        $this->access->authorizeRead($request, 'phonebook');

        return response()->json(['data' => [
            'categories' => PhonebookCategory::query()
                ->orderBy('order_column')
                ->orderBy('id')
                ->get()
                ->map(fn (PhonebookCategory $category): array => $this->categoryResource($category))
                ->values(),
            'entries' => PhonebookEntry::query()
                ->orderBy('order_column')
                ->orderBy('id')
                ->get()
                ->map(fn (PhonebookEntry $entry): array => $this->entryResource($entry))
                ->values(),
        ]]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'create');
        $data = $request->validate([
            'icon' => ['nullable', 'string', 'max:64'],
            'id' => ['nullable', 'string', 'max:64', 'alpha_dash', Rule::unique('phonebook_categories', 'id')],
            'is_active' => ['required', 'boolean'],
            'label_ar' => ['required', 'string', 'max:255'],
            'label_en' => ['required', 'string', 'max:255'],
        ]);
        $data['id'] ??= 'phonebook_category_'.Str::lower((string) Str::ulid());

        $category = DB::transaction(function () use ($data): PhonebookCategory {
            $data['order_column'] = ((int) PhonebookCategory::query()->max('order_column')) + 1;

            return PhonebookCategory::create($data);
        });
        $this->flushCache();

        return response()->json(['data' => $this->categoryResource($category)], 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'edit');
        $category = PhonebookCategory::query()->findOrFail($id);
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
        $this->access->authorizeAction($request, 'phonebook', 'delete');
        PhonebookCategory::query()->findOrFail($id)->delete();
        $this->flushCache();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function storeEntry(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'create');
        $data = $this->validateEntry($request, true);
        $data['id'] ??= 'phone_'.Str::lower((string) Str::ulid());

        $entry = DB::transaction(function () use ($data): PhonebookEntry {
            return PhonebookEntry::create([
                'category_id' => $data['category_id'],
                'id' => $data['id'],
                'is_active' => $data['is_active'],
                'is_whatsapp' => $data['is_whatsapp'],
                'name_ar' => $data['name_ar'],
                'name_en' => $data['name_en'] ?? null,
                'number' => $data['number'],
                'order_column' => ((int) PhonebookEntry::query()
                    ->where('category_id', $data['category_id'])
                    ->max('order_column')) + 1,
                'source_url' => $data['source_url'] ?? null,
            ]);
        });
        $this->flushCache();

        return response()->json(['data' => $this->entryResource($entry)], 201);
    }

    public function updateEntry(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'edit');
        $data = $this->validateEntry($request, false);
        $entry = DB::transaction(function () use ($data, $id, $request): PhonebookEntry {
            $entry = PhonebookEntry::query()->lockForUpdate()->findOrFail($id);
            if ((bool) $data['is_active'] !== (bool) $entry->is_active) {
                $this->access->authorizeAction($request, 'phonebook', 'toggle');
            }
            $entry->update([
                'category_id' => $data['category_id'],
                'is_active' => $data['is_active'],
                'is_whatsapp' => $data['is_whatsapp'],
                'name_ar' => $data['name_ar'],
                'name_en' => $data['name_en'] ?? null,
                'number' => $data['number'],
                'source_url' => $data['source_url'] ?? null,
            ]);

            return $entry;
        });
        $this->flushCache();

        return response()->json(['data' => $this->entryResource($entry->fresh())]);
    }

    public function updateEntryVisibility(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'toggle');
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $entry = PhonebookEntry::query()->findOrFail($id);
        $entry->update(['is_active' => $data['is_active']]);
        $this->flushCache();

        return response()->json(['data' => $this->entryResource($entry->fresh())]);
    }

    public function destroyEntry(Request $request, string $id): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'delete');
        PhonebookEntry::query()->findOrFail($id)->delete();
        $this->flushCache();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function reorderCategories(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'reorder');
        $data = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['required', 'string', 'distinct', 'exists:phonebook_categories,id'],
        ]);
        DB::transaction(function () use ($data): void {
            foreach ($data['order'] as $index => $id) {
                PhonebookCategory::query()
                    ->whereKey($id)
                    ->update(['order_column' => $index + 1]);
            }
        });
        $this->flushCache();

        return response()->json(['data' => ['success' => true]]);
    }

    public function reorderEntries(Request $request): JsonResponse
    {
        $this->access->authorizeAction($request, 'phonebook', 'reorder');
        $data = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['required', 'string', 'distinct', 'exists:phonebook_entries,id'],
        ]);
        DB::transaction(function () use ($data): void {
            foreach ($data['order'] as $index => $id) {
                PhonebookEntry::query()
                    ->whereKey($id)
                    ->update(['order_column' => $index + 1]);
            }
        });
        $this->flushCache();

        return response()->json(['data' => ['success' => true]]);
    }

    private function validateEntry(Request $request, bool $creating): array
    {
        $rules = [
            'category_id' => ['required', 'string', 'exists:phonebook_categories,id'],
            'is_active' => ['required', 'boolean'],
            'is_whatsapp' => ['required', 'boolean'],
            'name_ar' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],
            'number' => ['required', 'string', 'max:64'],
            'source_url' => ['nullable', 'url:http,https', 'max:500'],
        ];
        if ($creating) {
            $rules['id'] = [
                'nullable',
                'string',
                'max:128',
                'alpha_dash',
                Rule::unique('phonebook_entries', 'id'),
            ];
        }

        return $request->validate($rules);
    }

    private function categoryResource(PhonebookCategory $category): array
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

    private function entryResource(PhonebookEntry $entry): array
    {
        return [
            'category_id' => $entry->category_id,
            'id' => $entry->id,
            'is_active' => (bool) $entry->is_active,
            'is_whatsapp' => (bool) $entry->is_whatsapp,
            'name_ar' => $entry->name_ar,
            'name_en' => $entry->name_en,
            'number' => $entry->number,
            'order_column' => (int) $entry->order_column,
            'source_url' => $entry->source_url,
        ];
    }

    private function flushCache(): void
    {
        Cache::forget('phonebook:db_categories_v1');
        Cache::forget('phonebook:db_entries_v1');
    }
}
