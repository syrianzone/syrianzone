<?php

namespace App\Http\Controllers;

use App\Exceptions\Directories\DirectoryActionException;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin dashboard for the SyOfficial directory.
 *
 * This class is now only a transport adapter: validation, then a delegation to
 * SyOfficialDirectoryService. The same service backs the agent MCP tools, so a
 * rule enforced here is enforced there too. Do not re-inline domain logic in
 * this file.
 */
class SyOfficialAdminController extends Controller
{
    public function __construct(
        private readonly SyOfficialDirectoryService $directory,
        private readonly SyOfficialPresenter $presenter,
    ) {}

    public function renderIndex()
    {
        return inertia('Admin/SyOfficial/Index', [
            'categories' => $this->directory->categories(),
            'entities' => $this->directory->entities(),
        ]);
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'id' => 'required|string|max:64|unique:official_categories,id|alpha_dash',
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        return $this->write(
            fn () => $this->directory->createCategory($validated),
            'تم إضافة الفئة بنجاح',
        );
    }

    public function updateCategory(Request $request, string $id): RedirectResponse
    {
        // Validate before the lookup, matching the previous behaviour where the
        // form's required fields were checked first.
        $validated = $request->validate([
            'label_ar' => 'required|string|max:255',
            'label_en' => 'required|string|max:255',
            'icon' => 'nullable|string|max:64',
            'is_active' => 'boolean',
        ]);

        return $this->write(
            fn () => $this->directory->updateCategory($id, $validated),
            'تم تحديث الفئة بنجاح',
        );
    }

    public function destroyCategory(string $id): RedirectResponse
    {
        return $this->write(
            fn () => $this->directory->deleteCategory($id),
            'تم حذف الفئة بنجاح',
        );
    }

    public function storeEntity(Request $request): RedirectResponse
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

        return $this->write(
            fn () => $this->directory->createEntity(
                $validated,
                $validated['socials'] ?? [],
                $request->file('image_file'),
            ),
            'تم إضافة الجهة الرسمية بنجاح',
        );
    }

    /**
     * Registered for both POST and PUT. The Inertia form posts, the agent-facing
     * convention uses PUT; same handler either way.
     */
    public function updateEntity(Request $request, string $id): RedirectResponse
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

        return $this->write(
            fn () => $this->directory->updateEntity(
                $id,
                $validated,
                // null means "leave the existing list alone". The dashboard form
                // always submits this field, so its behaviour is unchanged; the
                // difference only shows for a caller that omits socials entirely,
                // which previously wiped the column.
                $validated['socials'] ?? null,
                $request->file('image_file'),
            ),
            'تم تحديث البيانات بنجاح',
        );
    }

    public function destroyEntity(string $id): RedirectResponse
    {
        return $this->write(
            fn () => $this->directory->deleteEntity($id),
            'تم حذف الجهة الرسمية بنجاح',
        );
    }

    public function reorderCategories(Request $request): Response
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_categories,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        return $this->writeJson(
            fn () => $this->directory->reorderCategories($validated['orders']),
        );
    }

    public function reorderEntities(Request $request): Response
    {
        $validated = $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:official_entities,id',
            'orders.*.order_column' => 'required|integer',
        ]);

        return $this->writeJson(
            fn () => $this->directory->reorderEntities($validated['orders']),
        );
    }

    /**
     * Run a domain action and redirect back with the admin's success toast.
     *
     * The service refuses with DirectoryActionException instead of calling
     * abort() or findOrFail(), so that the MCP tools can report the same
     * refusals in agent language. This is where that becomes an HTTP status
     * again: a missing id is a 404, anything else is a 422 with the message.
     */
    private function write(Closure $action, string $success): RedirectResponse
    {
        try {
            $action();
        } catch (DirectoryActionException $e) {
            if (in_array($e->kind, [DirectoryActionException::NOT_FOUND, DirectoryActionException::CATEGORY_NOT_FOUND], true)) {
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
            if (in_array($e->kind, [DirectoryActionException::NOT_FOUND, DirectoryActionException::CATEGORY_NOT_FOUND], true)) {
                abort(404, $e->getMessage());
            }

            return response()->json(['message' => $e->getMessage()], $e->httpStatus());
        }

        return response()->json(['message' => 'تم إعادة الترتيب بنجاح']);
    }
}
