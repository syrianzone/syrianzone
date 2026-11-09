<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Candidate;
use App\Models\HouseMember2026;
use App\Models\OfficialEntity;
use App\Models\Poll;
use App\Models\PromiseSpeaker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The people a promise can be attributed to.
 *
 * The site already knows most officials: tier-list candidates, people in the
 * officials directory (`ministers`, `public_figures`) and People's Assembly
 * members. Rather than copying them into a second list, the picker searches
 * those tables live and a `promise_speakers` row is created, linked, the first
 * time someone is picked. The unique link columns keep that idempotent.
 *
 * A picker option is addressed by a `ref`: `speaker:{uuid}`,
 * `candidate:{uuid}`, `official:{id}` or `house:{id}`.
 *
 * Visitors only ever reach approved speakers and people the site shows
 * publicly (the main tier-list poll, active directory entries). Staff
 * (`$forStaff`) also see pending speakers and hidden records.
 */
class SpeakerDirectory
{
    /** Officials-directory categories that hold people rather than bodies. */
    public const PEOPLE_CATEGORIES = ['ministers', 'public_figures'];

    private const PER_SOURCE = 8;

    /** Normalised names shorter than this never match by containment. */
    private const MIN_MATCH_LENGTH = 6;

    /**
     * Search every source. Records already linked to a speaker are returned as
     * that speaker, so the same person never shows twice.
     *
     * @return array<int, array<string, mixed>>
     */
    public function search(string $query, bool $forStaff = false): array
    {
        $query = trim($query);
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $query).'%';

        $speakers = PromiseSpeaker::query()
            ->with(['candidate', 'officialEntity'])
            ->when($forStaff, fn ($q) => $q->where('status', '!=', 'rejected'), fn ($q) => $q->approved())
            ->when($query !== '', fn ($q) => $q->where('name', 'like', $like))
            ->orderBy('name')
            ->limit($query === '' ? 30 : self::PER_SOURCE * 2)
            ->get();

        $options = $speakers->map(fn (PromiseSpeaker $s) => [
            'ref' => 'speaker:'.$s->id,
            'name' => $s->name,
            'title' => $s->title,
            'image' => $s->resolvedImage(),
            'source' => 'speaker',
            'pending' => $s->status === 'pending',
        ]);

        if ($query === '') {
            return $options->values()->all();
        }

        $linked = PromiseSpeaker::query()->get(['candidate_id', 'official_entity_id', 'house_member_id']);

        $candidates = $this->candidates($forStaff)
            ->where('name', 'like', $like)
            ->whereNotIn('id', $linked->pluck('candidate_id')->filter()->all())
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->limit(self::PER_SOURCE)
            ->get(['id', 'name', 'title', 'image_url', 'status'])
            ->map(fn (Candidate $c) => [
                'ref' => 'candidate:'.$c->id,
                'name' => $c->name,
                'title' => $c->title,
                'image' => $c->image_url,
                'source' => 'candidate',
                'pending' => false,
            ]);

        $officials = $this->officials($forStaff)
            ->where(fn ($q) => $q->where('name_ar', 'like', $like)->orWhere('name', 'like', $like))
            ->whereNotIn('id', $linked->pluck('official_entity_id')->filter()->all())
            ->orderBy('order_column')
            ->limit(self::PER_SOURCE)
            ->get(['id', 'name', 'name_ar', 'description_ar', 'image'])
            ->map(fn (OfficialEntity $e) => [
                'ref' => 'official:'.$e->id,
                'name' => $e->name_ar ?: $e->name,
                'title' => $e->description_ar,
                'image' => $e->image,
                'source' => 'official',
                'pending' => false,
            ]);

        $house = HouseMember2026::query()
            ->where('name_ar', 'like', $like)
            ->whereNotIn('id', $linked->pluck('house_member_id')->filter()->all())
            ->orderBy('name_ar')
            ->limit(self::PER_SOURCE)
            ->get(['id', 'name_ar', 'governorate_ar', 'management_position'])
            ->map(fn (HouseMember2026 $m) => [
                'ref' => 'house:'.$m->id,
                'name' => $m->name_ar,
                'title' => $this->houseTitle($m),
                'image' => null,
                'source' => 'house',
                'pending' => false,
            ]);

        return Collection::make()
            ->concat($options)
            ->concat($candidates)
            ->concat($officials)
            ->concat($house)
            ->values()
            ->all();
    }

    /**
     * Find the one known person a free-text name refers to, as a picker ref.
     *
     * Directory names carry titles and spelling variants ("وزير الطاقة محمد
     * البشير", "د. عبد القادر الحصرية", "عبدالسلام هيكل"), so names are
     * normalised and matched by containment in either direction. Only an
     * unambiguous single match is returned; anything else is null so the
     * caller proposes a new speaker for review instead of guessing.
     */
    public function findExisting(string $name): ?string
    {
        $needle = self::normalizeName($name);
        if (mb_strlen($needle) < self::MIN_MATCH_LENGTH) {
            return null;
        }

        $pools = [
            'speaker' => PromiseSpeaker::query()->where('status', '!=', 'rejected')->pluck('name', 'id'),
            'candidate' => $this->candidates(true)->pluck('name', 'id'),
            'official' => $this->officials(true)->pluck('name_ar', 'id'),
            'house' => HouseMember2026::query()->pluck('name_ar', 'id'),
        ];

        $linked = PromiseSpeaker::query()->get(['id', 'candidate_id', 'official_entity_id', 'house_member_id']);
        $matches = [];

        foreach ($pools as $kind => $names) {
            foreach ($names as $id => $candidate) {
                $hay = self::normalizeName((string) $candidate);
                if (mb_strlen($hay) < self::MIN_MATCH_LENGTH || (! str_contains($hay, $needle) && ! str_contains($needle, $hay))) {
                    continue;
                }

                // A record already linked to a speaker resolves to that speaker.
                $owner = match ($kind) {
                    'candidate' => $linked->firstWhere('candidate_id', $id),
                    'official' => $linked->firstWhere('official_entity_id', $id),
                    'house' => $linked->firstWhere('house_member_id', (int) $id),
                    default => null,
                };
                $matches[$owner ? 'speaker:'.$owner->id : $kind.':'.$id] = true;
            }
        }

        return count($matches) === 1 ? array_key_first($matches) : null;
    }

    /** Strip honorifics, spaces and spelling variants so names compare. */
    public static function normalizeName(string $name): string
    {
        $name = preg_replace('/(^|\s)(د\.|الدكتور|دكتور|المهندس|م\.)\s*/u', '$1', $name) ?? $name;
        $name = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $name) ?? $name;

        return str_replace(
            ['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى', ' ', '.', '-'],
            ['ا', 'ا', 'ا', 'ا', 'ه', 'ي', '', '', ''],
            trim($name),
        );
    }

    /**
     * Turn a picker ref into a speaker row, creating the linked row on first
     * use. Visitors can only resolve people the site shows publicly.
     */
    public function resolve(string $ref, bool $forStaff = false): PromiseSpeaker
    {
        [$kind, $id] = array_pad(explode(':', $ref, 2), 2, '');

        if ($id === '') {
            throw PromiseActionException::badSpeakerRef();
        }

        return match ($kind) {
            'speaker' => PromiseSpeaker::find($id) ?? throw PromiseActionException::badSpeakerRef(),
            'candidate' => $this->fromCandidate($id, $forStaff),
            'official' => $this->fromOfficial($id, $forStaff),
            'house' => $this->fromHouse($id),
            default => throw PromiseActionException::badSpeakerRef(),
        };
    }

    /**
     * Tier-list people. Visitors see the main poll's candidates in categories
     * that are switched on, the same set the public tier list shows.
     *
     * @return Builder<Candidate>
     */
    private function candidates(bool $forStaff): Builder
    {
        return Candidate::query()->when(! $forStaff, fn ($q) => $q
            ->whereHas('poll', fn ($p) => $p->where('slug', Poll::CORE_POLL_SLUG))
            ->where(fn ($g) => $g
                ->whereNull('candidate_group_id')
                ->orWhereHas('group', fn ($c) => $c->where('is_active', true))));
    }

    /**
     * Officials-directory people. Visitors see active entries in active
     * categories, as the directory page does.
     *
     * @return Builder<OfficialEntity>
     */
    private function officials(bool $forStaff): Builder
    {
        return OfficialEntity::query()
            ->whereIn('category_id', self::PEOPLE_CATEGORIES)
            ->when(! $forStaff, fn ($q) => $q
                ->where('is_active', true)
                ->whereHas('category', fn ($c) => $c->where('is_active', true)));
    }

    private function fromCandidate(string $id, bool $forStaff): PromiseSpeaker
    {
        $candidate = $this->candidates($forStaff)->find($id) ?? throw PromiseActionException::badSpeakerRef();

        return PromiseSpeaker::firstOrCreate(
            ['candidate_id' => $candidate->id],
            ['name' => $candidate->name, 'title' => $candidate->title, 'status' => 'approved'],
        );
    }

    private function fromOfficial(string $id, bool $forStaff): PromiseSpeaker
    {
        $entity = $this->officials($forStaff)->find($id) ?? throw PromiseActionException::badSpeakerRef();

        return PromiseSpeaker::firstOrCreate(
            ['official_entity_id' => $entity->id],
            ['name' => $entity->name_ar ?: $entity->name, 'title' => $entity->description_ar, 'status' => 'approved'],
        );
    }

    private function fromHouse(string $id): PromiseSpeaker
    {
        $member = HouseMember2026::find((int) $id) ?? throw PromiseActionException::badSpeakerRef();

        return PromiseSpeaker::firstOrCreate(
            ['house_member_id' => $member->id],
            ['name' => $member->name_ar, 'title' => $this->houseTitle($member), 'status' => 'approved'],
        );
    }

    private function houseTitle(HouseMember2026 $member): string
    {
        return $member->management_position
            ?: trim('عضو مجلس الشعب'.($member->governorate_ar ? ' عن '.$member->governorate_ar : ''));
    }
}
