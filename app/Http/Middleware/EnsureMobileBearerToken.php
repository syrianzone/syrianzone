<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\Response;

class EnsureMobileBearerToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainTextToken = $request->bearerToken();

        if (! $plainTextToken) {
            return $this->unauthenticated();
        }

        $tokenModel = Sanctum::$personalAccessTokenModel;
        $accessToken = $tokenModel::findToken($plainTextToken);
        $sanctumExpiration = config('sanctum.expiration');
        $expiredByConfig = $accessToken
          && $sanctumExpiration
          && $accessToken->created_at->lte(now()->subMinutes((int) $sanctumExpiration));
        $expiredAt = $accessToken?->expires_at?->isPast() ?? false;
        $user = $accessToken?->tokenable;
        $abilities = $accessToken?->abilities ?? [];
        $hasMobileProvenance = $accessToken
          && str_starts_with($accessToken->name, 'mobile:')
          && in_array('mobile', $abilities, true)
          && ! in_array('*', $abilities, true);

        if (
            ! $accessToken
            || $expiredByConfig
            || $expiredAt
            || ! $user instanceof User
            || ! $hasMobileProvenance
        ) {
            return $this->unauthenticated();
        }

        if ($user->is_banned) {
            $user->tokens()->delete();

            return response()->json(['error' => 'account_disabled'], 403);
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();
        $user->withAccessToken($accessToken);
        $request->setUserResolver(static fn () => $user);

        return $next($request);
    }

    private function unauthenticated(): JsonResponse
    {
        return response()->json(['message' => 'Unauthenticated.'], 401);
    }
}
