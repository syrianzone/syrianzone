<?php

namespace App\Mcp\Tools\Public;

use App\Services\Governorates\GovernorateDataService;
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

#[Name('list-governorates')]
#[Title('List Syrian Governorates')]
#[Description(
    'List all 14 Syrian governorates with their civic metadata, or retrieve full detail for one governorate by id '
    .'(e.g. damascus, aleppo, homs, latakia).'
)]
#[IsReadOnly]
#[IsIdempotent]
class ListGovernoratesTool extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()
                ->description('Optional governorate id (e.g. damascus, rural-damascus, aleppo) to fetch full detail.'),
        ];
    }

    public function handle(Request $request): Response|ResponseFactory
    {
        try {
            $validated = $request->validate([
                'id' => 'sometimes|nullable|string|max:64',
            ]);
        } catch (ValidationException $e) {
            return Response::error(implode(' ', collect($e->errors())->flatten()->all()));
        }

        $service = app(GovernorateDataService::class);
        $id = trim((string) ($validated['id'] ?? ''));

        if ($id !== '') {
            $detail = $service->forGovernorate($id);
            if ($detail === null) {
                return Response::error("Governorate '{$id}' was not found.");
            }

            return Response::structured($detail);
        }

        $hub = $service->forHub();
        $governorates = is_array($hub['governorates'] ?? null) ? $hub['governorates'] : [];

        return Response::structured([
            'count' => count($governorates),
            'governorates' => $governorates,
        ]);
    }
}
