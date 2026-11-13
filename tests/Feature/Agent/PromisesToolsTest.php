<?php

use App\Mcp\Tools\Promises\AddPromiseUpdateTool;
use App\Mcp\Tools\Promises\CreatePromiseTool;
use App\Mcp\Tools\Promises\GetPromiseTool;
use App\Mcp\Tools\Promises\ListPromisesTool;
use App\Mcp\Tools\Promises\RemovePromiseUpdateTool;
use App\Mcp\Tools\Promises\UpdatePromiseTool;
use App\Models\McpToolCall;
use App\Models\Promise;
use App\Services\Promises\PromiseEditor;
use Illuminate\Support\Str;

test('a token with only promises.review can call list-promises and get-promise (any-of read gate)', function () {
    $user = agentUser(['permissions' => ['promises.review']]);
    agentToken($user, ['promises.review']);

    $promise = Promise::factory()->create(['title' => 'وعد للاختبار']);

    $list = toolPayload(callTool(ListPromisesTool::class));
    expect($list['count'])->toBe(1)
        ->and($list['promises'][0]['title'])->toBe('وعد للاختبار');

    $get = toolPayload(callTool(GetPromiseTool::class, ['id' => $promise->id]));
    expect($get['promise']['title'])->toBe('وعد للاختبار');

    $other = agentUser(['permissions' => ['places.review']]);
    agentToken($other, ['places.review']);

    $refused = callTool(ListPromisesTool::class);
    expect(toolText($refused))->toContain('Permission denied');
});

test('create-promise with promises.create creates a promise with review_status pending, number null, sources stored; and the McpToolCall audit row has outcome ok', function () {
    $user = agentUser(['permissions' => ['promises.create']]);
    agentToken($user, ['promises.create']);

    $payload = promisePayload();
    $response = callTool(CreatePromiseTool::class, $payload);
    $result = toolPayload($response);

    expect($result['created'])->toBeTrue();

    $promise = Promise::where('title', $payload['title'])->first();
    expect($promise)->not->toBeNull()
        ->and($promise->review_status)->toBe('pending')
        ->and($promise->number)->toBeNull()
        ->and($promise->sources()->count())->toBe(2);

    $audit = McpToolCall::query()->latest('id')->first();
    expect($audit->outcome)->toBe('ok')
        ->and($audit->tool)->toBe('create-promise');
});

test('a token with only promises.edit is denied create-promise and nothing is created', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $response = callTool(CreatePromiseTool::class, promisePayload());

    expect($response->isError())->toBeTrue()
        ->and(toolText($response))->toContain('Permission denied')
        ->and(Promise::count())->toBe(0);
});

test('update-promise edits drafts and published promises alike, given the version it read', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $draft = Promise::factory()->create(['title' => 'العنوان الأصلي']);
    $res = callTool(UpdatePromiseTool::class, promisePayload([
        'id' => $draft->id,
        'expected_version' => 0,
        'title' => 'العنوان المحدث',
    ]));

    expect(toolPayload($res)['updated'])->toBeTrue()
        ->and($draft->fresh()->title)->toBe('العنوان المحدث');

    $published = Promise::factory()->published()->create(['title' => 'عنوان منشور']);
    $read = toolPayload(callTool(GetPromiseTool::class, ['id' => $published->id]))['promise'];
    $res = callTool(UpdatePromiseTool::class, promisePayload([
        'id' => $published->id,
        'expected_version' => $read['version'],
        'title' => 'عنوان منشور مصحح',
    ]));

    expect(toolPayload($res)['updated'])->toBeTrue()
        ->and($published->fresh()->title)->toBe('عنوان منشور مصحح')
        ->and($published->fresh()->review_status)->toBe('published');
});

test('update-promise refuses a stale read, even one from the same second, so it never overwrites a newer edit', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $promise = Promise::factory()->create(['title' => 'العنوان الأصلي']);
    $read = toolPayload(callTool(GetPromiseTool::class, ['id' => $promise->id]))['promise'];

    app(PromiseEditor::class)->save($promise, promisePayload(['title' => 'تعديل محرر آخر']));

    $res = callTool(UpdatePromiseTool::class, promisePayload([
        'id' => $promise->id,
        'expected_version' => $read['version'],
        'title' => 'تعديل الوكيل',
    ]));

    expect($res->isError())->toBeTrue()
        ->and(toolText($res))->toContain('version 1')
        ->and($promise->fresh()->title)->toBe('تعديل محرر آخر');

    $missing = callTool(UpdatePromiseTool::class, promisePayload(['id' => $promise->id]));
    expect($missing->isError())->toBeTrue()
        ->and($promise->fresh()->title)->toBe('تعديل محرر آخر');
});

test('add-promise-update adds a progress entry with a source; a progress entry without source_url is refused; then remove-promise-update removes the added entry', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $promise = Promise::factory()->create(['statement_date' => '2025-06-01']);

    $addRes = callTool(AddPromiseUpdateTool::class, [
        'id' => $promise->id,
        'type' => 'progress',
        'happened_on' => '2025-07-01',
        'value' => 50,
        'source_url' => 'https://example.com/progress',
    ]);
    expect(toolPayload($addRes)['added'])->toBeTrue();

    $update = $promise->updates()->where('type', 'progress')->first();
    expect($update)->not->toBeNull()
        ->and((float) $update->value)->toBe(50.0);

    $failRes = callTool(AddPromiseUpdateTool::class, [
        'id' => $promise->id,
        'type' => 'progress',
        'happened_on' => '2025-07-02',
        'value' => 60,
    ]);
    expect($failRes->isError())->toBeTrue();

    $remRes = callTool(RemovePromiseUpdateTool::class, [
        'id' => $promise->id,
        'update_id' => $update->id,
    ]);
    expect(toolPayload($remRes)['removed'])->toBeTrue()
        ->and($promise->updates()->where('id', $update->id)->exists())->toBeFalse();
});

test('remove-promise-update refuses a status_change entry', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $promise = Promise::factory()->create();
    $statusUpdate = $promise->updates()->create([
        'type' => 'status_change',
        'happened_on' => '2025-07-01',
        'status_from' => 'pending',
        'status_to' => 'in_progress',
        'source_url' => 'https://example.com/source',
    ]);

    $remRes = callTool(RemovePromiseUpdateTool::class, [
        'id' => $promise->id,
        'update_id' => $statusUpdate->id,
    ]);

    expect($remRes->isError())->toBeTrue()
        ->and($promise->updates()->where('id', $statusUpdate->id)->exists())->toBeTrue();
});

test('the change-log tools work on published promises, keeping status changes permanent', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $promise = Promise::factory()->published()->create(['statement_date' => '2025-06-01']);
    $verdict = $promise->updates()->create([
        'type' => 'status_change',
        'happened_on' => '2025-06-15',
        'status_from' => 'pending',
        'status_to' => 'in_progress',
        'source_url' => 'https://example.com/started',
    ]);

    $add = callTool(AddPromiseUpdateTool::class, [
        'id' => $promise->id,
        'type' => 'note',
        'happened_on' => '2025-07-02',
        'body' => 'ملاحظة جديدة',
    ]);
    $note = $promise->updates()->where('type', 'note')->sole();

    $removeNote = callTool(RemovePromiseUpdateTool::class, ['id' => $promise->id, 'update_id' => $note->id]);
    $removeVerdict = callTool(RemovePromiseUpdateTool::class, ['id' => $promise->id, 'update_id' => $verdict->id]);

    expect(toolPayload($add)['added'])->toBeTrue()
        ->and(toolPayload($removeNote)['removed'])->toBeTrue()
        ->and($removeVerdict->isError())->toBeTrue()
        ->and($promise->updates()->pluck('id')->all())->toBe([$verdict->id]);
});

test('get-promise by unknown id returns an error mentioning list-promises', function () {
    $user = agentUser(['permissions' => ['promises.review']]);
    agentToken($user, ['promises.review']);

    $res = callTool(GetPromiseTool::class, ['id' => (string) Str::uuid()]);

    expect($res->isError())->toBeTrue()
        ->and(toolText($res))->toContain('list-promises');
});

test('create-promise with a bogus speaker_ref returns an error mentioning search-promise-speakers', function () {
    $user = agentUser(['permissions' => ['promises.create']]);
    agentToken($user, ['promises.create']);

    $res = callTool(CreatePromiseTool::class, promisePayload([
        'speaker_ref' => 'speaker:00000000-0000-0000-0000-000000000000',
    ]));

    expect($res->isError())->toBeTrue()
        ->and(toolText($res))->toContain('search-promise-speakers');
});
