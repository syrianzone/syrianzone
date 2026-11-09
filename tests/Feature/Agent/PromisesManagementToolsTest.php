<?php

use App\Exceptions\Promises\PromiseActionException;
use App\Mcp\Tools\Promises\AcceptPromiseReportTool;
use App\Mcp\Tools\Promises\ApprovePromiseSpeakerTool;
use App\Mcp\Tools\Promises\CreatePromiseSectorTool;
use App\Mcp\Tools\Promises\CreatePromiseSpeakerTool;
use App\Mcp\Tools\Promises\DeletePromiseSectorTool;
use App\Mcp\Tools\Promises\DeletePromiseSpeakerTool;
use App\Mcp\Tools\Promises\DeletePromiseTool;
use App\Mcp\Tools\Promises\DismissPromiseReportTool;
use App\Mcp\Tools\Promises\GetPromiseReviewQueueTool;
use App\Mcp\Tools\Promises\ListPromiseSectorsTool;
use App\Mcp\Tools\Promises\ListPromiseSpeakersTool;
use App\Mcp\Tools\Promises\PublishPromiseTool;
use App\Mcp\Tools\Promises\RejectPromiseSpeakerTool;
use App\Mcp\Tools\Promises\RejectPromiseTool;
use App\Mcp\Tools\Promises\ReorderPromiseSectorsTool;
use App\Mcp\Tools\Promises\SetPromiseStatusTool;
use App\Mcp\Tools\Promises\TogglePromiseSectorTool;
use App\Mcp\Tools\Promises\UndoPromiseStatusTool;
use App\Mcp\Tools\Promises\UnpublishPromiseTool;
use App\Mcp\Tools\Promises\UpdatePromiseSectorTool;
use App\Mcp\Tools\Promises\UpdatePromiseSpeakerTool;
use App\Mcp\Tools\Promises\UpdatePromiseTool;
use App\Models\McpToolCall;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSector;
use App\Models\PromiseSpeaker;
use App\Models\User;
use App\Services\Promises\PromiseModerationService;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Promises tracker agent tools: publishing, verdicts, the review queue,
| people and sectors
|--------------------------------------------------------------------------
|
| Every agent here belongs to staff holding the whole promises module, so the
| token alone decides what the agent may do: that is the ceiling under test.
|
*/

function promisesAgent(array $abilities): User
{
    $user = moduleStaff('promises');
    agentToken($user, $abilities);

    return $user;
}

test('each tool needs its own capability on the token, whatever the user holds', function () {
    promisesAgent(['promises.edit']);
    $promise = Promise::factory()->create();

    foreach ([
        [PublishPromiseTool::class, ['id' => $promise->id]],
        [SetPromiseStatusTool::class, ['id' => $promise->id, 'status' => 'in_progress', 'happened_on' => '2025-07-01', 'source_url' => 'https://example.com/s']],
        [DeletePromiseTool::class, ['id' => $promise->id]],
        [GetPromiseReviewQueueTool::class, []],
        [CreatePromiseSectorTool::class, ['id' => 'tourism', 'label' => 'السياحة']],
    ] as [$tool, $arguments]) {
        expect(toolText(callTool($tool, $arguments)))->toContain('Permission denied');
    }

    $promise->refresh();
    expect($promise->review_status)->toBe('pending')
        ->and($promise->status)->toBe('pending')
        ->and($promise->trashed())->toBeFalse()
        ->and(PromiseSector::find('tourism'))->toBeNull()
        ->and(McpToolCall::where('outcome', 'denied')->count())->toBe(5);
});

test('a reviewer publishes, unpublishes and rejects, and a number survives unpublishing', function () {
    promisesAgent(['promises.review']);
    $promise = Promise::factory()->create();
    $suggestion = Promise::factory()->create();

    $published = toolPayload(callTool(PublishPromiseTool::class, ['id' => $promise->id]));
    $again = callTool(PublishPromiseTool::class, ['id' => $promise->id]);
    callTool(UnpublishPromiseTool::class, ['id' => $promise->id]);
    $rejected = toolPayload(callTool(RejectPromiseTool::class, ['id' => $suggestion->id, 'reason' => 'لا مصدر موثوق']));

    expect($published['number'])->toBe(1)
        ->and($published['url'])->toEndWith('/promises/1')
        ->and($again->isError())->toBeTrue()
        ->and($promise->fresh()->review_status)->toBe('pending')
        ->and($promise->fresh()->number)->toBe(1)
        ->and($rejected['promise']['reviewStatus'])->toBe('rejected')
        ->and($rejected['promise']['rejectionReason'])->toBe('لا مصدر موثوق')
        ->and(McpToolCall::where('tool', 'publish-promise')->pluck('outcome')->all())->toBe(['ok', 'error']);
});

test('publishing a restatement postpones the original only when the token may rule', function () {
    $original = Promise::factory()->published()->overdue()->create();
    $restatement = fn () => Promise::factory()->create(['restates_promise_id' => $original->id, 'statement_date' => '2025-10-01']);

    promisesAgent(['promises.review']);
    $reviewOnly = toolPayload(callTool(PublishPromiseTool::class, ['id' => $restatement()->id]));

    expect($original->fresh()->status)->toBe('pending')
        ->and($reviewOnly['note'])->toContain('promises.rule');

    promisesAgent(['promises.review', 'promises.rule']);
    $ruler = toolPayload(callTool(PublishPromiseTool::class, ['id' => $restatement()->id]));

    expect($original->fresh()->status)->toBe('postponed')
        ->and($ruler)->not->toHaveKey('note');
});

test('linking a restatement with update-promise postpones the original only when the token may rule', function () {
    $original = Promise::factory()->published()->overdue()->create();
    $restatement = Promise::factory()->published()->create(['statement_date' => '2025-10-01']);
    $link = fn (?string $restates) => callTool(UpdatePromiseTool::class, [
        'id' => $restatement->id,
        'expected_version' => $restatement->fresh()->version,
        'speaker_ref' => 'speaker:'.$restatement->speaker_id,
        'title' => $restatement->title,
        'quote' => $restatement->quote,
        'statement_date' => '2025-10-01',
        'statement_venue' => 'tv_interview',
        'deadline_date' => '2026-06-01',
        'restates_promise_id' => $restates,
        'sources' => [['url' => 'https://example.com/restated', 'type' => 'news_article']],
    ]);

    promisesAgent(['promises.edit']);
    $editOnly = toolPayload($link($original->id));

    expect($editOnly['updated'])->toBeTrue()
        ->and($editOnly['note'])->toContain('promises.rule')
        ->and($restatement->fresh()->restates_promise_id)->toBe($original->id)
        ->and($original->fresh()->status)->toBe('pending');

    promisesAgent(['promises.edit', 'promises.rule']);
    $link(null);
    $link($original->id);

    expect($original->fresh()->status)->toBe('postponed');
});

test('a ruler sets sourced statuses in date order and can undo one only before publication', function () {
    promisesAgent(['promises.rule']);
    $draft = Promise::factory()->create(['statement_date' => '2025-06-01']);
    $status = fn (Promise $p, array $entry) => callTool(SetPromiseStatusTool::class, ['id' => $p->id] + $entry);

    $unsourced = $status($draft, ['status' => 'in_progress', 'happened_on' => '2025-07-01']);
    $beforeStatement = $status($draft, ['status' => 'in_progress', 'happened_on' => '2025-05-01', 'source_url' => 'https://example.com/early']);
    $fulfilled = toolPayload($status($draft, ['status' => 'fulfilled', 'happened_on' => '2025-08-01', 'source_url' => 'https://example.com/done']));

    expect($unsourced->isError())->toBeTrue()
        ->and($beforeStatement->isError())->toBeTrue()
        ->and($fulfilled['status'])->toBe('fulfilled')
        ->and($draft->fresh()->resolved_at->format('Y-m-d'))->toBe('2025-08-01');

    $undone = toolPayload(callTool(UndoPromiseStatusTool::class, [
        'id' => $draft->id,
        'update_id' => $draft->updates()->sole()->id,
    ]));

    expect($undone['status'])->toBe('pending')
        ->and($draft->updates()->count())->toBe(0);

    $public = Promise::factory()->published()->create(['statement_date' => '2025-06-01']);
    $status($public, ['status' => 'broken', 'happened_on' => '2025-09-01', 'source_url' => 'https://example.com/broken']);
    $undoPublic = callTool(UndoPromiseStatusTool::class, [
        'id' => $public->id,
        'update_id' => $public->updates()->sole()->id,
    ]);

    expect($undoPublic->isError())->toBeTrue()
        ->and($public->fresh()->status)->toBe('broken');
});

test('delete-promise takes a promise off the site and its number is never reused', function () {
    promisesAgent(['promises.delete', 'promises.review']);
    $promise = Promise::factory()->published()->create();

    $deleted = toolPayload(callTool(DeletePromiseTool::class, ['id' => $promise->id]));
    $next = toolPayload(callTool(PublishPromiseTool::class, ['id' => Promise::factory()->create()->id]));

    expect($deleted['deleted'])->toBeTrue()
        ->and(Promise::find($promise->id))->toBeNull()
        ->and($next['number'])->toBe($promise->number + 1);
});

test('a review action on a promise deleted after it was loaded is refused as not found', function () {
    $reviewer = moduleStaff('promises');
    $promise = Promise::factory()->published()->create();
    $loaded = Promise::find($promise->id);
    $promise->delete();

    expect(fn () => app(PromiseModerationService::class)->unpublish($loaded, $reviewer))
        ->toThrow(PromiseActionException::class, 'الوعد غير موجود');
});

test('a reviewer works through the queue: people, progress reports and error reports', function () {
    promisesAgent(['promises.review']);
    $speaker = PromiseSpeaker::factory()->pending()->create(['name' => 'اسم مقترح']);
    $promise = Promise::factory()->published()->create(['statement_date' => '2025-06-01']);
    $report = fn (string $kind, ?string $source) => PromiseReport::create([
        'promise_id' => $promise->id, 'user_id' => User::factory()->create()->id, 'kind' => $kind,
        'body' => 'نص من زائر', 'source_url' => $source, 'status' => 'pending',
    ]);
    $progress = $report('progress', 'https://example.com/work');
    $error = $report('error', null);

    $queue = toolPayload(callTool(GetPromiseReviewQueueTool::class));

    expect($queue['count'])->toBe(3)
        ->and($queue['promises'])->toBe([])
        ->and($queue['speakers'][0]['name'])->toBe('اسم مقترح')
        ->and(collect($queue['reports'])->pluck('id')->all())->toEqualCanonicalizing([$progress->id, $error->id]);

    callTool(ApprovePromiseSpeakerTool::class, ['speaker_id' => $speaker->id]);
    $accepted = toolPayload(callTool(AcceptPromiseReportTool::class, ['report_id' => $progress->id, 'note' => 'بدأت أعمال الصيانة']));
    callTool(DismissPromiseReportTool::class, ['report_id' => $error->id]);
    $acceptDismissed = callTool(AcceptPromiseReportTool::class, ['report_id' => $error->id]);

    $entry = $promise->updates()->sole();
    expect($speaker->fresh()->status)->toBe('approved')
        ->and($accepted['added_to_log'])->toBeTrue()
        ->and($entry->body)->toBe('بدأت أعمال الصيانة')
        ->and($entry->source_url)->toBe('https://example.com/work')
        ->and($error->fresh()->status)->toBe('dismissed')
        ->and($acceptDismissed->isError())->toBeTrue()
        ->and(toolPayload(callTool(GetPromiseReviewQueueTool::class))['count'])->toBe(0);
});

test('a person with published promises cannot be rejected, and unknown ids name the listing to call', function () {
    promisesAgent(['promises.review']);
    $speaker = PromiseSpeaker::factory()->pending()->create();
    Promise::factory()->published()->create(['speaker_id' => $speaker->id]);

    $reject = callTool(RejectPromiseSpeakerTool::class, ['speaker_id' => $speaker->id, 'reason' => 'مكرر']);
    $unknownPerson = callTool(ApprovePromiseSpeakerTool::class, ['speaker_id' => (string) Str::uuid()]);
    $unknownReport = callTool(DismissPromiseReportTool::class, ['report_id' => 999_999]);

    expect($reject->isError())->toBeTrue()
        ->and($speaker->fresh()->status)->toBe('pending')
        ->and(toolText($unknownPerson))->toContain('get-promise-review-queue')
        ->and(toolText($unknownReport))->toContain('get-promise-review-queue');
});

test('staff add people by name, correct them, and cannot delete one who has promises', function () {
    promisesAgent(['promises.speakers']);

    $created = toolPayload(callTool(CreatePromiseSpeakerTool::class, [
        'name' => 'محافظ المثال', 'title' => 'محافظ حمص', 'x_handle' => '@example_gov',
    ]));
    $speaker = PromiseSpeaker::findOrFail(Str::after($created['ref'], 'speaker:'));

    $page = toolPayload(callTool(ListPromiseSpeakersTool::class, ['status' => 'approved', 'limit' => 1]));
    $all = toolPayload(callTool(ListPromiseSpeakersTool::class, ['status' => 'approved']));

    expect($speaker->status)->toBe('approved')
        ->and($speaker->x_handle)->toBe('example_gov')
        ->and($page['count'])->toBe(1)
        ->and($page['total'])->toBe($all['count'])
        ->and(collect($all['speakers'])->pluck('ref'))->toContain($created['ref']);

    $corrected = toolPayload(callTool(UpdatePromiseSpeakerTool::class, ['speaker_id' => $speaker->id, 'name' => 'محافظ المثال الجديد']));
    $unsafeImage = callTool(CreatePromiseSpeakerTool::class, ['name' => 'اسم آخر', 'image_url' => 'javascript:alert(1)']);

    expect($corrected['speaker']['name'])->toBe('محافظ المثال الجديد')
        ->and($corrected['speaker']['title'])->toBeNull()
        ->and($unsafeImage->isError())->toBeTrue()
        ->and(PromiseSpeaker::where('name', 'اسم آخر')->exists())->toBeFalse();

    Promise::factory()->create(['speaker_id' => $speaker->id]);
    $inUse = callTool(DeletePromiseSpeakerTool::class, ['speaker_id' => $speaker->id]);
    $unused = toolPayload(callTool(DeletePromiseSpeakerTool::class, ['speaker_id' => PromiseSpeaker::factory()->create()->id]));

    expect($inUse->isError())->toBeTrue()
        ->and(PromiseSpeaker::find($speaker->id))->not->toBeNull()
        ->and($unused['deleted'])->toBeTrue();
});

test('staff manage sectors: icons survive a rename, used sectors are hidden not deleted, orders are complete', function () {
    promisesAgent(['promises.speakers']);
    Promise::factory()->create(['sector_id' => 'electricity']);

    $badId = callTool(CreatePromiseSectorTool::class, ['id' => 'Tourism Sector', 'label' => 'السياحة']);
    callTool(CreatePromiseSectorTool::class, ['id' => 'tourism', 'label' => 'السياحة', 'icon' => 'landmark']);
    callTool(UpdatePromiseSectorTool::class, ['id' => 'tourism', 'label' => 'السياحة والآثار']);
    $hidden = toolPayload(callTool(TogglePromiseSectorTool::class, ['id' => 'tourism', 'is_active' => false]));
    $inUse = callTool(DeletePromiseSectorTool::class, ['id' => 'electricity']);

    $tourism = PromiseSector::find('tourism');
    expect($badId->isError())->toBeTrue()
        ->and($tourism->label)->toBe('السياحة والآثار')
        ->and($tourism->icon)->toBe('landmark')
        ->and($hidden['is_active'])->toBeFalse()
        ->and($inUse->isError())->toBeTrue()
        ->and(PromiseSector::find('electricity'))->not->toBeNull();

    $ids = collect(toolPayload(callTool(ListPromiseSectorsTool::class))['sectors'])->pluck('id')->all();
    $partial = callTool(ReorderPromiseSectorsTool::class, ['ids' => ['tourism']]);
    $repeated = callTool(ReorderPromiseSectorsTool::class, ['ids' => [...$ids, 'tourism']]);
    $unknown = callTool(ReorderPromiseSectorsTool::class, ['ids' => [...$ids, 'no-such-sector']]);
    $full = toolPayload(callTool(ReorderPromiseSectorsTool::class, ['ids' => array_reverse($ids)]));

    expect($partial->isError())->toBeTrue()
        ->and(toolText($partial))->toContain('Missing: ', 'list-promise-sectors')
        ->and($repeated->isError())->toBeTrue()
        ->and(toolText($repeated))->toContain('Repeated: tourism')
        ->and($unknown->isError())->toBeTrue()
        ->and(toolText($unknown))->toContain('Unknown: no-such-sector')
        ->and($full['reordered'])->toBeTrue()
        ->and(PromiseSector::orderBy('order_column')->pluck('id')->all())->toBe(array_reverse($ids));
});
