<?php

namespace App\Mcp\Tools\Places;

use App\Services\Places\PlaceModerationService;
use App\Services\Places\PlaceRules;
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
    protected array $permissions = [PermissionCatalogue::PLACES_EDIT];

    public function schema(JsonSchema $schema): array
    {
        return [
            'place_id' => $schema->integer()
                ->description('Id of the place to edit.')
                ->required(),

            'name' => $schema->string()
                ->description('Display name. Max 160 characters.')
                ->max(PlaceRules::MAX_NAME),

            'category' => $schema->string()
                ->enum(PlaceRules::categories())
                ->description('One of the fixed mishwar categories.'),

            'description' => $schema->string()
                ->description('Full description, 20-1000 characters.')
                ->min(PlaceRules::MIN_DESCRIPTION)
                ->max(PlaceRules::MAX_DESCRIPTION),

            'lat' => $schema->number()
                ->description('Latitude, '.PlaceRules::latMin().' to '.PlaceRules::latMax().' (Syria).')
                ->min((float) PlaceRules::latMin())
                ->max((float) PlaceRules::latMax()),

            'lng' => $schema->number()
                ->description('Longitude, '.PlaceRules::lngMin().' to '.PlaceRules::lngMax().' (Syria).')
                ->min((float) PlaceRules::lngMin())
                ->max((float) PlaceRules::lngMax()),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $rules = app(PlaceRules::class);

        $validated = $request->validate([
            'place_id' => ['required', 'integer', 'min:1'],
            ...$rules->edit(),
        ], $rules->messages());

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
