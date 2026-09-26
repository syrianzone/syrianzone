<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\AgentPermissionsResource;
use App\Mcp\Resources\AgentTokenResource;
use App\Mcp\Tools\GovApps\CreateGovAppTool;
use App\Mcp\Tools\GovApps\DeleteGovAppTool;
use App\Mcp\Tools\GovApps\ListGovAppsTool;
use App\Mcp\Tools\GovApps\ReorderGovAppsTool;
use App\Mcp\Tools\GovApps\RestoreGovAppTool;
use App\Mcp\Tools\GovApps\ToggleGovAppTool;
use App\Mcp\Tools\GovApps\UpdateGovAppTool;
use App\Mcp\Tools\Places\ApprovePlaceTool;
use App\Mcp\Tools\Places\DeletePlacePhotoTool;
use App\Mcp\Tools\Places\DeletePlaceTool;
use App\Mcp\Tools\Places\GetPlaceTool;
use App\Mcp\Tools\Places\ListPlacesTool;
use App\Mcp\Tools\Places\RejectPlaceTool;
use App\Mcp\Tools\Places\RotatePlacePhotoTool;
use App\Mcp\Tools\Places\UpdatePlaceTool;
use App\Mcp\Tools\SyOfficial\CreateSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\CreateSyOfficialEntityTool;
use App\Mcp\Tools\SyOfficial\DeleteSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\DeleteSyOfficialEntityTool;
use App\Mcp\Tools\SyOfficial\ListSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ListSyOfficialEntitiesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialCategoriesTool;
use App\Mcp\Tools\SyOfficial\ReorderSyOfficialEntitiesTool;
use App\Mcp\Tools\SyOfficial\ToggleSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\ToggleSyOfficialEntityTool;
use App\Mcp\Tools\SyOfficial\UpdateSyOfficialCategoryTool;
use App\Mcp\Tools\SyOfficial\UpdateSyOfficialEntityTool;
use App\Mcp\Tools\Transit\ApproveTransitDraftTool;
use App\Mcp\Tools\Transit\DeleteTransitRouteTool;
use App\Mcp\Tools\Transit\GetTransitDraftGeometryTool;
use App\Mcp\Tools\Transit\ListTransitDraftsTool;
use App\Mcp\Tools\Transit\ListTransitRouteHistoryTool;
use App\Mcp\Tools\Transit\ListTransitRoutesTool;
use App\Mcp\Tools\Transit\MoveTransitRouteTool;
use App\Mcp\Tools\Transit\RejectTransitDraftTool;
use App\Mcp\Tools\Transit\SetTransitRouteStatusTool;
use App\Mcp\Tools\Transit\UpdateTransitRouteTool;
use App\Mcp\Tools\Users\SetUserBanTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Prompt;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\ToolSearch;

/**
 * The agent-facing view of the Syrian Zone admin dashboard.
 *
 * One server, gated per-tool: a token is only ever shown the tools its
 * capabilities actually permit (see AuditedTool::shouldRegister), so the
 * advertised catalogue shrinks to what the caller can use. That keeps the tool
 * list small enough for an agent to choose well, and means revoking a
 * capability takes effect on the next discovery call without revoking the token.
 *
 * Modules are added by dropping their tools in below. Anything not listed here
 * is not reachable by an agent.
 */
#[Name('Syrian Zone Admin')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
Administrative access to the Syrian Zone dashboard: community-submitted places
(mishwar) moderation, the SyOfficial directory of official entities, the
government apps directory, and transit route governance.

Moderation lifecycle: a submitted place starts `pending`. Approve it to publish
it to the map, or reject it with a reason. Only `pending` places can be
moderated — approving an already-approved place is an error, not a no-op.

Transit drafts work the same way: a submitted draft starts `pending`; approving
it publishes a new route or applies the edit to the existing route it targets.

Showing versus deleting. The directories distinguish the two on purpose, and
picking the reversible one is usually right: `toggle-*` hides something while
keeping its data, whereas `delete-*` on an entity or a category is a permanent
hard delete. Government apps are the exception — their delete is a soft delete,
recoverable with `restore-gov-app`.

Governorate scope. Transit capabilities may be restricted to specific
governorates. When that applies, the listings only return what is in scope and
writes outside it are refused; the `scope` field of a listing says so
explicitly. There is no equivalent scope on the other modules.

Some tools are hidden depending on the capabilities of the token you were given.
If a capability you expect is missing, say so rather than retrying: a
superadmin can widen the token.
MARKDOWN)]
class AdminServer extends Server
{
    /**
     * Read tools are advertised directly; every write and destructive tool sits
     * behind a searchable catalogue instead. An agent picks far more reliably
     * from a short list plus a search than from a flat wall of mutations, and
     * the write tools are exactly the ones that must not be called by accident.
     *
     * @var array<int|string, Tool|class-string<Tool>|array<int, Tool|class-string<Tool>>>
     */
    protected array $tools = [
        ListPlacesTool::class,
        GetPlaceTool::class,
        ListSyOfficialCategoriesTool::class,
        ListSyOfficialEntitiesTool::class,
        ListGovAppsTool::class,
        ListTransitDraftsTool::class,
        GetTransitDraftGeometryTool::class,
        ListTransitRoutesTool::class,
        ListTransitRouteHistoryTool::class,

        ToolSearch::class => [
            // Places
            ApprovePlaceTool::class,
            RejectPlaceTool::class,
            UpdatePlaceTool::class,
            RotatePlacePhotoTool::class,
            DeletePlacePhotoTool::class,
            DeletePlaceTool::class,

            // SyOfficial
            CreateSyOfficialCategoryTool::class,
            UpdateSyOfficialCategoryTool::class,
            ToggleSyOfficialCategoryTool::class,
            DeleteSyOfficialCategoryTool::class,
            ReorderSyOfficialCategoriesTool::class,
            CreateSyOfficialEntityTool::class,
            UpdateSyOfficialEntityTool::class,
            ToggleSyOfficialEntityTool::class,
            DeleteSyOfficialEntityTool::class,
            ReorderSyOfficialEntitiesTool::class,

            // Government apps
            CreateGovAppTool::class,
            UpdateGovAppTool::class,
            ToggleGovAppTool::class,
            DeleteGovAppTool::class,
            RestoreGovAppTool::class,
            ReorderGovAppsTool::class,

            // Transit
            ApproveTransitDraftTool::class,
            RejectTransitDraftTool::class,
            SetTransitRouteStatusTool::class,
            UpdateTransitRouteTool::class,
            MoveTransitRouteTool::class,
            DeleteTransitRouteTool::class,

            // User moderation
            SetUserBanTool::class,
        ],
    ];

    /**
     * @var array<int, class-string<Server\Resource>>
     */
    protected array $resources = [
        AgentPermissionsResource::class,
        AgentTokenResource::class,
    ];

    /**
     * @var array<int, class-string<Prompt>>
     */
    protected array $prompts = [];
}
