<?php

use App\Services\PublicContent\DirectoryDataService;
use App\Services\PublicContent\HouseDataService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Cache::flush();

    config([
        'services.mobile_public.contributors_path' => base_path('tests/Fixtures/mobile-contributors.json'),
    ]);

    $routes = base_path('routes/mobile-public.php');
    if (is_file($routes) && ! Route::has('mobile.public.home')) {
        Route::middleware('api')->prefix('api')->group($routes);
    }
});

test('home returns bounded start page content for native clients', function () {
    $response = $this->getJson('/api/mobile/home');

    $response->assertOk();

    $data = $response->json('data');
    expect(array_keys($data))->toBe(['about_content', 'quick_links', 'search_providers'])
        ->and($data['about_content'])->toBe(file_get_contents(resource_path('js/Data/about.md')))
        ->and(array_column($data['quick_links'], 'id'))->toBe([
          'official-accounts', 'calendar', 'phonebook', 'visual-identity',
          'organizations', 'government-ranking', 'legislative-council',
          'political-compass', 'syria-priorities', 'web-directory', 'syria-atlas',
          'government-apps', 'transit', 'transitional-justice', 'joory', 'jard',
          'recipes', 'news', 'answers', 'codex-community', 'flag-replacer',
      ])
        ->and($data['quick_links'][0])->toBe([
          'id' => 'official-accounts',
          'label_ar' => 'الحسابات الرسمية',
          'label_en' => 'Official accounts',
          'type' => 'feature',
          'target' => 'syofficial',
      ])
        ->and($data['quick_links'][14])->toBe([
          'id' => 'joory',
          'label_ar' => 'جوري AI',
          'label_en' => 'Joory AI',
          'type' => 'external',
          'target' => 'https://joory.chat',
      ])
        ->and($data['search_providers'])->toBe([
          ['id' => 'duckduckgo', 'label' => 'DuckDuckGo', 'template' => 'https://duckduckgo.com/?q=%s'],
          ['id' => 'searx', 'label' => 'SearX', 'template' => 'https://searx.be/search?q=%s'],
          ['id' => 'google', 'label' => 'Google', 'template' => 'https://www.google.com/search?q=%s'],
          ['id' => 'bing', 'label' => 'Bing', 'template' => 'https://www.bing.com/search?q=%s'],
      ]);

    foreach ($data['quick_links'] as $link) {
        expect(array_keys($link))->toBe(['id', 'label_ar', 'label_en', 'type', 'target']);
    }
});

test('official accounts keep the existing page data shape', function () {
    Http::fake([
        DirectoryDataService::OFFICIAL_ACCOUNTS_URL => Http::response(implode("\n", [
            'ID,Name (English),Name (Arabic),Description (English),Description (Arabic),Image Path,Category,Facebook URL,Telegram URL (Secondary),Twitter/X URL',
            'ministry-health,Health Ministry,وزارة الصحة,Public health,الصحة العامة,/syofficial-assets/health.png,Government,https://facebook.example/health,https://t.me/health-news,https://x.com/health',
            'skip,No category,بلا تصنيف,,,,,,,',
        ])),
    ]);

    $this->getJson('/api/mobile/official-accounts')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => 'ministry-health',
                'name' => 'Health Ministry',
                'name_ar' => 'وزارة الصحة',
                'description' => 'Public health',
                'description_ar' => 'الصحة العامة',
                'image' => '/syofficial-assets/health.png',
                'category' => 'government',
                'socials' => [
                    'facebook' => 'https://facebook.example/health',
                    'telegram' => 'https://t.me/health-news',
                    'twitter' => 'https://x.com/health',
                ],
            ]],
        ]);
});

test('phonebook strips a byte order mark and normalizes whatsapp values', function () {
    Http::fake([
        DirectoryDataService::PHONEBOOK_URL => Http::response(
            "\xEF\xBB\xBFID,Category_AR,Category_EN,Name_AR,Name_EN,Number,Is_WhatsApp,Source_URL\n".
            "emergency,طوارئ,Emergency,الإطفاء,Fire brigade,113,TRUE,https://source.example/113\n".
            'missing,خدمات,Services,فارغ,Empty,,yes,https://source.example/empty'
        ),
    ]);

    $this->getJson('/api/mobile/phonebook')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => 'emergency',
                'category_ar' => 'طوارئ',
                'category_en' => 'Emergency',
                'name_ar' => 'الإطفاء',
                'name_en' => 'Fire brigade',
                'number' => '113',
                'is_whatsapp' => true,
                'source_url' => 'https://source.example/113',
            ]],
        ]);
});

test('sites return the Arabic spreadsheet columns without renaming them', function () {
    Http::fake([
        DirectoryDataService::SITES_URL => Http::response(
            "اسم الموقع,رابط الموقع,نوع الموقع,توصيف الموقع\n".
            "بوابة الخدمات,https://services.example,حكومي,دليل الخدمات\n".
            'بدون رابط,,حكومي,يجب تجاهله'
        ),
    ]);

    $this->getJson('/api/mobile/sites')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => 'site-1',
                'name' => 'بوابة الخدمات',
                'url' => 'https://services.example',
                'type' => 'حكومي',
                'description' => 'دليل الخدمات',
            ]],
        ]);
});

test('parties include location, political leanings, and contact fields', function () {
    Http::fake([
        DirectoryDataService::PARTIES_URL => Http::response(implode("\n", [
            'Name,Short Description,Type,Country of Origin,City,Political Leanings,Social - X,Social - Insta,Social - FB,Website,Manifesto Link,Email,Phone,Lang,MVP Members,Social - YouTube,Social - Telegram',
            'Civic Group,Local work,Initiative,Syria,Damascus,Social|Liberal,@civic,civicgram,civicfb,https://civic.example,https://civic.example/manifesto,hello@civic.example,+963111,AR,One|Two,civicvideo,civicchat',
        ])),
    ]);

    $this->getJson('/api/mobile/parties')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => 'org-1',
                'name' => 'Civic Group',
                'description' => 'Local work',
                'type' => 'Initiative',
                'country' => 'Syria',
                'city' => 'Damascus',
                'formattedLocation' => 'Damascus, Syria',
                'socialX' => '@civic',
                'socialInsta' => 'civicgram',
                'socialFb' => 'civicfb',
                'website' => 'https://civic.example',
                'manifesto' => 'https://civic.example/manifesto',
                'email' => 'hello@civic.example',
                'phone' => '+963111',
                'lang' => 'AR',
                'politicalLeanings' => ['Social', 'Liberal'],
                'mvpMembers' => 'One|Two',
                'youtube' => 'civicvideo',
                'telegram' => 'civicchat',
            ]],
        ]);
});

test('government apps expose server asset paths and download links', function () {
    Http::fake([
        DirectoryDataService::GOVERNMENT_APPS_URL => Http::response(implode("\n", [
            'ID,Name,Description,Official Site,Android Download,Apple Download',
            'sham,Sham App,City services,https://sham.example,https://play.example/sham,https://apps.example/sham',
        ])),
    ]);

    $response = $this->getJson('/api/mobile/government-apps')->assertOk();

    $response
        ->assertJsonPath('data.0.id', 'sham')
        ->assertJsonPath('data.0.icon', '/assets/apps/sham/shamicon.png')
        ->assertJsonPath('data.0.links.official', 'https://sham.example')
        ->assertJsonPath('data.0.links.android', 'https://play.example/sham')
        ->assertJsonPath('data.0.links.apple', 'https://apps.example/sham');

    expect($response->json('data.0.images'))->toBe([
        '/assets/apps/sham/sham1.png',
        '/assets/apps/sham/sham2.png',
        '/assets/apps/sham/sham3.png',
        '/assets/apps/sham/sham4.png',
    ]);
});

test('directory endpoints return an empty list when an upstream request fails', function () {
    Http::fake([
        DirectoryDataService::SITES_URL => Http::response('upstream unavailable', 503),
    ]);

    $this->getJson('/api/mobile/sites')
        ->assertOk()
        ->assertExactJson(['data' => []]);
});

test('house returns normalized rows for a fixed spreadsheet mode', function () {
    Http::fake([
        HouseDataService::WINNERS_URL => Http::response(implode("\n", [
            'Name,Place,Sex,Age,AppealStatus,Notes',
            'أَحمد,دِمَشق,انثي,42,مقبول,"قيمة, بفاصلة"',
            ',,,,,',
        ])),
    ]);

    $this->getJson('/api/mobile/house?mode=winners&province=damascus')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'rows' => [[
                    'Name' => 'أَحمد',
                    'Place' => 'دِمَشق',
                    'Sex' => 'انثي',
                    'Age' => '42',
                    'AppealStatus' => 'مقبول',
                    'Notes' => 'قيمة, بفاصلة',
                    '__nameNorm' => 'احمد',
                    '__placeNorm' => 'دمشق',
                    '__sexNorm' => 'أنثى',
                    '__ageGroup' => '40s',
                    '__appealStatus' => 'مقبول',
                ]],
                'headers' => ['Name', 'Place', 'Sex', 'Age', 'AppealStatus', 'Notes'],
            ],
        ]);
});

test('house adds its normalized age field to headers when the source omits it', function () {
    Http::fake([
        HouseDataService::CANDIDATES_URL => Http::response(
            "Name,Place\nمرشح,دمشق"
        ),
    ]);

    $this->getJson('/api/mobile/house?mode=candidates')
        ->assertOk()
        ->assertJsonPath('data.rows.0.Age', '0')
        ->assertJsonPath('data.headers', ['Name', 'Place', 'Age']);
});

test('house rejects unknown modes and provinces before requesting an upstream', function () {
    Http::fake();

    $this->getJson('/api/mobile/house?mode=other&province=nowhere')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['mode', 'province']);

    Http::assertNothingSent();
});

test('contributors use the mobile page data and support case insensitive lookup', function () {
    $this->getJson('/api/mobile/contributors')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.username', 'FirstDev')
        ->assertJsonPath('data.1.total_contributions', 210);

    $this->getJson('/api/mobile/contributors/firstdev')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'username' => 'FirstDev',
                'daily_contributions' => 2,
                'monthly_contributions' => 18,
                'yearly_contributions' => 220,
                'total_contributions' => 1200,
                'avatar_url' => 'https://avatars.example/first',
            ],
        ]);
});

test('unknown contributors return a JSON 404', function () {
    $this->getJson('/api/mobile/contributors/not-listed')
        ->assertNotFound()
        ->assertExactJson(['message' => 'Contributor not found.']);
});
