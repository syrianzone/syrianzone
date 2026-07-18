<?php

use App\Services\PublicContent\DirectoryDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Cache::flush();
    $this->withoutVite();
});

test('home web page keeps its about content prop', function () {
    $content = file_get_contents(resource_path('js/Data/about.md'));

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->where('aboutContent', $content));
});

test('official accounts web page keeps its initial data prop', function () {
    Http::fake([
        DirectoryDataService::OFFICIAL_ACCOUNTS_URL => Http::response(
            "ID,Name (English),Name (Arabic),Category\nhealth,Health,الصحة,Government"
        ),
    ]);

    $this->get('/syofficial')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('SyOfficial/Index')
            ->where('initialData.0.id', 'health')
            ->where('initialData.0.name_ar', 'الصحة'));
});

test('phonebook web page keeps its initial data prop', function () {
    Http::fake([
        DirectoryDataService::PHONEBOOK_URL => Http::response(
            "ID,Category_AR,Category_EN,Name_AR,Name_EN,Number,Is_WhatsApp,Source_URL\n".
            'fire,طوارئ,Emergency,الإطفاء,Fire,113,yes,https://source.example'
        ),
    ]);

    $this->get('/phonebook')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Phonebook/Index')
            ->where('initialData.0.id', 'fire')
            ->where('initialData.0.is_whatsapp', true));
});

test('external directory web pages keep their named props', function (
    string $path,
    string $url,
    string $csv,
    string $component,
    string $prop,
    string $expectedPath,
    mixed $expected
) {
    Http::fake([$url => Http::response($csv)]);

    $this->get($path)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component($component)
            ->where($expectedPath, $expected)
            ->has($prop, 1));
})->with([
    'sites' => [
        '/sites',
        DirectoryDataService::SITES_URL,
        "اسم الموقع,رابط الموقع,نوع الموقع,توصيف الموقع\nبوابة,https://site.example,خدمي,وصف",
        'Sites/Index',
        'initialWebsites',
        'initialWebsites.0.name',
        'بوابة',
    ],
    'parties' => [
        '/party',
        DirectoryDataService::PARTIES_URL,
        "Name,City,Country of Origin\nGroup,Damascus,Syria",
        'Party/Index',
        'initialOrganizations',
        'initialOrganizations.0.formattedLocation',
        'Damascus, Syria',
    ],
    'government apps' => [
        '/govapps',
        DirectoryDataService::GOVERNMENT_APPS_URL,
        "ID,Name\nsham,Sham App",
        'GovApps/Index',
        'initialData',
        'initialData.0.id',
        'sham',
    ],
]);
