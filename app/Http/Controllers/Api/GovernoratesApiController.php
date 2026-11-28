<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Governorates\GovernorateDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public read-only JSON API for the 14 Syrian governorates.
 */
class GovernoratesApiController extends Controller
{
    public function __construct(
        private readonly GovernorateDataService $data,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $hub = $this->data->forHub();
        $governorates = is_array($hub['governorates'] ?? null) ? $hub['governorates'] : [];

        $payload = [
            'data' => $hub,
            'meta' => [
                'count' => count($governorates),
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $detail = $this->data->forGovernorate($id);
        abort_if($detail === null, 404);

        $payload = [
            'data' => $detail,
            'meta' => [
                'id' => $id,
            ],
        ];

        return $this->cachedJson($request, $payload, 300);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function cachedJson(Request $request, array $payload, int $maxAge): JsonResponse
    {
        $etag = '"'.sha1((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)).'"';
        $headers = [
            'Cache-Control' => "public, max-age={$maxAge}",
            'ETag' => $etag,
        ];

        if ($request->header('If-None-Match') === $etag) {
            return response()->json(null, 304, $headers);
        }

        return response()->json($payload, 200, $headers);
    }
}
