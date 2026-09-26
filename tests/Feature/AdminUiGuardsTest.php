<?php

/*
|--------------------------------------------------------------------------
| Admin UI authorization guards
|--------------------------------------------------------------------------
|
| The admin pages used to render every control for anyone holding any capability
| in the module, so a `places.review`-only reviewer saw eight moderation buttons
| and 403'd on all of them, and a `polls.delete`-only account was offered the
| create-poll button. The endpoints have been tagged per capability since
| ModuleCapabilityGuard landed; this asserts the UI caught up.
|
| These are source-level assertions rather than rendered-output tests. The
| failure mode being guarded against is precisely the one a render test would
| miss: a control present in the JSX with no capability check at all. Asserting
| on the source catches that where it is introduced, and needs no browser or
| component harness in CI.
|
| Each case pairs a page with the capabilities its routes require. If a route
| tag changes, the expectation here should change with it.
|
*/

/**
 * Module admin pages, and the capabilities their endpoints are tagged with.
 *
 * @return array<string, array<int, string>>
 */
function adminUiGateCases(): array
{
    return [
        'resources/js/Pages/Admin/Places/PlaceReviewCard.tsx' => [
            'places.approve', 'places.edit', 'places.delete', 'places.moderate_photos',
        ],
        'resources/js/Components/admin/AdminPollManager.tsx' => [
            'polls.create', 'polls.edit', 'polls.delete',
        ],
        'resources/js/Pages/Admin/SyOfficial/Index.tsx' => [
            'syofficial.create', 'syofficial.edit', 'syofficial.delete', 'syofficial.reorder',
        ],
        'resources/js/Pages/Admin/GovApps/Index.tsx' => [
            'govapps.create', 'govapps.edit', 'govapps.delete', 'govapps.reorder',
        ],
        'resources/js/Pages/Admin/Phonebook/Index.tsx' => [
            'phonebook.create', 'phonebook.edit', 'phonebook.toggle', 'phonebook.delete',
        ],
    ];
}

it('gates every module admin control on a capability', function () {
    foreach (adminUiGateCases() as $file => $capabilities) {
        $source = file_get_contents(base_path($file));

        expect($source)->not->toBeFalse("{$file} should exist");

        foreach ($capabilities as $capability) {
            $gated = str_contains($source, "can('{$capability}')")
                || str_contains($source, "\"{$capability}\"");

            expect($gated)->toBeTrue(
                "{$file} must gate on {$capability} — the matching route is tagged with it"
            );
        }
    }
});

it('derives no module admin gate from a role string', function () {
    // resources/js/Lib/permissions.ts documents why: a module role holds its
    // whole module with an empty permissions array, and a plain user can hold
    // explicit grants, so a role check hides the panel from both.
    //
    // The dashboard is deliberately excluded. It still gates the Filament link,
    // the asset manager, the site popup and the token page by role, because
    // those are superadmin-only surfaces with no capability of their own.
    foreach (array_keys(adminUiGateCases()) as $file) {
        $source = file_get_contents(base_path($file));

        expect($source)->not->toMatch(
            "/role\s*===?\s*'(admin|superadmin|transit_admin|syofficial_admin|govapps_admin|phonebook_admin|places_admin|users_admin)'/",
            "{$file} must not gate on a role string"
        );
    }
});

it('gates the dashboard poll controls on their own capabilities', function () {
    $source = file_get_contents(base_path('resources/js/Pages/Dashboard/Index.tsx'));

    foreach (['polls.create', 'polls.edit', 'polls.delete'] as $capability) {
        expect($source)->toContain("'{$capability}'");
    }
});

it('does not fire a capability-gated fetch from an ungated mount', function () {
    // useAdminDrafts() used to run unconditionally, so a transit.edit_routes-only
    // operator hit a 403 on page load for data they cannot see.
    $hook = file_get_contents(base_path('resources/js/Pages/Transit/_hooks/useMapData.ts'));
    $page = file_get_contents(base_path('resources/js/Pages/Transit/admin/Index.tsx'));

    expect($hook)->toContain('enabled')
        ->and($page)->toMatch('/useAdminDrafts\([^)]/');
});

it('hides the transit logs tab from operators who cannot read the audit trail', function () {
    $source = file_get_contents(base_path('resources/js/Pages/Transit/admin/Index.tsx'));

    // /admin/routes/logs is tagged transit.review_drafts.
    expect($source)->toMatch('/canReviewDrafts\s*&&\s*\(\s*<TabsTrigger value="logs"/');
});

it('gates the import publish buttons on the capability the route requires', function () {
    $source = file_get_contents(base_path('resources/js/Pages/Transit/admin/ImportTab.tsx'));

    // Both modes go through /import-publish, tagged transit_admin:transit.edit_routes.
    // "Save as draft" used to be offered to anyone with transit.review_drafts.
    $at = strpos($source, "handlePublish('draft')");
    expect($at)->not->toBeFalse();

    expect(substr($source, max(0, $at - 500), 500))->toContain('canEdit');
});

it('keeps the superadmin-only asset upload out of reach of poll managers', function () {
    // Candidate images post to /api/v1/admin/assets/upload, in the
    // ['auth','superadmin'] group. The drop zone is now inert for everyone else.
    $source = file_get_contents(base_path('resources/js/Components/admin/AdminPollManager.tsx'));

    expect($source)
        ->toContain('canUploadImages')
        ->toContain('disabled={!canUploadImages}');
});

it('makes both sortable lists read-only without their reorder capability', function () {
    foreach ([
        'resources/js/Pages/Admin/SyOfficial/_components/SortableList.tsx',
        'resources/js/Pages/Admin/GovApps/_components/SortableList.tsx',
    ] as $file) {
        $source = file_get_contents(base_path($file));

        expect($source)
            ->toContain('canReorder')
            ->toContain('if (!canReorder) return;');
    }
});
