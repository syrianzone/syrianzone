<?php

declare(strict_types=1);

namespace App\Http\Controllers\Mobile;

use App\Http\Controllers\Controller;
use App\Services\PublicContent\ContributorDirectoryService;
use App\Services\PublicContent\DirectoryDataService;
use App\Services\PublicContent\HomeContentService;
use App\Services\PublicContent\HouseDataService;
use App\Services\PublicContent\TransitRouteDetailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PublicContentController extends Controller
{
    public function __construct(
        private readonly DirectoryDataService $directories,
        private readonly HomeContentService $homeContent,
        private readonly HouseDataService $houseData,
        private readonly ContributorDirectoryService $contributors,
        private readonly TransitRouteDetailService $transitRoutes,
    ) {}

    public function home(): JsonResponse
    {
        return response()->json(['data' => $this->homeContent->mobilePayload()]);
    }

    public function officialAccounts(): JsonResponse
    {
        return response()->json(['data' => $this->directories->officialAccounts()]);
    }

    public function phonebook(): JsonResponse
    {
        return response()->json(['data' => $this->directories->phonebook()]);
    }

    public function sites(): JsonResponse
    {
        return response()->json(['data' => $this->directories->sites()]);
    }

    public function parties(): JsonResponse
    {
        return response()->json(['data' => $this->directories->parties()]);
    }

    public function governmentApps(): JsonResponse
    {
        return response()->json(['data' => $this->directories->governmentApps()]);
    }

    public function house(Request $request): JsonResponse
    {
        $request->validate([
            'mode' => ['sometimes', 'string', Rule::in(['voters', 'candidates', 'winners', 'presidential'])],
            'province' => ['sometimes', 'string', Rule::in(array_keys(HouseDataService::PROVINCE_URLS))],
        ]);

        $mode = (string) $request->query('mode', 'voters');
        $province = (string) $request->query('province', 'damascus');

        return response()->json(['data' => $this->houseData->get($mode, $province)]);
    }

    public function contributors(): JsonResponse
    {
        return response()->json(['data' => $this->contributors->all()]);
    }

    public function contributor(string $username): JsonResponse
    {
        $contributor = $this->contributors->find($username);
        if ($contributor === null) {
            return response()->json(['message' => 'Contributor not found.'], 404);
        }

        return response()->json(['data' => $contributor]);
    }

    public function transitRoute(string $cityId, string $routeId): JsonResponse
    {
        $route = $this->transitRoutes->find($cityId, $routeId);
        if ($route === null) {
            return response()->json(['message' => 'Transit route not found.'], 404);
        }

        return response()->json(['data' => $route]);
    }
}
