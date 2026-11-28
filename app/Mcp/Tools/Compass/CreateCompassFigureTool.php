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

#[Name('create-compass-figure')]
#[Title('Create Compass Figure')]
#[Description(
    'Create a political compass reference figure with its category, foreign alignment bloc, '
    .'and axis position vector (values between -1 and 1). Figures default to disabled until enabled explicitly.'
)]
#[IsDestructive]
class CreateCompassFigureTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::COMPASS_FIGURES];

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()
                ->description('Unique display name of the figure.')
                ->required(),

            'category' => $schema->string()
                ->enum(CompassFigure::CATEGORIES)
                ->description('Figure category.')
                ->required(),

            'align' => $schema->string()
                ->description('Foreign alignment bloc (e.g. west, gulf, turkish, east, neutral).')
                ->default('neutral'),

            'positions' => $schema->object()
                ->description('Axis position map keyed by axis id ('.implode(', ', CompassStats::AXIS_IDS).'), numeric values from -1 to 1 or null.')
                ->required(),

            'image_url' => $schema->string()
                ->description('Optional portrait URL.'),

            'image_path' => $schema->string()
                ->description('Optional storage path for the portrait.'),

            'enabled' => $schema->boolean()
                ->description('Whether this figure is active on the public compass.')
                ->default(false),

            'sort_order' => $schema->integer()
                ->description('Optional display sort order (defaults to appending at the end).')
                ->min(0),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('compass_figures', 'name')],
            'category' => ['required', Rule::in(CompassFigure::CATEGORIES)],
            'align' => ['sometimes', 'nullable', 'string', 'max:64'],
            'positions' => ['required', 'array'],
            'positions.*' => ['nullable', 'numeric', 'min:-1', 'max:1'],
            'image_url' => ['sometimes', 'nullable', 'string', 'url:http,https', 'max:2048'],
            'image_path' => ['sometimes', 'nullable', 'string', 'max:1024', 'regex:/^(?:compass|images\/compass)\/(?!.*\.\.)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/'],
            'enabled' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ]);

        $figure = CompassFigure::create([
            'name' => $validated['name'],
            'category' => $validated['category'],
            'align' => $validated['align'] ?? 'neutral',
            'positions' => $this->normalizePositions($validated['positions']),
            'image_url' => $validated['image_url'] ?? null,
            'image_path' => $validated['image_path'] ?? null,
            'enabled' => (bool) ($validated['enabled'] ?? false),
            'sort_order' => (int) ($validated['sort_order'] ?? ((int) CompassFigure::max('sort_order')) + 1),
        ]);

        return Response::structured([
            'created' => true,
            'figure' => $figure->toAdminPayload(),
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
