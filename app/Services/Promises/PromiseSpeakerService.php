<?php

namespace App\Services\Promises;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseSpeaker;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The people promises are attributed to, as staff manage them. Transport-free,
 * so the dashboard and the agent tools share one set of rules.
 *
 * Rules that must not be relaxed:
 *  - Staff add a person either by linking someone the site already knows (a
 *    `ref` from SpeakerDirectory, which reuses the existing row) or by name.
 *    Staff additions are approved; only the public proposes pending people.
 *  - A person attributed any promise, including a deleted one, cannot be
 *    deleted: the promise would lose who made it.
 */
class PromiseSpeakerService
{
    public function __construct(private readonly SpeakerDirectory $directory) {}

    public function find(string $id): PromiseSpeaker
    {
        return PromiseSpeaker::find($id) ?? throw PromiseActionException::notFound('الشخص');
    }

    /**
     * People by name: everyone but the rejected, or one status.
     *
     * @return Collection<int, PromiseSpeaker>
     */
    public function list(?string $status = null, ?int $limit = null, int $offset = 0): Collection
    {
        return $this->query($status)
            ->with(['institution', 'candidate', 'officialEntity', 'houseMember'])
            ->withCount('promises')
            ->orderBy('name')
            ->orderBy('id')
            ->when($limit, fn ($q) => $q->limit($limit)->offset($offset))
            ->get();
    }

    public function count(?string $status = null): int
    {
        return $this->query($status)->count();
    }

    /**
     * @param  array<string, mixed>  $data  validated input: a `ref`, or a name and details
     */
    public function create(array $data): PromiseSpeaker
    {
        $speaker = filled($data['ref'] ?? null)
            ? $this->directory->resolve((string) $data['ref'], forStaff: true)
            : PromiseSpeaker::create($this->attributes($data) + ['status' => 'approved']);

        return $speaker->fresh()->loadCount('promises');
    }

    /**
     * @param  array<string, mixed>  $data  validated input
     */
    public function update(PromiseSpeaker $speaker, array $data): PromiseSpeaker
    {
        $speaker->update($this->attributes($data));

        return $speaker->fresh()->loadCount('promises');
    }

    public function delete(PromiseSpeaker $speaker): void
    {
        $count = Promise::withTrashed()->where('speaker_id', $speaker->id)->count();
        if ($count > 0) {
            throw PromiseActionException::speakerInUse($count);
        }

        $speaker->delete();
    }

    /** @return Builder<PromiseSpeaker> */
    private function query(?string $status): Builder
    {
        return PromiseSpeaker::query()->when(
            $status,
            fn ($q) => $q->where('status', $status),
            fn ($q) => $q->where('status', '!=', 'rejected'),
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        return [
            'name' => $data['name'],
            'title' => $data['title'] ?? null,
            'institution_id' => $data['institution_id'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'x_handle' => isset($data['x_handle']) ? (ltrim(trim($data['x_handle']), '@') ?: null) : null,
        ];
    }
}
