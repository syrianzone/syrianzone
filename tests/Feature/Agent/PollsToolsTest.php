<?php

use App\Mcp\Tools\Polls\ArchivePollCandidateTool;
use App\Mcp\Tools\Polls\CreatePollCandidateTool;
use App\Mcp\Tools\Polls\DeletePollCandidateTool;
use App\Mcp\Tools\Polls\ListPollCandidatesTool;
use App\Mcp\Tools\Polls\ListPollGroupsTool;
use App\Mcp\Tools\Polls\RestorePollCandidateTool;
use App\Mcp\Tools\Polls\UpdatePollCandidateTool;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use App\Models\User;
use App\Support\Agents\TokenIssuer;

test('list-poll-groups and list-poll-candidates read poll structure and enforce permissions', function () {
    $poll = Poll::factory()->create(['slug' => 'best-ministers', 'title' => 'Best Ministers', 'is_active' => true]);
    $ministers = CandidateGroup::create([
        'poll_id' => $poll->id,
        'name' => 'الحكومة',
        'key' => 'minister',
        'sort_order' => 0,
        'is_default' => true,
        'is_active' => true,
    ]);
    $governors = CandidateGroup::create([
        'poll_id' => $poll->id,
        'name' => 'المحافظون',
        'key' => 'governor',
        'sort_order' => 1,
        'is_default' => false,
        'is_active' => true,
    ]);

    Candidate::create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $ministers->id,
        'name' => 'نضال الشعار',
        'title' => 'وزير الاقتصاد',
        'x_handle' => 'SyMOEAI',
        'category' => 'minister',
        'status' => 'active',
        'sort' => 1,
    ]);
    Candidate::create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $governors->id,
        'name' => 'عبد الرحمن الأعمى',
        'title' => 'محافظ حمص',
        'category' => 'governor',
        'status' => 'archived',
        'term_ended_at' => '2026-05-09',
        'sort' => 2,
    ]);

    $staff = agentUser(['permissions' => ['polls.edit']]);
    agentToken($staff, ['polls.edit']);

    $groupsPayload = toolPayload(callTool(ListPollGroupsTool::class, ['poll' => 'best-ministers']));
    expect($groupsPayload['count'])->toBe(2)
        ->and($groupsPayload['groups'][0]['key'])->toBe('minister')
        ->and($groupsPayload['groups'][0]['candidates_count'])->toBe(1);

    $activePayload = toolPayload(callTool(ListPollCandidatesTool::class, [
        'poll' => 'best-ministers',
        'status' => 'active',
    ]));
    expect($activePayload['count'])->toBe(1)
        ->and($activePayload['candidates'][0]['name'])->toBe('نضال الشعار');

    $formerPayload = toolPayload(callTool(ListPollCandidatesTool::class, [
        'poll' => 'best-ministers',
        'status' => 'former',
        'group_key' => 'governor',
    ]));
    expect($formerPayload['count'])->toBe(1)
        ->and($formerPayload['candidates'][0]['name'])->toBe('عبد الرحمن الأعمى');

    $other = agentUser(['permissions' => ['places.review']]);
    agentToken($other, ['places.review']);
    expect(callTool(ListPollGroupsTool::class, ['poll' => 'best-ministers'])->isError())->toBeTrue()
        ->and(callTool(ListPollCandidatesTool::class, ['poll' => 'best-ministers'])->isError())->toBeTrue();
});

test('poll candidate write tools create, update, archive, restore, and delete with capability gates', function () {
    $poll = Poll::factory()->create(['slug' => 'best-ministers', 'title' => 'Best Ministers', 'is_active' => true]);
    $ministers = CandidateGroup::create([
        'poll_id' => $poll->id,
        'name' => 'الحكومة',
        'key' => 'minister',
        'sort_order' => 0,
        'is_default' => true,
        'is_active' => true,
    ]);

    $editor = agentUser(['permissions' => ['polls.edit']]);
    agentToken($editor, ['polls.edit']);

    $created = toolPayload(callTool(CreatePollCandidateTool::class, [
        'poll' => 'best-ministers',
        'candidate_group_id' => $ministers->id,
        'name' => 'أحمد رواد رمضان',
        'title' => 'وزير الاقتصاد والتجارة الخارجية',
        'term_started_at' => '2026-11-18',
    ]));
    expect($created['created'])->toBeTrue()
        ->and($created['candidate']['status'])->toBe('active')
        ->and($created['candidate']['term_started_at'])->toBe('2026-11-18');

    $successorId = $created['candidate']['id'];

    $oldMinister = Candidate::create([
        'poll_id' => $poll->id,
        'candidate_group_id' => $ministers->id,
        'name' => 'نضال الشعار',
        'title' => 'وزير الاقتصاد',
        'x_handle' => 'SyMOEAI',
        'category' => 'minister',
        'status' => 'active',
        'sort' => 0,
    ]);

    $updated = toolPayload(callTool(UpdatePollCandidateTool::class, [
        'id' => $oldMinister->id,
        'x_handle' => null,
        'title' => 'وزير الاقتصاد السابق',
    ]));
    expect($updated['updated'])->toBeTrue()
        ->and($updated['candidate']['x_handle'])->toBeNull()
        ->and($updated['candidate']['title'])->toBe('وزير الاقتصاد السابق');

    $archived = toolPayload(callTool(ArchivePollCandidateTool::class, [
        'id' => $oldMinister->id,
        'term_ended_at' => '2026-11-18',
        'archive_reason' => 'عُيّن مستشاراً للشؤون الاقتصادية والمالية لدى رئاسة الجمهورية',
        'successor_id' => $successorId,
    ]));
    expect($archived['archived'])->toBeTrue()
        ->and($archived['candidate']['status'])->toBe('archived')
        ->and($archived['candidate']['term_ended_at'])->toBe('2026-11-18')
        ->and($archived['candidate']['successor_id'])->toBe($successorId);

    $restored = toolPayload(callTool(RestorePollCandidateTool::class, ['id' => $oldMinister->id]));
    expect($restored['restored'])->toBeTrue()
        ->and($restored['candidate']['status'])->toBe('active')
        ->and($restored['candidate']['term_ended_at'])->toBeNull()
        ->and($restored['candidate']['successor_id'])->toBeNull();

    // polls.edit cannot permanently delete a candidate
    expect(callTool(DeletePollCandidateTool::class, ['id' => $oldMinister->id])->isError())->toBeTrue();

    // polls.delete can delete a candidate
    $deleter = agentUser(['permissions' => ['polls.delete']]);
    agentToken($deleter, ['polls.delete']);
    $deleted = toolPayload(callTool(DeletePollCandidateTool::class, ['id' => $oldMinister->id]));
    expect($deleted['deleted'])->toBeTrue()
        ->and(Candidate::find($oldMinister->id))->toBeNull();
});

test('poll read tools are advertised only when the token holds a polls capability', function () {
    $pollsUser = User::factory()->create(['role' => 'user', 'permissions' => ['polls.edit']]);
    $pollsToken = app(TokenIssuer::class)->issue($pollsUser, 'polls-bot', ['polls.edit'])['token']->plainTextToken;

    $tools = mcpToolNames($pollsToken);
    expect($tools)->toContain('list-polls', 'list-poll-groups', 'list-poll-candidates');
});
