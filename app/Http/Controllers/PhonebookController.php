<?php

namespace App\Http\Controllers;

use App\Services\Phonebook\PhonebookCache;
use Inertia\Inertia;

class PhonebookController extends Controller
{
    public function index()
    {
        $categories = PhonebookCache::categories();
        $entries = PhonebookCache::entries();

        return Inertia::render('Phonebook/Index', [
            'initialData' => $entries,
            'categories' => $categories,
        ]);
    }
}
