<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\File;

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
