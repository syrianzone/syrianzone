<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PublicContent\DirectoryDataService;
use Inertia\Inertia;
use Inertia\Response;

class PhonebookController extends Controller
{
    public const CSV_URL = DirectoryDataService::PHONEBOOK_URL;

    public function __construct(private readonly DirectoryDataService $directories) {}

    public function index(): Response
    {
        return Inertia::render('Phonebook/Index', [
            'initialData' => $this->directories->phonebook(),
        ]);
    }
}
