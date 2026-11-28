<?php

namespace App\Mcp\Resources;

use App\Support\Facts;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Attributes\Uri;
use Laravel\Mcp\Server\Resource;

/**
 * Static reference catalogue of public Syrian Zone civic modules.
 */
#[Name('civic-modules-catalog')]
#[Uri('syrianzone://catalog/modules')]
#[Title('Syrian Zone Civic Modules Catalog')]
#[Description(
    'Directory of public Syrian Zone civic modules, routes, Arabic/English titles, and descriptions. '
    .'Use this resource to discover which civic datasets and pages exist on Syrian Zone.'
)]
class CivicModulesCatalogResource extends Resource
{
    public function handle(Request $request): Response
    {
        $siteModules = Facts::siteModules();
        $modules = array_values(array_map(function (array $module): array {
            return [
                'id' => $module['id'] ?? null,
                'href' => $module['href'] ?? null,
                'label_ar' => $module['label'] ?? $module['label_ar'] ?? null,
                'label_en' => $module['label_en'] ?? null,
                'description_ar' => $module['description'] ?? $module['description_ar'] ?? null,
                'category' => $module['category'] ?? null,
            ];
        }, $siteModules['modules'] ?? []));

        $payload = [
            'base_url' => Facts::site()['base_url'] ?? 'https://syrian.zone',
            'count' => count($modules),
            'modules' => $modules,
        ];

        return Response::text((string) json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
