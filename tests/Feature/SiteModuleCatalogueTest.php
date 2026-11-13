<?php

use App\Models\SiteSetting;
use App\Models\User;
use App\Support\Facts;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Cache;

/**
 * `resources/data/site-modules.json` is the one site-module catalogue: the
 * server's navigation defaults, the browser's navigation fallback, the
 * dashboard's admin cards and the search copy all come from it. These tests pin
 * the server side to that file and keep the icon drawings usable by the
 * Filament panel.
 */
beforeEach(function () {
    Cache::flush();
});

test('the default navigation is the catalogue, entry for entry', function () {
    $modules = Facts::siteModules()['modules'];
    $items = SiteSetting::defaultNavigationItems();

    expect($items)->toHaveCount(count($modules));

    foreach ($modules as $index => $module) {
        $item = $items[$index];
        expect($item['id'])->toBe($module['id'])
            ->and($item['title'])->toBe($module['title'])
            ->and($item['subtitle'])->toBe($module['subtitle'])
            ->and($item['href'])->toBe($module['href'])
            ->and($item['target'])->toBe($module['target'])
            ->and($item['iconKey'])->toBe($module['iconKey'])
            ->and($item['text'])->toBe($module['title'])
            ->and($item['subCategories'])->toHaveCount(count($module['subCategories']));
    }

    expect(SiteSetting::navigationDefaults()['navbarTopCount'])
        ->toBe(Facts::siteModules()['navbar']['topCount']);
});

test('the stored admin override still wins over the catalogue', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', [
            'navbarTopCount' => 3,
            'items' => [
                [
                    'id' => 'transit',
                    'title' => 'ترانزيت سوريا',
                    'href' => '/transit',
                    'iconKey' => 'transit',
                    'type' => 'native',
                    'target' => 'transit_map',
                ],
            ],
        ])
        ->assertOk();

    $navigation = SiteSetting::getNavigation();
    $transit = collect($navigation['items'])->firstWhere('id', 'transit');

    expect($navigation['navbarTopCount'])->toBe(3)
        ->and($transit['title'])->toBe('ترانزيت سوريا')
        // Built-ins added in code after the row was saved are still appended.
        ->and($navigation['items'])->toHaveCount(count(Facts::siteModules()['modules']));
});

test('reset to defaults restores the catalogue', function () {
    $superadmin = User::factory()->create(['role' => 'superadmin']);

    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', [
            'items' => [
                ['id' => 'compass', 'title' => 'بوصلة', 'href' => '/compass', 'enabled' => false],
            ],
        ])
        ->assertOk();

    expect(SiteSetting::getNavigation()['items'][0]['id'])->toBe('compass');

    $this->actingAs($superadmin)
        ->putJson('/api/v1/admin/navigation', ['reset' => true])
        ->assertOk()
        ->assertJsonPath('navigation.items.0.id', 'roznama');

    expect(SiteSetting::getNavigation()['items'])->toEqual(SiteSetting::defaultNavigationItems());
});

test('the shared Inertia prop carries the catalogue navigation', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('siteNavigation.items', count(Facts::siteModules()['modules']))
            ->where('siteNavigation.items.0.id', Facts::siteModules()['modules'][0]['id'])
            ->where('siteNavigation.navbarTopCount', Facts::siteModules()['navbar']['topCount'])
        );
});

test('every icon the catalogue and the capability groups name has a drawing', function () {
    $icons = Facts::projectIcons()['icons'];

    $keys = collect(Facts::siteModules()['modules'])
        ->pluck('iconKey')
        ->filter()
        ->merge(collect(PermissionCatalogue::groupMeta())->pluck('icon'))
        ->unique()
        ->values();

    foreach ($keys as $key) {
        expect(array_key_exists($key, $icons))->toBeTrue("icon '{$key}' is named but not drawn");
    }
});

test('the blade icon component draws every key in the icon file', function () {
    $icons = Facts::projectIcons()['icons'];

    foreach (array_keys($icons) as $key) {
        $html = Blade::render('<x-project-icon name="'.$key.'" />');

        // An unknown name renders nothing, so a blank panel icon is silent.
        expect(trim($html))->not->toBe('', "icon '{$key}' renders nothing")
            ->and($html)->toContain('<svg')
            ->and($html)->not->toContain('class=')
            ->and($html)->not->toContain('hsl(var(--primary))');
    }

    expect(trim(Blade::render('<x-project-icon name="not-an-icon" />')))->toBe('');
});

test('the blade icon component follows an alias instead of copying the drawing', function () {
    $icons = Facts::projectIcons()['icons'];

    expect($icons['places'])->toHaveKey('alias')
        ->and($icons['polls'])->toHaveKey('alias');

    expect(Blade::render('<x-project-icon name="places" />'))
        ->toBe(Blade::render('<x-project-icon name="mishwar" />'))
        ->and(Blade::render('<x-project-icon name="polls" />'))
        ->toBe(Blade::render('<x-project-icon name="tierlist" />'));
});
