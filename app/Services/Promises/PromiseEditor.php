<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseCoSpeaker;
use App\Models\PromiseGovernorate;
use App\Models\PromiseSource;
use App\Models\PromiseTag;
use App\Models\PromiseUpdate;
use App\Models\User;
use App\Support\Governorates;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * Writes to a promise and its change log, transport-free.
 *
 * Rules that must not be relaxed:
 *  - A status change always writes a `status_change` entry to the public
 *    change log, cites a source, and is dated no earlier than the statement
 *    or the previous status change, so the log reads in order.
 *  - `progress` and `official_response` entries must cite a source too.
 *  - `resolved_at` is set by closing verdicts only and cleared on reopen.
 *  - No log entry is dated before the statement, and the statement date
 *    cannot move past the log.
 *  - Once a promise has ever been public, its status changes are permanent.
 *    Before that, the latest one can be undone (to fix a researched date).
 *  - Verdicts are recorded under a row lock on the promise, so concurrent
 *    requests cannot interleave the log.
 *  - Marking a restated original `postponed` is a verdict, so it only happens
 *    when the caller says the actor may rule on promises. The caller decides
 *    because only it knows the full grant: the dashboard asks the user, an
 *    agent asks the user and its token. It defaults to no.
 *  - Every save bumps the promise's `version` in one atomic update. A save
 *    that names the version it read is refused under a row lock once the
 *    promise has moved on, so a full replacement built from stale values
 *    never overwrites a newer edit.
 *  - A published promise only points at an approved speaker.
 *  - Any change to a promise or its public log touches the promise, so its
 *    `updated_at` (detail page, sitemap) follows the evidence.
 *  - Field shapes are validated at the edge (controllers); this class
 *    enforces the domain rules and keeps the relation rows consistent.
 */
class PromiseEditor
{
    public function __construct(private readonly SpeakerDirectory $speakers) {}

    public function find(string $id): Promise
    {
        return Promise::find($id) ?? throw PromiseActionException::notFound();
    }

    /**
     * Create or update a promise and replace its sources, governorates and tags.
     *
     * @param  array<string, mixed>  $data  validated input
     * @param  bool  $mayRule  whether the actor may rule on promises (see postponeRestatedOriginal)
     */
    public function save(?Promise $promise, array $data, ?User $actor = null, bool $mayRule = false): Promise
    {
        return DB::transaction(function () use ($promise, $data, $actor, $mayRule) {
            $speaker = $this->speakers->resolve((string) $data['speaker_ref'], forStaff: true);

            if ($promise?->published_at && $speaker->status !== 'approved') {
                throw PromiseActionException::speakerNotApproved();
            }

            $restatesId = $data['restates_promise_id'] ?? null;
            if ($restatesId !== null) {
                $this->assertRestatable($promise, $restatesId);
            }

            $firstEntry = $promise?->updates()->min('happened_on');
            if ($firstEntry && $data['statement_date'] > substr((string) $firstEntry, 0, 10)) {
                throw PromiseActionException::statementAfterLog(substr((string) $firstEntry, 0, 10));
            }

            // The title is a snapshot of the speaker's office at the time. A
            // blank field keeps the existing snapshot unless the speaker changed.
            $speakerTitle = filled($data['speaker_title'] ?? null)
                ? $data['speaker_title']
                : (($promise && $promise->speaker_id === $speaker->id) ? $promise->speaker_title : $speaker->title);

            $attributes = [
                'title' => $data['title'],
                'summary' => $data['summary'] ?? null,
                'quote' => $data['quote'],
                'quote_is_verbatim' => (bool) ($data['quote_is_verbatim'] ?? true),
                'speaker_id' => $speaker->id,
                'speaker_title' => $speakerTitle,
                'institution_id' => $data['institution_id'] ?? null,
                'sector_id' => $data['sector_id'] ?? null,
                'is_national' => (bool) ($data['is_national'] ?? true),
                'statement_date' => $data['statement_date'],
                'statement_venue' => $data['statement_venue'],
                'deadline_wording' => $data['deadline_wording'] ?? null,
                'deadline_date' => $data['deadline_date'] ?? null,
                'deadline_reasoning' => $data['deadline_reasoning'] ?? null,
                'target_value' => $data['target_value'] ?? null,
                'target_unit' => $data['target_unit'] ?? null,
                'baseline_value' => $data['baseline_value'] ?? null,
                'baseline_note' => $data['baseline_note'] ?? null,
                'restates_promise_id' => $restatesId,
            ];

            $linkChanged = $promise === null || $promise->restates_promise_id !== $restatesId;

            if ($promise === null) {
                $promise = Promise::create($attributes + [
                    'status' => 'pending',
                    'review_status' => 'pending',
                    'origin' => $data['origin'] ?? 'editor',
                    'submitted_by' => $actor?->id,
                ]);
            } else {
                $promise->update($attributes);
            }

            $this->syncGovernorates($promise, $attributes['is_national'] ? [] : ($data['governorates'] ?? []));
            $this->syncTags($promise, $data['tags'] ?? []);

            if (array_key_exists('sources', $data)) {
                $this->syncSources($promise, $data['sources']);
            }

            if (array_key_exists('co_speakers', $data)) {
                $this->syncCoSpeakers($promise, (array) ($data['co_speakers'] ?? []), $speaker->id);
            }

            if (array_key_exists('related_promise_ids', $data)) {
                $this->syncRelatedPromises($promise, (array) ($data['related_promise_ids'] ?? []));
            }

            // Also moves updated_at, which the detail page and sitemap read.
            $promise->increment('version');

            if ($linkChanged && $promise->review_status === 'published') {
                $this->postponeRestatedOriginal($promise->fresh(), $actor, $mayRule);
            }

            return $promise->fresh();
        });
    }

    /**
     * Save only if the promise is still the version the caller read.
     *
     * @param  array<string, mixed>  $data  validated input
     */
    public function saveIfUnchanged(Promise $promise, int $readVersion, array $data, ?User $actor = null, bool $mayRule = false): Promise
    {
        return DB::transaction(function () use ($promise, $readVersion, $data, $actor, $mayRule) {
            $current = Promise::query()->lockForUpdate()->find($promise->id)
                ?? throw PromiseActionException::notFound();

            if ($current->version !== $readVersion) {
                throw PromiseActionException::staleEdit($current->version);
            }

            return $this->save($current, $data, $actor, $mayRule);
        });
    }

    /**
     * Change the editorial status and log it publicly with its source.
     *
     * @param  array{happened_on: string, body?: string|null, source_url?: string|null, archive_url?: string|null}  $entry
     */
    public function changeStatus(Promise $promise, string $to, array $entry, ?User $actor = null): Promise
    {
        if (blank($entry['source_url'] ?? null)) {
            throw PromiseActionException::sourceRequired();
        }

        return DB::transaction(function () use ($promise, $to, $entry, $actor) {
            $promise = Promise::query()->lockForUpdate()->find($promise->id)
                ?? throw PromiseActionException::notFound();

            if ($promise->status === $to) {
                throw PromiseActionException::sameStatus();
            }

            $earliest = $this->earliestStatusDate($promise);
            if ($entry['happened_on'] < $earliest) {
                throw PromiseActionException::dateOutOfOrder($earliest);
            }

            $from = $promise->status;

            $promise->update([
                'status' => $to,
                'resolved_at' => in_array($to, Promise::CLOSED_STATUSES, true) ? $entry['happened_on'] : null,
            ]);

            $promise->updates()->create([
                'type' => 'status_change',
                'happened_on' => $entry['happened_on'],
                'body' => $entry['body'] ?? null,
                'status_from' => $from,
                'status_to' => $to,
                'source_url' => $entry['source_url'],
                'archive_url' => $entry['archive_url'] ?? null,
                'created_by' => $actor?->id,
            ]);

            return $promise->fresh();
        });
    }

    /**
     * Revise a deadline in place and record the revision in the change log.
     *
     * @param  array<string, mixed>  $data
     */
    public function rescheduleDeadline(Promise $promise, array $data, ?User $actor = null): Promise
    {
        return DB::transaction(function () use ($promise, $data, $actor) {
            $locked = Promise::lockForUpdate()->findOrFail($promise->id);

            $oldDate = $locked->deadline_date?->format('Y-m-d');
            $oldWording = $locked->deadline_wording;

            if ($locked->original_deadline_date === null && $locked->deadline_date !== null) {
                $locked->original_deadline_date = $locked->deadline_date;
                $locked->original_deadline_wording = $locked->deadline_wording;
            }

            $locked->postponed_count = ((int) $locked->postponed_count) + 1;

            $locked->deadline_date = $data['deadline_date'];
            if (array_key_exists('deadline_wording', $data) && $data['deadline_wording'] !== null) {
                $locked->deadline_wording = $data['deadline_wording'];
            }
            if (array_key_exists('deadline_reasoning', $data) && $data['deadline_reasoning'] !== null) {
                $locked->deadline_reasoning = $data['deadline_reasoning'];
            }

            if ($locked->status === 'postponed') {
                $locked->status = 'pending';
                $locked->resolved_at = null;
            }

            $locked->save();

            $body = ($data['body'] ?? null) ?: ($oldDate ? "تأجّل موعد الوعد من {$oldDate} إلى {$data['deadline_date']}" : "حُدّد موعد جديد للوعد: {$data['deadline_date']}");

            $locked->updates()->create([
                'type' => 'deadline_change',
                'happened_on' => $data['happened_on'],
                'source_url' => $data['source_url'],
                'archive_url' => $data['archive_url'] ?? null,
                'created_by' => $actor?->id,
                'body' => $body,
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Add a progress reading, an official response or a note.
     *
     * @param  array<string, mixed>  $data
     */
    public function addUpdate(Promise $promise, array $data, ?User $actor = null): PromiseUpdate
    {
        if (in_array($data['type'], PromiseUpdate::SOURCED_TYPES, true) && blank($data['source_url'] ?? null)) {
            throw PromiseActionException::sourceRequired();
        }

        $statement = $promise->statement_date->format('Y-m-d');
        if ($data['happened_on'] < $statement) {
            throw PromiseActionException::dateOutOfOrder($statement);
        }

        $update = $promise->updates()->create([
            'type' => $data['type'],
            'happened_on' => $data['happened_on'],
            'body' => $data['body'] ?? null,
            'value' => $data['type'] === 'progress' ? ($data['value'] ?? null) : null,
            'source_url' => $data['source_url'] ?? null,
            'archive_url' => $data['archive_url'] ?? null,
            'created_by' => $actor?->id,
        ]);
        $promise->touch();

        return $update;
    }

    public function removeUpdate(Promise $promise, int $updateId): void
    {
        $update = $promise->updates()->whereKey($updateId)->first()
            ?? throw PromiseActionException::notFound('البند');

        if ($update->type === 'status_change') {
            throw PromiseActionException::logIsPermanent();
        }

        $update->delete();
        $promise->touch();
    }

    /**
     * Undo the latest status change of a promise that has never been public;
     * the promise falls back to the previous verdict.
     */
    public function undoStatusChange(Promise $promise, int $updateId): Promise
    {
        return DB::transaction(function () use ($promise, $updateId) {
            $promise = Promise::query()->lockForUpdate()->find($promise->id)
                ?? throw PromiseActionException::notFound();

            if ($promise->published_at !== null) {
                throw PromiseActionException::logIsPermanent();
            }

            $latest = $this->statusChanges($promise)->first();

            if ($latest === null || $latest->id !== $updateId) {
                throw PromiseActionException::onlyLatestStatus();
            }

            $latest->delete();

            $previous = $this->statusChanges($promise)->first();
            $status = $previous?->status_to ?? ($latest->status_from ?: 'pending');

            $promise->update([
                'status' => $status,
                'resolved_at' => $previous && in_array($status, Promise::CLOSED_STATUSES, true)
                    ? $previous->happened_on
                    : null,
            ]);

            return $promise->fresh();
        });
    }

    /**
     * When a published promise restates an earlier, still-open one, the
     * earlier one is marked postponed with a public log entry pointing here.
     * That is a verdict, so it only happens when the actor may rule; for
     * anyone else the link is kept and the original waits for a ruler.
     */
    public function postponeRestatedOriginal(Promise $promise, ?User $actor, bool $mayRule): void
    {
        if (! $mayRule) {
            return;
        }

        $original = $promise->restates;
        if ($original === null || ! $original->isOpen() || $promise->review_status !== 'published') {
            return;
        }

        $source = $promise->sources()->first();
        $happenedOn = max($promise->statement_date->format('Y-m-d'), $this->earliestStatusDate($original));

        $this->changeStatus($original, 'postponed', [
            'happened_on' => $happenedOn,
            'body' => "أُعيد الإعلان عن الوعد بموعد جديد في الوعد رقم {$promise->number}",
            'source_url' => $source?->url ?? url('/promises/'.$promise->number),
            'archive_url' => $source?->archive_url,
        ], $actor);
    }

    public function delete(Promise $promise): void
    {
        $promise->delete();
    }

    /** The earliest date a new status change may carry. */
    private function earliestStatusDate(Promise $promise): string
    {
        $latest = $this->statusChanges($promise)->value('happened_on');

        return max($promise->statement_date->format('Y-m-d'), $latest ? substr((string) $latest, 0, 10) : '');
    }

    /** Status changes, latest first (log order: date, then insertion). */
    private function statusChanges(Promise $promise): HasMany
    {
        return $promise->updates()
            ->where('type', 'status_change')
            ->reorder()
            ->orderByDesc('happened_on')
            ->orderByDesc('id');
    }

    /**
     * A promise may only restate a published, live promise other than itself,
     * and never one that already restates it.
     */
    private function assertRestatable(?Promise $promise, string $targetId): void
    {
        $target = Promise::published()->find($targetId);

        if ($target === null
            || ($promise && ($target->id === $promise->id || $target->restates_promise_id === $promise->id))) {
            throw PromiseActionException::badRestatement();
        }
    }

    /**
     * @param  array<int, string>  $slugs
     */
    private function syncGovernorates(Promise $promise, array $slugs): void
    {
        $slugs = array_values(array_unique(array_intersect($slugs, Governorates::slugs())));

        PromiseGovernorate::where('promise_id', $promise->id)->delete();
        if ($slugs !== []) {
            PromiseGovernorate::insert(array_map(
                fn (string $slug) => ['promise_id' => $promise->id, 'governorate' => $slug],
                $slugs,
            ));
        }

        // A promise scoped to no governorate is national by definition.
        if ($slugs === [] && ! $promise->is_national) {
            $promise->update(['is_national' => true]);
        }
    }

    /**
     * Replace the tags. Duplicates are dropped by a folded key that matches how
     * the database collation compares them (case, diacritics, hamza forms),
     * keeping the first spelling given.
     *
     * @param  array<int, string>  $tags
     */
    private function syncTags(Promise $promise, array $tags): void
    {
        $tags = collect($tags)
            ->map(fn ($t) => mb_substr(trim(ltrim((string) $t, '#')), 0, 64))
            ->filter()
            ->unique(fn (string $t) => mb_strtolower(SpeakerDirectory::normalizeName($t)))
            ->values();

        PromiseTag::where('promise_id', $promise->id)->delete();
        if ($tags->isNotEmpty()) {
            PromiseTag::insert($tags->map(
                fn (string $tag) => ['promise_id' => $promise->id, 'tag' => $tag],
            )->all());
        }
    }

    /**
     * Replace the sources. The first source is primary unless one is marked.
     *
     * @param  array<int, array<string, mixed>>  $sources
     */
    private function syncSources(Promise $promise, array $sources): void
    {
        $promise->sources()->delete();

        $hasPrimary = collect($sources)->contains(fn ($s) => (bool) ($s['is_primary'] ?? false));

        foreach (array_values($sources) as $i => $source) {
            PromiseSource::create([
                'promise_id' => $promise->id,
                'url' => $source['url'],
                'outlet' => $source['outlet'] ?? null,
                'type' => $source['type'] ?? 'news_article',
                'published_date' => $source['published_date'] ?? null,
                'language' => $source['language'] ?? null,
                'archive_url' => $source['archive_url'] ?? null,
                'screenshot_url' => $source['screenshot_url'] ?? null,
                'video_timestamp' => $source['video_timestamp'] ?? null,
                'is_primary' => $hasPrimary ? (bool) ($source['is_primary'] ?? false) : $i === 0,
                'sort' => $i,
            ]);
        }
    }

    /**
     * Sync bidirectional related promises using canonical pairs [min, max].
     *
     * @param  array<int, string>  $relatedIds
     */
    private function syncRelatedPromises(Promise $promise, array $relatedIds): void
    {
        DB::table('promise_relations')
            ->where('promise_id', $promise->id)
            ->orWhere('related_promise_id', $promise->id)
            ->delete();

        $pairs = [];
        $uniqueIds = array_values(array_unique(array_filter($relatedIds)));
        foreach ($uniqueIds as $otherId) {
            if ($otherId === $promise->id) {
                continue;
            }

            $pairs[] = [
                'promise_id' => min($promise->id, $otherId),
                'related_promise_id' => max($promise->id, $otherId),
                'relation_type' => 'related',
            ];
        }

        if ($pairs !== []) {
            DB::table('promise_relations')->insertOrIgnore($pairs);
        }
    }

    /**
     * Replace co-speakers on a joint promise.
     *
     * @param  array<int, array<string, mixed>>  $coSpeakers
     */
    private function syncCoSpeakers(Promise $promise, array $coSpeakers, string $primarySpeakerId): void
    {
        $promise->coSpeakerRows()->delete();

        $seen = [$primarySpeakerId => true];
        $sort = 0;

        foreach (array_values($coSpeakers) as $item) {
            $ref = trim((string) ($item['speaker_ref'] ?? ''));
            if ($ref === '') {
                continue;
            }

            $coSpeaker = $this->speakers->resolve($ref, forStaff: true);
            if ($promise->published_at && $coSpeaker->status !== 'approved') {
                throw PromiseActionException::speakerNotApproved();
            }

            if (isset($seen[$coSpeaker->id])) {
                continue;
            }
            $seen[$coSpeaker->id] = true;

            $title = filled($item['speaker_title'] ?? null)
                ? (string) $item['speaker_title']
                : $coSpeaker->title;

            PromiseCoSpeaker::create([
                'promise_id' => $promise->id,
                'speaker_id' => $coSpeaker->id,
                'speaker_title' => $title,
                'sort' => $sort++,
            ]);
        }
    }
}
