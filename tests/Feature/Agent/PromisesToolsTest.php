<?php

use App\Mcp\Tools\Promises\AddPromiseUpdateTool;
use App\Mcp\Tools\Promises\CreatePromiseTool;
use App\Mcp\Tools\Promises\GetPromiseTool;
use App\Mcp\Tools\Promises\ListPromisesTool;
use App\Mcp\Tools\Promises\RemovePromiseUpdateTool;
use App\Mcp\Tools\Promises\UpdatePromiseTool;
use App\Models\McpToolCall;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Promises tracker agent tools
|--------------------------------------------------------------------------
*/

function agentPromisePayload(array $overrides = []): array
{
    $speaker = PromiseSpeaker::factory()->create();

    return array_merge([
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => 'إعادة تأهيل المحطة الكهربائية',
        'quote' => 'سنعيد تأهيل المحطة خلال ستة أشهر',
        'statement_date' => '2025-07-01',
        'statement_venue' => 'tv_interview',
        'deadline_wording' => 'خلال ستة أشهر',
        'deadline_date' => '2026-01-01',
        'sector_id' => 'electricity',
        'is_national' => false,
        'governorates' => ['aleppo', 'homs'],
        'tags' => ['الكهرباء', 'محطات'],
        'sources' => [
            ['url' => 'https://example.com/a', 'type' => 'tv_interview', 'published_date' => '2025-07-01'],
            ['url' => 'https://example.com/b', 'type' => 'news_article', 'published_date' => '2025-07-03'],
        ],
    ], $overrides);
}

test('a token with only promises.review can call list-promises and get-promise (any-of read gate)', function () {
    $user = agentUser(['permissions' => ['promises.review']]);
    agentToken($user, ['promises.review']);

    $promise = Promise::factory()->create(['title' => 'وعد للاختبار']);

    $list = toolPayload(callTool(ListPromisesTool::class));
    expect($list['count'])->toBe(1)
        ->and($list['promises'][0]['title'])->toBe('وعد للاختبار');

    $get = toolPayload(callTool(GetPromiseTool::class, ['id' => $promise->id]));
    expect($get['promise']['title'])->toBe('وعد للاختبار');

    // An unprivileged token cannot call read tools
    $other = agentUser(['permissions' => ['places.review']]);
    agentToken($other, ['places.review']);

    $refused = callTool(ListPromisesTool::class);
    expect(toolText($refused))->toContain('Permission denied');
});

test('create-promise with promises.create creates a promise with review_status pending, number null, sources stored; and the McpToolCall audit row has outcome ok', function () {
    $user = agentUser(['permissions' => ['promises.create']]);
    agentToken($user, ['promises.create']);

    $payload = agentPromisePayload();
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

    $response = callTool(CreatePromiseTool::class, agentPromisePayload());

    expect($response->isError())->toBeTrue()
        ->and(toolText($response))->toContain('Permission denied')
        ->and(Promise::count())->toBe(0);
});

test('update-promise edits an unpublished promise; update-promise on a published promise returns an error and leaves title unchanged', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    // Unpublished promise can be edited
    $promise = Promise::factory()->create(['title' => 'العنوان الأصلي']);
    $res = callTool(UpdatePromiseTool::class, agentPromisePayload(['id' => $promise->id, 'title' => 'العنوان المحدث']));

    expect(toolPayload($res)['updated'])->toBeTrue()
        ->and($promise->fresh()->title)->toBe('العنوان المحدث');

    // Published promise cannot be edited by agents
    $published = Promise::factory()->published()->create(['title' => 'عنوان منشور']);
    $resPublished = callTool(UpdatePromiseTool::class, agentPromisePayload(['id' => $published->id, 'title' => 'عنوان معدل جديد']));

    expect($resPublished->isError())->toBeTrue()
        ->and(toolText($resPublished))->toContain('This promise is published')
        ->and($published->fresh()->title)->toBe('عنوان منشور');
});

test('add-promise-update adds a progress entry with a source; a progress entry without source_url is refused; then remove-promise-update removes the added entry', function () {
    $user = agentUser(['permissions' => ['promises.edit']]);
    agentToken($user, ['promises.edit']);

    $promise = Promise::factory()->create(['statement_date' => '2025-06-01']);

    // Progress update with source_url succeeds
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

    // Progress update without source_url is refused
    $failRes = callTool(AddPromiseUpdateTool::class, [
        'id' => $promise->id,
        'type' => 'progress',
        'happened_on' => '2025-07-02',
        'value' => 60,
    ]);
    expect($failRes->isError())->toBeTrue();

    // Remove update succeeds
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

    $promise = Promise::factory()->published()->create();
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

    $res = callTool(CreatePromiseTool::class, agentPromisePayload([
        'speaker_ref' => 'speaker:00000000-0000-0000-0000-000000000000',
    ]));

    expect($res->isError())->toBeTrue()
        ->and(toolText($res))->toContain('search-promise-speakers');
});
