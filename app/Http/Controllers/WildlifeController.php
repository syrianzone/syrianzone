<?php

namespace App\Http\Controllers;

use App\Services\Wildlife\WildlifeData;
use Inertia\Inertia;
use Inertia\Response;

/** The wildlife guide: `/wild` and `/wild/{slug}` (docs/modules/wildlife.md). */
class WildlifeController extends Controller
{
    public function __construct(
        private readonly WildlifeData $data,
    ) {}

    public function index(): Response
    {
        return Inertia::render('Wild/Index', $this->data->forHub());
    }

    public function show(string $slug): Response
    {
        $payload = $this->data->forSpecies($slug);
        abort_if($payload === null, 404);

        return Inertia::render('Wild/Show', $payload);
    }
}
