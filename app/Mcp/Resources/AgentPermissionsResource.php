<?php

namespace App\Mcp\Resources;

use App\Support\Agents\AgentAuthorizer;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Attributes\Uri;
use Laravel\Mcp\Server\Resource;

/**
 * What this agent is actually allowed to do.
 *
 * An agent that is refused a tool has no way to tell "you lack the capability"
 * from "this is not a real capability" from "the tool does not exist". Exposing
 * the effective permission set lets it report the gap precisely instead of
 * retrying, and lets an operator see at a glance why a token is limited.
 */
#[Name('agent-permissions')]
// Without an explicit Uri the package derives one from the class name, giving
// file://resources/agent-permissions-resource — which shares no prefix with the
// #[Name] an agent reads in resources/list. Pin both so the pair is coherent.
#[Uri('syrianzone://agent/permissions')]
#[Title('Agent Permissions')]
#[Description(
    'The capabilities this token can exercise right now, and the capabilities it was granted but cannot use. '
    .'Useful for diagnosing a permission-denied error: if a capability appears under granted-but-unusable, the '
    .'token has it but the owning user no longer does.'
)]
class AgentPermissionsResource extends Resource
{
    public function handle(Request $request): Response
    {
        $context = app(AgentContext::class);
        $authorizer = app(AgentAuthorizer::class);

        $effective = $context->abilities();

        $grantedButUnusable = $authorizer->missing($context->user, $this->grantedAbilities($context), $context->token);

        $payload = [
            'user' => [
                'id' => $context->id(),
                'name' => $context->user?->name,
                'role' => $context->user?->role,
                'banned' => (bool) $context->user?->is_banned,
            ],
            'token' => [
                'name' => $context->tokenName(),
                'expires_at' => $context->token?->expires_at?->toIso8601String(),
                'last_used_at' => $context->token?->last_used_at?->toIso8601String(),
            ],
            'effective_permissions' => $effective,
            'granted_but_unusable' => $grantedButUnusable,
            'governorate_scopes' => $this->scopes($context),
            'capability_reference' => $this->reference(),
        ];

        return Response::text((string) json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    /**
     * @return array<int, string>
     */
    private function grantedAbilities(AgentContext $context): array
    {
        $abilities = $context->token?->abilities;

        return is_array($abilities) ? $abilities : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function scopes(AgentContext $context): array
    {
        $user = $context->user;

        if ($user === null) {
            return [];
        }

        return [
            'transit' => [
                'restricted' => $user->isTransitScopeRestricted(),
                'cities' => $user->allowedTransitCities() ?? 'all',
            ],
        ];
    }

    /**
     * @return array<string, array<string, string>>
     */
    private function reference(): array
    {
        return PermissionCatalogue::groups();
    }
}
