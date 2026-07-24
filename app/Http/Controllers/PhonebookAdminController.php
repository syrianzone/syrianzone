<?php

namespace App\Http\Controllers;

use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Services\DirectoryAdminAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PhonebookAdminController extends Controller
{
    public function __construct(private readonly DirectoryAdminAccess $access) {}

    /**
     * Render the admin management dashboard for Phonebook.
     */
    public function renderIndex(Request $request)
    {
        $this->access->authorizeRead($request, 'phonebook');
        $categories = PhonebookCategory::orderBy('order_column')->get();
        $entries = PhonebookEntry::with('category')
            ->orderBy('order_column')
            ->get();

        return inertia('Admin/Phonebook/Index', [
            'categories' => $categories,
            'entries' => $entries,
        ]);
    }

    /**
     * Category CRUD: Store
     */
    public function storeCategory(Request $request)
    {
        $this->access->authorizeAction($request, 'phonebook', 'create');
        $validated = $request->validate([
            'id' => 'required|string|max:64|unique:phonebook_categories,id|alpha_dash',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        $maxOrder = PhonebookCategory::max('order_column') ?? 0;
        $validated['order_column'] = $maxOrder + 1;
        $validated['is_active'] = $validated['is_active'] ?? true;

        PhonebookCategory::create($validated);
        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة الفئة بنجاح');
    }

    /**
     * Category CRUD: Update
     */
    public function updateCategory(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'phonebook', 'edit');
        $category = PhonebookCategory::findOrFail($id);

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
        $this->access->authorizeAction($request, 'phonebook', 'delete');
        $category = PhonebookCategory::findOrFail($id);
        $category->delete();
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الفئة بنجاح');
    }

    /**
     * Entry CRUD: Store
     */
    public function storeEntry(Request $request)
    {
        $this->access->authorizeAction($request, 'phonebook', 'create');
        $validated = $request->validate([
            'id' => 'nullable|string|max:128|unique:phonebook_entries,id|alpha_dash',
            'category_id' => 'required|exists:phonebook_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'number' => 'required|string|max:64',
            'is_whatsapp' => 'boolean',
            'source_url' => 'nullable|url|max:500',
            'is_active' => 'boolean',
        ]);

        if (empty($validated['id'])) {
            $validated['id'] = 'phone_'.time().'_'.rand(100, 999);
        }

        $validated['source_url'] = ! empty($validated['source_url']) && ! empty(trim($validated['source_url'])) ? trim($validated['source_url']) : null;
        $validated['name_en'] = ! empty($validated['name_en']) && ! empty(trim($validated['name_en'])) ? trim($validated['name_en']) : null;

        $maxOrder = PhonebookEntry::where('category_id', $validated['category_id'])->max('order_column') ?? 0;
        $validated['order_column'] = $maxOrder + 1;
        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['is_whatsapp'] = $validated['is_whatsapp'] ?? false;

        PhonebookEntry::create($validated);
        $this->flushCache();

        return redirect()->back()->with('success', 'تم إضافة الرقم بنجاح');
    }

    /**
     * Entry CRUD: Update
     */
    public function updateEntry(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'phonebook', 'edit');
        $entry = PhonebookEntry::findOrFail($id);

        $validated = $request->validate([
            'category_id' => 'required|exists:phonebook_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'number' => 'required|string|max:64',
            'is_whatsapp' => 'boolean',
            'source_url' => 'nullable|url|max:500',
            'is_active' => 'boolean',
        ]);

        $validated['source_url'] = ! empty($validated['source_url']) && ! empty(trim($validated['source_url'])) ? trim($validated['source_url']) : null;
        $validated['name_en'] = ! empty($validated['name_en']) && ! empty(trim($validated['name_en'])) ? trim($validated['name_en']) : null;

        $entry->update($validated);
        $this->flushCache();

        return redirect()->back()->with('success', 'تم تحديث البيانات بنجاح');
    }

    /**
     * Entry CRUD: Toggle Active/Hidden State
     */
    public function toggleEntryActive(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'phonebook', 'toggle');
        $entry = PhonebookEntry::findOrFail($id);
        $entry->is_active = ! $entry->is_active;
        $entry->save();
        $this->flushCache();

        return redirect()->back()->with('success', $entry->is_active ? 'تم إظهار الرقم بنجاح' : 'تم إخفاء الرقم بنجاح');
    }

    /**
     * Entry CRUD: Delete
     */
    public function destroyEntry(Request $request, string $id)
    {
        $this->access->authorizeAction($request, 'phonebook', 'delete');
        $entry = PhonebookEntry::findOrFail($id);
        $entry->delete();
        $this->flushCache();

        return redirect()->back()->with('success', 'تم حذف الرقم بنجاح');
    }

    /**
     * Drag-and-drop reorder categories
     */
    public function reorderCategories(Request $request)
    {
        $this->access->authorizeAction($request, 'phonebook', 'reorder');
        $request->validate([
            'order' => 'required|array',
            'order.*' => 'string|exists:phonebook_categories,id',
        ]);

        foreach ($request->order as $index => $id) {
            PhonebookCategory::where('id', $id)->update(['order_column' => $index + 1]);
        }

        $this->flushCache();

        return response()->json(['success' => true]);
    }

    /**
     * Drag-and-drop reorder entries
     */
    public function reorderEntries(Request $request)
    {
        $this->access->authorizeAction($request, 'phonebook', 'reorder');
        $request->validate([
            'order' => 'required|array',
            'order.*' => 'string|exists:phonebook_entries,id',
        ]);

        foreach ($request->order as $index => $id) {
            PhonebookEntry::where('id', $id)->update(['order_column' => $index + 1]);
        }

        $this->flushCache();

        return response()->json(['success' => true]);
    }

    private function flushCache(): void
    {
        Cache::forget('phonebook:db_categories_v1');
        Cache::forget('phonebook:db_entries_v1');
    }
}
