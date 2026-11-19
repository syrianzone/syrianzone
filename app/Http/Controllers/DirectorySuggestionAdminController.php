<?php

namespace App\Http\Controllers;

use App\Services\Directories\DirectorySuggestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Module-scoped admin review endpoints for visitor suggestions. Each module's
 * route group fixes its own `module` default and enforces its own
 * `ModuleCapabilityGuard` capability (`*.edit` for mutations, `:any` for reads).
 */
class DirectorySuggestionAdminController extends Controller
{
    public function __construct(private readonly DirectorySuggestionService $service) {}

    public function index(Request $request): JsonResponse
    {
        $module = (string) $request->route('module');
        $status = (string) $request->query('status', 'pending');

        return response()->json($this->service->listForAdmin($module, $status));
    }

    public function accept(Request $request, int $id): JsonResponse
    {
        $module = (string) $request->route('module');
        $validated = $request->validate([
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $suggestion = $this->service->review(
            $request->user(),
            $module,
            $id,
            'accepted',
            $validated['resolution_note'] ?? null,
        );

        return response()->json([
            'suggestion' => $this->service->present($suggestion),
            'message' => 'تم اعتماد الاقتراح ووضع علامة تمت المعالجة.',
        ]);
    }

    public function dismiss(Request $request, int $id): JsonResponse
    {
        $module = (string) $request->route('module');
        $validated = $request->validate([
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $suggestion = $this->service->review(
            $request->user(),
            $module,
            $id,
            'dismissed',
            $validated['resolution_note'] ?? null,
        );

        return response()->json([
            'suggestion' => $this->service->present($suggestion),
            'message' => 'تم إهمال الاقتراح.',
        ]);
    }
}
