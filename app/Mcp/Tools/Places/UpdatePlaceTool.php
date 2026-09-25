<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
use App\Services\Places\PlacePresenter;
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

#[Name('update-place')]
#[Title('Update Place')]
#[Description(
    'Edit a place\'s name, category, description or coordinates. Only the fields you pass are changed, so a '
    .'single-field correction does not overwrite the others. Coordinates must fall inside Syria\'s bounding box.'
)]
#[IsDestructive]
#[IsIdempotent]
class UpdatePlaceTool extends PlacesTool
{
    protected array $permissions = ['places.edit'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the place to edit.')
                ->required(),

            'name' => $schema->string()
                ->description('Display name. Max 160 characters.')
                ->max(160),

            'category' => $schema->string()
                ->enum(PlacePresenter::CATEGORIES)
                ->description('One of the fixed mishwar categories.'),

            'description' => $schema->string()
                ->description('Full description, 20-1000 characters.')
                ->min(20)
                ->max(1000),

            'lat' => $schema->number()
                ->description('Latitude, 32.0 to 37.5 (Syria).')
                ->min(32.0)
                ->max(37.5),

            'lng' => $schema->number()
                ->description('Longitude, 35.5 to 42.5 (Syria).')
                ->min(35.5)
                ->max(42.5),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'place_id' => 'required|integer|min:1',
            'name' => 'sometimes|required|string|max:160',
            'category' => 'sometimes|required|string|in:'.implode(',', PlacePresenter::CATEGORIES),
            'description' => 'sometimes|required|string|min:20|max:1000',
            'lat' => 'sometimes|required|numeric|between:32.0,37.5',
            'lng' => 'sometimes|required|numeric|between:35.5,42.5',
        ], [
            'description.min' => 'The description must be at least 20 characters.',
            'lat.between' => 'Latitude must be between 32.0 and 37.5 (inside Syria).',
            'lng.between' => 'Longitude must be between 35.5 and 42.5 (inside Syria).',
        ]);

        $attributes = collect($validated)->except('place_id')->all();

        if ($attributes === []) {
            return Response::error(
                'Nothing to change: pass at least one of name, category, description, lat or lng.'
            );
        }

        return $this->attempt(function () use ($validated, $attributes, $context) {
            $place = app(PlaceModerationService::class)->update($validated['place_id'], $attributes);

            return Response::structured([
                'id' => $place->id,
                'changed' => array_keys($attributes),
                'place' => $this->placePayload($place, $context->id()),
            ]);
        });
    }
}
