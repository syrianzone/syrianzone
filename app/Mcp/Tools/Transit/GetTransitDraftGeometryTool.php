<?php

namespace App\Mcp\Tools\Transit;

use App\Services\Transit\TransitAdminService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

/**
 * The submitted GeoJSON for one draft.
 *
 * This reads route_drafts.geojson, which is a plain JSON column — not the
 * spatial `geometry` column on routes and stops. That distinction is the whole
 * reason this tool can exist: reading coordinates back out of the spatial
 * columns needs MySQL's ST_AsGeoJSON(), which is not available on the SQLite
 * test database and so is not exposed to agents until that is sorted out. A
 * reviewer can still see exactly what was submitted, because the submission
 * stored it verbatim.
 */
#[Name('get-transit-draft-geometry')]
#[Title('Get Transit Draft Geometry')]
#[Description(
    'Get the geometry a contributor submitted with a transit draft, as GeoJSON. Returns one LineString or '
    .'MultiLineString feature for the route path plus one Point feature per stop, with each stop\'s name in '
    .'properties.nameAr. Use this to judge whether a draft is a sensible shape before approving it. Drafts '
    .'with no features return an empty list rather than failing.'
)]
#[IsReadOnly]
#[IsIdempotent]
class GetTransitDraftGeometryTool extends TransitTool
{
    protected array $permissions = ['transit.review_drafts'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'draft_id' => $schema->integer()
                ->description('Id of the draft whose geometry to read.')
                ->required(),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'draft_id' => $schema->integer(),
            'city_id' => $schema->string(),
            'line' => $schema->array()
                ->description('The route path as a GeoJSON geometry object, or null when the draft carries no line.')
                ->nullable(),
            'stops' => $schema->array()
                ->description('One entry per stop, in submission order.')
                ->items($schema->object([
                    'name_ar' => $schema->string()->nullable(),
                    'coordinates' => $schema->array()
                        ->description('[longitude, latitude]')
                        ->items($schema->number()),
                ])),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'draft_id' => 'required|integer|min:1',
        ]);

        $service = app(TransitAdminService::class);
        $draft = $service->findDraft($validated['draft_id']);

        $this->guardCity($context, 'transit.review_drafts', $draft->city_id);

        $line = null;
        $stops = [];

        foreach ($draft->geojson['features'] ?? [] as $feature) {
            if (! is_array($feature)) {
                continue;
            }

            $type = $feature['geometry']['type'] ?? null;

            if ($type === 'LineString' || $type === 'MultiLineString') {
                $line = $feature['geometry'];
            } elseif ($type === 'Point') {
                $stops[] = [
                    'name_ar' => trim($feature['properties']['nameAr'] ?? '') ?: null,
                    'coordinates' => $feature['geometry']['coordinates'] ?? null,
                ];
            }
        }

        return Response::structured([
            'draft_id' => $draft->id,
            'city_id' => $draft->city_id,
            'line' => $line,
            'stops' => $stops,
        ]);
    }
}
