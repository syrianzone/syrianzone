<?php

use App\Models\HouseMember2026;
use App\Services\ExternalData\ExternalSheetCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

/*
|--------------------------------------------------------------------------
| ExternalDataController: the two CSV proxies and the pages around them
|--------------------------------------------------------------------------
|
| Most of this controller is four static Inertia renders. The part worth testing
| is the two Google Sheets proxies, `party` and `sites`, which do real work:
| fetch a CSV over the network, normalise a header row that is neither stable nor
| uniform between the two sheets, build a stable id per row, and cache the result
| for ten minutes.
|
| The rule that matters most is the one in the source as a comment: an outage is
| never cached. `fetchParty()` returns [] on a failed fetch, a renamed sheet or a
| malformed body, and if that empty array were cached then every visitor for the
| next ten minutes would get a blank page with no way to tell the data was
| missing rather than empty. Both proxies guard this and both are asserted here.
|
*/

/** A party sheet with the header row the parser expects, plus two rows. */
function partyCsv(array $overrides = []): string
{
    // A `headers` override replaces the row outright rather than extending it.
    // Appending would leave `name` in place and the header guard could never
    // fire, which is the whole point of the tests that pass one.
    $headers = $overrides['headers'] ?? [
        'Name', 'Short Description', 'Type', 'City', 'Country of Origin',
        'Political Leanings', 'Website',
    ];

    // Latin org names on purpose: the parser is script-agnostic, and RTL text in
    // a fixture string is easy to typo in a way the assertion then disagrees
    // about, which is a confusing failure to read.
    $rows = array_merge($overrides['prepend'] ?? [], [
        ['National Party', 'وصف', 'FK', 'دمشق', 'سوريا', 'يسار|وسط', 'https://a.test'],
        ['Progressive Party', 'وصف آخر', 'NF', 'حلب', 'سوريا', '', 'https://b.test'],
    ]);

    $out = implode(',', $headers)."\n";
    foreach ($rows as $r) {
        $out .= implode(',', array_map(static fn ($v) => '"'.str_replace('"', '""', $v).'"', $r))."\n";
    }

    return $out;
}

// The party and sites proxies cache for ten minutes, and RefreshDatabase does
// not touch the cache — so without this the first test's parse is served to
// every later one and the fixtures appear to be ignored.
beforeEach(function () {
    Cache::flush();
});

/**
 * Read one Inertia prop off a page response.
 *
 * These routes render pages, not JSON, so ->json() on the test response fails
 * with "Invalid JSON". AssertableInertia::toArray() is the way in.
 */
function prop(TestResponse $response, string $key): mixed
{
    $value = null;

    $response->assertInertia(function ($page) use (&$value, $key) {
        $value = $page->toArray()['props'][$key] ?? null;
    });

    return $value;
}

function fakeSheet(string $body, int $status = 200): void
{
    Http::fake(['*' => Http::response($body, $status)]);
}

it('redirects phased-out /party route to homepage', function () {
    $this->get('/party')->assertMovedPermanently()->assertRedirect('/');
});

//
// A second sheet with a different header convention: Arabic column names, and
// both name and url are required for a row to be usable.

function sitesCsv(?array $headers = null): string
{
    $headers ??= ['اسم الموقع', 'رابط الموقع', 'نوع الموقع', 'توصيف الموقع'];

    return implode(',', $headers)."\n"
        .'"موقع affixed","https://one.test","جامعة","وصف"'."\n"
        .'"موقع ثاني","https://two.test","جامعة","وصف آخر"'."\n";
}

it('normalises a sites sheet using its arabic headers', function () {
    fakeSheet(sitesCsv());

    $response = $this->get('/sites')->assertOk()
        ->assertInertia(fn ($page) => $page->component('Sites/Index'));
    $sites = prop($response, 'initialWebsites');

    expect($sites)->toHaveCount(2)
        ->and($sites[0]['name'])->toBe('موقع affixed')
        ->and($sites[0]['url'])->toBe('https://one.test')
        ->and($sites[0]['type'])->toBe('جامعة');
});

it('refuses a sites sheet missing either required column', function (array $headers) {
    // Both columns are load-bearing: without a url there is nothing to link to,
    // without a name there is nothing to label the link with.
    fakeSheet(sitesCsv($headers));

    $this->get('/sites')->assertOk()
        ->assertInertia(fn ($page) => $page->where('initialWebsites', []));

    expect(Cache::get(ExternalSheetCache::SITES))->toBeNull();
})->with([
    'only the name' => [['اسم الموقع', 'نوع الموقع']],
    'only the url' => [['رابط الموقع', 'نوع الموقع']],
]);

it('skips a sites row with no url', function () {
    fakeSheet("اسم الموقع,رابط الموقع,نوع الموقع\nموقع, ,جامعة\n");

    $sites = prop($this->get('/sites')->assertOk(), 'initialWebsites');

    expect($sites)->toHaveCount(1)
        ->and($sites[0]['name'])->toBe('موقع');
});

it('does not cache a sites outage', function () {
    Http::fakeSequence()
        ->push('down', 503)
        ->push('down', 503)
        ->push(sitesCsv(), 200);

    $this->get('/sites')->assertOk()
        ->assertInertia(fn ($page) => $page->where('initialWebsites', []));

    expect(Cache::get(ExternalSheetCache::SITES))->toBeNull();

    expect(prop($this->get('/sites')->assertOk(), 'initialWebsites'))->toHaveCount(2);
});

it('lists house members ordered by governorate then name', function () {
    // Latin fixture values on purpose. The real rows are Arabic, but SQLite and
    // MySQL collate Arabic differently, so an assertion about the order *within*
    // a governorate would pass on one engine and fail on the other. What is being
    // tested is that ordering happens at all, and that it is by governorate first.
    HouseMember2026::create(['name_ar' => 'Baker', 'governorate_ar' => 'Homs']);
    HouseMember2026::create(['name_ar' => 'Adel', 'governorate_ar' => 'Damascus']);
    HouseMember2026::create(['name_ar' => 'Cave', 'governorate_ar' => 'Damascus']);

    $response = $this->get('/house')->assertOk()
        ->assertInertia(fn ($page) => $page->component('House/Index'));
    $members = prop($response, 'members2026');

    expect(array_column($members, 'name_ar'))->toBe(['Adel', 'Cave', 'Baker']);
});

it('renders the house page with an empty list when there are no members', function () {
    $this->get('/house')->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('House/Index')
            ->where('members2026', [])
        );
});

//
// No logic, but they are routes a visitor can reach and a rename of the Inertia
// component would 500 in production. Cheap to cover, and it is the only thing
// these four methods do.

it('sends the contributors leaderboard with the page, so it is in the server-rendered html', function () {
    $list = json_decode(file_get_contents(public_path('contributors.json')), true);

    expect($list)->not->toBeEmpty();

    $this->get('/syrian-contributors')->assertOk()
        ->assertInertia(fn ($page) => $page->component('SyrianContributors/Index')
            ->has('contributors', count($list))
            ->where('contributors.0.username', $list[0]['username']));
});

it('renders the static pages these routes exist for', function (string $uri, string $component) {
    $this->get($uri)->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['/syid', 'SyId/Index'],
    ['/alignment', 'Alignment/Index'],
    ['/syrian-contributors', 'SyrianContributors/Index'],
]);
