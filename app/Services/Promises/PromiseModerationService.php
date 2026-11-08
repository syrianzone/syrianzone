<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The review queue, transport-free: publishing promises, approving people
 * proposed by the public, and resolving reports on published promises.
 *
 * Rules that must not be relaxed:
 *  - Pending speakers and reports are approved or rejected once; a promise
 *    that is not public (pending or rejected) can be published.
 *  - A promise gets its public number when first published, under a row lock,
 *    so concurrent publishes cannot renumber it and rejected suggestions never
 *    leave gaps. Unpublishing keeps the number.
 *  - A promise is published only with at least one source and an approved
 *    speaker. A pending speaker proposed alongside it is approved with it,
 *    since the reviewer has just looked at both; a rejected one blocks it.
 *  - Publishing a restatement marks the still-open original `postponed`.
 */
class PromiseModerationService
{
    public function __construct(private readonly PromiseEditor $editor) {}

    public function publish(Promise $promise, User $reviewer): Promise
    {
        return DB::transaction(function () use ($promise, $reviewer) {
            $promise = Promise::query()->lockForUpdate()->findOrFail($promise->id);

            if ($promise->review_status === 'published') {
                throw PromiseActionException::alreadyPublished();
            }
            if (! $promise->sources()->exists()) {
                throw PromiseActionException::promiseNeedsSource();
            }

            $speaker = $promise->speaker;
            if ($speaker === null || $speaker->status === 'rejected') {
                throw PromiseActionException::speakerNotApproved();
            }
            if ($speaker->status === 'pending') {
                $this->approveSpeaker($speaker, $reviewer);
            }

            $number = $promise->number
                ?? ((int) Promise::withTrashed()->lockForUpdate()->max('number')) + 1;

            $promise->update([
                'number' => $number,
                'review_status' => 'published',
                'published_at' => $promise->published_at ?? now(),
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'rejection_reason' => null,
            ]);

            $this->editor->postponeRestatedOriginal($promise->fresh(), $reviewer);

            return $promise->fresh();
        });
    }

    /** Take a published promise off the public site. It keeps its number. */
    public function unpublish(Promise $promise, User $reviewer): Promise
    {
        if ($promise->review_status !== 'published') {
            throw PromiseActionException::notPublished();
        }

        $promise->update([
            'review_status' => 'pending',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        return $promise->fresh();
    }

    public function reject(Promise $promise, User $reviewer, ?string $reason = null): Promise
    {
        if ($promise->review_status !== 'pending') {
            throw PromiseActionException::notPending($promise->review_status);
        }

        $promise->update([
            'review_status' => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        return $promise->fresh();
    }

    public function approveSpeaker(PromiseSpeaker $speaker, User $reviewer): PromiseSpeaker
    {
        if ($speaker->status !== 'pending') {
            throw PromiseActionException::notPending($speaker->status);
        }

        $speaker->update([
            'status' => 'approved',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'rejection_reason' => null,
        ]);

        return $speaker;
    }

    public function rejectSpeaker(PromiseSpeaker $speaker, User $reviewer, ?string $reason = null): PromiseSpeaker
    {
        if ($speaker->status !== 'pending') {
            throw PromiseActionException::notPending($speaker->status);
        }
        if ($speaker->promises()->where('review_status', 'published')->exists()) {
            throw PromiseActionException::speakerHasPublishedPromises();
        }

        $speaker->update([
            'status' => 'rejected',
            'rejection_reason' => $reason,
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
        ]);

        return $speaker;
    }

    /**
     * Accept a report. An accepted progress report becomes a public log entry
     * carrying the reporter's source; an accepted error report is closed and
     * the editor fixes the promise itself.
     */
    public function acceptReport(PromiseReport $report, User $reviewer, ?string $note = null): PromiseReport
    {
        if ($report->status !== 'pending') {
            throw PromiseActionException::notPending($report->status);
        }

        $promise = $report->promise ?? throw PromiseActionException::notFound();

        return DB::transaction(function () use ($report, $promise, $reviewer, $note) {
            if ($report->kind === 'progress') {
                $this->editor->addUpdate($promise, [
                    'type' => $report->source_url ? 'progress' : 'note',
                    'happened_on' => $report->created_at->timezone(Promise::TIMEZONE)->format('Y-m-d'),
                    'body' => $note ?: $report->body,
                    'source_url' => $report->source_url,
                ], $reviewer);
            }

            $report->update([
                'status' => 'accepted',
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'resolution_note' => $note,
            ]);

            return $report;
        });
    }

    public function dismissReport(PromiseReport $report, User $reviewer, ?string $note = null): PromiseReport
    {
        if ($report->status !== 'pending') {
            throw PromiseActionException::notPending($report->status);
        }

        $report->update([
            'status' => 'dismissed',
            'reviewed_by' => $reviewer->id,
            'reviewed_at' => now(),
            'resolution_note' => $note,
        ]);

        return $report;
    }
}
