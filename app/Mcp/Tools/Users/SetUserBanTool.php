<?php

namespace App\Mcp\Tools\Users;

use App\Models\User;
use App\Services\Users\UserModerationService;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

/**
 * Set a user's banned state.
 *
 * Deliberately `set`, not `toggle`. A toggle is the wrong shape for an agent:
 * two calls flip the state back, so an agent retrying after a timeout or a
 * duplicate delivery would undo its own action. Requiring the intended state
 * makes a repeat call a no-op, and makes the tool idempotent in the annotation
 * sense as well as the practical one.
 */
#[Name('set-user-ban')]
#[Title('Ban or Unban a User')]
#[Description(
    'Ban or unban a user account by id, stating which state you want. A ban is immediate and severe: it '
    .'blocks the account\'s login, its access to the admin panel, any API or agent token it holds, and its '
    .'ability to submit new places or transit routes. Prefer unban over ban where the goal can be met '
    .'that way, and never ban to silence a disagreement — ban for spam, abuse or fraud. You cannot ban '
    .'your own account, and superadmin accounts cannot be banned at all.'
)]
#[IsDestructive]
#[IsIdempotent]
class SetUserBanTool extends UsersTool
{
    protected array $permissions = ['users.ban'];

    public function schema(JsonSchema $schema): array
    {
        return [
            'user_id' => $schema->integer()
                ->description('Id of the account to ban or unban.')
                ->required(),

            'is_banned' => $schema->boolean()
                ->description('true to ban the account, false to unban it. State the target state explicitly rather than relying on a flip.')
                ->required(),
        ];
    }

    public function outputSchema(JsonSchema $schema): array
    {
        return [
            'user' => $schema->object([
                'id' => $schema->integer(),
                'name' => $schema->string(),
                'email' => $schema->string(),
                'is_banned' => $schema->boolean(),
                'role' => $schema->string(),
            ]),
            'changed' => $schema->boolean()->description('False when the account was already in the requested state.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|min:1',
            'is_banned' => 'required|boolean',
        ]);

        return $this->attempt(function () use ($validated, $context) {
            $actor = $context->user;

            $target = User::find($validated['user_id']);

            if ($target === null) {
                return Response::error(sprintf(
                    'No user exists with id %d. There is no list-users tool, so confirm the id with the operator.',
                    $validated['user_id']
                ));
            }

            $wasBanned = (bool) $target->is_banned;

            $user = app(UserModerationService::class)->setBanned(
                $target,
                (bool) $validated['is_banned'],
                $actor,
            );

            return Response::structured([
                'user' => $this->userPayload($user),
                'changed' => $wasBanned !== (bool) $user->is_banned,
            ]);
        });
    }
}
