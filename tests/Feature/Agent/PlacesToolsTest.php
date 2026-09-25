<?php

use App\Mcp\Resources\AgentPermissionsResource;
use App\Mcp\Resources\AgentTokenResource;
use App\Mcp\Servers\AdminServer;
use App\Mcp\Tools\Places\ApprovePlaceTool;
use App\Mcp\Tools\Places\DeletePlacePhotoTool;
use App\Mcp\Tools\Places\DeletePlaceTool;
use App\Mcp\Tools\Places\GetPlaceTool;
use App\Mcp\Tools\Places\ListPlacesTool;
use App\Mcp\Tools\Places\RejectPlaceTool;
use App\Mcp\Tools\Places\RotatePlacePhotoTool;
use App\Mcp\Tools\Places\UpdatePlaceTool;
use App\Models\McpToolCall;
use App\Models\Place;
use App\Support\Agents\AgentAudit;
use App\Support\Agents\AgentContext;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Places tools
|--------------------------------------------------------------------------
|
| Two things are under test: that the tools enforce the token ceiling, and
| that they share the domain rules with the web dashboard (so an agent cannot
| approve something a human could not). Callbacks go through callTool(), which
| invokes handle() exactly as the MCP ToolInvoker does — see tests/Pest.php for
| why the package's own helper cannot reach catalogue tools.
|
*/

test('a review-only token can list and read places', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    $pending = Place::factory()->create(['name' => 'قلعة حماه']);

    $list = toolPayload(callTool(ListPlacesTool::class));
    expect($list['total'])->toBe(1)
        ->and($list['places'][0]['name'])->toBe('قلعة حماه');

    $one = toolPayload(callTool(GetPlaceTool::class, ['place_id' => $pending->id]));
    expect($one['place']['status'])->toBe('pending');
});

test('a review-only token is refused approve, and the place is untouched', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    $place = Place::factory()->create();

    $response = callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    expect($response->isError())->toBeTrue()
        ->and(toolText($response))->toContain('Permission denied')
        // The message names the capability so the operator knows what to grant.
        ->and(toolText($response))->toContain('الموافقة على الأماكن')
        ->and($place->fresh()->status)->toBe('pending');
});

test('approve publishes a pending place and busts the map cache', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    $place = Place::factory()->create();
    cache()->put('places:map', ['stale'], 60);

    $payload = toolPayload(callTool(ApprovePlaceTool::class, ['place_id' => $place->id]));

    expect($payload['status'])->toBe('approved')
        ->and($place->fresh()->status)->toBe('approved')
        ->and($place->fresh()->approved_at)->not->toBeNull()
        ->and(cache()->has('places:map'))->toBeFalse();
});

test('approving a non-pending place tells the agent there is nothing to do', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    $place = Place::factory()->approved()->create();

    $response = callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    expect(toolText($response))
        ->toContain('Place is already approved')
        ->toContain('Only a pending place can be moderated')
        ->and($place->fresh()->status)->toBe('approved');
});

test('reject stores the reason shown to the submitter', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    $place = Place::factory()->create();

    $payload = toolPayload(callTool(RejectPlaceTool::class, [
        'place_id' => $place->id,
        'reason' => 'Not a real landmark — please resubmit with a photo.',
    ]));

    expect($payload['status'])->toBe('rejected')
        ->and($place->fresh()->status)->toBe('rejected')
        ->and($place->fresh()->rejection_reason)->toContain('Not a real landmark');
});

test('get-place reports a missing id with a recovery hint', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    expect(toolText(callTool(GetPlaceTool::class, ['place_id' => 999999])))
        ->toContain('No place exists with id 999999')
        ->toContain('Check the id with list-places');
});

test('delete refuses without explicit confirmation', function () {
    $user = agentUser(['permissions' => ['places.delete']]);
    agentToken($user, ['places.delete']);

    $place = Place::factory()->create();

    $response = callTool(DeletePlaceTool::class, ['place_id' => $place->id, 'confirm' => false]);

    expect($response->isError())->toBeTrue()
        ->and(toolText($response))->toContain('confirm=true')
        ->and(Place::whereKey($place->id)->exists())->toBeTrue();
});

test('delete removes the place once confirmed', function () {
    Storage::fake('public');

    $user = agentUser(['permissions' => ['places.delete']]);
    agentToken($user, ['places.delete']);

    $place = Place::factory()->create();

    callTool(DeletePlaceTool::class, ['place_id' => $place->id, 'confirm' => true]);

    expect(Place::whereKey($place->id)->exists())->toBeFalse();
});

test('update applies only the fields it was given', function () {
    $user = agentUser(['permissions' => ['places.edit']]);
    agentToken($user, ['places.edit']);

    $place = Place::factory()->create([
        'name' => 'الاسم الأصلي',
        'description' => 'وصف أصلي طويل بما يكفي لإعادة.',
    ]);

    callTool(UpdatePlaceTool::class, ['place_id' => $place->id, 'name' => 'الاسم الجديد']);

    $place->refresh();
    expect($place->name)->toBe('الاسم الجديد')
        ->and($place->description)->toBe('وصف أصلي طويل بما يكفي لإعادة.');
});

test('update rejects coordinates outside syria with an actionable message', function () {
    $user = agentUser(['permissions' => ['places.edit']]);
    agentToken($user, ['places.edit']);

    $place = Place::factory()->create();

    expect(toolText(callTool(UpdatePlaceTool::class, ['place_id' => $place->id, 'lat' => 48.85])))
        ->toContain('inside Syria');
});

test('update with no fields is refused rather than silently succeeding', function () {
    $user = agentUser(['permissions' => ['places.edit']]);
    agentToken($user, ['places.edit']);

    $place = Place::factory()->create();

    expect(toolText(callTool(UpdatePlaceTool::class, ['place_id' => $place->id])))
        ->toContain('Nothing to change');
});

test('a token with no places capability is offered none of the places tools', function () {
    $user = agentUser(['permissions' => ['transit.approve']]);
    agentToken($user, ['transit.approve']);

    foreach ([
        ListPlacesTool::class,
        GetPlaceTool::class,
        ApprovePlaceTool::class,
        RejectPlaceTool::class,
        UpdatePlaceTool::class,
        RotatePlacePhotoTool::class,
        DeletePlacePhotoTool::class,
        DeletePlaceTool::class,
    ] as $tool) {
        expect((new $tool)->shouldRegister())->toBeFalse();
    }
});

test('a token is offered exactly the tools its capabilities allow', function () {
    $user = agentUser(['permissions' => ['places.review', 'places.approve']]);
    agentToken($user, ['places.review', 'places.approve']);

    expect((new ListPlacesTool)->shouldRegister())->toBeTrue()
        ->and((new GetPlaceTool)->shouldRegister())->toBeTrue()
        ->and((new ApprovePlaceTool)->shouldRegister())->toBeTrue()
        ->and((new RejectPlaceTool)->shouldRegister())->toBeTrue()
        // places.edit / places.moderate_photos / places.delete were not granted
        ->and((new UpdatePlaceTool)->shouldRegister())->toBeFalse()
        ->and((new RotatePlacePhotoTool)->shouldRegister())->toBeFalse()
        ->and((new DeletePlacePhotoTool)->shouldRegister())->toBeFalse()
        ->and((new DeletePlaceTool)->shouldRegister())->toBeFalse();
});

test('losing a capability hides the tool on the next listing', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    expect((new ApprovePlaceTool)->shouldRegister())->toBeTrue();

    $user->update(['permissions' => []]);

    // Same token, still holding the ability, but the user grant is gone.
    expect((new ApprovePlaceTool)->shouldRegister())->toBeFalse();
});

test('an anonymous context registers nothing requiring a capability', function () {
    app()->instance(AgentContext::class, AgentContext::anonymous());

    expect((new ApprovePlaceTool)->shouldRegister())->toBeFalse();
});

test('every successful tool call is written to the audit trail', function () {
    $user = agentUser(['permissions' => ['places.approve', 'places.review']]);
    $token = agentToken($user, ['places.approve', 'places.review']);

    $place = Place::factory()->create();

    callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    $call = McpToolCall::query()->latest('id')->first();

    expect($call)->not->toBeNull()
        ->and($call->tool)->toBe('approve-place')
        ->and($call->outcome)->toBe('ok')
        ->and($call->user_id)->toBe($user->id)
        ->and($call->token_id)->toBe($token->id)
        ->and($call->token_name)->toBe('test-agent')
        ->and($call->arguments['place_id'])->toBe($place->id)
        ->and($call->duration_ms)->not->toBeNull();
});

test('a denied call is audited as denied, not silently dropped', function () {
    $user = agentUser(['permissions' => ['places.review']]);
    agentToken($user, ['places.review']);

    $place = Place::factory()->create();

    callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    $call = McpToolCall::query()->latest('id')->first();

    expect($call->outcome)->toBe('denied')
        ->and($call->tool)->toBe('approve-place')
        ->and($call->error)->toContain('Permission denied');
});

test('a domain refusal is audited as an error, with the reason recorded', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    $place = Place::factory()->approved()->create();

    callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    $call = McpToolCall::query()->latest('id')->first();

    expect($call->outcome)->toBe('error')
        // Found by driving a real agent session: the outcome was recorded but
        // the reason was not, so the trail said "error" with nothing to go on.
        ->and($call->error)->toContain('Place is already approved');
});

test('audit arguments are redacted so a pasted secret is never persisted', function () {
    $redacted = app(AgentAudit::class)->redact([
        'place_id' => 5,
        'token' => 'sz_super_secret',
        'nested' => ['apiKey' => 'sk-live-123', 'name' => 'keep me'],
    ]);

    expect($redacted['place_id'])->toBe(5)
        ->and($redacted['token'])->toBe('[redacted]')
        ->and($redacted['nested']['apiKey'])->toBe('[redacted]')
        ->and($redacted['nested']['name'])->toBe('keep me');
});

test('the permissions resource reports the effective set and the unusable grants', function () {
    $user = agentUser(['permissions' => ['places.review', 'places.edit']]);
    agentToken($user, ['places.review']);

    AdminServer::resource(AgentPermissionsResource::class)
        ->assertOk()
        ->assertSee('effective_permissions')
        // places.edit: user has it, token does not -> surfaced as unusable
        ->assertSee('granted_but_unusable')
        ->assertSee('places.edit')
        ->assertSee('places.review');
});

test('the token audit resource shows this token only', function () {
    $user = agentUser(['permissions' => ['places.approve']]);
    agentToken($user, ['places.approve']);

    $place = Place::factory()->create();
    callTool(ApprovePlaceTool::class, ['place_id' => $place->id]);

    // A call attributed to a different token must not leak into this view.
    $other = agentUser(['permissions' => ['places.approve']]);
    McpToolCall::create([
        'user_id' => $other->id,
        'token_id' => 9999,
        'token_name' => 'other-agent',
        'tool' => 'secret-tool',
        'outcome' => 'ok',
    ]);

    AdminServer::resource(AgentTokenResource::class)
        ->assertOk()
        ->assertSee('approve-place')
        ->assertDontSee('secret-tool');
});
