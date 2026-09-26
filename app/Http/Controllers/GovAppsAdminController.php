<?php

namespace App\Http\Controllers;

use App\Exceptions\Directories\DirectoryActionException;
use App\Services\GovApps\GovAppPresenter;
use App\Services\GovApps\GovAppService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP adapter for the government apps admin.
 *
 * Every write delegates to GovAppService, which is also what the agent MCP
 * tools call. This class is left with request validation, the response shape,
 * and the domain-exception to status-code mapping — nothing else.
 */
class GovAppsAdminController extends Controller
{
    public function __construct(
        private readonly GovAppService $apps,
        private readonly GovAppPresenter $presenter,
    ) {}

    public function renderIndex()
    {
        return inertia('Admin/GovApps/Index', [
            'apps' => $this->apps->apps(),
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
            'icon_file' => 'nullable|image|max:5120',
            'links' => 'nullable|array',
            'links.*' => 'nullable|string|max:2048|starts_with:http://,https://',
            'is_active' => 'boolean',
        ]);

        return $this->write(
            fn () => $this->apps->create(
                $validated,
                $validated['links'] ?? [],
                $request->file('icon_file'),
            ),
            'تم إضافة التطبيق الحكومي بنجاح',
        );
    }

    public function update(Request $request, string $id): RedirectResponse
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

        return $this->write(
            fn () => $this->apps->update(
                $id,
                $validated,
                // null means "leave the existing links alone". The dashboard
                // form always submits this field; a caller that omits links
                // entirely previously wiped the column.
                $validated['links'] ?? null,
                $request->file('icon_file'),
            ),
            'تم تحديث بيانات التطبيق بنجاح',
        );
    }

    public function destroy(string $id): RedirectResponse
    {
        return $this->write(
            fn () => $this->apps->delete($id),
            'تم حذف التطبيق بنجاح',
        );
    }

    public function reorder(Request $request): Response
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:gov_apps,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        return $this->writeJson(fn () => $this->apps->reorder($validated['orders']));
    }

    private function write(Closure $action, string $success): RedirectResponse
    {
        try {
            $action();
        } catch (DirectoryActionException $e) {
            if ($e->kind === DirectoryActionException::NOT_FOUND) {
                abort(404, $e->getMessage());
            }

            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        }

        return redirect()->back()->with('success', $success);
    }

    private function writeJson(Closure $action): Response
    {
        try {
            $action();
        } catch (DirectoryActionException $e) {
            if ($e->kind === DirectoryActionException::NOT_FOUND) {
                abort(404, $e->getMessage());
            }

            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        }

        return response()->json(['message' => 'تم إعادة الترتيب بنجاح']);
    }
}
