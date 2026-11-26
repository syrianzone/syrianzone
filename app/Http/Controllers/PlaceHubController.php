<?php

namespace App\Http\Controllers;

use App\Services\Places\PlaceHubService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Server-rendered Mishwar governorate and category hub pages.
 */
class PlaceHubController extends Controller
{
    public function __construct(private readonly PlaceHubService $hubs) {}

    public function governorate(string $governorate): Response
    {
        $data = $this->hubs->forGovernorate($governorate);
        abort_if($data === null, 404);

        return Inertia::render('Places/Hub', $this->props($data));
    }

    public function category(string $governorate, string $category): Response|RedirectResponse
    {
        $result = $this->hubs->forCategory($governorate, $category);

        if ($result['status'] === 'not_found') {
            abort(404);
        }

        if ($result['status'] === 'redirect') {
            return redirect($result['to'], 302);
        }

        return Inertia::render('Places/Hub', $this->props($result['data']));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function props(array $data): array
    {
        return [
            'governorate' => $data['governorate'],
            'category' => $data['category'],
            'h1' => $data['h1'],
            'intro' => $data['intro'],
            'total' => $data['total'],
            'mapUrl' => $data['map_url'],
            'governorateUrl' => $data['governorate_url'],
            'hubUrl' => $data['hub_url'],
            'categories' => $data['categories'],
            'places' => $data['places'],
            'otherHubs' => $data['other_hubs'],
        ];
    }
}
