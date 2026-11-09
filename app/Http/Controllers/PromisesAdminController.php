<?php

namespace App\Http\Controllers;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSector;
use App\Models\PromiseSpeaker;
use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromiseFormOptions;
use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
use App\Services\Promises\SpeakerDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Response;

/**
 * Admin for the promises tracker: promises, the review queue, speakers and
 * sectors. A thin adapter over App\Services\Promises; every route names its
 * capability in routes/web.php (`promises_admin:promises.*`).
 */
class PromisesAdminController extends Controller
{
    public function __construct(
        private readonly PromiseEditor $editor,
        private readonly PromiseModerationService $moderation,
        private readonly PromisePresenter $presenter,
        private readonly SpeakerDirectory $speakers,
        private readonly PromiseRules $rules,
        private readonly PromiseFormOptions $formOptions,
    ) {}

    // ── Pages ──────────────────────────────────────────────────────────

    public function renderIndex(): Response
    {
        $promises = Promise::query()
            ->with(['speaker', 'submitter'])
            ->withCount(['sources', 'reports as pending_reports_count' => fn ($q) => $q->where('status', 'pending')])
            ->orderByDesc('updated_at')
            ->get();

        return inertia('Admin/Promises/Index', [
            'promises' => $promises->map(fn (Promise $p) => $this->presenter->adminRow($p))->all(),
            'queueCount' => $this->queueCount(),
        ]);
    }

    public function renderEditor(?string $id = null): Response
    {
        $promise = $id ? $this->findPromise($id) : null;

        return inertia('Admin/Promises/Edit', [
            'promise' => $promise ? $this->presenter->adminDetail($promise) : null,
            'options' => $this->formOptions->forEditor($promise),
            'queueCount' => $this->queueCount(),
        ]);
    }

    public function renderReview(): Response
    {
        $pendingPromises = Promise::query()
            ->where('review_status', 'pending')
            ->with(['speaker', 'submitter'])
            ->withCount('sources')
            ->orderBy('created_at')
            ->get();

        $pendingSpeakers = PromiseSpeaker::query()
            ->where('status', 'pending')
            ->withCount('promises')
            ->orderBy('created_at')
            ->get();

        $reports = PromiseReport::query()
            ->where('status', 'pending')
            ->whereHas('promise')
            ->with(['promise:id,number,title', 'user:id,name'])
            ->orderBy('created_at')
            ->get();

        return inertia('Admin/Promises/Review', [
            'promises' => $pendingPromises->map(fn (Promise $p) => $this->presenter->adminRow($p))->all(),
            'speakers' => $pendingSpeakers->map->toAdminPayload()->all(),
            'reports' => $reports->map(fn (PromiseReport $r) => [
                'id' => $r->id,
                'kind' => $r->kind,
                'body' => $r->body,
                'sourceUrl' => $r->source_url,
                'createdOn' => $r->created_at?->timezone(Promise::TIMEZONE)->format('Y-m-d'),
                'userName' => $r->user?->name,
                'promise' => [
                    'id' => $r->promise->id,
                    'number' => $r->promise->number,
                    'title' => $r->promise->title,
                ],
            ])->all(),
            'queueCount' => $this->queueCount(),
        ]);
    }

    public function renderSpeakers(): Response
    {
        $speakers = PromiseSpeaker::query()
            ->where('status', '!=', 'rejected')
            ->with(['institution', 'candidate', 'officialEntity', 'houseMember'])
            ->withCount('promises')
            ->orderBy('name')
            ->get();

        return inertia('Admin/Promises/Speakers', [
            'speakers' => $speakers->map->toAdminPayload()->all(),
            'institutions' => $this->formOptions->institutions(),
            'queueCount' => $this->queueCount(),
        ]);
    }

    public function renderSectors(): Response
    {
        $sectors = PromiseSector::query()
            ->withCount('promises')
            ->orderBy('order_column')
            ->get()
            ->map(fn (PromiseSector $s) => $s->toOption() + [
                'isActive' => (bool) $s->is_active,
                'promisesCount' => (int) $s->promises_count,
            ]);

        return inertia('Admin/Promises/Sectors', [
            'sectors' => $sectors->all(),
            'queueCount' => $this->queueCount(),
        ]);
    }

    // ── Promises ───────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->promise(), $this->rules->messages());

        $promise = $this->editor->save(null, $data + ['origin' => 'editor'], $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);
        $data = $request->validate($this->rules->promise($promise), $this->rules->messages());

        $promise = $this->editor->save($promise, $data, $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $this->editor->delete($this->findPromise($id));

        return response()->json(['success' => true]);
    }

    public function changeStatus(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);

        $data = $request->validate($this->rules->status($promise), $this->rules->messages());

        $promise = $this->editor->changeStatus($promise, $data['status'], $data, $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    public function undoStatusChange(string $id, int $updateId): JsonResponse
    {
        $promise = $this->editor->undoStatusChange($this->findPromise($id), $updateId);

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    public function addUpdate(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);

        $data = $request->validate($this->rules->update(), $this->rules->messages());

        $this->editor->addUpdate($promise, $data, $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise->fresh())]);
    }

    public function removeUpdate(string $id, int $updateId): JsonResponse
    {
        $promise = $this->findPromise($id);
        $this->editor->removeUpdate($promise, $updateId);

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise->fresh())]);
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $promise = $this->moderation->publish($this->findPromise($id), $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    public function unpublish(Request $request, string $id): JsonResponse
    {
        $promise = $this->moderation->unpublish($this->findPromise($id), $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']], $this->rules->messages());
        $promise = $this->moderation->reject($this->findPromise($id), $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)]);
    }

    /**
     * Upload a source screenshot or a speaker photo to R2 (public disk
     * locally). The stored extension comes from the file's content, never the
     * name the browser sent.
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'kind' => ['nullable', Rule::in(['speaker', 'source'])],
        ], $this->rules->messages());

        $folder = $request->input('kind') === 'speaker' ? 'speakers' : 'sources';
        $file = $request->file('image');
        $filename = Str::uuid().'.'.$file->extension();

        if (config('filesystems.disks.r2.bucket')) {
            $path = "promises/{$folder}/{$filename}";
            $disk = Storage::disk('r2');
            $disk->putFileAs("promises/{$folder}", $file, $filename, 'public');

            return response()->json(['success' => true, 'url' => $disk->url($path)]);
        }

        $rel = "images/promises/{$folder}/{$filename}";
        Storage::disk('public')->putFileAs("images/promises/{$folder}", $file, $filename);

        return response()->json(['success' => true, 'url' => '/storage/'.$rel]);
    }

    // ── Review queue ───────────────────────────────────────────────────

    public function approveSpeaker(Request $request, string $id): JsonResponse
    {
        $this->moderation->approveSpeaker($this->findSpeaker($id), $request->user());

        return response()->json(['success' => true]);
    }

    public function rejectSpeaker(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']], $this->rules->messages());
        $this->moderation->rejectSpeaker($this->findSpeaker($id), $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true]);
    }

    public function acceptReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']], $this->rules->messages());
        $report = PromiseReport::with('promise')->find($id) ?? throw PromiseActionException::notFound('البلاغ');
        $this->moderation->acceptReport($report, $request->user(), $data['note'] ?? null);

        return response()->json(['success' => true]);
    }

    public function dismissReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']], $this->rules->messages());
        $report = PromiseReport::find($id) ?? throw PromiseActionException::notFound('البلاغ');
        $this->moderation->dismissReport($report, $request->user(), $data['note'] ?? null);

        return response()->json(['success' => true]);
    }

    // ── Speakers ───────────────────────────────────────────────────────

    public function searchSpeakers(Request $request): JsonResponse
    {
        $q = mb_substr((string) $request->query('q', ''), 0, 80);

        return response()->json(['speakers' => $this->speakers->search($q, forStaff: true)]);
    }

    /**
     * Add a speaker, either linked to an existing person (`ref`) or typed in.
     */
    public function storeSpeaker(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ref' => ['nullable', 'string', 'max:80', 'required_without:name'],
            ...$this->rules->speaker(required: false),
        ], $this->rules->messages());

        $speaker = ! empty($data['ref'])
            ? $this->speakers->resolve($data['ref'], forStaff: true)
            : PromiseSpeaker::create($this->speakerAttributes($data) + ['status' => 'approved']);

        return response()->json(['success' => true, 'speaker' => $speaker->fresh()->toAdminPayload()], 201);
    }

    public function updateSpeaker(Request $request, string $id): JsonResponse
    {
        $speaker = $this->findSpeaker($id);
        $data = $request->validate($this->rules->speaker(required: true), $this->rules->messages());

        $speaker->update($this->speakerAttributes($data));

        return response()->json(['success' => true, 'speaker' => $speaker->fresh()->toAdminPayload()]);
    }

    public function destroySpeaker(string $id): JsonResponse
    {
        $speaker = $this->findSpeaker($id);

        $count = Promise::withTrashed()->where('speaker_id', $speaker->id)->count();
        if ($count > 0) {
            throw PromiseActionException::speakerInUse($count);
        }

        $speaker->delete();

        return response()->json(['success' => true]);
    }

    // ── Sectors ────────────────────────────────────────────────────────

    public function storeSector(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:32', 'regex:/^[a-z][a-z0-9_-]*$/', 'unique:promise_sectors,id'],
            'label' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:64'],
        ], $this->rules->messages());

        $sector = PromiseSector::create($data + [
            'order_column' => ((int) PromiseSector::max('order_column')) + 1,
            'is_active' => true,
        ]);

        return response()->json(['success' => true, 'sector' => $sector->toOption()], 201);
    }

    public function updateSector(Request $request, string $id): JsonResponse
    {
        $sector = $this->findSector($id);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:64'],
        ], $this->rules->messages());

        $sector->update($data);

        return response()->json(['success' => true, 'sector' => $sector->toOption()]);
    }

    public function toggleSector(string $id): JsonResponse
    {
        $sector = $this->findSector($id);
        $sector->update(['is_active' => ! $sector->is_active]);

        return response()->json(['success' => true, 'isActive' => $sector->is_active]);
    }

    public function destroySector(string $id): JsonResponse
    {
        $sector = $this->findSector($id);

        $count = Promise::withTrashed()->where('sector_id', $sector->id)->count();
        if ($count > 0) {
            throw PromiseActionException::sectorInUse($count);
        }

        $sector->delete();

        return response()->json(['success' => true]);
    }

    public function reorderSectors(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['string', 'exists:promise_sectors,id'],
        ], $this->rules->messages());

        DB::transaction(function () use ($data) {
            foreach ($data['ids'] as $i => $id) {
                PromiseSector::whereKey($id)->update(['order_column' => $i]);
            }
        });

        return response()->json(['success' => true]);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private function findPromise(string $id): Promise
    {
        return Promise::find($id) ?? throw PromiseActionException::notFound();
    }

    private function findSpeaker(string $id): PromiseSpeaker
    {
        return PromiseSpeaker::find($id) ?? throw PromiseActionException::notFound('الشخص');
    }

    private function findSector(string $id): PromiseSector
    {
        return PromiseSector::find($id) ?? throw PromiseActionException::notFound('القطاع');
    }

    /** Items waiting in the review queue, for the admin tab badge. */
    private function queueCount(): int
    {
        return Promise::where('review_status', 'pending')->count()
            + PromiseSpeaker::where('status', 'pending')->count()
            + PromiseReport::where('status', 'pending')->whereHas('promise')->count();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function speakerAttributes(array $data): array
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
