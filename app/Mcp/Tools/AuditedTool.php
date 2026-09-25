<?php

namespace App\Mcp\Tools;

use App\Support\Agents\AgentAudit;
use App\Support\Agents\AgentContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tool;
use Throwable;

/**
 * Base class for every agent tool.
 *
 * It centralises the three things each tool would otherwise repeat and get
 * subtly wrong:
 *
 *  1. Audit. Each call lands in mcp_tool_calls with its outcome, arguments
 *     (redacted) and duration. See AgentAudit.
 *  2. Error translation. An authorization failure becomes a plain denial the
 *     agent can act on, not a stack trace. Validation failures keep Laravel's
 *     messages, which the MCP docs are explicit about: the agent acts on the
 *     message, so it has to name the fix.
 *  3. The permission declaration. Subclasses list the capabilities they need in
 *     $permissions, which drives shouldRegister() so an unprivileged token is
 *     never offered the tool at all, and guards the call as a second line of
 *     defence if the listing is ever bypassed.
 */
abstract class AuditedTool extends Tool
{
    /**
     * Capability ids this tool requires. Empty means the tool is public-safe
     * and always registered.
     *
     * @var array<int, string>
     */
    protected array $permissions = [];

    /**
     * Optional secondary gate for governorate-scoped tools. Return the city id
     * the arguments resolve to, or null when the tool is not city-scoped.
     */
    protected function cityIdFor(Request $request): ?string
    {
        return null;
    }

    final public function handle(Request $request): Response|ResponseFactory
    {
        $context = app(AgentContext::class);
        $http = app(HttpRequest::class);
        $started = hrtime(true);

        try {
            $this->authorize($context, $request);

            $response = $this->run($request, $context);

            // A tool that refuses in-domain (e.g. approving an already-approved
            // place) returns Response::error() rather than throwing, so the
            // audit row has to take the reason from the response. Without this
            // the trail records outcome=error with a null message: you learn
            // something failed but not what, which is the one case the log
            // exists for.
            [$outcome, $reason] = $this->classify($response);

            $this->audit($context, $http, $request, $started, $outcome, $reason);

            return $response;
        } catch (AuthorizationException $e) {
            $this->audit($context, $http, $request, $started, AgentAudit::OUTCOME_DENIED, $e->getMessage());

            return Response::error($e->getMessage());
        } catch (ValidationException $e) {
            $this->audit($context, $http, $request, $started, AgentAudit::OUTCOME_INVALID, $e->getMessage());

            return Response::error($this->describeValidation($e));
        } catch (Throwable $e) {
            report($e);

            $this->audit($context, $http, $request, $started, AgentAudit::OUTCOME_ERROR, $e->getMessage());

            return Response::error(
                'The action could not be completed: '.$e->getMessage()
            );
        }
    }

    /**
     * The tool's actual work. Throwing is fine — the base class translates.
     */
    abstract protected function run(Request $request, AgentContext $context): Response|ResponseFactory;

    /**
     * Hide the tool from tools/list when this agent could not call it anyway.
     *
     * The MCP client caches discovery, so an unprivileged agent never learns
     * the tool exists; that saves context and stops it spending turns
     * discovering a 403. RequiresApiToken guarantees a real token, so a null
     * context here means local/stdio use, where nothing is filtered.
     */
    public function shouldRegister(?AgentContext $context = null): bool
    {
        if ($this->permissions === []) {
            return true;
        }

        $context ??= app()->bound(AgentContext::class) ? app(AgentContext::class) : null;

        if ($context === null) {
            return true;
        }

        return $context->canAny($this->permissions);
    }

    protected function authorize(AgentContext $context, Request $request): void
    {
        if ($this->permissions === []) {
            return;
        }

        $context->authorize(...$this->permissions);

        $cityId = $this->cityIdFor($request);

        if ($cityId !== null || $this->isCityScoped()) {
            $this->authorizeCity($context, $cityId);
        }
    }

    /**
     * Whether this tool operates on governorate-scoped data. Overridden by
     * transit tools; false elsewhere so a null city id is not a false alarm.
     */
    protected function isCityScoped(): bool
    {
        return false;
    }

    protected function authorizeCity(AgentContext $context, ?string $cityId): void
    {
        // No-op by default: only transit.* carries governorate scoping today.
        // User::hasPermissionInCity() ignores the scope for other modules, so
        // there is nothing extra to assert.
    }

    /**
     * Classify a finished response for the audit row.
     *
     * Response::structured() hands back a factory rather than a Response, so
     * both shapes have to be inspected; a factory counts as an error if any of
     * the responses it wraps is one.
     *
     * @return array{0: string, 1: string|null} [outcome, reason]
     */
    protected function classify(Response|ResponseFactory $response): array
    {
        $responses = $response instanceof Response
            ? [$response]
            : $response->responses()->all();

        $errored = collect($responses)->contains(fn (Response $item) => $item->isError());

        if (! $errored) {
            return [AgentAudit::OUTCOME_OK, null];
        }

        $reason = collect($responses)
            ->filter(fn (Response $item) => $item->isError())
            ->map(fn (Response $item) => (string) $item->content())
            ->implode(' ');

        return [AgentAudit::OUTCOME_ERROR, $reason === '' ? null : $reason];
    }

    private function audit(
        AgentContext $context,
        HttpRequest $http,
        Request $request,
        int $started,
        string $outcome,
        ?string $error = null,
    ): void {
        app(AgentAudit::class)->record(
            context: $context,
            http: $http,
            tool: $this->name(),
            outcome: $outcome,
            error: $error,
            durationMs: (int) round((hrtime(true) - $started) / 1_000_000),
            arguments: $this->auditArguments($request),
        );
    }

    /**
     * Override to narrow what reaches the audit table. Defaults to the raw tool
     * arguments, which AgentAudit redacts by key.
     *
     * @return array<string, mixed>
     */
    protected function auditArguments(Request $request): array
    {
        return $request->all();
    }

    private function describeValidation(ValidationException $e): string
    {
        $messages = collect($e->errors())->flatten()->all();

        return $messages === []
            ? 'The arguments were rejected as invalid.'
            : 'The arguments were rejected as invalid: '.implode(' ', $messages);
    }
}
