<?php

namespace App\Mcp\Tools\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Mcp\Tools\AuditedTool;
use App\Models\Promise;
use App\Models\PromiseSource;
use App\Services\Promises\PromiseEditor;
use App\Support\Agents\AgentContext;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;

/**
 * Shared base for promises tracker tools.
 *
 * Each tool needs exactly the capability its dashboard route needs, and the
 * domain rules live in App\Services\Promises, shared with the dashboard. The
 * one thing a tool must add is the token: a service that asks whether the
 * actor may rule is told by mayRule(), never by the user row alone, so a token
 * without `promises.rule` cannot reach a verdict through a side effect.
 */
abstract class PromisesTool extends AuditedTool
{
    protected const READ_PERMISSIONS = [
        'promises.create',
        'promises.edit',
        'promises.rule',
        'promises.review',
        'promises.speakers',
        'promises.delete',
    ];

    /**
     * @param  callable(): (Response|ResponseFactory)  $callback
     */
    protected function attempt(callable $callback): Response|ResponseFactory
    {
        try {
            return $callback();
        } catch (PromiseActionException $e) {
            return Response::error(match ($e->kind) {
                PromiseActionException::NOT_FOUND => sprintf('%s %s', $e->getMessage(), $this->notFoundHint()),
                PromiseActionException::STALE => sprintf(
                    '%s The promise changed after you read it (it is now at version %d). Call get-promise again, apply your change to the fresh values, and retry with the new version.',
                    $e->getMessage(),
                    $e->context['version'] ?? 0
                ),
                PromiseActionException::BAD_SPEAKER_REF => sprintf(
                    '%s Call search-promise-speakers and pass one of the returned `ref` values.',
                    $e->getMessage()
                ),
                default => $e->getMessage(),
            });
        }
    }

    /** Where the agent finds valid ids when the one it passed does not exist. */
    protected function notFoundHint(): string
    {
        return 'Call list-promises to find valid ids.';
    }

    protected function findPromise(string $id): Promise
    {
        return app(PromiseEditor::class)->find($id);
    }

    /** Whether this agent may rule on promises: its user AND its token. */
    protected function mayRule(AgentContext $context): bool
    {
        return $context->can('promises.rule');
    }

    /**
     * A public promise restating one that is still open, which only an agent
     * with promises.rule can mark postponed; empty otherwise.
     *
     * @return array{note?: string}
     */
    protected function restatementNote(Promise $promise): array
    {
        $original = $promise->review_status === 'published' ? $promise->restates : null;

        return $original?->isOpen() ? ['note' => sprintf(
            'Promise #%d, which this one restates, is still open. Marking it postponed needs promises.rule (set-promise-status).',
            $original->number,
        )] : [];
    }

    /**
     * Shared field schema for create-promise-speaker and update-promise-speaker.
     *
     * @return array<string, mixed>
     */
    protected function speakerFieldsSchema(JsonSchema $schema): array
    {
        return [
            'title' => $schema->string()
                ->description('Their current office in Arabic, e.g. "وزير الطاقة". Max 255 characters.')
                ->max(255),

            'institution_id' => $schema->string()
                ->description('Optional institution id from get-promise-form-options.'),

            'image_url' => $schema->string()
                ->description('Optional photo URL (http/https or a /storage/ path). Uploads are dashboard-only.')
                ->max(2048),

            'x_handle' => $schema->string()
                ->description('Optional handle on X, letters, digits and underscores, with or without @.')
                ->max(16),
        ];
    }

    /**
     * Shared field schema for create-promise and update-promise.
     *
     * @return array<string, mixed>
     */
    protected function promiseFieldsSchema(JsonSchema $schema): array
    {
        return [
            'speaker_ref' => $schema->string()
                ->description('Speaker reference from search-promise-speakers (e.g. "speaker:<uuid>", "official:<id>", "candidate:<uuid>", "house:<id>"). Required.')
                ->required(),

            'speaker_title' => $schema->string()
                ->description('Optional title of the speaker at the time of the statement.'),

            'title' => $schema->string()
                ->description('Promise title in Arabic (max 200 chars). Required.')
                ->max(200)
                ->required(),

            'summary' => $schema->string()
                ->description('Optional context or summary in Arabic (max 2000 chars).')
                ->max(2000),

            'quote' => $schema->string()
                ->description('Verbatim quote of the promise in Arabic (max 5000 chars). Required.')
                ->max(5000)
                ->required(),

            'quote_is_verbatim' => $schema->boolean()
                ->description('Whether the quote is verbatim. Defaults to true.')
                ->default(true),

            'institution_id' => $schema->string()
                ->description('Optional official entity id from get-promise-form-options.'),

            'sector_id' => $schema->string()
                ->description('Optional sector id from get-promise-form-options.'),

            'is_national' => $schema->boolean()
                ->description('Whether the promise applies nationwide. Defaults to true.')
                ->default(true),

            'governorates' => $schema->array()
                ->description('Governorate slugs when not national, from get-promise-form-options.')
                ->items($schema->string()),

            'tags' => $schema->array()
                ->description('Optional tags (up to 10).')
                ->max(10)
                ->items($schema->string()->max(64)),

            'statement_date' => $schema->string()
                ->description('Date of the statement (YYYY-MM-DD), between 2024-12-08 and today. Required.')
                ->required(),

            'statement_venue' => $schema->string()
                ->description('Venue where the statement was made. Required.')
                ->enum(Promise::VENUES)
                ->required(),

            'deadline_wording' => $schema->string()
                ->description('Original wording of the deadline (e.g. "خلال ستة أشهر").')
                ->max(255),

            'deadline_date' => $schema->string()
                ->description('Parsed target deadline date (YYYY-MM-DD), on or after statement_date.'),

            'deadline_reasoning' => $schema->string()
                ->description('Explanation of how the deadline date was derived from the wording.')
                ->max(2000),

            'target_value' => $schema->number()
                ->description('Numeric target value for measurable promises.'),

            'target_unit' => $schema->string()
                ->description('Unit of measurement for the target (required if target_value is set).')
                ->max(64),

            'baseline_value' => $schema->number()
                ->description('Baseline numeric value before the promise.'),

            'baseline_note' => $schema->string()
                ->description('Note on how the baseline was determined.')
                ->max(255),

            'restates_promise_id' => $schema->string()
                ->description('UUID of an earlier published promise this promise supersedes/restates.'),

            'sources' => $schema->array()
                ->description('Sources supporting the promise. At least one source is required.')
                ->min(1)
                ->max(20)
                ->items($schema->object([
                    'url' => $schema->string()
                        ->description('Source URL (http/https). Required.')
                        ->max(2048)
                        ->required(),
                    'outlet' => $schema->string()
                        ->description('Media outlet or publishing organization.')
                        ->max(255),
                    'type' => $schema->string()
                        ->description('Type of source. Required.')
                        ->enum(PromiseSource::TYPES)
                        ->required(),
                    'published_date' => $schema->string()
                        ->description('Date source was published (YYYY-MM-DD).'),
                    'language' => $schema->string()
                        ->description('Source language.')
                        ->enum(['ar', 'en', 'other']),
                    'archive_url' => $schema->string()
                        ->description('Archive or backup URL (http/https).')
                        ->max(2048),
                    'screenshot_url' => $schema->string()
                        ->description('Screenshot URL (http/https or /storage/ path).')
                        ->max(2048),
                    'video_timestamp' => $schema->string()
                        ->description('Video timestamp formatted as MM:SS or H:MM:SS.')
                        ->max(16),
                    'is_primary' => $schema->boolean()
                        ->description('Whether this is the primary citation for the statement.'),
                ]))
                ->required(),
        ];
    }
}
