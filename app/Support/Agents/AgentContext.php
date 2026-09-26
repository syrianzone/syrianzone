<?php

namespace App\Support\Agents;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Auth\Access\AuthorizationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * The authenticated agent for the current MCP request.
 *
 * Tools type-hint this and never touch the token or the user directly, so there
 * is exactly one place where "may this agent do X" is answered. Every method
 * delegates to AgentAuthorizer's ceiling rule.
 */
final class AgentContext
{
    public function __construct(
        public readonly ?User $user,
        public readonly ?PersonalAccessToken $token,
        private readonly AgentAuthorizer $authorizer,
    ) {}

    public static function for(User $user, PersonalAccessToken $token): self
    {
        return new self($user, $token, app(AgentAuthorizer::class));
    }

    /**
     * A context with no identity, for local/stdio servers and tests. Every
     * permission check denies, so a tool that forgets to guard itself still
     * fails closed rather than acting as a god.
     */
    public static function anonymous(): self
    {
        return new self(null, null, app(AgentAuthorizer::class));
    }

    public function id(): ?int
    {
        return $this->user?->getAuthIdentifier();
    }

    public function tokenId(): ?int
    {
        return $this->token?->getKey();
    }

    public function tokenName(): ?string
    {
        return $this->token?->name;
    }

    public function can(string $permission): bool
    {
        return $this->authorizer->can($this->user, $permission, $this->token);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function canAny(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->can($permission)) {
                return true;
            }
        }

        return false;
    }

    public function canInCity(string $permission, ?string $cityId): bool
    {
        return $this->authorizer->allowsInCity($this->user, $permission, $cityId, $this->token);
    }

    /**
     * @param  array<int, string>  $permissions
     */
    public function canAnyInCity(array $permissions, ?string $cityId): bool
    {
        return $this->authorizer->allowsAnyInCity($this->user, $permissions, $cityId, $this->token);
    }

    /**
     * Governorates this agent's user may act on, or null when unrestricted.
     *
     * A thin delegation on purpose: the scope lives on the user row, and the
     * token ceiling has already been applied by the permission check that got a
     * tool this far. Tools use this to *narrow* a listing, never to widen it —
     * pass the result straight to a whereIn, and treat null as "no restriction"
     * rather than "no cities".
     *
     * With no authenticated user this returns [] rather than null, so an
     * anonymous context sees no governorates instead of all of them.
     *
     * @return array<int, string>|null
     */
    public function allowedTransitCities(): ?array
    {
        if ($this->user === null) {
            return [];
        }

        return $this->user->allowedTransitCities();
    }

    /**
     * @return array<int, string>
     */
    public function abilities(): array
    {
        return $this->authorizer->effectiveAbilities($this->user, $this->token);
    }

    /**
     * True when the agent holds at least one capability in the module. Used by
     * shouldRegister() so a transit-only token is not offered places tools.
     */
    public function canAnythingIn(string $module): bool
    {
        foreach (PermissionCatalogue::forModule($module) as $permission) {
            if ($this->can($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Guard for a write tool. Throws with an actionable message naming the
     * capabilities involved, so the agent can tell the operator exactly what to
     * ask for rather than retrying blind.
     *
     * @throws AuthorizationException
     */
    public function authorize(string ...$permissions): void
    {
        $missing = array_values(array_filter(
            $permissions,
            fn (string $permission) => ! $this->can($permission),
        ));

        if ($missing !== []) {
            throw new AuthorizationException($this->describeDenial($missing));
        }
    }

    /**
     * Guard for a tool satisfied by any one of several capabilities, e.g. a
     * read-only listing in a module whose catalogue has no read entry.
     *
     * The denial names every capability that would have worked, so the agent
     * can tell its operator exactly what to grant.
     *
     * @param  array<int, string>  $permissions
     *
     * @throws AuthorizationException
     */
    public function authorizeAny(array $permissions): void
    {
        if ($this->canAny($permissions)) {
            return;
        }

        throw new AuthorizationException(sprintf(
            'Permission denied: this agent needs at least one of the %s capabilities to use this tool.%s',
            implode(', ', array_map(
                static fn (string $permission) => PermissionCatalogue::label($permission),
                $permissions,
            )),
            $this->token?->name !== null
                ? sprintf(' Token "%s" also needs this grant.', $this->token->name)
                : ''
        ));
    }

    /**
     * @param  array<int, string>  $missing
     */
    private function describeDenial(array $missing): string
    {
        $labels = array_map(
            static fn (string $permission) => PermissionCatalogue::label($permission),
            $missing,
        );

        $capability = count($labels) === 1
            ? 'capability'
            : 'capabilities';

        $tokenNote = $this->token?->name !== null
            ? sprintf(' Token "%s" also needs this grant.', $this->token->name)
            : '';

        return sprintf(
            'Permission denied: this agent lacks the %s %s.%s',
            $capability,
            implode(', ', $labels),
            $tokenNote
        );
    }
}
