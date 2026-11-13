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
        'resources/js/Pages/Admin/Promises/Index.tsx' => [
            'promises.create', 'promises.edit', 'promises.review', 'promises.delete',
        ],
        'resources/js/Pages/Admin/Promises/Edit.tsx' => [
            'promises.create', 'promises.edit', 'promises.rule', 'promises.review',
        ],
        'resources/js/Pages/Admin/Promises/Review.tsx' => [
            'promises.review', 'promises.edit',
        ],
        'resources/js/Pages/Admin/Promises/Speakers.tsx' => [
            'promises.speakers',
        ],
        'resources/js/Pages/Admin/Promises/Sectors.tsx' => [
            'promises.speakers',
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
    // resources/js/Lib/capabilities.ts documents why: an account's access is
    // exactly its stored grants, so a role check hides the panel from a plain
    // user who was granted a capability explicitly.
    //
    // The dashboard is deliberately excluded. It still gates the Filament
    // panel link and the route-submissions tab by role — those are the
    // account kind, not a module capability. Its admin tabs are gated on
    // capabilities, including the modules that used to be superadmin-only
    // (guesswho.manage, assets.manage, site.popup, site.navigation).
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
    // Candidate images post to /api/v1/admin/assets/upload, which is guarded by
    // assets.manage. The drop zone is now inert for anyone without it.
    $source = file_get_contents(base_path('resources/js/Components/admin/AdminPollManager.tsx'));

    expect($source)
        ->toContain('canUploadImages')
        ->toContain('disabled={!canUploadImages}');
});

it('makes the sortable list read-only without its reorder capability', function () {
    // One component serves both admin sections since the directories kit; the
    // capability itself still comes from the caller (syofficial.reorder vs
    // govapps.reorder), so it stays a prop and not a constant here.
    $source = file_get_contents(base_path('resources/js/Components/directory/SortableList.tsx'));

    expect($source)
        ->toContain('canReorder')
        ->toContain('if (!canReorder) return;');
});

it('never calls useAuth() from a page that renders MainLayout', function () {
    // AuthProvider is mounted *inside* MainLayout (Layouts/MainLayout.tsx), and
    // app.tsx provides only DirectionProvider and QueryProvider. A page component
    // that calls useAuth() in its own body therefore runs above the provider and
    // throws "useAuth must be used within an AuthProvider" — the page renders
    // blank, with no server error and nothing in the deploy log.
    //
    // This shipped broken on three admin pages, and the static gate above could
    // not see it: that gate proves a capability check exists in the source, never
    // that the component mounts. The rule is structural, so it is asserted
    // structurally.
    //
    // A child component declared in the same file is fine — it renders inside
    // MainLayout, which is how Dashboard's AvatarUploader still uses the context.
    // Only a call in the page component's own body is fatal, hence the scan stops
    // at that component's first return.
    $pages = array_merge(
        array_keys(adminUiGateCases()),
        ['resources/js/Pages/Dashboard/Index.tsx'],
    );

    $checked = 0;

    foreach ($pages as $file) {
        $source = file_get_contents(base_path($file));

        if ($source === false || ! str_contains($source, 'MainLayout')) {
            continue;
        }

        if (! preg_match('/export default function\s+\w+\s*\(/', $source, $m, PREG_OFFSET_CAPTURE)) {
            continue;
        }

        $from = $m[0][1] + strlen($m[0][0]);
        $body = substr($source, $from);

        // The page component's own body ends at its first return statement.
        $body = preg_split('/\breturn\s*[\(<{]/', $body, 2)[0];

        // Strip comments before looking for the call. The files that were fixed
        // explain in prose why useAuth cannot be used here, and that prose would
        // otherwise trip the check it documents.
        $code = preg_replace(['#//[^\n]*#', '#/\*.*?\*/#s'], '', $body);

        $checked++;

        // Compared through str_contains rather than toContain: this suite's other
        // gates do the same, and Pest's toContain does not do a substring check
        // when given a string — it passes vacuously, which is how a guard written
        // that way reports success while the bug is present.
        expect(str_contains($code, 'useAuth('))->toBeFalse(
            "{$file} renders MainLayout, so its own body runs above AuthProvider. "
            .'Read auth.user.effective_permissions from usePage() and gate on that, '
            .'or move the call into a child component that renders inside MainLayout.'
        );
    }

    // The loop must actually have inspected the admin pages, or this test proves
    // nothing at all — a guard that silently scans nothing always passes.
    expect($checked)->toBeGreaterThanOrEqual(4);
});
