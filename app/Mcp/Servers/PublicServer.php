<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\CivicModulesCatalogResource;
use App\Mcp\Tools\Public\ListCrossingsTool;
use App\Mcp\Tools\Public\ListGovernoratesTool;
use App\Mcp\Tools\Public\ListMinistriesTool;
use App\Mcp\Tools\Public\ListPromisesTool;
use App\Mcp\Tools\Public\ListWildlifeTool;
use App\Mcp\Tools\Public\SearchOfficialAccountsTool;
use App\Mcp\Tools\Public\SearchOfficialsTool;
use App\Mcp\Tools\Public\SearchPhonebookTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Prompt;
use Laravel\Mcp\Server\Tool;

/**
 * Unauthenticated, strictly read-only public civic MCP server (`/mcp/public`).
 *
 * Exposes verified public Syrian civic datasets only — zero PII, zero mutations.
 */
#[Name('Syrian Zone Public Civic Data')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
Read-only public civic data from Syrian Zone (syrian.zone). All tools return
publicly published, non-personal Syrian civic information:
- `search-phonebook`: emergency, service, and WhatsApp directory numbers.
- `search-official-accounts`: verified Syrian official entity accounts (SyOfficial).
- `list-ministries`: current cabinet, historical ministries, and sovereign bodies.
- `search-officials`: published Syrian government officials & CV summaries.
- `list-promises`: published public promises and their verification statuses.
- `list-wildlife`: documented Syrian wildlife species guide.
- `list-governorates`: the 14 Syrian governorates and their key civic metadata.
- `list-crossings`: Syrian border crossings, operating hours, and contact info.

Read `syrianzone://catalog/modules` for an overview of all public modules.
MARKDOWN)]
class PublicServer extends Server
{
    /**
     * @var array<int|string, Tool|class-string<Tool>|array<int, Tool|class-string<Tool>>>
     */
    protected array $tools = [
        SearchPhonebookTool::class,
        SearchOfficialAccountsTool::class,
        ListMinistriesTool::class,
        SearchOfficialsTool::class,
        ListPromisesTool::class,
        ListWildlifeTool::class,
        ListGovernoratesTool::class,
        ListCrossingsTool::class,
    ];

    /**
     * @var array<int, class-string<Server\Resource>>
     */
    protected array $resources = [
        CivicModulesCatalogResource::class,
    ];

    /**
     * @var array<int, class-string<Prompt>>
     */
    protected array $prompts = [];
}
