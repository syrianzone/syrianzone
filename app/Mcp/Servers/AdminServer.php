<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\AgentPermissionsResource;
use App\Mcp\Resources\AgentTokenResource;
use App\Mcp\Tools\Places\ApprovePlaceTool;
use App\Mcp\Tools\Places\DeletePlacePhotoTool;
use App\Mcp\Tools\Places\DeletePlaceTool;
use App\Mcp\Tools\Places\GetPlaceTool;
use App\Mcp\Tools\Places\ListPlacesTool;
use App\Mcp\Tools\Places\RejectPlaceTool;
use App\Mcp\Tools\Places\RotatePlacePhotoTool;
use App\Mcp\Tools\Places\UpdatePlaceTool;
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
(mishwar) moderation, plus read-only reference data for the other directories.

Moderation lifecycle: a submitted place starts `pending`. Approve it to publish
it to the map, or reject it with a reason. Only `pending` places can be
moderated — approving an already-approved place is an error, not a no-op.

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

        ToolSearch::class => [
            ApprovePlaceTool::class,
            RejectPlaceTool::class,
            UpdatePlaceTool::class,
            RotatePlacePhotoTool::class,
            DeletePlacePhotoTool::class,
            DeletePlaceTool::class,
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
