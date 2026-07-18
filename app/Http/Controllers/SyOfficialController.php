<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PublicContent\DirectoryDataService;
use Inertia\Inertia;
use Inertia\Response;

class SyOfficialController extends Controller
{
    public const CSV_URL = DirectoryDataService::OFFICIAL_ACCOUNTS_URL;

    public function __construct(private readonly DirectoryDataService $directories) {}

    public function index(): Response
    {
        return Inertia::render('SyOfficial/Index', [
            'initialData' => $this->directories->officialAccounts(),
        ]);
    }
}
