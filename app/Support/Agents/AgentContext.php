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
