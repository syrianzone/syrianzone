<?php

namespace App\Mcp\Tools\Public;

use App\Models\Crossing;
use App\Support\ArabicSearch;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-crossings')]
#[Title('List Syrian Border Crossings')]
#[Description(
    'List Syrian land and sea border crossings with neighboring country, direction, operating windows, '
    .'coordinates, and official contact info from resources/data/crossings.json.'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListCrossingsTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()
                ->description('Optional Arabic or English search text (crossing name, slug, or country).'),

            'country' => $schema->string()
                ->description('Optional neighboring country filter (e.g. تركيا, لبنان, الأردن, العراق).'),

            'direction' => $schema->string()
                ->description('Optional border direction filter (north, south, east, west).'),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'q' => 'sometimes|nullable|string|max:120',
                'country' => 'sometimes|nullable|string|max:64',
                'direction' => 'sometimes|nullable|string|max:32',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $data = Crossing::publicDataset();
        $crossings = is_array($data['crossings'] ?? null) ? $data['crossings'] : [];

        $query = trim((string) ($validated['q'] ?? ''));
        $country = trim((string) ($validated['country'] ?? ''));
        $direction = trim((string) ($validated['direction'] ?? ''));

        $filtered = $crossings;

        if ($country !== '') {
            $countryFold = ArabicSearch::fold($country);
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $c): bool => str_contains(ArabicSearch::fold((string) ($c['country'] ?? '')), $countryFold),
            ));
        }

        if ($direction !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $c): bool => mb_strtolower((string) ($c['direction'] ?? '')) === mb_strtolower($direction),
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $c) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($c['name'] ?? ''),
                    (string) ($c['slug'] ?? ''),
                    (string) ($c['country'] ?? ''),
                    (string) ($c['opType'] ?? ''),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        return Response::structured([
            'meta' => $data['meta'] ?? [],
            'count' => count($filtered),
            'crossings' => $filtered,
        ]);
    }
}
