<?php

use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;

/*
| The public SyOfficial and GovApps pages receive their rows from presenters
| that the admin panel and the agent tools also use. The public props therefore
| keep their own key set, pinned here.
*/

test('syofficial page keeps its public entity shape', function () {
    OfficialCategory::create([
        'id' => 'cat-1',
        'label_ar' => 'وزارات',
        'label_en' => 'Ministries',
        'icon' => null,
        'order_column' => 1,
        'is_active' => true,
    ]);
    OfficialEntity::create([
        'id' => 'ent-1',
        'category_id' => 'cat-1',
        'name' => 'Ministry',
        'name_ar' => 'وزارة',
        'description' => 'Desc',
        'description_ar' => 'وصف',
        'image' => 'entities/ent-1.webp',
        'socials' => ['x' => 'https://x.com/ministry'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    $props = $this->get('/syofficial')->assertOk()->viewData('page')['props'];

    expect(array_keys($props['initialData'][0]))->toBe([
        'id', 'name', 'name_ar', 'description', 'description_ar', 'image', 'category', 'socials',
    ]);
    expect($props['initialData'][0]['category'])->toBe('cat-1');
    // an object, not a list: an empty socials map must reach the client as {}
    expect($props['initialData'][0]['socials'])->toBeInstanceOf(stdClass::class);
    expect((array) $props['initialData'][0]['socials'])->toBe(['x' => 'https://x.com/ministry']);
    // the category rows keep the columns the page reads
    expect(array_keys($props['categories'][0]))
        ->toContain('id', 'label_ar', 'label_en', 'icon', 'order_column');
    // a stored path is expanded to the public asset host
    expect($props['initialData'][0]['image'])->toContain('/syofficial/entities/ent-1.webp');
});

test('govapps page keeps its public app shape', function () {
    GovApp::create([
        'id' => 'app-1',
        'name' => 'App',
        'name_ar' => 'تطبيق',
        'description' => 'Desc',
        'description_ar' => 'وصف',
        'icon' => 'govapps/app-1/icon.webp',
        'images' => [],
        'links' => ['official' => 'https://example.test'],
        'order_column' => 1,
        'is_active' => true,
    ]);

    $props = $this->get('/govapps')->assertOk()->viewData('page')['props'];

    expect(array_keys($props['initialData'][0]))->toBe([
        'id', 'name', 'description', 'icon', 'images', 'links',
    ]);
    expect($props['initialData'][0]['name'])->toBe('تطبيق');
    expect($props['initialData'][0]['description'])->toBe('وصف');
    expect($props['initialData'][0]['links'])->toBe(['official' => 'https://example.test']);
});
