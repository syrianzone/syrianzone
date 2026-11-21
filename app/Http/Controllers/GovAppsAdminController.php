<?php

namespace App\Http\Controllers;

use App\Services\Directories\DirectorySuggestionService;
use App\Services\GovApps\GovAppService;
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
    public function __construct(private readonly GovAppService $apps) {}

    public function renderIndex()
    {
        return inertia('Admin/GovApps/Index', [
            'apps' => $this->apps->apps(),
            'pendingSuggestionsCount' => app(DirectorySuggestionService::class)->pendingCount('govapps'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:128|unique:gov_apps,id|alpha_dash',
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'official_entity_id' => 'nullable|string|max:128|exists:official_entities,id',
            'overview_ar' => 'nullable|string|max:10000',
            'features' => 'nullable|array|max:20',
            'features.*' => 'nullable|string|max:500',
            'requirements' => 'nullable|array|max:20',
            'requirements.*' => 'nullable|string|max:500',
            'faqs' => 'nullable|array|max:20',
            'faqs.*.q' => 'required_with:faqs|string|max:500',
            'faqs.*.a' => 'required_with:faqs|string|max:2000',
            'verified_at' => 'nullable|date',
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

        return redirect()->back()->with('success', 'تم إضافة التطبيق الحكومي بنجاح');
    }

    public function update(Request $request, string $id): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'name_ar' => 'required|string|max:255',
            'description' => 'nullable|string',
            'description_ar' => 'nullable|string',
            'official_entity_id' => 'sometimes|nullable|string|max:128|exists:official_entities,id',
            'overview_ar' => 'sometimes|nullable|string|max:10000',
            'features' => 'sometimes|nullable|array|max:20',
            'features.*' => 'nullable|string|max:500',
            'requirements' => 'sometimes|nullable|array|max:20',
            'requirements.*' => 'nullable|string|max:500',
            'faqs' => 'sometimes|nullable|array|max:20',
            'faqs.*.q' => 'required_with:faqs|string|max:500',
            'faqs.*.a' => 'required_with:faqs|string|max:2000',
            'verified_at' => 'sometimes|nullable|date',
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

        return redirect()->back()->with('success', 'تم تحديث بيانات التطبيق بنجاح');
    }

    public function destroy(string $id): RedirectResponse
    {
        $this->apps->delete($id);

        return redirect()->back()->with('success', 'تم حذف التطبيق بنجاح');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:gov_apps,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        $this->apps->reorder($validated['orders']);

        return redirect()->back()->with('success', 'تم إعادة الترتيب بنجاح');
    }
}
