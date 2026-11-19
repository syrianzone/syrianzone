<?php

namespace App\Mcp\Tools\GovtCvs;

use App\Services\GovtCvs\GovtCvPresenter;
use App\Services\GovtCvs\GovtCvRules;
use App\Services\GovtCvs\GovtCvVocabulary;
use App\Services\GovtCvs\GovtTenureTracker;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('save-govt-slot')]
#[Title('Save Govt Slot')]
#[Description(
    'Create or update a government office slot (`govt_office_slots`). Omit slot_id to create a new slot '
    .'(title_ar and tier are required); pass slot_id to partially update an existing slot (e.g. mark it '
    .'"merged" or "abolished" and link replaced_by_slot_id).'
)]
#[IsDestructive]
class SaveGovtSlotTool extends GovtCvsTool
{
    protected array $permissions = [PermissionCatalogue::GOVTCVS_SLOTS];

    public function schema(JsonSchema $schema): array
    {
        return [
            'slot_id' => $schema->string()
                ->description('Optional UUID of an existing office slot to update (from list-govt-slots). Omit to create a new slot.'),

            'slug' => $schema->string()
                ->description('Optional URL slug (lowercase alphanumeric and hyphens, max 160). Auto-generated from title_ar if omitted.')
                ->max(160),

            'title_ar' => $schema->string()
                ->description('Office slot title in Arabic (e.g. "وزير الطاقة"). Required when creating. Max 255 characters.')
                ->max(255),

            'institution_id' => $schema->string()
                ->description('Optional institution ID from get-govtcv-options.')
                ->max(255),

            'institution_name_ar' => $schema->string()
                ->description('Optional institution name in Arabic when not linked by institution_id. Max 255 characters.')
                ->max(255),

            'tier' => $schema->string()
                ->description('Seniority tier key (from get-govtcv-options). Required when creating.')
                ->enum(GovtCvVocabulary::tiers()),

            'is_single_seat' => $schema->boolean()
                ->description('Whether only one current incumbent can hold this slot at a time (enables auto-closing prior incumbents). Defaults to true.'),

            'status' => $schema->string()
                ->description('Lifecycle status of the office slot ("active", "merged", "abolished"). Defaults to "active".')
                ->enum(GovtCvVocabulary::slotStatuses()),

            'active_from' => $schema->string()
                ->description('Optional date the office slot was established (YYYY-MM-DD).'),

            'ended_at' => $schema->string()
                ->description('Optional date the office slot was merged or abolished (YYYY-MM-DD).'),

            'lineage_note_ar' => $schema->string()
                ->description('Optional Arabic note explaining mergers, renames, or successor lineage. Max 5000 characters.')
                ->max(5000),

            'replaced_by_slot_id' => $schema->string()
                ->description('Optional UUID of the successor office slot if this slot was merged or replaced.'),
        ];
    }

    protected function notFoundHint(): string
    {
        return 'Call list-govt-slots or get-govtcv-options to find valid office slot ids.';
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        return $this->attempt(function () use ($request) {
            $slotId = $request->get('slot_id');
            $isUpdate = filled($slotId);
            $slot = $isUpdate ? $this->findSlot((string) $slotId) : null;

            $rules = app(GovtCvRules::class);
            $data = $request->validate([
                'slot_id' => ['nullable', 'string'],
                ...$rules->officeSlot($slot, partial: $isUpdate),
            ], $rules->messages());

            unset($data['slot_id']);

            $saved = app(GovtTenureTracker::class)->saveSlot($slot, $data);

            return Response::structured([
                $isUpdate ? 'updated' : 'created' => true,
                'slot' => app(GovtCvPresenter::class)->slotItem($saved),
            ]);
        });
    }
}
