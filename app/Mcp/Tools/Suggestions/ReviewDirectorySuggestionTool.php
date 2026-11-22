<?php

namespace App\Mcp\Tools\Suggestions;

use App\Mcp\Tools\AuditedTool;
use App\Models\DirectorySuggestion;
use App\Services\Directories\DirectorySuggestionService;
use App\Support\Agents\AgentContext;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Title;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

#[Name('review-directory-suggestion')]
#[Title('Review Directory Suggestion')]
#[Description(
    'Mark a pending visitor directory suggestion (govtcvs, syofficial, govapps, or phonebook) as accepted '
    .'or dismissed after reviewing or applying it. Requires the corresponding module edit capability.'
)]
#[IsDestructive]
class ReviewDirectorySuggestionTool extends AuditedTool
{
    public function __construct()
    {
        $this->anyPermissions = [
            PermissionCatalogue::GOVTCVS_EDIT,
            PermissionCatalogue::SYOFFICIAL_EDIT,
            PermissionCatalogue::GOVAPPS_EDIT,
            PermissionCatalogue::PHONEBOOK_EDIT,
        ];
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'module' => $schema->string()
                ->enum(DirectorySuggestion::MODULES)
                ->description('Directory module the suggestion belongs to: govtcvs, syofficial, govapps, or phonebook.')
                ->required(),

            'id' => $schema->integer()
                ->min(1)
                ->description('Numeric ID of the pending suggestion (from list-directory-suggestions).')
                ->required(),

            'decision' => $schema->string()
                ->enum(['accepted', 'dismissed'])
                ->description('Review outcome: "accepted" when applied/done, or "dismissed" when rejected.')
                ->required(),

            'resolution_note' => $schema->string()
                ->max(1000)
                ->description('Optional editorial note describing what was applied or why it was dismissed.'),
        ];
    }

    protected function run(Request $request, AgentContext $context): Response|ResponseFactory
    {
        $validated = $request->validate([
            'module' => ['required', 'string', Rule::in(DirectorySuggestion::MODULES)],
            'id' => ['required', 'integer', 'min:1'],
            'decision' => ['required', 'string', Rule::in(['accepted', 'dismissed'])],
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $module = (string) $validated['module'];
        $editPermission = match ($module) {
            'govtcvs' => PermissionCatalogue::GOVTCVS_EDIT,
            'syofficial' => PermissionCatalogue::SYOFFICIAL_EDIT,
            'govapps' => PermissionCatalogue::GOVAPPS_EDIT,
            'phonebook' => PermissionCatalogue::PHONEBOOK_EDIT,
        };
        $context->authorizeAny([$editPermission]);

        $service = app(DirectorySuggestionService::class);

        try {
            $suggestion = $service->review(
                $context->user,
                $module,
                (int) $validated['id'],
                (string) $validated['decision'],
                $validated['resolution_note'] ?? null,
            );
        } catch (HttpExceptionInterface $e) {
            return Response::error($e->getMessage());
        }

        return Response::structured([
            'reviewed' => true,
            'suggestion' => $service->present($suggestion),
        ]);
    }
}
