<?php

use App\Mcp\Tools\GovApps\CreateGovAppTool;
use App\Mcp\Tools\GovApps\RestoreGovAppTool;
use App\Mcp\Tools\SyOfficial\CreateSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\DeleteSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\ListSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialEntitiesTool;
use App\Mcp\Tools\SyOfficial\ToggleSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\UpdateSyOfficialEntityTool;
use App\Models\GovApp;
use App\Models\OfficialCategory;
use App\Models\OfficialEntity;
use App\Models\User;
use App\Services\GovApps\GovAppService;

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

// ─── Capability isolation ──────────────────────────────────────────────────

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

// ─── Read tools accept any of the module's five ───────────────────────────

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

// ─── Behaviour the tools must preserve ─────────────────────────────────────

it('keeps a directory entity visible when the edit omits socials', function () {
    $entity = OfficialEntity::factory()->create(['socials' => ['https://keep.me']]);
    agentToken($this->user, ['syofficial.edit']);

    callTool(UpdateSyOfficialEntityTool::class, [
        'id' => $entity->id,
        'name' => 'Renamed',
    ]);

    expect($entity->fresh()->socials)->toBe(['https://keep.me'])
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

// ─── Gov Apps: the soft-delete difference ──────────────────────────────────

it('requires both delete and edit to restore a soft-deleted app', function () {
    $app = GovApp::factory()->create();
    agentToken($this->user, ['govapps.delete']);
    GovAppService::class;
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
