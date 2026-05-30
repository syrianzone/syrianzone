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
        $aboutPath = resource_path('js/Data/about.md');
        $aboutContent = '';
        
        if (File::exists($aboutPath)) {
            $aboutContent = File::get($aboutPath);
        }

        return Inertia::render('Home', [
            'aboutContent' => $aboutContent
        ]);
    }
}
