<?php

use App\Mcp\Tools\GovtCvs\AddGovtEvidenceTool;
use App\Mcp\Tools\GovtCvs\AddGovtTenureTool;
use App\Mcp\Tools\GovtCvs\ArchiveGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\CreateGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\DeleteGovtCvEntryTool;
use App\Mcp\Tools\GovtCvs\DeleteGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\DeleteGovtTenureTool;
use App\Mcp\Tools\GovtCvs\GetGovtCvOptionsTool;
use App\Mcp\Tools\GovtCvs\GetGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\ListGovtOfficialsTool;
use App\Mcp\Tools\GovtCvs\ListGovtSlotsTool;
use App\Mcp\Tools\GovtCvs\PublishGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\SaveGovtCvEntryTool;
use App\Mcp\Tools\GovtCvs\SaveGovtSlotTool;
use App\Mcp\Tools\GovtCvs\UpdateGovtOfficialTool;
use App\Mcp\Tools\GovtCvs\UpdateGovtTenureTool;
use App\Models\GovtCvEntry;
use App\Models\GovtEvidenceLink;
use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use App\Models\GovtTenure;
use App\Models\McpToolCall;
use App\Models\User;

function govtcvsAgent(array $abilities): User
{
    $user = moduleStaff('govtcvs');
    agentToken($user, $abilities);

    return $user;
}

test('read tools succeed for a token with govtcvs.view and deny a token without any govtcvs.* permission', function () {
    $official = GovtOfficial::create([
        'slug' => 'anass-khattab',
        'full_name_ar' => 'أنس خطاب',
        'display_name_ar' => 'أنس خطاب',
        'office_status' => 'in_office',
        'highest_tier' => 'minister',
        'publish_status' => 'draft',
    ]);
    $slot = GovtOfficeSlot::create([
        'slug' => 'minister-of-interior',
        'title_ar' => 'وزير الداخلية',
        'tier' => 'minister',
        'is_single_seat' => true,
        'status' => 'active',
    ]);

    $viewer = agentUser(['permissions' => ['govtcvs.view']]);
    agentToken($viewer, ['govtcvs.view']);

    $options = toolPayload(callTool(GetGovtCvOptionsTool::class));
    expect($options)->toHaveKeys(['cutoff_date', 'office_statuses', 'tiers', 'office_slots'])
        ->and($options['office_slots'][0]['slug'])->toBe($slot->slug);

    $list = toolPayload(callTool(ListGovtOfficialsTool::class, ['q' => 'انس']));
    expect($list['count'])->toBe(1)
        ->and($list['officials'][0]['slug'])->toBe('anass-khattab');

    $get = toolPayload(callTool(GetGovtOfficialTool::class, ['id' => $official->id]));
    expect($get['official']['full_name_ar'])->toBe('أنس خطاب');

    $slots = toolPayload(callTool(ListGovtSlotsTool::class));
    expect($slots['count'])->toBe(1)
        ->and($slots['slots'][0]['slug'])->toBe('minister-of-interior');

    // Token without any govtcvs.* permission is denied on all read tools
    $outsider = agentUser(['permissions' => ['places.review']]);
    agentToken($outsider, ['places.review']);

    foreach ([
        [GetGovtCvOptionsTool::class, []],
        [ListGovtOfficialsTool::class, []],
        [GetGovtOfficialTool::class, ['id' => $official->id]],
        [ListGovtSlotsTool::class, []],
    ] as [$tool, $args]) {
        $refused = callTool($tool, $args);
        expect($refused->isError())->toBeTrue()
            ->and(toolText($refused))->toContain('Permission denied');
    }
});

test('write tools enforce their capability gates on the token even when the user holds the full module', function () {
    govtcvsAgent(['govtcvs.view']);

    $official = GovtOfficial::create([
        'slug' => 'gated-official',
        'full_name_ar' => 'مسؤول محمي',
        'display_name_ar' => 'مسؤول محمي',
    ]);
    $tenure = GovtTenure::create([
        'official_id' => $official->id,
        'role_title_ar' => 'وزير',
        'tier' => 'minister',
        'status' => 'current',
        'started_at' => '2025-03-29',
    ]);
    $cvEntry = GovtCvEntry::create([
        'official_id' => $official->id,
        'section' => 'education',
        'title_ar' => 'إجازة جامعية',
    ]);

    foreach ([
        [CreateGovtOfficialTool::class, ['full_name_ar' => 'مسؤول جديد']],
        [UpdateGovtOfficialTool::class, ['id' => $official->id, 'version' => 1, 'full_name_ar' => 'اسم معدل']],
        [PublishGovtOfficialTool::class, ['id' => $official->id]],
        [ArchiveGovtOfficialTool::class, ['id' => $official->id]],
        [DeleteGovtOfficialTool::class, ['id' => $official->id]],
        [AddGovtTenureTool::class, ['official_id' => $official->id, 'role_title_ar' => 'وزير', 'tier' => 'minister']],
        [UpdateGovtTenureTool::class, ['tenure_id' => $tenure->id, 'role_title_ar' => 'وزير معدل']],
        [DeleteGovtTenureTool::class, ['tenure_id' => $tenure->id]],
        [SaveGovtCvEntryTool::class, ['official_id' => $official->id, 'section' => 'education', 'title_ar' => 'ماجستير']],
        [DeleteGovtCvEntryTool::class, ['entry_id' => $cvEntry->id]],
        [AddGovtEvidenceTool::class, ['official_id' => $official->id, 'evidence_type' => 'cv_card', 'source_title_ar' => 'بطاقة']],
        [SaveGovtSlotTool::class, ['title_ar' => 'منصب جديد', 'tier' => 'minister']],
    ] as [$tool, $arguments]) {
        $res = callTool($tool, $arguments);
        expect($res->isError())->toBeTrue()
            ->and(toolText($res))->toContain('Permission denied');
    }

    expect(GovtOfficial::count())->toBe(1)
        ->and(McpToolCall::where('outcome', 'denied')->count())->toBe(12);
});

test('create-govt-official, update-govt-official, publish-govt-official, archive-govt-official, and delete-govt-official mutate officials and check optimistic version lock', function () {
    // 1. create-govt-official (requires govtcvs.create)
    govtcvsAgent(['govtcvs.create']);

    $createdRes = callTool(CreateGovtOfficialTool::class, [
        'full_name_ar' => 'د. هند قبوات',
        'full_name_en' => 'Hind Kabawat',
        'highest_tier' => 'minister',
        'aliases' => [
            ['alias_ar' => 'هند قبوات', 'alias_type' => 'patronymic_short'],
        ],
    ]);
    $created = toolPayload($createdRes);

    expect($created['created'])->toBeTrue()
        ->and($created['official']['publish_status'])->toBe('draft')
        ->and($created['official']['version'])->toBe(1);

    $officialId = $created['official']['id'];

    // 2. update-govt-official (requires govtcvs.edit)
    govtcvsAgent(['govtcvs.edit']);

    $updated = toolPayload(callTool(UpdateGovtOfficialTool::class, [
        'id' => $officialId,
        'version' => 1,
        'bio_summary_ar' => 'وزيرة الشؤون الاجتماعية والعمل في الحكومة السورية الانتقالية.',
        'birth_place_ar' => 'دمشق',
    ]));

    expect($updated['updated'])->toBeTrue()
        ->and($updated['official']['version'])->toBe(2)
        ->and($updated['official']['birth_place_ar'])->toBe('دمشق');

    // Stale version (1 instead of 2) is refused with an actionable error
    $stale = callTool(UpdateGovtOfficialTool::class, [
        'id' => $officialId,
        'version' => 1,
        'birth_place_ar' => 'حلب',
    ]);
    expect($stale->isError())->toBeTrue()
        ->and(toolText($stale))->toContain('version 2')
        ->and(GovtOfficial::findOrFail($officialId)->birth_place_ar)->toBe('دمشق');

    // 3. publish-govt-official & archive-govt-official (requires govtcvs.publish)
    govtcvsAgent(['govtcvs.publish']);

    $published = toolPayload(callTool(PublishGovtOfficialTool::class, ['id' => $officialId]));
    expect($published['published'])->toBeTrue()
        ->and($published['official']['publish_status'])->toBe('published')
        ->and(GovtOfficial::findOrFail($officialId)->publish_status)->toBe('published');

    $archived = toolPayload(callTool(ArchiveGovtOfficialTool::class, ['id' => $officialId]));
    expect($archived['archived'])->toBeTrue()
        ->and($archived['official']['publish_status'])->toBe('archived')
        ->and(GovtOfficial::findOrFail($officialId)->publish_status)->toBe('archived');

    // 4. delete-govt-official (requires govtcvs.delete)
    govtcvsAgent(['govtcvs.delete']);

    $deleted = toolPayload(callTool(DeleteGovtOfficialTool::class, ['id' => $officialId]));
    expect($deleted['deleted'])->toBeTrue()
        ->and(GovtOfficial::find($officialId))->toBeNull();
});

test('save-govt-slot, add-govt-tenure, update-govt-tenure, delete-govt-tenure, save-govt-cv-entry, delete-govt-cv-entry, and add-govt-evidence work cleanly', function () {
    // 1. save-govt-slot (requires govtcvs.slots)
    govtcvsAgent(['govtcvs.slots']);

    $createdSlot = toolPayload(callTool(SaveGovtSlotTool::class, [
        'slug' => 'minister-of-finance',
        'title_ar' => 'وزير المالية',
        'institution_name_ar' => 'وزارة المالية',
        'tier' => 'minister',
        'is_single_seat' => true,
        'status' => 'active',
    ]));

    expect($createdSlot['created'])->toBeTrue()
        ->and($createdSlot['slot']['slug'])->toBe('minister-of-finance');

    $slotId = $createdSlot['slot']['id'];

    $updatedSlot = toolPayload(callTool(SaveGovtSlotTool::class, [
        'slot_id' => $slotId,
        'lineage_note_ar' => 'منصب وزاري سيادي',
    ]));

    expect($updatedSlot['updated'])->toBeTrue()
        ->and($updatedSlot['slot']['lineage_note_ar'])->toBe('منصب وزاري سيادي');

    // 2. Tenures, CV entries, and evidence tools (requires govtcvs.edit)
    govtcvsAgent(['govtcvs.edit']);

    $official = GovtOfficial::create([
        'slug' => 'mohammed-yusr-barnieh',
        'full_name_ar' => 'محمد يسر برنية',
        'display_name_ar' => 'محمد يسر برنية',
        'office_status' => 'out_of_office',
        'cv_completeness' => 'positions_only',
    ]);

    // add-govt-tenure
    $addedTenure = toolPayload(callTool(AddGovtTenureTool::class, [
        'official_id' => $official->id,
        'office_slot_id' => $slotId,
        'role_title_ar' => 'وزير المالية',
        'tier' => 'minister',
        'government_phase' => 'transitional_2025',
        'status' => 'current',
        'started_at' => '2025-03-29',
    ]));

    expect($addedTenure['added'])->toBeTrue()
        ->and($official->fresh()->office_status)->toBe('in_office');

    $tenureId = $addedTenure['tenure']['id'];

    // update-govt-tenure
    $updatedTenure = toolPayload(callTool(UpdateGovtTenureTool::class, [
        'tenure_id' => $tenureId,
        'status' => 'ended',
        'ended_at' => '2026-01-15',
        'end_reason' => 'resigned',
    ]));

    expect($updatedTenure['updated'])->toBeTrue()
        ->and($updatedTenure['tenure']['status'])->toBe('ended')
        ->and($official->fresh()->office_status)->toBe('out_of_office');

    // save-govt-cv-entry (create & update)
    $createdCv1 = toolPayload(callTool(SaveGovtCvEntryTool::class, [
        'official_id' => $official->id,
        'section' => 'education',
        'title_ar' => 'إجازة في الاقتصاد',
        'organization_ar' => 'جامعة دمشق',
        'start_year' => 1990,
        'end_year' => 1994,
    ]));

    expect($createdCv1['created'])->toBeTrue()
        ->and($official->fresh()->cv_completeness)->toBe('partial_bio');

    $cv1Id = $createdCv1['cv_entry']['id'];

    $createdCv2 = toolPayload(callTool(SaveGovtCvEntryTool::class, [
        'official_id' => $official->id,
        'section' => 'career_history',
        'title_ar' => 'خبير اقتصادي في صندوق النقد العربي',
        'start_year' => 2005,
        'end_year' => 2024,
    ]));

    expect($createdCv2['created'])->toBeTrue()
        ->and($official->fresh()->cv_completeness)->toBe('full_cv');

    $cv2Id = $createdCv2['cv_entry']['id'];

    $updatedCv1 = toolPayload(callTool(SaveGovtCvEntryTool::class, [
        'entry_id' => $cv1Id,
        'title_ar' => 'دراسات عليا في الاقتصاد والمالية',
    ]));

    expect($updatedCv1['updated'])->toBeTrue()
        ->and($updatedCv1['cv_entry']['title_ar'])->toBe('دراسات عليا في الاقتصاد والمالية');

    // add-govt-evidence
    $addedEvidence = toolPayload(callTool(AddGovtEvidenceTool::class, [
        'official_id' => $official->id,
        'tenure_id' => $tenureId,
        'evidence_type' => 'appointment_decree',
        'source_title_ar' => 'مرسوم تشكيل الحكومة الانتقالية',
        'source_channel_ar' => 'رئاسة الجمهورية',
        'source_url' => 'https://example.com/decree-2025',
        'published_date' => '2025-03-29',
    ]));

    expect($addedEvidence['added'])->toBeTrue()
        ->and(GovtEvidenceLink::where('official_id', $official->id)->count())->toBe(1);

    // delete-govt-cv-entry
    $deletedCv2 = toolPayload(callTool(DeleteGovtCvEntryTool::class, ['entry_id' => $cv2Id]));
    expect($deletedCv2['deleted'])->toBeTrue()
        ->and(GovtCvEntry::find($cv2Id))->toBeNull()
        ->and($official->fresh()->cv_completeness)->toBe('partial_bio');

    // delete-govt-tenure
    $deletedTenure = toolPayload(callTool(DeleteGovtTenureTool::class, ['tenure_id' => $tenureId]));
    expect($deletedTenure['deleted'])->toBeTrue()
        ->and(GovtTenure::find($tenureId))->toBeNull();
});
