<?php

declare(strict_types=1);

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Services\PublicContent\WarningsFeedService;
use Illuminate\Http\JsonResponse;
use RuntimeException;

final class WarningsController extends Controller
{
    public function __construct(private readonly WarningsFeedService $warnings) {}

    public function index(): JsonResponse
    {
        try {
            return response()->json(['data' => $this->warnings->latest()]);
        } catch (RuntimeException) {
            return response()->json(
                ['message' => 'Emergency warnings are temporarily unavailable.'],
                503,
            );
        }
    }
}
