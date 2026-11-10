<?php

use App\Mcp\Tools\Promises\ReschedulePromiseTool;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use App\Models\PromiseUpdate;
use App\Models\User;
use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromisePresenter;
use Illuminate\Support\Facades\DB;

/*
|--------------------------------------------------------------------------
| Related Promises & Deadline Rescheduling Tests
|--------------------------------------------------------------------------
*/

test('saving related_promise_ids establishes bidirectional relationships with canonical pairs', function () {
    $speaker = PromiseSpeaker::factory()->create();
    $editor = app(PromiseEditor::class);

    $a = Promise::factory()->published()->create(['speaker_id' => $speaker->id, 'title' => 'الوعد أ']);
    $b = Promise::factory()->published()->create(['speaker_id' => $speaker->id, 'title' => 'الوعد ب']);
    $c = Promise::factory()->published()->create(['speaker_id' => $speaker->id, 'title' => 'الوعد ج']);

    $editor->save($a, [
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => $a->title,
        'quote' => $a->quote,
        'statement_date' => $a->statement_date->format('Y-m-d'),
        'statement_venue' => $a->statement_venue,
        'sources' => [['url' => 'https://example.com/a', 'type' => 'news_article']],
        'related_promise_ids' => [$b->id, $c->id],
    ]);

    expect($a->relatedPromiseIds())->toEqualCanonicalizing([$b->id, $c->id])
        ->and($b->relatedPromiseIds())->toEqualCanonicalizing([$a->id])
        ->and($c->relatedPromiseIds())->toEqualCanonicalizing([$a->id]);

    // Check raw DB rows: only 2 pairs stored canonically min(id, otherId), max(id, otherId)
    $rows = DB::table('promise_relations')->get();
    expect($rows)->toHaveCount(2);

    // Updating A to only link to B removes the link to C
    $editor->save($a, [
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => $a->title,
        'quote' => $a->quote,
        'statement_date' => $a->statement_date->format('Y-m-d'),
        'statement_venue' => $a->statement_venue,
        'sources' => [['url' => 'https://example.com/a', 'type' => 'news_article']],
        'related_promise_ids' => [$b->id],
    ]);

    expect($a->fresh()->relatedPromiseIds())->toEqualCanonicalizing([$b->id])
        ->and($b->fresh()->relatedPromiseIds())->toEqualCanonicalizing([$a->id])
        ->and($c->fresh()->relatedPromiseIds())->toBeEmpty();
});

test('relatedPublishedPromises returns published promises in statement date and number order', function () {
    $speaker = PromiseSpeaker::factory()->create(['name' => 'طارق الأحمد']);
    $editor = app(PromiseEditor::class);

    $a = Promise::factory()->published()->create([
        'speaker_id' => $speaker->id,
        'statement_date' => '2025-06-01',
        'number' => 10,
    ]);

    $pLater = Promise::factory()->published()->create([
        'speaker_id' => $speaker->id,
        'title' => 'وعد لاحق',
        'statement_date' => '2025-09-01',
        'deadline_date' => '2026-03-01',
        'number' => 25,
    ]);

    $pEarlier = Promise::factory()->published()->create([
        'speaker_id' => $speaker->id,
        'title' => 'وعد مبكر',
        'statement_date' => '2025-07-01',
        'deadline_date' => '2026-01-01',
        'number' => 15,
    ]);

    $pUnpublished = Promise::factory()->create([
        'speaker_id' => $speaker->id,
        'title' => 'مسودة غير منشورة',
        'statement_date' => '2025-05-01',
    ]);

    $editor->save($a, [
        'speaker_ref' => 'speaker:'.$speaker->id,
        'title' => $a->title,
        'quote' => $a->quote,
        'statement_date' => $a->statement_date->format('Y-m-d'),
        'statement_venue' => $a->statement_venue,
        'sources' => [['url' => 'https://example.com/s', 'type' => 'news_article']],
        'related_promise_ids' => [$pLater->id, $pEarlier->id, $pUnpublished->id],
    ]);

    $related = $a->relatedPublishedPromises();

    // Unpublished promises are excluded from relatedPublishedPromises
    expect($related)->toHaveCount(2)
        ->and($related->first()->id)->toBe($pEarlier->id)
        ->and($related->last()->id)->toBe($pLater->id);

    // Presenter detail output
    $presenter = app(PromisePresenter::class);
    $detail = $presenter->detail($a);

    expect($detail)->toHaveKey('relatedPromises')
        ->and($detail['relatedPromises'])->toHaveCount(2)
        ->and($detail['relatedPromises'][0])->toMatchArray([
            'number' => 15,
            'title' => 'وعد مبكر',
            'speakerName' => 'طارق الأحمد',
            'statementDate' => '2025-07-01',
            'deadlineDate' => '2026-01-01',
        ])
        ->and($detail['relatedPromises'][1])->toMatchArray([
            'number' => 25,
            'title' => 'وعد لاحق',
            'speakerName' => 'طارق الأحمد',
            'statementDate' => '2025-09-01',
            'deadlineDate' => '2026-03-01',
        ]);

    $admin = $presenter->adminDetail($a);
    expect($admin['relatedPromiseIds'])->toEqualCanonicalizing([$pLater->id, $pEarlier->id, $pUnpublished->id]);
});

test('rescheduleDeadline preserves original deadline, increments postponed_count, and logs change', function () {
    $editor = app(PromiseEditor::class);
    $actor = User::factory()->create(['role' => 'user']);

    $promise = Promise::factory()->published()->create([
        'statement_date' => '2025-06-01',
        'deadline_date' => '2025-12-31',
        'deadline_wording' => 'قبل نهاية 2025',
        'original_deadline_date' => null,
        'original_deadline_wording' => null,
        'postponed_count' => 0,
    ]);

    // First reschedule
    $first = $editor->rescheduleDeadline($promise, [
        'deadline_date' => '2026-06-30',
        'deadline_wording' => 'تمديد حتى منتصف 2026',
        'deadline_reasoning' => 'تأخر التمويل',
        'happened_on' => '2025-11-15',
        'source_url' => 'https://example.com/reschedule-1',
        'body' => null,
    ], $actor);

    expect($first->deadline_date->format('Y-m-d'))->toBe('2026-06-30')
        ->and($first->deadline_wording)->toBe('تمديد حتى منتصف 2026')
        ->and($first->deadline_reasoning)->toBe('تأخر التمويل')
        ->and($first->original_deadline_date->format('Y-m-d'))->toBe('2025-12-31')
        ->and($first->original_deadline_wording)->toBe('قبل نهاية 2025')
        ->and($first->postponed_count)->toBe(1);

    $update = PromiseUpdate::where('promise_id', $promise->id)->latest('id')->first();
    expect($update)->not->toBeNull()
        ->and($update->type)->toBe('deadline_change')
        ->and($update->happened_on->format('Y-m-d'))->toBe('2025-11-15')
        ->and($update->source_url)->toBe('https://example.com/reschedule-1')
        ->and($update->created_by)->toBe($actor->id)
        ->and($update->body)->toBe('تأجّل موعد الوعد من 2025-12-31 إلى 2026-06-30');

    // Second reschedule: original deadline must remain 2025-12-31
    $second = $editor->rescheduleDeadline($first, [
        'deadline_date' => '2026-12-31',
        'happened_on' => '2026-05-01',
        'source_url' => 'https://example.com/reschedule-2',
        'body' => 'تأجيل ثان بسبب الظروف الجوية',
    ], $actor);

    expect($second->deadline_date->format('Y-m-d'))->toBe('2026-12-31')
        ->and($second->original_deadline_date->format('Y-m-d'))->toBe('2025-12-31')
        ->and($second->original_deadline_wording)->toBe('قبل نهاية 2025')
        ->and($second->postponed_count)->toBe(2);

    $secondUpdate = PromiseUpdate::where('promise_id', $promise->id)->latest('id')->first();
    expect($secondUpdate->body)->toBe('تأجيل ثان بسبب الظروف الجوية');
});

test('rescheduleDeadline reopens a postponed promise and clears resolved_at', function () {
    $editor = app(PromiseEditor::class);

    $promise = Promise::factory()->published()->create([
        'statement_date' => '2025-06-01',
        'deadline_date' => '2025-12-31',
        'status' => 'postponed',
        'resolved_at' => '2025-11-01',
        'postponed_count' => 0,
    ]);

    $updated = $editor->rescheduleDeadline($promise, [
        'deadline_date' => '2026-06-30',
        'happened_on' => '2025-12-01',
        'source_url' => 'https://example.com/reopen',
    ]);

    expect($updated->status)->toBe('pending')
        ->and($updated->resolved_at)->toBeNull()
        ->and($updated->deadline_date->format('Y-m-d'))->toBe('2026-06-30')
        ->and($updated->postponed_count)->toBe(1);
});

test('card and adminDetail presenters include original deadline and postponed_count', function () {
    $promise = Promise::factory()->published()->create([
        'statement_date' => '2025-06-01',
        'deadline_date' => '2026-06-30',
        'original_deadline_date' => '2025-12-31',
        'original_deadline_wording' => 'قبل نهاية السنة',
        'postponed_count' => 2,
    ]);

    $presenter = app(PromisePresenter::class);
    $card = $presenter->card($promise);
    $admin = $presenter->adminDetail($promise);

    expect($card['originalDeadlineDate'])->toBe('2025-12-31')
        ->and($card['originalDeadlineWording'])->toBe('قبل نهاية السنة')
        ->and($card['postponedCount'])->toBe(2)
        ->and($admin['originalDeadlineDate'])->toBe('2025-12-31')
        ->and($admin['originalDeadlineWording'])->toBe('قبل نهاية السنة')
        ->and($admin['postponedCount'])->toBe(2);
});

test('admin reschedule endpoint enforces promises.rule capability and validates input', function () {
    $ruler = User::factory()->create(['role' => 'user', 'permissions' => ['promises.rule']]);
    $editorOnly = User::factory()->create(['role' => 'user', 'permissions' => ['promises.edit']]);

    $promise = Promise::factory()->published()->create([
        'statement_date' => '2025-06-01',
        'deadline_date' => '2025-12-31',
    ]);

    $payload = [
        'deadline_date' => '2026-06-30',
        'happened_on' => '2025-10-01',
        'source_url' => 'https://example.com/reschedule',
    ];

    // Non-ruler is forbidden
    $this->actingAs($editorOnly)
        ->postJson("/admin/promises/{$promise->id}/reschedule", $payload)
        ->assertForbidden();

    // Ruler can reschedule via POST /admin/promises/{promise}/reschedule
    $response = $this->actingAs($ruler)
        ->postJson("/admin/promises/{$promise->id}/reschedule", $payload);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'promise' => [
                'deadlineDate' => '2026-06-30',
                'originalDeadlineDate' => '2025-12-31',
                'postponedCount' => 1,
            ],
        ]);

    // Validation: deadline before statement date fails
    $this->actingAs($ruler)
        ->postJson("/admin/promises/{$promise->id}/reschedule", [
            'deadline_date' => '2025-05-01',
            'happened_on' => '2025-10-01',
            'source_url' => 'https://example.com/s',
        ])
        ->assertUnprocessable();

    // Validation: future happened_on fails
    $this->actingAs($ruler)
        ->postJson("/admin/promises/{$promise->id}/reschedule", [
            'deadline_date' => '2027-01-01',
            'happened_on' => Promise::today()->addDays(5)->format('Y-m-d'),
            'source_url' => 'https://example.com/s',
        ])
        ->assertUnprocessable();
});

test('ReschedulePromiseTool MCP tool requires promises.rule capability and executes reschedule', function () {
    $user = moduleStaff('promises');
    agentToken($user, ['promises.rule']);

    $promise = Promise::factory()->published()->create([
        'statement_date' => '2025-06-01',
        'deadline_date' => '2025-12-31',
    ]);

    $response = callTool(ReschedulePromiseTool::class, [
        'id' => $promise->id,
        'deadline_date' => '2026-08-31',
        'happened_on' => '2025-10-15',
        'source_url' => 'https://example.com/rescheduled-mcp',
    ]);

    $payload = toolPayload($response);
    expect($payload['deadlineDate'])->toBe('2026-08-31');

    $promise->refresh();
    expect($promise->deadline_date->format('Y-m-d'))->toBe('2026-08-31')
        ->and($promise->original_deadline_date->format('Y-m-d'))->toBe('2025-12-31')
        ->and($promise->postponed_count)->toBe(1);

    // Agent without promises.rule is denied
    $editorAgent = moduleStaff('promises');
    agentToken($editorAgent, ['promises.edit']);

    $denied = callTool(ReschedulePromiseTool::class, [
        'id' => $promise->id,
        'deadline_date' => '2026-11-30',
        'happened_on' => '2025-10-20',
        'source_url' => 'https://example.com/denied',
    ]);

    expect(toolText($denied))->toContain('Permission denied');
});
