<?php

use App\Models\HouseMember2026;
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

// ─── party ─────────────────────────────────────────────────────────────────

it('normalises a party sheet into the shape the page expects', function () {
    fakeSheet(partyCsv());

    $response = $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page->component('Party/Index'));
    $orgs = prop($response, 'initialOrganizations');

    expect($orgs)->toHaveCount(2)
        ->and($orgs[0]['name'])->toBe('National Party')
        // Headers arrive mixed-case from the sheet and are lowercased, so the
        // downstream lookups are what make this work.
        ->and($orgs[0]['type'])->toBe('FK')
        ->and($orgs[0]['country'])->toBe('سوريا')
        // city and country are joined for display, and either may be absent
        ->and($orgs[0]['formattedLocation'])->toBe('دمشق, سوريا')
        // leanings are a pipe-separated cell in the sheet and a list here
        ->and($orgs[0]['politicalLeanings'])->toBe(['يسار', 'وسط'])
        // an empty leanings cell is an empty list, not ['']
        ->and($orgs[1]['politicalLeanings'])->toBe([])
        ->and($orgs[1]['formattedLocation'])->toBe('حلب, سوريا');
});

it('refuses a party sheet that has lost its name column', function () {
    // A renamed column upstream would otherwise silently drop every row, and the
    // page would render as though Syria had no political parties. The header
    // check is what turns that into a logged empty result instead.
    fakeSheet(partyCsv(['headers' => ['Organisation', 'City']]));

    $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page->where('initialOrganizations', []));
});

it('does not cache an outage, so the next visitor retries', function () {
    // The load-bearing rule. fetchParty() returns [] on a failed fetch; caching
    // that would serve a blank page for ten minutes.
    // Two failures, not one: fetchParty() retries twice on a 500, so a single 500
    // is transparently recovered and is not an outage at all. The budget has to be
    // exhausted before the empty result is produced.
    Http::fakeSequence()
        ->push('gateway down', 500)
        ->push('gateway down', 500)
        ->push(partyCsv(), 200);

    $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page->where('initialOrganizations', []));

    expect(Cache::get('external_party_data'))->toBeNull();

    // The second request has to reach upstream, which it could not do if the
    // failure had been cached.
    $response = $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page->component('Party/Index'));
    $orgs = prop($response, 'initialOrganizations');

    expect($orgs)->toHaveCount(2);
});

it('does not cache a sheet that failed its header check', function () {
    // Same rule, different cause: a parse that yields nothing must not be cached,
    // or a corrected sheet stays invisible until the TTL expires.
    Http::fakeSequence()
        ->push(partyCsv(['headers' => ['Organisation']]), 200)
        ->push(partyCsv(), 200);

    $this->get('/party')->assertOk();

    expect(Cache::get('external_party_data'))->toBeNull();

    expect(prop($this->get('/party')->assertOk(), 'initialOrganizations'))->toHaveCount(2);
});

it('caches a good fetch and serves the second visitor from it', function () {
    fakeSheet(partyCsv());

    $this->get('/party')->assertOk();

    $sentAfterFirst = Http::recorded()->count();

    $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page->has('initialOrganizations'));

    // One upstream request total, not two.
    expect(Http::recorded())->toHaveCount($sentAfterFirst);
});

it('keeps row ids stable when the sheet gains a row above them', function () {
    // The id is derived from the name, not the row number, so inserting upstream
    // does not renumber every existing organisation in the page.
    //
    // Two sheets in one test, which means fakeSequence rather than a second
    // Http::fake(): fake() *merges* into the stub collection, so a second call
    // leaves the first stub in front and the second sheet is never served. That
    // failure is invisible — the assertion still passes, because it compares the
    // first sheet with itself.
    //
    // The cache is dropped between the reads for the same reason: the second
    // request would otherwise be served from external_party_data and never fetch.
    $before = partyCsv();
    $after = partyCsv([
        'prepend' => [['New Organisation', 'وصف', 'LR', 'حمص', 'سوريا', '', 'https://c.test']],
    ]);

    Http::fakeSequence()->push($before, 200)->push($after, 200);

    $first = prop($this->get('/party')->assertOk(), 'initialOrganizations');

    Cache::flush();

    $second = prop($this->get('/party')->assertOk(), 'initialOrganizations');

    $byName = static fn (?array $orgs) => collect($orgs)->keyBy('name');

    // The insertion is real, otherwise the comparison below is vacuous.
    expect($first)->toHaveCount(2)
        ->and($second)->toHaveCount(3);

    // National Party moved from row 0 to row 1 and kept its id.
    expect($byName($second)->get('National Party')['id'] ?? null)
        ->toBe($byName($first)->get('National Party')['id'] ?? 'missing')
        ->and($byName($second)->get('Progressive Party')['id'] ?? null)
        ->toBe($byName($first)->get('Progressive Party')['id'] ?? 'missing');
});

it('skips a row with no name rather than rendering a blank card', function () {
    fakeSheet("Name,City\n,دمشق\nSolo Party,حلب\n");

    $orgs = prop($this->get('/party')->assertOk(), 'initialOrganizations');

    expect($orgs)->toHaveCount(1)
        ->and($orgs[0]['name'])->toBe('Solo Party');
});

it('renders the party page with no data when upstream is unreachable', function () {
    Http::fake(['*' => Http::response('', 500)]);

    $this->get('/party')->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Party/Index')
            ->where('initialOrganizations', [])
            ->where('fetchedAt', null)
        );
});

// ─── sites ─────────────────────────────────────────────────────────────────
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

    expect(Cache::get('external_sites_data'))->toBeNull();
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

    expect(Cache::get('external_sites_data'))->toBeNull();

    expect(prop($this->get('/sites')->assertOk(), 'initialWebsites'))->toHaveCount(2);
});

// ─── house ─────────────────────────────────────────────────────────────────

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

// ─── The static pages ──────────────────────────────────────────────────────
//
// No logic, but they are routes a visitor can reach and a rename of the Inertia
// component would 500 in production. Cheap to cover, and it is the only thing
// these four methods do.

it('renders the static pages these routes exist for', function (string $uri, string $component) {
    $this->get($uri)->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['/syid', 'SyId/Index'],
    ['/alignment', 'Alignment/Index'],
    ['/syrian-contributors', 'SyrianContributors/Index'],
]);
