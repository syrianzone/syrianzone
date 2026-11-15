<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsToAdminMutations;
use App\Services\GovApps\GovAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse;

/**
 * HTTP adapter for the government apps admin.
 *
 * Every write delegates to GovAppService, which is also what the agent MCP
 * tools call. Domain refusals (DirectoryActionException) are rendered into
 * standardized HTTP/JSON responses by bootstrap/app.php.
 */
class GovAppsAdminController extends Controller
{
    use RespondsToAdminMutations;

    public function __construct(private readonly GovAppService $apps) {}

    public function renderIndex()
    {
        return inertia('Admin/GovApps/Index', [
            'apps' => $this->apps->apps(),
        ]);
    }

    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:gov_apps,id|alpha_dash',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => 'nullable|image|max:5120',
            'links' => 'nullable|array',
            'links.*' => 'nullable|string|max:2048|starts_with:http://,https://',
            'is_active' => 'boolean',
        ]);

        $this->apps->create(
            $validated,
            $validated['links'] ?? [],
            $request->file('icon_file'),
        );

        return $this->adminMutationResponse('تم إضافة التطبيق الحكومي بنجاح');
    }

    public function update(Request $request, string $id): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'icon_file' => 'nullable|image|max:5120',
            'links' => 'nullable|array',
            'links.*' => 'nullable|string|max:2048|starts_with:http://,https://',
            'is_active' => 'boolean',
        ]);

        $this->apps->update(
            $id,
            $validated,
            // null means "leave the existing links alone". The dashboard
            // form always submits this field; a caller that omits links
            // entirely previously wiped the column.
            $validated['links'] ?? null,
            $request->file('icon_file'),
        );

        return $this->adminMutationResponse('تم تحديث بيانات التطبيق بنجاح');
    }

    public function destroy(string $id): JsonResponse|RedirectResponse
    {
        $this->apps->delete($id);

        return $this->adminMutationResponse('تم حذف التطبيق بنجاح');
    }

    public function reorder(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:gov_apps,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->apps->reorder($validated['orders']);

        return $this->adminMutationResponse('تم إعادة الترتيب بنجاح');
    }
}
