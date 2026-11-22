<?php

use App\Mcp\Tools\GovApps\CreateGovAppTool;
use App\Mcp\Tools\GovApps\RestoreGovAppTool;
use App\Mcp\Tools\Suggestions\ReviewDirectorySuggestionTool;
use App\Mcp\Tools\SyOfficial\CreateSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\CreateSyOfficialEntityTool;
use App\Mcp\Tools\SyOfficial\DeleteSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\ListSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialEntitiesTool;
use App\Mcp\Tools\SyOfficial\ToggleSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\UpdateSyOfficialEntityTool;
use App\Models\DirectorySuggestion;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\User;
use App\Services\Directories\SquareWebpImageService;
use App\Services\GovApps\GovAppService;
use App\Services\SyOfficial\SyOfficialDirectoryService;
use Illuminate\Support\Facades\Http;

/*
|--------------------------------------------------------------------------
| SyOfficial and Gov Apps tools
|--------------------------------------------------------------------------
|
| Two things are being protected here, and both are the reason these tools
| exist as separate capabilities rather than one "manage the directory" grant:
|
|  1. Capability isolation. A token that may create may not delete. The
|     .toggle capabilities had no endpoint at all before this, so an operator
|     who granted them had granted nothing; these tests are what make the grant
|     mean something.
|  2. No write permission is quietly treated as read authority. The read tools
|     accept any of the module's five, and that is asserted explicitly so the
|     any-of gate cannot be quietly tightened into a single write capability.
|
*/

beforeEach(function () {
    $this->user = User::factory()->create([
        'role' => 'user',
        'permissions' => [
            'syofficial.create', 'syofficial.edit', 'syofficial.toggle',
            'syofficial.delete', 'syofficial.reorder',
            'govapps.create', 'govapps.edit', 'govapps.toggle',
            'govapps.delete', 'govapps.reorder',
        ],
    ]);
});

it('lets a create-only token create but not delete a category', function () {
    agentToken($this->user, ['syofficial.create']);

    $created = toolPayload(callTool(CreateSyOfficialCategoryTool::class, [
        'id' => 'governorates',
        'label_ar' => 'المحافظات',
        'label_en' => 'Governorates',
    ]));

    expect($created['created'])->toBeTrue();

    // The delete tool is not even registered for this token, and calling it
    // directly is refused.
    $refused = callTool(DeleteSyOfficialCategoryTool::class, [
        'id' => 'governorates',
    ]);

    expect(toolText($refused))->toContain('Permission denied');
    expect(OfficialCategory::where('id', 'governorates')->exists())->toBeTrue();
});

it('refuses a toggle without the toggle capability', function () {
    $category = OfficialCategory::factory()->create(['is_active' => true]);
    agentToken($this->user, ['syofficial.edit']);

    $response = callTool(ToggleSyOfficialCategoryTool::class, [
        'id' => $category->id,
        'is_active' => false,
    ]);

    expect(toolText($response))->toContain('Permission denied')
        // The whole point: an edit grant must not imply a visibility grant.
        ->and($category->fresh()->is_active)->toBeTrue();
});

it('refuses a reorder without the reorder capability', function () {
    $category = OfficialCategory::factory()->create(['order_column' => 1]);
    agentToken($this->user, ['syofficial.edit']);

    $response = callTool(ReorderSyOfficialCategoriesTool::class, [
        'orders' => [['id' => $category->id, 'order_column' => 5]],
    ]);

    expect(toolText($response))->toContain('Permission denied')
        ->and($category->fresh()->order_column)->toBe(1);
});

it('lets a delete-only token read the directory, since reading needs no write grant', function () {
    OfficialCategory::factory()->count(2)->create();
    agentToken($this->user, ['syofficial.delete']);

    $payload = toolPayload(callTool(ListSyOfficialCategoriesTool::class));

    expect($payload['count'])->toBe(2);
});

it('refuses the directory listing to a token with no capability in the module', function () {
    agentToken($this->user, ['govapps.create']);

    $response = callTool(ListSyOfficialCategoriesTool::class);

    expect(toolText($response))->toContain('Permission denied');
});

it('refuses a list-shaped socials argument from the tool', function () {
    $category = OfficialCategory::factory()->create();
    agentToken($this->user, ['syofficial.create']);

    $response = callTool(CreateSyOfficialEntityTool::class, [
        'id' => 'list-socials',
        'category_id' => $category->id,
        'name' => 'List',
        'name_ar' => 'قائمة',
        'socials' => ['https://example.com', 'http://example.org'],
    ]);

    expect(toolText($response))->toContain('socials must be an object keyed by platform')
        ->and(OfficialEntity::where('id', 'list-socials')->exists())->toBeFalse();
});

it('keeps a directory entity visible when the edit omits socials', function () {
    $entity = OfficialEntity::factory()->create(['socials' => ['facebook' => 'https://keep.me']]);
    agentToken($this->user, ['syofficial.edit']);

    callTool(UpdateSyOfficialEntityTool::class, [
        'id' => $entity->id,
        'name' => 'Renamed',
    ]);

    expect($entity->fresh()->socials)->toBe(['facebook' => 'https://keep.me'])
        ->and($entity->fresh()->name)->toBe('Renamed');
});

it('reports the blast radius when deleting a category with entities in it', function () {
    $category = OfficialCategory::factory()->create();
    OfficialEntity::factory()->count(2)->inCategory($category)->create();

    agentToken($this->user, ['syofficial.delete']);

    $payload = toolPayload(callTool(DeleteSyOfficialCategoryTool::class, [
        'id' => $category->id,
    ]));

    expect($payload['entities_deleted'])->toBe(2)
        ->and($payload['warning'])->toContain('2 entities were permanently deleted');
});

it('rejects a duplicate id with guidance instead of overwriting', function () {
    OfficialCategory::factory()->create(['id' => 'governorates']);
    agentToken($this->user, ['syofficial.create']);

    $response = callTool(CreateSyOfficialCategoryTool::class, [
        'id' => 'governorates',
        'label_ar' => 'x',
        'label_en' => 'x',
    ]);

    expect(toolText($response))->toContain('already in use')
        ->and(OfficialCategory::where('id', 'governorates')->count())->toBe(1);
});

it('catches a mixed-category entity reorder before it scrambles the order', function () {
    $a = OfficialCategory::factory()->create();
    $b = OfficialCategory::factory()->create();
    $one = OfficialEntity::factory()->inCategory($a)->create(['order_column' => 1]);
    $two = OfficialEntity::factory()->inCategory($b)->create(['order_column' => 1]);

    agentToken($this->user, ['syofficial.reorder']);

    $response = callTool(ReorderSyOfficialEntitiesTool::class, [
        'category_id' => $a->id,
        'orders' => [
            ['id' => $one->id, 'order_column' => 1],
            ['id' => $two->id, 'order_column' => 2],
        ],
    ]);

    // Refused, and crucially neither entity was written: a partial reorder
    // across categories would scramble one group to fix the other.
    expect(toolText($response))->toContain('not in category')
        ->and($one->fresh()->order_column)->toBe(1)
        ->and($two->fresh()->order_column)->toBe(1);
});

it('requires both delete and edit to restore a soft-deleted app', function () {
    $app = GovApp::factory()->create();
    agentToken($this->user, ['govapps.delete']);
    app(GovAppService::class)->delete($app->id);

    // Delete alone is not enough to put content back in public view.
    $refused = callTool(RestoreGovAppTool::class, ['id' => $app->id]);
    expect(toolText($refused))->toContain('Permission denied');

    agentToken($this->user, ['govapps.delete', 'govapps.edit']);
    $payload = toolPayload(callTool(RestoreGovAppTool::class, ['id' => $app->id]));

    expect($payload['restored'])->toBeTrue()
        ->and(GovApp::find($app->id))->not->toBeNull();
});

it('restores to the visibility the app had before deletion', function () {
    $app = GovApp::factory()->inactive()->create();
    $service = app(GovAppService::class);
    $service->delete($app->id);

    agentToken($this->user, ['govapps.delete', 'govapps.edit']);
    $payload = toolPayload(callTool(RestoreGovAppTool::class, ['id' => $app->id]));

    expect($payload['is_active'])->toBeFalse()
        ->and($payload['note'])->toContain('still inactive');
});

it('tells the agent a deleted app id stays taken', function () {
    $app = GovApp::factory()->create(['id' => 'services']);
    app(GovAppService::class)->delete($app->id);

    agentToken($this->user, ['govapps.create']);
    $response = callTool(CreateGovAppTool::class, [
        'id' => 'services',
        'name' => 'Services',
        'name_ar' => 'الخدمات',
    ]);

    expect(toolText($response))->toContain('restore-gov-app');
});

it('refuses a list-shaped links argument from create-gov-app and keeps keyed links intact', function () {
    agentToken($this->user, ['govapps.create']);

    $refused = callTool(CreateGovAppTool::class, [
        'id' => 'list-links-app',
        'name' => 'List Links',
        'name_ar' => 'قائمة',
        'links' => ['https://apps.apple.com/us/app/test/id123'],
    ]);

    expect(toolText($refused))->toContain('links must be an object keyed by platform')
        ->and(GovApp::where('id', 'list-links-app')->exists())->toBeFalse();

    $created = toolPayload(callTool(CreateGovAppTool::class, [
        'id' => 'keyed-links-app',
        'name' => 'Keyed Links',
        'name_ar' => 'روابط مصنفة',
        'links' => [
            'android' => 'https://play.google.com/store/apps/details?id=sy.test',
            'apple' => 'https://apps.apple.com/us/app/test/id123',
        ],
    ]));

    expect($created['created'])->toBeTrue()
        ->and($created['app']['links'])->toBe([
            'android' => 'https://play.google.com/store/apps/details?id=sy.test',
            'apple' => 'https://apps.apple.com/us/app/test/id123',
        ]);
});

it('downloads and stores icon_url on R2 when creating a gov app via MCP', function () {
    Http::fake([
        'https://example.test/icon.png' => Http::response('fake-png-bytes', 200),
    ]);

    $mock = Mockery::mock(SquareWebpImageService::class);
    $mock->shouldReceive('storeSquareWebpFromBytes')
        ->once()
        ->with('fake-png-bytes', GovAppService::ICON_DIR, 'icon-app')
        ->andReturn('https://r2.example.test/govapps/icon-app_123.webp');
    app()->instance(SquareWebpImageService::class, $mock);

    agentToken($this->user, ['govapps.create']);
    $created = toolPayload(callTool(CreateGovAppTool::class, [
        'id' => 'icon-app',
        'name' => 'Icon App',
        'name_ar' => 'تطبيق بأيقونة',
        'icon_url' => 'https://example.test/icon.png',
    ]));

    expect($created['created'])->toBeTrue()
        ->and($created['app']['icon'])->toBe('https://r2.example.test/govapps/icon-app_123.webp');
});

it('downloads and stores image_url on R2 when creating a SyOfficial entity via MCP', function () {
    $category = OfficialCategory::factory()->create(['id' => 'ministries']);

    Http::fake([
        'https://example.test/logo.png' => Http::response('fake-logo-bytes', 200),
    ]);

    $mock = Mockery::mock(SquareWebpImageService::class);
    $mock->shouldReceive('storeSquareWebpFromBytes')
        ->once()
        ->with('fake-logo-bytes', SyOfficialDirectoryService::IMAGE_DIR, 'min-logo')
        ->andReturn('https://r2.example.test/syofficial/entities/min-logo_123.webp');
    app()->instance(SquareWebpImageService::class, $mock);

    agentToken($this->user, ['syofficial.create']);
    $created = toolPayload(callTool(CreateSyOfficialEntityTool::class, [
        'id' => 'min-logo',
        'category_id' => $category->id,
        'name' => 'Logo Ministry',
        'name_ar' => 'وزارة بشعار',
        'image_url' => 'https://example.test/logo.png',
    ]));

    expect($created['created'])->toBeTrue()
        ->and($created['entity']['image'])->toBe('https://r2.example.test/syofficial/entities/min-logo_123.webp');
});

it('lets a module editor accept or dismiss a directory suggestion via MCP', function () {
    $submitter = User::factory()->create();
    $suggestion = DirectorySuggestion::create([
        'module' => 'govapps',
        'kind' => 'edit',
        'target_id' => 'paymera',
        'target_label' => 'بيميرا',
        'title' => 'تحديث رابط',
        'details' => 'الرابط الرسمي هو https://paymera.net/',
        'user_id' => $submitter->id,
        'status' => 'pending',
    ]);

    agentToken($this->user, ['govapps.edit']);
    $res = toolPayload(callTool(ReviewDirectorySuggestionTool::class, [
        'module' => 'govapps',
        'id' => $suggestion->id,
        'decision' => 'accepted',
        'resolution_note' => 'Applied official URL.',
    ]));

    expect($res['reviewed'])->toBeTrue()
        ->and($res['suggestion']['status'])->toBe('accepted')
        ->and($res['suggestion']['resolution_note'])->toBe('Applied official URL.');
});
