<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PublicContent\HomeContentService;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __construct(private readonly HomeContentService $homeContent) {}

    public function index(): Response
    {
        return Inertia::render('Home', [
            'aboutContent' => $this->homeContent->about(),
        ]);
    }
}
