<?php

namespace App\Mcp\Tools\Compass;

use App\Mcp\Tools\AuditedTool;
use App\Models\CompassFigure;
use App\Support\Agents\AgentContext;
use App\Support\Compass\CompassStats;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('update-compass-figure')]
#[Title('Update Compass Figure')]
#[Description(
    'Update an existing political compass figure by id. Only the fields you pass are modified; '
    .'call list-compass-figures first to inspect valid ids.'
)]
#[IsDestructive]
class UpdateCompassFigureTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::COMPASS_FIGURES];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()
                ->description('Numeric id of the compass figure to update.')
                ->min(1)
                ->required(),

            'name' => $schema->string()
                ->description('Optional new unique display name.'),

            'category' => $schema->string()
                ->enum(CompassFigure::CATEGORIES)
                ->description('Optional new figure category.'),

            'align' => $schema->string()
                ->description('Optional new foreign alignment bloc.'),

            'positions' => $schema->object()
                ->description('Optional axis position map keyed by axis id ('.implode(', ', CompassStats::AXIS_IDS).'), values -1 to 1 or null.'),

            'image_url' => $schema->string()
                ->description('Optional portrait URL.'),

            'image_path' => $schema->string()
                ->description('Optional storage path for the portrait.'),

            'enabled' => $schema->boolean()
                ->description('Optional enabled toggle.'),

            'sort_order' => $schema->integer()
                ->description('Optional sort order.')
                ->min(0),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $id = (int) $request->get('id', 0);
        $figure = $id > 0 ? CompassFigure::find($id) : null;

        if ($figure === null) {
            return Response::error("Compass figure #{$id} was not found. Call list-compass-figures to see valid ids.");
        }

        $validated = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('compass_figures', 'name')->ignore($figure->id)],
            'category' => ['sometimes', Rule::in(CompassFigure::CATEGORIES)],
            'align' => ['sometimes', 'nullable', 'string', 'max:64'],
            'positions' => ['sometimes', 'array'],
            'positions.*' => ['nullable', 'numeric', 'min:-1', 'max:1'],
            'image_url' => ['sometimes', 'nullable', 'string', 'url:http,https', 'max:2048'],
            'image_path' => ['sometimes', 'nullable', 'string', 'max:1024', 'regex:/^(?:compass|images\/compass)\/(?!.*\.\.)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/'],
            'enabled' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ]);

        $updates = [];
        foreach (['name', 'category', 'align', 'image_url', 'image_path', 'enabled', 'sort_order'] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }

        if (array_key_exists('positions', $validated)) {
            $updates['positions'] = $this->normalizePositions($validated['positions']);
        }

        if ($updates === []) {
            return Response::error('Provide at least one field to update.');
        }

        $figure->update($updates);

        return Response::structured([
            'updated' => true,
            'figure' => $figure->fresh()->toAdminPayload(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, float|null>
     */
    private function normalizePositions(array $input): array
    {
        $positions = [];
        foreach (CompassStats::AXIS_IDS as $axis) {
            $value = $input[$axis] ?? null;
            $positions[$axis] = ($value === '' || $value === null) ? null : round((float) $value, 4);
        }

        return $positions;
    }
}
