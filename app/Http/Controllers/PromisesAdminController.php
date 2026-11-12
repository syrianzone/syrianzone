<?php

namespace App\Http\Controllers;

use App\Models\Promise;
use App\Models\PromiseSector;
use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromiseFormOptions;
use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\PromiseRules;
use App\Services\Promises\PromiseSectorService;
use App\Services\Promises\PromiseSpeakerService;
use App\Services\Promises\SpeakerDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        private readonly SpeakerDirectory $directory,
        private readonly PromiseSpeakerService $speakers,
        private readonly PromiseSectorService $sectors,
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
            'queueCount' => $this->moderation->queueCount(),
        ]);
    }

    public function renderEditor(?string $id = null): Response
    {
        $promise = $id ? $this->findPromise($id) : null;

        return inertia('Admin/Promises/Edit', [
            'promise' => $promise ? $this->presenter->adminDetail($promise) : null,
            'options' => $this->formOptions->forEditor($promise),
            'queueCount' => $this->moderation->queueCount(),
        ]);
    }

    public function renderReview(): Response
    {
        return inertia('Admin/Promises/Review', [
            ...$this->presenter->reviewQueue(),
            'queueCount' => $this->moderation->queueCount(),
        ]);
    }

    public function renderSpeakers(): Response
    {
        return inertia('Admin/Promises/Speakers', [
            'speakers' => $this->speakers->list()->map->toAdminPayload()->all(),
            'institutions' => $this->formOptions->institutions(),
            'queueCount' => $this->moderation->queueCount(),
        ]);
    }

    public function renderSectors(): Response
    {
        return inertia('Admin/Promises/Sectors', [
            'sectors' => $this->sectors->list()->map(fn (PromiseSector $s) => $this->presenter->adminSector($s))->all(),
            'queueCount' => $this->moderation->queueCount(),
        ]);
    }

    // ── Promises ───────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->promise(), $this->rules->messages());

        $promise = $this->editor->save(null, $data + ['origin' => 'editor'], $request->user());

        return $this->promiseResponse($promise, 201);
    }

    /**
     * Save the editor form. The form must send the version its fields were
     * loaded at, so a save never overwrites an edit made since by another
     * editor or an agent.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);
        $data = $request->validate(
            ['version' => $this->rules->version(), ...$this->rules->promise($promise)],
            $this->rules->messages(),
        );

        $version = (int) $data['version'];
        unset($data['version']);

        $promise = $this->editor->saveIfUnchanged($promise, $version, $data, $request->user(), $this->mayRule($request));

        return $this->promiseResponse($promise);
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

        return $this->promiseResponse($promise);
    }

    public function undoStatusChange(string $id, int $updateId): JsonResponse
    {
        $promise = $this->editor->undoStatusChange($this->findPromise($id), $updateId);

        return $this->promiseResponse($promise);
    }

    public function reschedule(Request $request, string $promise): JsonResponse
    {
        $target = $this->findPromise($promise);

        $data = $request->validate($this->rules->reschedule($target), $this->rules->messages());

        $updated = $this->editor->rescheduleDeadline($target, $data, $request->user());

        return $this->promiseResponse($updated);
    }

    public function addUpdate(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);

        $data = $request->validate($this->rules->update(), $this->rules->messages());

        $this->editor->addUpdate($promise, $data, $request->user());

        return $this->promiseResponse($promise->fresh());
    }

    public function removeUpdate(string $id, int $updateId): JsonResponse
    {
        $promise = $this->findPromise($id);
        $this->editor->removeUpdate($promise, $updateId);

        return $this->promiseResponse($promise->fresh());
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $promise = $this->moderation->publish($this->findPromise($id), $request->user(), $this->mayRule($request));

        return $this->promiseResponse($promise);
    }

    public function unpublish(Request $request, string $id): JsonResponse
    {
        $promise = $this->moderation->unpublish($this->findPromise($id), $request->user());

        return $this->promiseResponse($promise);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $data = $request->validate($this->rules->reason(), $this->rules->messages());
        $promise = $this->moderation->reject($this->findPromise($id), $request->user(), $data['reason'] ?? null);

        return $this->promiseResponse($promise);
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
        $this->moderation->approveSpeaker($this->speakers->find($id), $request->user());

        return response()->json(['success' => true]);
    }

    public function rejectSpeaker(Request $request, string $id): JsonResponse
    {
        $data = $request->validate($this->rules->reason(), $this->rules->messages());
        $this->moderation->rejectSpeaker($this->speakers->find($id), $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true]);
    }

    public function acceptReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate($this->rules->note(), $this->rules->messages());
        $this->moderation->acceptReport($this->moderation->findReport($id), $request->user(), $data['note'] ?? null);

        return response()->json(['success' => true]);
    }

    public function dismissReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate($this->rules->note(), $this->rules->messages());
        $this->moderation->dismissReport($this->moderation->findReport($id), $request->user(), $data['note'] ?? null);

        return response()->json(['success' => true]);
    }

    // ── Speakers ───────────────────────────────────────────────────────

    public function searchSpeakers(Request $request): JsonResponse
    {
        $q = mb_substr((string) $request->query('q', ''), 0, 80);

        return response()->json(['speakers' => $this->directory->search($q, forStaff: true)]);
    }

    /**
     * Add a speaker, either linked to an existing person (`ref`) or typed in.
     */
    public function storeSpeaker(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->newSpeaker(), $this->rules->messages());

        $speaker = $this->speakers->create($data);

        return response()->json(['success' => true, 'speaker' => $speaker->toAdminPayload()], 201);
    }

    public function updateSpeaker(Request $request, string $id): JsonResponse
    {
        $speaker = $this->speakers->find($id);
        $data = $request->validate($this->rules->speaker(required: true), $this->rules->messages());

        $speaker = $this->speakers->update($speaker, $data);

        return response()->json(['success' => true, 'speaker' => $speaker->toAdminPayload()]);
    }

    public function destroySpeaker(string $id): JsonResponse
    {
        $this->speakers->delete($this->speakers->find($id));

        return response()->json(['success' => true]);
    }

    // ── Sectors ────────────────────────────────────────────────────────

    public function storeSector(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->sector(creating: true), $this->rules->messages());

        $sector = $this->sectors->create($data);

        return response()->json(['success' => true, 'sector' => $sector->toOption()], 201);
    }

    public function updateSector(Request $request, string $id): JsonResponse
    {
        $sector = $this->sectors->find($id);
        $data = $request->validate($this->rules->sector(creating: false), $this->rules->messages());

        $sector = $this->sectors->update($sector, $data);

        return response()->json(['success' => true, 'sector' => $sector->toOption()]);
    }

    public function toggleSector(string $id): JsonResponse
    {
        $sector = $this->sectors->find($id);
        $sector = $this->sectors->setActive($sector, ! $sector->is_active);

        return response()->json(['success' => true, 'isActive' => $sector->is_active]);
    }

    public function destroySector(string $id): JsonResponse
    {
        $this->sectors->delete($this->sectors->find($id));

        return response()->json(['success' => true]);
    }

    public function reorderSectors(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules->sectorOrder(), $this->rules->messages());

        $this->sectors->reorder($data['ids']);

        return response()->json(['success' => true]);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    /**
     * One shape for every admin write that returns a promise, so the admin UI
     * reads `{ success, promise }` from one place.
     */
    private function promiseResponse(Promise $promise, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)], $status);
    }

    private function findPromise(string $id): Promise
    {
        return $this->editor->find($id);
    }

    /** Whether this staff member may rule on promises (verdicts, postponement). */
    private function mayRule(Request $request): bool
    {
        return (bool) $request->user()?->hasPermission('promises.rule');
    }
}
