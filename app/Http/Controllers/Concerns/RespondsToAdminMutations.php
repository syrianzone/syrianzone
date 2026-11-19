<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;

trait RespondsToAdminMutations
{
    protected function adminMutationResponse(string $message): JsonResponse|RedirectResponse
    {
        if (request()->wantsJson() && ! request()->header('X-Inertia')) {
            return response()->json(['success' => true, 'message' => $message]);
        }

        return redirect()->back()->with('success', $message);
    }
}
