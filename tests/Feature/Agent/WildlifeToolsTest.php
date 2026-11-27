<?php

use App\Mcp\Tools\Wildlife\CreateWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\DeleteWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\DiscardWildlifeDraftTool;
use App\Mcp\Tools\Wildlife\GetWildlifeOptionsTool;
use App\Mcp\Tools\Wildlife\GetWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\ListWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\MoveWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\PublishWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\UnpublishWildlifeSpeciesTool;
use App\Mcp\Tools\Wildlife\UpdateWildlifeDraftTool;
use App\Models\WildlifeSpecies;
use App\Services\Wildlife\WildlifeData;
use App\Support\Agents\TokenIssuer;
use App\Support\Facts;
use App\Support\Permissions\PermissionCatalogue;

/*
|--------------------------------------------------------------------------
| Wildlife guide tools
|--------------------------------------------------------------------------
|
| What these protect is the guide's review rule: an edit only ever writes a
| draft, and the public pages change only when someone holding
| wildlife.publish publishes it. A token that may draft may not publish, and a
| draft never leaks onto /wild, the sitemap or a governorate page.
|
*/

/** A record that passes the rules, under a slug the seed does not use. */
function newWildlifeRecord(string $slug = 'test-gazelle'): array
{
    $record = collect(Facts::json('wildlife')['species'])->firstWhere('slug', 'dorcas-gazelle');
    $record['slug'] = $slug;
    $record['nameAr'] = 'غزال تجريبي';

    return $record;
}

beforeEach(function () {
    $this->editor = capabilityUser(PermissionCatalogue::WILDLIFE_EDIT);
    $this->reviewer = capabilityUser([PermissionCatalogue::WILDLIFE_PUBLISH, PermissionCatalogue::WILDLIFE_DELETE]);
});

it('creates a species as a draft that is not on the public site', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);

    $created = toolPayload(callTool(CreateWildlifeSpeciesTool::class, ['record' => newWildlifeRecord()]));

    expect($created['created'])->toBeTrue()
        ->and($created['species']['state'])->toBe('draft')
        ->and($created['species']['url'])->toBeNull();
    expect(array_column(app(WildlifeData::class)->all(), 'slug'))->not->toContain('test-gazelle');
    $this->get('/wild/test-gazelle')->assertNotFound();
});

it('refuses to let a drafting token publish', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $species = toolPayload(callTool(CreateWildlifeSpeciesTool::class, ['record' => newWildlifeRecord()]))['species'];

    $refused = callTool(PublishWildlifeSpeciesTool::class, ['slug' => 'test-gazelle', 'expected_version' => $species['version']]);

    expect(toolText($refused))->toContain('Permission denied');
    $this->get('/wild/test-gazelle')->assertNotFound();
});

it('publishes a reviewed draft onto the public pages', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $species = toolPayload(callTool(CreateWildlifeSpeciesTool::class, [
        'record' => newWildlifeRecord(),
        'after_slug' => 'dorcas-gazelle',
    ]))['species'];

    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_PUBLISH]);
    $published = toolPayload(callTool(PublishWildlifeSpeciesTool::class, [
        'slug' => 'test-gazelle', 'expected_version' => $species['version'],
    ]));

    expect($published['published'])->toBeTrue()
        ->and($published['reviewed_by_draft_author'])->toBeFalse()
        ->and($published['species']['state'])->toBe('published')
        ->and($published['species']['has_draft'])->toBeFalse();

    $slugs = array_column(app(WildlifeData::class)->all(), 'slug');
    expect($slugs[array_search('dorcas-gazelle', $slugs, true) + 1])->toBe('test-gazelle');
    $this->get('/wild/test-gazelle')->assertOk()->assertSee('غزال تجريبي');
});

it('says when a draft was published by its own author', function () {
    $both = capabilityUser([PermissionCatalogue::WILDLIFE_EDIT, PermissionCatalogue::WILDLIFE_PUBLISH]);
    agentToken($both, [PermissionCatalogue::WILDLIFE_EDIT, PermissionCatalogue::WILDLIFE_PUBLISH]);
    $species = toolPayload(callTool(CreateWildlifeSpeciesTool::class, ['record' => newWildlifeRecord()]))['species'];

    $published = toolPayload(callTool(PublishWildlifeSpeciesTool::class, [
        'slug' => 'test-gazelle', 'expected_version' => $species['version'],
    ]));

    expect($published['reviewed_by_draft_author'])->toBeTrue();
});

it('keeps the published record public while an edit waits as a draft', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $current = toolPayload(callTool(GetWildlifeSpeciesTool::class, ['slug' => 'striped-hyena']));
    $edited = $current['record'];
    $edited['nameAr'] = 'اسم معدّل للتجربة';

    $saved = toolPayload(callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $current['version'], 'record' => $edited,
    ]));

    expect($saved['species']['has_draft'])->toBeTrue()
        ->and($saved['species']['record']['nameAr'])->toBe('الضبع المخطّط');
    $this->get('/wild/striped-hyena')->assertOk()->assertDontSee('اسم معدّل للتجربة');

    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_PUBLISH]);
    callTool(PublishWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $saved['species']['version']]);

    $this->get('/wild/striped-hyena')->assertOk()->assertSee('اسم معدّل للتجربة');
});

it('refuses a write based on a stale version', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $current = toolPayload(callTool(GetWildlifeSpeciesTool::class, ['slug' => 'striped-hyena']));

    callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $current['version'], 'record' => $current['record'],
    ]);
    $stale = callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $current['version'], 'record' => $current['record'],
    ]);

    expect(toolText($stale))->toContain('changed since you read it')->toContain('get-wildlife-species');
});

it('refuses a record that breaks the sourcing rules, naming each rule', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $record = newWildlifeRecord();
    $record['factsAr'][] = ['text' => 'معلومة بلا مصدر', 'sources' => []];
    $record['sources'][] = ['title' => 'Wikipedia', 'url' => 'http://en.wikipedia.org/wiki/Gazelle'];

    $refused = toolText(callTool(CreateWildlifeSpeciesTool::class, ['record' => $record]));

    expect($refused)->toContain('breaks the sourcing rules')
        ->toContain('every statement must cite')
        ->toContain('https:// url');
    expect(WildlifeSpecies::where('slug', 'test-gazelle')->exists())->toBeFalse();
});

it('refuses to change a species slug or reuse a taken one', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $current = toolPayload(callTool(GetWildlifeSpeciesTool::class, ['slug' => 'striped-hyena']));
    $renamed = $current['record'];
    $renamed['slug'] = 'hyena';

    expect(toolText(callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $current['version'], 'record' => $renamed,
    ])))->toContain('cannot be changed');

    expect(toolText(callTool(CreateWildlifeSpeciesTool::class, [
        'record' => newWildlifeRecord('striped-hyena'),
    ])))->toContain('already used');
});

it('unpublishes a species and shows it again', function () {
    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_PUBLISH]);
    $version = WildlifeSpecies::where('slug', 'striped-hyena')->value('version');

    $hidden = toolPayload(callTool(UnpublishWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $version]));
    expect($hidden['species']['state'])->toBe('hidden');
    $this->get('/wild/striped-hyena')->assertNotFound();
    expect(collect(app(WildlifeData::class)->forGovernorate('homs'))->pluck('slug'))->not->toContain('striped-hyena');

    callTool(PublishWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $hidden['species']['version']]);
    $this->get('/wild/striped-hyena')->assertOk();
});

it('discards a draft and leaves the published record alone', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $current = toolPayload(callTool(GetWildlifeSpeciesTool::class, ['slug' => 'striped-hyena']));
    $saved = toolPayload(callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $current['version'], 'record' => $current['record'],
    ]));

    $discarded = toolPayload(callTool(DiscardWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $saved['species']['version'],
    ]));

    expect($discarded['species']['has_draft'])->toBeFalse()
        ->and($discarded['species']['record'])->toBe($current['record']);
});

it('deletes only with the delete capability', function () {
    $version = WildlifeSpecies::where('slug', 'striped-hyena')->value('version');

    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    expect(toolText(callTool(DeleteWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $version])))
        ->toContain('Permission denied');

    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_DELETE]);
    expect(toolPayload(callTool(DeleteWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $version]))['deleted'])->toBeTrue();
    $this->get('/wild/striped-hyena')->assertNotFound();
});

it('moves a species to just after another one', function () {
    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $version = WildlifeSpecies::where('slug', 'eiselts-pond-turtle')->value('version');

    callTool(MoveWildlifeSpeciesTool::class, ['slug' => 'eiselts-pond-turtle', 'expected_version' => $version, 'after_slug' => 'golden-hamster']);

    expect(array_slice(array_column(app(WildlifeData::class)->all(), 'slug'), 0, 2))->toBe(['golden-hamster', 'eiselts-pond-turtle']);
});

it('lets any wildlife capability read the guide, drafts included', function () {
    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_DELETE]);

    $list = toolPayload(callTool(ListWildlifeSpeciesTool::class, ['query' => 'hyena']));
    $options = toolPayload(callTool(GetWildlifeOptionsTool::class));

    expect($list['species'][0]['slug'])->toBe('striped-hyena')
        ->and($options['groups'])->toContain('mammal')
        ->and(array_column($options['governorates'], 'id'))->toContain('homs');
});

test('a wildlife token is offered the read tools and finds the writes through the catalogue', function () {
    $staff = capabilityUser([PermissionCatalogue::WILDLIFE_EDIT]);
    $plain = app(TokenIssuer::class)->issue($staff, 'wildlife', [PermissionCatalogue::WILDLIFE_EDIT])['token']->plainTextToken;

    expect(mcpToolNames($plain))->toContain('list-wildlife-species', 'get-wildlife-species', 'get-wildlife-options')
        ->not->toContain('list-places', 'list-gov-apps');
    expect(mcpSearchToolNames($plain, 'create a new wildlife species draft'))->toContain('create-wildlife-species')
        ->and(mcpSearchToolNames($plain, 'publish wildlife species'))->not->toContain('publish-wildlife-species');
});

test('creating a species round-trips over the real jsonrpc surface', function () {
    $staff = capabilityUser([PermissionCatalogue::WILDLIFE_EDIT]);
    $plain = app(TokenIssuer::class)->issue($staff, 'wildlife', [PermissionCatalogue::WILDLIFE_EDIT])['token']->plainTextToken;

    mcpExecuteTool($plain, 'create-wildlife-species', ['record' => newWildlifeRecord()]);

    expect(WildlifeSpecies::where('slug', 'test-gazelle')->value('draft')['nameAr'])->toBe('غزال تجريبي');
});

it('keeps a mirrored photo when a draft of the same file arrives without its key', function () {
    $row = WildlifeSpecies::where('slug', 'striped-hyena')->first();
    $record = $row->record;
    $record['image']['r2Key'] = 'wildlife/striped-hyena-abc.jpg';
    $row->update(['record' => $record]);

    agentToken($this->editor, [PermissionCatalogue::WILDLIFE_EDIT]);
    $draft = $record;
    $draft['image']['r2Key'] = null;
    $saved = toolPayload(callTool(UpdateWildlifeDraftTool::class, [
        'slug' => 'striped-hyena', 'expected_version' => $row->fresh()->version, 'record' => $draft,
    ]));
    expect($saved['species']['draft']['image']['r2Key'])->toBe('wildlife/striped-hyena-abc.jpg');

    agentToken($this->reviewer, [PermissionCatalogue::WILDLIFE_PUBLISH]);
    callTool(PublishWildlifeSpeciesTool::class, ['slug' => 'striped-hyena', 'expected_version' => $saved['species']['version']]);
    expect(WildlifeSpecies::where('slug', 'striped-hyena')->first()->record['image']['r2Key'])->toBe('wildlife/striped-hyena-abc.jpg');
});
