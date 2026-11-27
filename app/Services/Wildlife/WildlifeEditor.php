<?php

namespace App\Services\Wildlife;

use App\Exceptions\Wildlife\WildlifeActionException;
use App\Models\User;
use App\Models\WildlifeSpecies;
use App\Services\IndexNow\IndexNow;
use Illuminate\Support\Facades\DB;

/**
 * Every change to the wildlife guide's species, for the MCP tools and any
 * later dashboard alike (docs/modules/wildlife.md, "Editing without a pull
 * request").
 *
 * The lifecycle keeps the guide's review rule: an edit is only ever written to
 * `draft`, and only publish() (behind `wildlife.publish`) copies a draft to the
 * public `record`. A published species can carry a pending draft while the
 * public page keeps showing the reviewed version.
 *
 * Every write bumps `version` under a row lock. A write that names the version
 * it read is refused when someone else wrote in between, so an agent and a
 * human cannot silently overwrite each other's work.
 */
final class WildlifeEditor
{
    public function __construct(
        private readonly WildlifeRules $rules,
        private readonly WildlifeData $data,
        private readonly IndexNow $indexNow,
    ) {}

    /**
     * A new species, as a draft that is not on the public site until published.
     *
     * @param  array<string, mixed>  $record
     */
    public function create(array $record, ?User $by, ?string $afterSlug = null): WildlifeSpecies
    {
        $this->assertValid($record);
        $slug = (string) $record['slug'];

        return DB::transaction(function () use ($record, $by, $afterSlug, $slug) {
            if (WildlifeSpecies::where('slug', $slug)->lockForUpdate()->exists()) {
                throw WildlifeActionException::slugTaken($slug);
            }

            $position = $afterSlug === null
                ? ((int) WildlifeSpecies::max('position')) + 1
                : $this->openSlotAfter($afterSlug);

            return WildlifeSpecies::create([
                'slug' => $slug,
                'position' => $position,
                'draft' => $record,
                'is_hidden' => false,
                'version' => 1,
                'draft_updated_by' => $by?->id,
                'draft_updated_at' => now(),
            ]);
        });
    }

    /**
     * Replace the species' draft with a whole new record. The public page is
     * unchanged until the draft is published.
     *
     * @param  array<string, mixed>  $record
     */
    public function saveDraft(string $slug, array $record, int $expectedVersion, ?User $by): WildlifeSpecies
    {
        if (($record['slug'] ?? null) !== $slug) {
            throw WildlifeActionException::slugChanged($slug);
        }
        $this->assertValid($record);

        return $this->write($slug, $expectedVersion, function (WildlifeSpecies $species) use ($record, $by) {
            $species->draft = $this->withMirroredPhoto($record, $species->record);
            $species->draft_updated_by = $by?->id;
            $species->draft_updated_at = now();
        });
    }

    /**
     * An agent writes a record from what it read, so a draft of an already
     * mirrored photo often arrives with `r2Key: null` (it read the record
     * before the mirror ran, or did not copy the key). The key belongs to the
     * file, not to the edit: carry it over whenever the draft shows the same
     * Commons file as the published record, so publishing never drops a
     * working mirror.
     *
     * @param  array<string, mixed>  $draft
     * @param  array<string, mixed>|null  $published
     * @return array<string, mixed>
     */
    private function withMirroredPhoto(array $draft, ?array $published): array
    {
        $key = $published['image']['r2Key'] ?? null;
        if (is_string($key) && $key !== ''
            && ($draft['image']['r2Key'] ?? null) === null
            && ($draft['image']['commonsFile'] ?? null) === ($published['image']['commonsFile'] ?? null)) {
            $draft['image']['r2Key'] = $key;
        }

        return $draft;
    }

    /** Drop the pending draft; the published record, if any, is untouched. */
    public function discardDraft(string $slug, int $expectedVersion): WildlifeSpecies
    {
        return $this->write($slug, $expectedVersion, function (WildlifeSpecies $species) {
            $species->draft = null;
            $species->draft_updated_by = null;
            $species->draft_updated_at = null;
        });
    }

    /**
     * Make the species public: its draft becomes the published record, or a
     * hidden species with no draft is shown again. The draft is checked
     * against the rules once more, in case they changed since it was saved.
     */
    public function publish(string $slug, int $expectedVersion, ?User $by): WildlifeSpecies
    {
        return $this->announced($slug, $this->write($slug, $expectedVersion, function (WildlifeSpecies $species) use ($slug, $by) {
            if ($species->draft === null && $species->isPublic()) {
                throw WildlifeActionException::nothingToPublish($slug);
            }
            if ($species->draft === null && $species->record === null) {
                throw WildlifeActionException::nothingToPublish($slug);
            }

            if ($species->draft !== null) {
                $this->assertValid($species->draft);
                $species->record = $this->withMirroredPhoto($species->draft, $species->record);
                $species->draft = null;
                $species->draft_updated_by = null;
                $species->draft_updated_at = null;
            }
            $species->is_hidden = false;
            $species->published_by = $by?->id;
            $species->published_at = now();
        }));
    }

    /** Take a species off the public site, keeping its record and any draft. */
    public function unpublish(string $slug, int $expectedVersion): WildlifeSpecies
    {
        return $this->announced($slug, $this->write($slug, $expectedVersion, function (WildlifeSpecies $species) use ($slug) {
            if (! $species->isPublic()) {
                throw WildlifeActionException::notPublic($slug);
            }
            $species->is_hidden = true;
        }));
    }

    /** Place the species right after another one in the guide's order, or first when $afterSlug is null. */
    public function move(string $slug, ?string $afterSlug, int $expectedVersion): WildlifeSpecies
    {
        return DB::transaction(function () use ($slug, $afterSlug, $expectedVersion) {
            $species = $this->lockedOrFail($slug, $expectedVersion);
            $species->position = $afterSlug === null ? $this->openSlotFirst() : $this->openSlotAfter($afterSlug, $slug);
            $species->version++;
            $species->save();
            $this->data->forget();

            return $species;
        });
    }

    /** Remove the species for good, published record and draft alike. */
    public function delete(string $slug, int $expectedVersion): void
    {
        DB::transaction(function () use ($slug, $expectedVersion) {
            $this->lockedOrFail($slug, $expectedVersion)->delete();
        });
        $this->data->forget();
        $this->announced($slug, null);
    }

    /**
     * Tell search engines the public page and the hub changed, after commit.
     *
     * @template T
     *
     * @param  T  $result
     * @return T
     */
    private function announced(string $slug, mixed $result): mixed
    {
        $this->indexNow->queue(['/wild/'.$slug, '/wild']);

        return $result;
    }

    /**
     * Record that the species' photo now lives on R2 (`wildlife:mirror-images`).
     * Written into the published record and into a draft showing the same
     * file, so publishing the draft does not drop the key. A housekeeping write
     * by the system, so it needs no version and no review. Returns whether
     * anything changed.
     */
    public function recordMirroredPhoto(string $slug, string $commonsFile, string $r2Key): bool
    {
        $changed = DB::transaction(function () use ($slug, $commonsFile, $r2Key) {
            $species = WildlifeSpecies::where('slug', $slug)->lockForUpdate()->first();
            if ($species === null) {
                throw WildlifeActionException::notFound($slug);
            }
            $changed = false;
            foreach (['record', 'draft'] as $column) {
                $value = $species->{$column};
                if (is_array($value) && ($value['image']['commonsFile'] ?? null) === $commonsFile
                    && ($value['image']['r2Key'] ?? null) !== $r2Key) {
                    $value['image']['r2Key'] = $r2Key;
                    $species->{$column} = $value;
                    $changed = true;
                }
            }
            // Only a real change bumps the version, so a repeated run does not
            // make every agent's last read stale.
            if ($changed) {
                $species->version++;
                $species->save();
            }

            return $changed;
        });
        if ($changed) {
            $this->data->forget();
        }

        return $changed;
    }

    /**
     * @param  callable(WildlifeSpecies): void  $change
     */
    private function write(string $slug, int $expectedVersion, callable $change): WildlifeSpecies
    {
        $species = DB::transaction(function () use ($slug, $expectedVersion, $change) {
            $species = $this->lockedOrFail($slug, $expectedVersion);
            $change($species);
            $species->version++;
            $species->save();

            return $species;
        });
        $this->data->forget();

        return $species;
    }

    private function lockedOrFail(string $slug, int $expectedVersion): WildlifeSpecies
    {
        $species = WildlifeSpecies::where('slug', $slug)->lockForUpdate()->first();
        if ($species === null) {
            throw WildlifeActionException::notFound($slug);
        }
        if ($species->version !== $expectedVersion) {
            throw WildlifeActionException::stale($slug, $expectedVersion, $species->version);
        }

        return $species;
    }

    /** Shift everything after $afterSlug down one place and return the freed position. */
    private function openSlotAfter(string $afterSlug, ?string $moving = null): int
    {
        $anchor = WildlifeSpecies::where('slug', $afterSlug)->lockForUpdate()->first();
        if ($anchor === null) {
            throw WildlifeActionException::notFound($afterSlug);
        }
        WildlifeSpecies::where('position', '>', $anchor->position)
            ->when($moving !== null, fn ($q) => $q->where('slug', '!=', $moving))
            ->increment('position');

        return $anchor->position + 1;
    }

    private function openSlotFirst(): int
    {
        WildlifeSpecies::query()->increment('position');

        return 0;
    }

    /**
     * @param  array<string, mixed>  $record
     */
    private function assertValid(array $record): void
    {
        $errors = $this->rules->errors($record);
        if ($errors !== []) {
            throw WildlifeActionException::invalid($errors);
        }
    }
}
