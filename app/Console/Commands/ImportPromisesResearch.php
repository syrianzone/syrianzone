<?php

namespace App\Console\Commands;

use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Models\PromiseSource;
use App\Models\PromiseSpeaker;
use App\Services\Promises\PromiseEditor;
use App\Services\Promises\SpeakerDirectory;
use App\Support\Governorates;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Load a researched promises dataset into the review queue.
 *
 * Everything lands UNPUBLISHED (`review_status = pending`, `origin =
 * research`): an editor checks every source and publishes each promise by
 * hand. The researcher's confidence, caveats and unverified links are written
 * into the submitter note the editor sees in the admin.
 *
 * Idempotent: a promise with the same title and statement date is skipped.
 */
class ImportPromisesResearch extends Command
{
    protected $signature = 'promises:import-research
        {path? : JSON file (defaults to database/seeders/data/promises-research.json)}
        {--dry-run : Show what would be imported without writing}';

    protected $description = 'Import researched promises into the review queue as unpublished drafts';

    private SpeakerDirectory $directory;

    public function handle(PromiseEditor $editor, SpeakerDirectory $directory): int
    {
        $this->directory = $directory;
        $path = $this->argument('path') ?: database_path('seeders/data/promises-research.json');

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $items = json_decode((string) file_get_contents($path), true);
        if (! is_array($items)) {
            $this->error('The file is not a JSON array.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $rows = [];
        $failed = 0;

        foreach ($items as $i => $item) {
            $title = mb_substr(trim((string) ($item['title_ar'] ?? '')), 0, 200);

            if ($title === '' || empty($item['statement_date']) || empty($item['speaker_name_ar'])) {
                $rows[] = [$i + 1, $title ?: '—', 'skipped: missing title, date or speaker'];

                continue;
            }

            $exists = Promise::withTrashed()
                ->where('title', $title)
                ->whereDate('statement_date', $item['statement_date'])
                ->exists();
            if ($exists) {
                $rows[] = [$i + 1, $title, 'skipped: already imported'];

                continue;
            }

            DB::beginTransaction();
            try {
                $notes = [];
                $promise = $editor->save(null, [
                    'speaker_ref' => $this->speakerRef($item),
                    'speaker_title' => $item['speaker_title_ar'] ?? null,
                    'title' => $title,
                    'summary' => $item['summary_ar'] ?? null,
                    'quote' => (string) ($item['quote'] ?? ''),
                    'quote_is_verbatim' => (bool) ($item['quote_is_verbatim'] ?? false),
                    'institution_id' => $this->institutionId($item['institution_ar'] ?? null, $notes),
                    'sector_id' => PromiseSector::whereKey($item['sector'] ?? '')->exists() ? $item['sector'] : 'other',
                    'is_national' => in_array('national', $item['governorates'] ?? ['national'], true),
                    'governorates' => $this->governorates($item['governorates'] ?? []),
                    'tags' => array_slice($item['tags_ar'] ?? [], 0, 10),
                    'statement_date' => $item['statement_date'],
                    'statement_venue' => in_array($item['statement_venue'] ?? '', Promise::VENUES, true) ? $item['statement_venue'] : 'other',
                    'deadline_wording' => $item['deadline_wording_ar'] ?? null,
                    'deadline_date' => $item['deadline_date'] ?? null,
                    'deadline_reasoning' => $item['deadline_reasoning'] ?? null,
                    'target_value' => $item['target']['value'] ?? null,
                    'target_unit' => $item['target']['unit_ar'] ?? null,
                    'baseline_value' => $item['target']['baseline'] ?? null,
                    'baseline_note' => isset($item['target']['baseline_note']) ? mb_substr($item['target']['baseline_note'], 0, 255) : null,
                    'origin' => 'research',
                    'sources' => $this->sources($item['sources'] ?? []),
                ]);

                $statusNote = $this->applyEvidence($editor, $promise, $item);

                $promise->update(['submitter_note' => $this->editorNote($item, $notes, $statusNote)]);

                $status = $promise->fresh()->status;
                $dryRun ? DB::rollBack() : DB::commit();
                $rows[] = [$i + 1, $title, ($dryRun ? 'would import' : 'imported').' · '.$status];
            } catch (\Throwable $e) {
                DB::rollBack();
                $failed++;
                $rows[] = [$i + 1, $title, 'failed: '.$e->getMessage()];
            }
        }

        if (! $dryRun && ! $this->argument('path')) {
            $this->directory->syncKnownPeople();
        }

        $this->table(['#', 'Title', 'Result'], $rows);

        if ($failed > 0) {
            $this->error("{$failed} of ".count($items).' rows failed; the others were '.($dryRun ? 'checked' : 'imported').'.');

            return self::FAILURE;
        }

        $this->info($dryRun
            ? 'Dry run: nothing was written.'
            : 'Done. Imported promises are unpublished; review them at /admin/promises/review.');

        return self::SUCCESS;
    }

    /**
     * Link to a person the site already knows when the name matches;
     * otherwise propose a new speaker for the editor to approve.
     *
     * @param  array<string, mixed>  $item
     */
    private function speakerRef(array $item): string
    {
        $name = trim((string) $item['speaker_name_ar']);

        if ($ref = $this->directory->findExisting($name)) {
            $speaker = $this->directory->resolve($ref, forStaff: true);

            // Directory names often carry the title ("وزير الطاقة محمد البشير").
            // A speaker row created by this link takes the bare researched name;
            // its title is snapshotted per promise anyway.
            if ($speaker->wasRecentlyCreated && $speaker->name !== $name) {
                $speaker->update(['name' => $name]);
            }

            return $speaker->ref();
        }

        $speaker = PromiseSpeaker::create([
            'name' => $name,
            'title' => $item['speaker_title_ar'] ?? null,
            'status' => 'pending',
        ]);

        return $speaker->ref();
    }

    /**
     * Match the researcher's institution text to an officials-directory body.
     *
     * @param  array<int, string>  $notes
     */
    private function institutionId(?string $text, array &$notes): ?string
    {
        if (! $text) {
            return null;
        }

        $candidates = array_unique(array_filter([
            trim($text),
            trim(preg_split('/[(\/]/u', $text)[0] ?? ''),
        ]));

        foreach ($candidates as $name) {
            $entity = OfficialEntity::query()
                ->whereNotIn('category_id', SpeakerDirectory::PEOPLE_CATEGORIES)
                ->where('name_ar', $name)
                ->first();
            if ($entity) {
                return $entity->id;
            }
        }

        $notes[] = "الجهة كما وردت في البحث: {$text} (لم تُطابَق مع دليل الحسابات الرسمية)";

        return null;
    }

    /**
     * @param  array<int, string>  $names
     * @return array<int, string>
     */
    private function governorates(array $names): array
    {
        return array_values(array_filter(array_map(
            fn ($n) => $n === 'national' ? null : Governorates::fromArabic((string) $n),
            $names,
        )));
    }

    /**
     * @param  array<int, array<string, mixed>>  $sources
     * @return array<int, array<string, mixed>>
     */
    private function sources(array $sources): array
    {
        $sources = array_values(array_filter($sources, fn ($s) => $this->webUrl($s['url'] ?? null) !== null));

        return array_map(fn (array $s, int $i) => [
            'url' => $s['url'],
            'outlet' => $s['outlet'] ?? null,
            'type' => in_array($s['type'] ?? '', PromiseSource::TYPES, true) ? $s['type'] : 'news_article',
            'published_date' => $s['published_date'] ?? null,
            'language' => in_array($s['language'] ?? '', ['ar', 'en'], true) ? $s['language'] : 'other',
            'archive_url' => $this->webUrl($s['archive_url'] ?? null),
            'is_primary' => $i === 0,
        ], $sources, array_keys($sources));
    }

    /**
     * Turn the researcher's status evidence into change-log entries.
     *
     * The verdict is set only from the evidence item the researcher marked
     * `supports_verdict`; it is never inferred from an item's position. It is
     * dated by that item's `event_date` when given, otherwise by its
     * publication date (and the editor note asks for the real date). Every
     * other item becomes a sourced note. Without a marked item the promise
     * stays pending; an overdue one shows as overdue on its own.
     *
     * @param  array<string, mixed>  $item
     */
    private function applyEvidence(PromiseEditor $editor, Promise $promise, array $item): ?string
    {
        $evidence = collect($item['status_evidence'] ?? [])
            ->filter(fn ($e) => ! empty($e['date']) && $this->webUrl($e['url'] ?? null) !== null)
            ->sortBy('date')
            ->values();

        $status = (string) ($item['status_assessment'] ?? 'pending');
        $settable = in_array($status, Promise::STATUSES, true) && $status !== 'pending';
        $verdict = $settable ? $evidence->first(fn ($e) => (bool) ($e['supports_verdict'] ?? false)) : null;
        $today = Promise::today()->format('Y-m-d');

        foreach ($evidence as $e) {
            if ($verdict && $e === $verdict) {
                continue;
            }
            $editor->addUpdate($promise, [
                'type' => 'note',
                'happened_on' => min($e['date'], $today),
                'body' => $e['note_ar'] ?? null,
                'source_url' => $e['url'],
            ]);
        }

        if ($verdict) {
            $date = min($verdict['event_date'] ?? $verdict['date'], $today);
            $editor->changeStatus($promise, $status, [
                'happened_on' => $date,
                'body' => $verdict['note_ar'] ?? null,
                'source_url' => $verdict['url'],
            ]);

            return isset($verdict['event_date'])
                ? null
                : "تاريخ الحالة ({$date}) هو تاريخ نشر الدليل لا تاريخ الحدث: تحقق منه، وللتصحيح تراجع عن تغيير الحالة في السجل وأعد تسجيله بالتاريخ الصحيح قبل النشر.";
        }

        return $settable ? "التقييم المقترح: {$status} (لم يُحدَّد الدليل الذي يثبته، فلم تُغيَّر الحالة)" : null;
    }

    /**
     * The URL when it is an http(s) web address, otherwise null. Paths may be
     * Arabic, so this checks the scheme and shape rather than FILTER_VALIDATE_URL.
     */
    private function webUrl(mixed $url): ?string
    {
        return is_string($url) && preg_match('#^https?://[^\s/$.?\#][^\s]*$#iu', $url) ? $url : null;
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<int, string>  $notes
     */
    private function editorNote(array $item, array $notes, ?string $statusNote): string
    {
        $lines = ['بحث أولي — درجة الثقة: '.($item['confidence'] ?? 'غير محددة')];

        if (! empty($item['notes'])) {
            $lines[] = 'ملاحظات الباحث: '.$item['notes'];
        }
        if (! ($item['quote_is_verbatim'] ?? false)) {
            $lines[] = 'الاقتباس ليس حرفياً: استبدله بالنص الأصلي من المصدر قبل النشر.';
        }

        $unverified = collect($item['sources'] ?? [])
            ->merge($item['status_evidence'] ?? [])
            ->filter(fn ($s) => ! empty($s['url']) && ! ($s['verified'] ?? false))
            ->pluck('url')
            ->all();
        if ($unverified !== []) {
            $lines[] = 'روابط لم يتمكن الباحث من فتحها: '.implode(' ، ', $unverified);
        }

        if ($statusNote) {
            $lines[] = $statusNote;
        }

        return implode("\n", array_merge($lines, $notes));
    }
}
