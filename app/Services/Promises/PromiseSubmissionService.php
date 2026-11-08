<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Public input, transport-free: promise suggestions and reports on published
 * promises from signed-in visitors. Everything lands in the review queue;
 * nothing a visitor sends is public until an editor accepts it.
 */
class PromiseSubmissionService
{
    public function __construct(
        private readonly PromiseEditor $editor,
        private readonly SpeakerDirectory $speakers,
    ) {}

    /**
     * Suggest a promise. The speaker is either an existing picker ref or a new
     * person, who is created `pending` and reviewed with the promise.
     *
     * @param  array<string, mixed>  $data  validated input
     */
    public function suggest(User $user, array $data): Promise
    {
        $this->assertNotBanned($user);

        return DB::transaction(function () use ($user, $data) {
            if (! empty($data['speaker_ref'])) {
                // A visitor may only point at approved speakers or at people
                // the site shows publicly; never at someone else's pending row.
                $speaker = $this->speakers->resolve((string) $data['speaker_ref']);
                if ($speaker->status !== 'approved' && $speaker->submitted_by !== $user->id) {
                    throw PromiseActionException::badSpeakerRef();
                }
            } else {
                $speaker = PromiseSpeaker::create([
                    'name' => $data['speaker_name'],
                    'title' => $data['speaker_title'] ?? null,
                    'status' => 'pending',
                    'submitted_by' => $user->id,
                ]);
            }

            $promise = $this->editor->save(null, [
                'speaker_ref' => 'speaker:'.$speaker->id,
                'speaker_title' => $data['speaker_title'] ?? $speaker->title,
                'title' => $data['title'],
                'quote' => $data['quote'],
                'quote_is_verbatim' => true,
                'statement_date' => $data['statement_date'],
                'statement_venue' => $data['statement_venue'] ?? 'other',
                'deadline_wording' => $data['deadline_wording'] ?? null,
                'is_national' => true,
                'origin' => 'public',
                'sources' => collect($data['source_urls'])
                    ->filter()
                    ->map(fn ($url) => ['url' => $url, 'type' => 'news_article'])
                    ->values()
                    ->all(),
            ], $user);

            $promise->update(['submitter_note' => $data['note'] ?? null]);

            return $promise;
        });
    }

    /**
     * @param  array{kind: string, body: string, source_url?: string|null}  $data
     */
    public function report(User $user, Promise $promise, array $data): PromiseReport
    {
        $this->assertNotBanned($user);

        if ($promise->review_status !== 'published') {
            throw PromiseActionException::notFound();
        }

        return $promise->reports()->create([
            'user_id' => $user->id,
            'kind' => $data['kind'],
            'body' => $data['body'],
            'source_url' => $data['source_url'] ?? null,
            'status' => 'pending',
        ]);
    }

    private function assertNotBanned(User $user): void
    {
        if ($user->is_banned) {
            throw PromiseActionException::banned();
        }
    }
}
