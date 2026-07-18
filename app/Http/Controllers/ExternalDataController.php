<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PublicContent\DirectoryDataService;
use Inertia\Inertia;
use Inertia\Response;

class ExternalDataController extends Controller
{
    public function __construct(private readonly DirectoryDataService $directories) {}

    public function syid(): Response
    {
        return Inertia::render('SyId/Index');
    }

    public function alignment(): Response
    {
        return Inertia::render('Alignment/Index');
    }

    public function contributors(): Response
    {
        return Inertia::render('SyrianContributors/Index');
    }

    public function house(): Response
    {
        return Inertia::render('House/Index');
    }

    public function party(): Response
    {
        return Inertia::render('Party/Index', [
            'initialOrganizations' => $this->directories->parties(),
        ]);
    }

    public function sites(): Response
    {
        return Inertia::render('Sites/Index', [
            'initialWebsites' => $this->directories->sites(),
        ]);
    }

    public function govapps(): Response
    {
        return Inertia::render('GovApps/Index', [
            'initialData' => $this->directories->governmentApps(),
        ]);
    }
}
