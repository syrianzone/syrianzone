<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Inertia\Inertia;

class HomeController extends Controller
{
    /**
     * Display the home/dashboard page.
     */
    public function index()
    {
        return Inertia::render('Home');
    }
}
