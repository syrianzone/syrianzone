<?php

namespace App\Mcp\Tools\Compass;

use App\Mcp\Tools\AuditedTool;
use App\Models\CompassFigure;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Storage;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete-compass-figure')]
#[Title('Delete Compass Figure')]
#[Description(
    'Permanently delete a political compass figure by id and clean up any stored portrait under compass/. '
    .'To hide a figure while keeping its data, use update-compass-figure with enabled=false instead.'
)]
#[IsDestructive]
class DeleteCompassFigureTool extends AuditedTool
{
    protected array $permissions = [PermissionCatalogue::COMPASS_FIGURES];

    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->integer()
                ->description('Numeric id of the compass figure to delete permanently.')
                ->min(1)
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
        ]);

        $figure = CompassFigure::find($validated['id']);
        if ($figure === null) {
            return Response::error("Compass figure #{$validated['id']} was not found. Call list-compass-figures to see valid ids.");
        }

        $imagePath = $figure->image_path;
        $figure->delete();

        if (
            is_string($imagePath)
            && preg_match('/^(?:compass|images\/compass)\/(?!.*\.\.)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/', $imagePath) === 1
            && ! CompassFigure::where('image_path', $imagePath)->exists()
        ) {
            try {
                $useR2 = config('filesystems.media_disk', 'public') === 'r2'
                    && ! empty(config('filesystems.disks.r2.bucket'));
                $disk = str_starts_with($imagePath, 'images/compass/')
                    ? 'public'
                    : ($useR2 ? 'r2' : 'public');
                Storage::disk($disk)->delete($imagePath);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return Response::structured([
            'deleted' => true,
            'id' => (int) $validated['id'],
        ]);
    }
}
