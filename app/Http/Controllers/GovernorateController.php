<?php

namespace App\Http\Controllers;

use App\Services\Governorates\GovernorateDataService;
use Inertia\Inertia;
use Inertia\Response;

class GovernorateController extends Controller
{
    public function __construct(
        private readonly GovernorateDataService $data,
    ) {}

    public function index(): Response
    {
        return Inertia::render('Governorates/Index', $this->data->forHub());
    }

    public function show(string $id): Response
    {
        $payload = $this->data->forGovernorate($id);
        abort_if($payload === null, 404);

        return Inertia::render('Governorates/Show', $payload);
    }
}
