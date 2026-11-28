<?php

namespace App\Http\Controllers;

use App\Services\SyOfficial\SyOfficialDirectoryService;
use App\Services\SyOfficial\SyOfficialPresenter;
use Inertia\Inertia;

class SyOfficialController extends Controller
{
    public function index(SyOfficialPresenter $presenter)
    {
        $categories = SyOfficialDirectoryService::publicCategories();
        $entities = SyOfficialDirectoryService::publicEntities($presenter);

        return Inertia::render('SyOfficial/Index', [
            'initialData' => $entities,
            'categories' => $categories,
        ]);
    }
}
