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
            'ref' => $s->ref(),
            'name' => $s->name,
            'title' => $s->title,
            'image' => $s->resolvedImage(),
            'source' => 'speaker',
            'pending' => $s->status === 'pending',
        ]);

        $linked = PromiseSpeaker::query()->get(['candidate_id', 'official_entity_id', 'house_member_id']);

        $candidates = $this->candidates($forStaff)
            ->when($query !== '', fn ($q) => $q->where('name', 'like', $like))
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
            ->when($query !== '', fn ($q) => $q->where(fn ($sub) => $sub->where('name_ar', 'like', $like)->orWhere('name', 'like', $like)))
            ->whereNotIn('id', $linked->pluck('official_entity_id')->filter()->all())
            ->orderBy('order_column')
            ->limit(self::PER_SOURCE)
            ->get(['id', 'name', 'name_ar', 'description_ar', 'image'])
            ->map(fn (OfficialEntity $e) => [
                'ref' => 'official:'.$e->id,
                'name' => self::cleanName($e->name_ar ?: $e->name),
                'title' => $e->description_ar,
                'image' => $e->image,
                'source' => 'official',
                'pending' => false,
            ]);

        $house = HouseMember2026::query()
            ->when($query !== '', fn ($q) => $q->where('name_ar', 'like', $like))
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

        $combined = Collection::make()
            ->concat($options)
            ->concat($candidates)
            ->concat($officials)
            ->concat($house);

        $deduped = [];
        foreach ($combined as $item) {
            $duplicate = false;
            foreach ($deduped as $existing) {
                if (self::namesMatch((string) $existing['name'], (string) $item['name'])) {
                    $duplicate = true;
                    break;
                }
            }
            if (! $duplicate) {
                $deduped[] = $item;
            }
        }

        return $deduped;
    }

    /**
     * Find the one known person a free-text name refers to, as a picker ref.
     *
     * Directory names carry titles and spelling variants ("وزير الطاقة محمد
     * البشير", "د. عبد القادر الحصرية", "عبدالسلام هيكل"), so names are
     * normalised and matched by priority pool (speaker -> candidate -> official
     * -> house). Only an unambiguous single match within the highest-priority
     * matching pool is returned; anything else is null so the caller proposes a
     * new speaker for review instead of guessing.
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

        foreach ($pools as $kind => $names) {
            $exact = [];
            $fuzzy = [];

            foreach ($names as $id => $candidate) {
                $candidateStr = (string) $candidate;
                $hay = self::normalizeName($candidateStr);
                if (mb_strlen($hay) < self::MIN_MATCH_LENGTH) {
                    continue;
                }

                $owner = match ($kind) {
                    'candidate' => $linked->firstWhere('candidate_id', $id),
                    'official' => $linked->firstWhere('official_entity_id', $id),
                    'house' => $linked->firstWhere('house_member_id', (int) $id),
                    default => null,
                };
                $ref = $owner ? $owner->ref() : $kind.':'.$id;

                if ($hay === $needle) {
                    $exact[$ref] = true;
                } elseif (self::namesMatch($candidateStr, $name)) {
                    $fuzzy[$ref] = true;
                }
            }

            $matches = $exact !== [] ? $exact : $fuzzy;
            if (count($matches) === 1) {
                return array_key_first($matches);
            }
            if (count($matches) > 1) {
                return null;
            }
        }

        return null;
    }

    /**
     * Ensure every publicly listed Tierlist candidate and Officials-directory
     * person has a linked PromiseSpeaker row, and link any existing speaker
     * whose normalised name matches unambiguously.
     */
    public function syncKnownPeople(): void
    {
        // 1. Link any unlinked existing speaker rows that match a known source.
        $unlinked = PromiseSpeaker::query()
            ->where('status', '!=', 'rejected')
            ->whereNull('candidate_id')
            ->whereNull('official_entity_id')
            ->whereNull('house_member_id')
            ->get();

        foreach ($unlinked as $speaker) {
            $this->attachSourceLinks($speaker);
        }

        // 2. Sync active candidates in the core tier-list poll.
        $candidates = $this->candidates(false)
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        foreach ($candidates as $candidate) {
            if (PromiseSpeaker::where('candidate_id', $candidate->id)->exists()) {
                continue;
            }

            $existing = $this->findMatchingSpeaker($candidate->name);
            if ($existing && $existing->candidate_id === null) {
                $existing->update([
                    'candidate_id' => $candidate->id,
                    'title' => $existing->title ?: $candidate->title,
                    'status' => 'approved',
                ]);
                $this->attachOfficialLink($existing);

                continue;
            }

            $speaker = $this->fromCandidate($candidate->id, true);
            $this->attachOfficialLink($speaker);
        }

        // 3. Sync active people in the officials directory (ministers, public_figures).
        $officials = $this->officials(false)
            ->orderBy('order_column')
            ->get();

        foreach ($officials as $entity) {
            if (PromiseSpeaker::where('official_entity_id', $entity->id)->exists()) {
                continue;
            }

            $name = self::cleanName($entity->name_ar ?: $entity->name);
            $existing = $this->findMatchingSpeaker($name);
            if ($existing) {
                if ($existing->official_entity_id === null) {
                    $existing->update([
                        'official_entity_id' => $entity->id,
                        'title' => $existing->title ?: $entity->description_ar,
                        'status' => 'approved',
                    ]);
                }

                continue;
            }

            $this->fromOfficial($entity->id, true);
        }
    }

    /** Strip parenthetical nicknames and common honorifics/titles for display. */
    public static function cleanName(string $name): string
    {
        $name = preg_replace('/\([^)]*\)/u', ' ', $name) ?? $name;
        $name = preg_replace('/(^|\s)(الأستاذ|الاستاذ|الدكتورة|الدكتور|دكتورة|دكتور|د\.|المهندسة|المهندس|م\.|اللواء|العقيد|العميد|المستشار|السيدة|السيد|وزير الطاقة)\s*/u', ' ', $name) ?? $name;

        return trim(preg_replace('/\s+/u', ' ', $name) ?? $name);
    }

    /** Strip honorifics, spaces and spelling variants so names compare. */
    public static function normalizeName(string $name): string
    {
        $name = self::cleanName($name);
        $name = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $name) ?? $name;

        return str_replace(
            ['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى', ' ', '.', '-'],
            ['ا', 'ا', 'ا', 'ا', 'ه', 'ي', '', '', ''],
            trim($name),
        );
    }

    /**
     * Compare two Arabic person names, accounting for leading titles/prefixes
     * ("وزير الطاقة محمد البشير" vs "محمد البشير", "محمد يسر برنية" vs "يسر برنية")
     * and middle patronymics ("محمد عبد الرحمن تركو" vs "محمد تركو").
     */
    public static function namesMatch(string $a, string $b): bool
    {
        $normA = self::normalizeName($a);
        $normB = self::normalizeName($b);

        if (mb_strlen($normA) < self::MIN_MATCH_LENGTH || mb_strlen($normB) < self::MIN_MATCH_LENGTH) {
            return false;
        }

        if ($normA === $normB || str_ends_with($normA, $normB) || str_ends_with($normB, $normA)) {
            return true;
        }

        $shortA = self::firstAndLastNormalized($a);
        $shortB = self::firstAndLastNormalized($b);

        return $shortA !== null && $shortA === $shortB;
    }

    private static function firstAndLastNormalized(string $name): ?string
    {
        $clean = self::cleanName($name);
        $clean = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u', '', $clean) ?? $clean;
        $rawWords = array_values(array_filter(preg_split('/[\s.\-]+/u', trim($clean)) ?: []));

        $compounds = ['عبد', 'ابو', 'ابي', 'نور', 'علاء', 'محي', 'تقي', 'بهاء', 'ضياء', 'سيف', 'صلاح', 'جمال', 'كمال', 'شمس', 'عز', 'سعد', 'فخر', 'زين'];
        $tokens = [];
        for ($i = 0; $i < count($rawWords); $i++) {
            $w = str_replace(['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى'], ['ا', 'ا', 'ا', 'ا', 'ه', 'ي'], $rawWords[$i]);
            if (in_array($w, $compounds, true) && isset($rawWords[$i + 1])) {
                $next = str_replace(['أ', 'إ', 'آ', 'ٱ', 'ة', 'ى'], ['ا', 'ا', 'ا', 'ا', 'ه', 'ي'], $rawWords[$i + 1]);
                $tokens[] = $w.$next;
                $i++;
            } else {
                $tokens[] = $w;
            }
        }

        if (count($tokens) < 2) {
            return null;
        }

        $combined = $tokens[0].$tokens[count($tokens) - 1];

        return mb_strlen($combined) >= self::MIN_MATCH_LENGTH ? $combined : null;
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
            ->whereHas('poll', fn ($p) => $p->where('slug', Poll::coreSlug()))
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
            ['name' => self::cleanName($entity->name_ar ?: $entity->name), 'title' => $entity->description_ar, 'status' => 'approved'],
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

    private function findMatchingSpeaker(string $name): ?PromiseSpeaker
    {
        $speakers = PromiseSpeaker::query()->where('status', '!=', 'rejected')->get();
        $matches = $speakers->filter(fn (PromiseSpeaker $s) => self::namesMatch($s->name, $name))->values();

        return $matches->count() === 1 ? $matches->first() : null;
    }

    private function attachSourceLinks(PromiseSpeaker $speaker): void
    {
        $candidates = $this->candidates(true)->get(['id', 'name', 'title']);
        $candMatches = $candidates->filter(fn (Candidate $c) => self::namesMatch($c->name, $speaker->name))->values();
        if ($candMatches->count() === 1) {
            $cand = $candMatches->first();
            if (! PromiseSpeaker::where('candidate_id', $cand->id)->exists()) {
                $speaker->update([
                    'candidate_id' => $cand->id,
                    'title' => $speaker->title ?: $cand->title,
                    'status' => 'approved',
                ]);
            }
        }

        $this->attachOfficialLink($speaker);
    }

    private function attachOfficialLink(PromiseSpeaker $speaker): void
    {
        if ($speaker->official_entity_id !== null) {
            return;
        }

        $officials = $this->officials(true)->get(['id', 'name', 'name_ar', 'description_ar']);
        $offMatches = $officials->filter(fn (OfficialEntity $e) => self::namesMatch($e->name_ar ?: $e->name, $speaker->name))->values();
        if ($offMatches->count() === 1) {
            $off = $offMatches->first();
            if (! PromiseSpeaker::where('official_entity_id', $off->id)->exists()) {
                $speaker->update([
                    'official_entity_id' => $off->id,
                    'title' => $speaker->title ?: $off->description_ar,
                    'status' => 'approved',
                ]);
            }
        }
    }

    private function houseTitle(HouseMember2026 $member): string
    {
        return $member->management_position
            ?: trim('عضو مجلس الشعب'.($member->governorate_ar ? ' عن '.$member->governorate_ar : ''));
    }
}
