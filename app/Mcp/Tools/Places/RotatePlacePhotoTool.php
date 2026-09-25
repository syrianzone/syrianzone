<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('rotate-place-photo')]
#[Title('Rotate Place Photo')]
#[Description(
    'Rotate one photo of a place 90 degrees clockwise, for submissions uploaded sideways. '
    .'Fails if the underlying file is missing from disk, in which case the photo must be re-uploaded instead.'
)]
#[IsDestructive]
#[IsIdempotent]
class RotatePlacePhotoTool extends PlacesTool
{
    protected array $permissions = ['places.moderate_photos'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'photo_id' => $schema->integer()
                ->description('Id of the photo to rotate. Get these from get-place or list-places.')
                ->required(),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'photo_id' => 'required|integer|min:1',
        ]);

        return $this->attempt(function () use ($validated) {
            $photo = app(PlaceModerationService::class)->rotatePhoto($validated['photo_id']);

            return Response::structured([
                'id' => $photo->id,
                'thumb_url' => $photo->thumb_url,
                'display_url' => $photo->display_url,
            ]);
        });
    }
}
