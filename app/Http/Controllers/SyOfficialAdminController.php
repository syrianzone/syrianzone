<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsToAdminMutations;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse;

/**
 * Admin dashboard for the SyOfficial directory.
 *
 * This class is now only a transport adapter: validation, then a delegation to
 * SyOfficialDirectoryService. The same service backs the agent MCP tools, so a
 * rule enforced here is enforced there too. Domain refusals
 * (DirectoryActionException) are rendered into standardized HTTP/JSON responses
 * by bootstrap/app.php.
 */
class SyOfficialAdminController extends Controller
{
    use RespondsToAdminMutations;

    public function __construct(private readonly SyOfficialDirectoryService $directory) {}

    public function renderIndex()
    {
        return inertia('Admin/SyOfficial/Index', [
            'categories' => $this->directory->categories(),
            'entities' => $this->directory->entities(),
        ]);
    }

    public function storeCategory(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64|unique:official_categories,id|alpha_dash',
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

    public function storeEntity(Request $request): JsonResponse|RedirectResponse
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

        $this->directory->createEntity(
            $validated,
            $validated['socials'] ?? [],
            $request->file('image_file'),
        );

        return $this->adminMutationResponse('تم إضافة الجهة الرسمية بنجاح');
    }

    /**
     * Registered for both POST and PUT. The Inertia form posts, the agent-facing
     * convention uses PUT; same handler either way.
     */
    public function updateEntity(Request $request, string $id): JsonResponse|RedirectResponse
    {
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

        $this->directory->updateEntity(
            $id,
            $validated,
            // null means "leave the existing list alone". The dashboard form
            // always submits this field, so its behaviour is unchanged; the
            // difference only shows for a caller that omits socials entirely,
            // which previously wiped the column.
            $validated['socials'] ?? null,
            $request->file('image_file'),
        );

        return $this->adminMutationResponse('تم تحديث البيانات بنجاح');
    }

    public function destroyEntity(string $id): JsonResponse|RedirectResponse
    {
        $this->directory->deleteEntity($id);

        return $this->adminMutationResponse('تم حذف الجهة الرسمية بنجاح');
    }

    public function reorderCategories(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_categories,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->directory->reorderCategories($validated['orders']);

        return $this->adminMutationResponse('تم إعادة الترتيب بنجاح');
    }

    public function reorderEntities(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_entities,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->directory->reorderEntities($validated['orders']);

        return $this->adminMutationResponse('تم إعادة الترتيب بنجاح');
    }
}
