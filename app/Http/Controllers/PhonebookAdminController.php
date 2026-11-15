<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsToAdminMutations;
use App\Services\Phonebook\PhonebookDirectoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse;

/**
 * HTTP adapter for the phonebook admin.
 *
 * Every write delegates to PhonebookDirectoryService, the third directory
 * service next to SyOfficial and Gov Apps: the rules (ids, per-category order,
 * cache flush, the reorder payload) are the module's, not this transport's.
 * Domain refusals (DirectoryActionException) are rendered into standardized
 * HTTP/JSON responses by bootstrap/app.php.
 */
class PhonebookAdminController extends Controller
{
    use RespondsToAdminMutations;

    public function __construct(private readonly PhonebookDirectoryService $directory) {}

    public function renderIndex()
    {
        return inertia('Admin/Phonebook/Index', [
            'categories' => $this->directory->categories(),
            'entries' => $this->directory->entries(),
        ]);
    }

    public function storeCategory(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64|unique:phonebook_categories,id|alpha_dash',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        $this->directory->createCategory($validated);

        return $this->adminMutationResponse('تم إضافة الفئة بنجاح');
    }

    public function updateCategory(Request $request, string $id): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        $this->directory->updateCategory($id, $validated);

        return $this->adminMutationResponse('تم تحديث الفئة بنجاح');
    }

    public function destroyCategory(string $id): JsonResponse|RedirectResponse
    {
        $this->directory->deleteCategory($id);

        return $this->adminMutationResponse('تم حذف الفئة بنجاح');
    }

    public function storeEntry(Request $request): JsonResponse|RedirectResponse
    {
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

        $this->directory->createEntry($validated);

        return $this->adminMutationResponse('تم إضافة الرقم بنجاح');
    }

    /**
     * Registered for both POST and PUT, matching the other two directories.
     */
    public function updateEntry(Request $request, string $id): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:phonebook_categories,id',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'nullable|string|max:255',
            'number' => 'required|string|max:64',
            'is_whatsapp' => 'boolean',
            'source_url' => 'nullable|url|max:500',
            'is_active' => 'boolean',
        ]);

        $this->directory->updateEntry($id, $validated);

        return $this->adminMutationResponse('تم تحديث البيانات بنجاح');
    }

    public function toggleEntryActive(string $id): JsonResponse|RedirectResponse
    {
        $entry = $this->directory->toggleEntryActive($id);

        return $this->adminMutationResponse($entry->is_active ? 'تم إظهار الرقم بنجاح' : 'تم إخفاء الرقم بنجاح');
    }

    public function destroyEntry(string $id): JsonResponse|RedirectResponse
    {
        $this->directory->deleteEntry($id);

        return $this->adminMutationResponse('تم حذف الرقم بنجاح');
    }

    public function reorderCategories(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:phonebook_categories,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->directory->reorderCategories($validated['orders']);

        return $this->adminMutationResponse('تم إعادة الترتيب بنجاح');
    }

    public function reorderEntries(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:phonebook_entries,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->directory->reorderEntries($validated['orders']);

        return $this->adminMutationResponse('تم إعادة الترتيب بنجاح');
    }
}
