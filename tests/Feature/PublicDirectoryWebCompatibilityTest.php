<?php

use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use App\Services\PublicContent\DirectoryDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Cache::flush();
    $this->withoutVite();
});

test('about is a standalone page instead of a home prop', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->missing('aboutContent'));

    $this->get('/about')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('About'));
});

test('official accounts web page reads its categories and entities from the database', function () {
    OfficialCategory::create([
        'id' => 'government',
        'label_ar' => 'الحكومة',
        'label_en' => 'Government',
        'is_active' => true,
        'order_column' => 1,
    ]);
    OfficialEntity::create([
        'id' => 'health',
        'category_id' => 'government',
        'name' => 'Health',
        'name_ar' => 'الصحة',
        'is_active' => true,
        'order_column' => 1,
    ]);

    $this->get('/syofficial')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('SyOfficial/Index')
            ->where('initialData.0.id', 'health')
            ->where('initialData.0.name_ar', 'الصحة')
            ->where('categories.0.id', 'government'));
});

test('phonebook web page reads its categories and entries from the database', function () {
    PhonebookCategory::create([
        'id' => 'emergency',
        'label_ar' => 'طوارئ',
        'label_en' => 'Emergency',
        'is_active' => true,
        'order_column' => 1,
    ]);
    PhonebookEntry::create([
        'id' => 'fire',
        'category_id' => 'emergency',
        'name_ar' => 'الإطفاء',
        'name_en' => 'Fire',
        'number' => '113',
        'is_whatsapp' => true,
        'source_url' => 'https://source.example',
        'is_active' => true,
        'order_column' => 1,
    ]);

    $this->get('/phonebook')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Phonebook/Index')
            ->where('initialData.0.id', 'fire')
            ->where('initialData.0.is_whatsapp', true)
            ->where('categories.0.id', 'emergency'));
});

test('government apps web page reads active records from the database', function () {
    GovApp::create([
        'id' => 'sham',
        'name' => 'Sham App',
        'name_ar' => 'تطبيق شام',
        'is_active' => true,
        'order_column' => 1,
    ]);

    $this->get('/govapps')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GovApps/Index')
            ->where('initialData.0.id', 'sham')
            ->where('initialData.0.name', 'تطبيق شام'));
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
]);
