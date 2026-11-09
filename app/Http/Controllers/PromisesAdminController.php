<?php

namespace App\Http\Controllers;

use App\Exceptions\Promises\PromiseActionException;
use App\Models\OfficialEntity;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSector;
use App\Models\PromiseSource;
use App\Models\PromiseSpeaker;
use App\Models\PromiseUpdate;
use App\Services\Promises\PromiseEditor;
use App\Services\Promises\PromiseModerationService;
use App\Services\Promises\PromisePresenter;
use App\Services\Promises\SpeakerDirectory;
use App\Support\Governorates;
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
    /** Links rendered as hrefs or image sources: web URLs or our own uploads. */
    private const LINK_PATTERN = '#^(https?://|/storage/)#i';

    /** A handle on X: letters, digits and underscores, up to 15, optional @. */
    private const X_HANDLE_PATTERN = '/^@?[A-Za-z0-9_]{1,15}$/';

    /** Comfortably inside the decimal(18,2) columns that store measurements. */
    private const MAX_MEASURE = 999_999_999_999;

    public function __construct(
        private readonly PromiseEditor $editor,
        private readonly PromiseModerationService $moderation,
        private readonly PromisePresenter $presenter,
        private readonly SpeakerDirectory $speakers,
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
            'options' => $this->editorOptions($promise),
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
            'institutions' => $this->institutionOptions(),
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
        $data = $request->validate($this->promiseRules(), $this->messages());

        $promise = $this->editor->save(null, $data + ['origin' => 'editor'], $request->user());

        return response()->json(['success' => true, 'promise' => $this->presenter->adminDetail($promise)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $promise = $this->findPromise($id);
        $data = $request->validate($this->promiseRules($promise), $this->messages());

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

        $data = $request->validate([
            'status' => ['required', Rule::in(Promise::STATUSES), Rule::notIn([$promise->status])],
            'happened_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Promise::today()->format('Y-m-d')],
            'body' => ['nullable', 'string', 'max:2000'],
            'source_url' => ['required', 'url:http,https', 'max:2048'],
            'archive_url' => ['nullable', 'url:http,https', 'max:2048'],
        ], $this->messages());

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

        $data = $request->validate([
            'type' => ['required', Rule::in(array_diff(PromiseUpdate::TYPES, ['status_change']))],
            'happened_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Promise::today()->format('Y-m-d')],
            'body' => ['nullable', 'string', 'max:2000', 'required_unless:type,progress'],
            'value' => ['nullable', 'numeric', 'between:-'.self::MAX_MEASURE.','.self::MAX_MEASURE, 'required_if:type,progress'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'archive_url' => ['nullable', 'url:http,https', 'max:2048'],
        ], $this->messages());

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
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']], $this->messages());
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
        ], $this->messages());

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
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:1000']], $this->messages());
        $this->moderation->rejectSpeaker($this->findSpeaker($id), $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true]);
    }

    public function acceptReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']], $this->messages());
        $report = PromiseReport::with('promise')->find($id) ?? throw PromiseActionException::notFound('البلاغ');
        $this->moderation->acceptReport($report, $request->user(), $data['note'] ?? null);

        return response()->json(['success' => true]);
    }

    public function dismissReport(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']], $this->messages());
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
            ...$this->speakerRules(required: false),
        ], $this->messages());

        $speaker = ! empty($data['ref'])
            ? $this->speakers->resolve($data['ref'], forStaff: true)
            : PromiseSpeaker::create($this->speakerAttributes($data) + ['status' => 'approved']);

        return response()->json(['success' => true, 'speaker' => $speaker->fresh()->toAdminPayload()], 201);
    }

    public function updateSpeaker(Request $request, string $id): JsonResponse
    {
        $speaker = $this->findSpeaker($id);
        $data = $request->validate($this->speakerRules(required: true), $this->messages());

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
        ], $this->messages());

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
        ], $this->messages());

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
        ], $this->messages());

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
     * @return array<string, mixed>
     */
    private function editorOptions(?Promise $current): array
    {
        return [
            'sectors' => PromiseSector::orderBy('order_column')->get()->map->toOption()->all(),
            'governorates' => Governorates::options(),
            'institutions' => $this->institutionOptions(),
            'venues' => Promise::VENUES,
            'sourceTypes' => PromiseSource::TYPES,
            'statuses' => Promise::STATUSES,
            'earliestDate' => Promise::EARLIEST_STATEMENT_DATE,
            'today' => Promise::today()->format('Y-m-d'),
            // Candidates for "this restates promise #N": published, not itself.
            'restatable' => Promise::published()
                ->when($current, fn ($q) => $q->whereKeyNot($current->id))
                ->orderByDesc('number')
                ->get(['id', 'number', 'title'])
                ->map(fn (Promise $p) => ['id' => $p->id, 'number' => $p->number, 'title' => $p->title])
                ->all(),
        ];
    }

    /**
     * Institutions: officials-directory entries that are bodies, not people.
     *
     * @return array<int, array{id: string, name: string}>
     */
    private function institutionOptions(): array
    {
        return OfficialEntity::query()
            ->whereNotIn('category_id', SpeakerDirectory::PEOPLE_CATEGORIES)
            ->where('is_active', true)
            ->orderBy('category_id')
            ->orderBy('order_column')
            ->get(['id', 'name', 'name_ar'])
            ->map(fn (OfficialEntity $e) => ['id' => $e->id, 'name' => $e->name_ar ?: $e->name])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function promiseRules(?Promise $promise = null): array
    {
        $measure = ['nullable', 'numeric', 'between:-'.self::MAX_MEASURE.','.self::MAX_MEASURE];

        return [
            'speaker_ref' => ['required', 'string', 'max:80'],
            'speaker_title' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:200'],
            'summary' => ['nullable', 'string', 'max:2000'],
            'quote' => ['required', 'string', 'max:5000'],
            'quote_is_verbatim' => ['boolean'],
            'institution_id' => ['nullable', 'string', 'exists:official_entities,id'],
            'sector_id' => ['nullable', 'string', 'exists:promise_sectors,id'],
            'is_national' => ['boolean'],
            'governorates' => ['array'],
            'governorates.*' => [Rule::in(Governorates::slugs())],
            'tags' => ['array', 'max:10'],
            'tags.*' => ['string', 'max:64'],
            'statement_date' => [
                'required', 'date_format:Y-m-d',
                'after_or_equal:'.Promise::EARLIEST_STATEMENT_DATE,
                'before_or_equal:'.Promise::today()->format('Y-m-d'),
            ],
            'statement_venue' => ['required', Rule::in(Promise::VENUES)],
            'deadline_wording' => ['nullable', 'string', 'max:255'],
            'deadline_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:statement_date'],
            'deadline_reasoning' => ['nullable', 'string', 'max:2000'],
            'target_value' => $measure,
            'target_unit' => ['nullable', 'string', 'max:64', 'required_with:target_value'],
            'baseline_value' => $measure,
            'baseline_note' => ['nullable', 'string', 'max:255'],
            'restates_promise_id' => [
                'nullable', 'string',
                Rule::exists('promises', 'id')->where('review_status', 'published')->whereNull('deleted_at'),
                Rule::notIn(array_filter([$promise?->id])),
            ],
            'sources' => ['required', 'array', 'min:1', 'max:20'],
            'sources.*.url' => ['required', 'url:http,https', 'max:2048'],
            'sources.*.outlet' => ['nullable', 'string', 'max:255'],
            'sources.*.type' => ['required', Rule::in(PromiseSource::TYPES)],
            'sources.*.published_date' => ['nullable', 'date_format:Y-m-d'],
            'sources.*.language' => ['nullable', Rule::in(['ar', 'en', 'other'])],
            'sources.*.archive_url' => ['nullable', 'url:http,https', 'max:2048'],
            'sources.*.screenshot_url' => ['nullable', 'string', 'max:2048', 'regex:'.self::LINK_PATTERN],
            'sources.*.video_timestamp' => ['nullable', 'string', 'max:16', 'regex:/^\d{1,2}(:\d{2}){1,2}$/'],
            'sources.*.is_primary' => ['boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function speakerRules(bool $required): array
    {
        return [
            'name' => [$required ? 'required' : 'nullable', 'string', 'max:255', ...($required ? [] : ['required_without:ref'])],
            'title' => ['nullable', 'string', 'max:255'],
            'institution_id' => ['nullable', 'string', 'exists:official_entities,id'],
            'image_url' => ['nullable', 'string', 'max:2048', 'regex:'.self::LINK_PATTERN],
            'x_handle' => ['nullable', 'string', 'regex:'.self::X_HANDLE_PATTERN],
        ];
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

    /**
     * Arabic messages for every admin form. Keys a given form does not use are
     * ignored by the validator.
     *
     * @return array<string, string>
     */
    private function messages(): array
    {
        $date = 'التاريخ غير صالح';
        $future = 'لا يمكن أن يكون التاريخ في المستقبل';
        $link = 'يجب أن يكون الرابط صالحاً ويبدأ بـ https://';
        $long = 'النص طويل جداً';
        $number = 'أدخل رقماً صحيحاً ضمن حدود معقولة';

        return [
            'speaker_ref.required' => 'اختر صاحب الوعد',
            'speaker_title.max' => $long,
            'title.required' => 'اكتب عنوان الوعد',
            'title.max' => 'العنوان طويل جداً (200 حرف كحد أقصى)',
            'summary.max' => $long,
            'quote.required' => 'اكتب نص الوعد كما قيل',
            'quote.max' => $long,
            'institution_id.exists' => 'الجهة المختارة غير موجودة',
            'sector_id.exists' => 'القطاع المختار غير موجود',
            'governorates.*.in' => 'إحدى المحافظات غير صالحة',
            'tags.max' => 'عشرة وسوم كحد أقصى',
            'tags.*.max' => 'أحد الوسوم طويل جداً',
            'statement_date.required' => 'حدد تاريخ التصريح',
            'statement_date.date_format' => $date,
            'statement_date.after_or_equal' => 'يغطي العداد الوعود التي أُطلقت منذ 8 كانون الأول 2024',
            'statement_date.before_or_equal' => $future,
            'statement_venue.required' => 'اختر مكان التصريح',
            'statement_venue.in' => 'اختر مكان التصريح من القائمة',
            'deadline_wording.max' => $long,
            'deadline_date.date_format' => $date,
            'deadline_date.after_or_equal' => 'لا يمكن أن يسبق الموعد تاريخ التصريح',
            'deadline_reasoning.max' => $long,
            'target_value.numeric' => $number,
            'target_value.between' => $number,
            'target_unit.required_with' => 'حدد وحدة الهدف',
            'target_unit.max' => $long,
            'baseline_value.numeric' => $number,
            'baseline_value.between' => $number,
            'baseline_note.max' => $long,
            'restates_promise_id.exists' => 'يجب أن يكون الوعد السابق منشوراً',
            'restates_promise_id.not_in' => 'لا يمكن أن يكون الوعد إعادة لنفسه',
            'sources.required' => 'أضف مصدراً واحداً على الأقل',
            'sources.min' => 'أضف مصدراً واحداً على الأقل',
            'sources.max' => 'عشرون مصدراً كحد أقصى',
            'sources.*.url.required' => 'رابط المصدر مطلوب',
            'sources.*.url.url' => $link,
            'sources.*.url.max' => 'الرابط طويل جداً',
            'sources.*.outlet.max' => $long,
            'sources.*.type.required' => 'اختر نوع المصدر',
            'sources.*.type.in' => 'اختر نوع المصدر من القائمة',
            'sources.*.published_date.date_format' => $date,
            'sources.*.language.in' => 'اختر اللغة من القائمة',
            'sources.*.archive_url.url' => $link,
            'sources.*.screenshot_url.regex' => $link,
            'sources.*.video_timestamp.regex' => 'اكتب الدقيقة بصيغة 12:34 أو 1:02:03',
            'status.required' => 'اختر الحالة الجديدة',
            'status.in' => 'اختر الحالة من القائمة',
            'status.not_in' => 'هذه هي الحالة الحالية للوعد',
            'happened_on.required' => 'حدد تاريخ الحدث',
            'happened_on.date_format' => $date,
            'happened_on.before_or_equal' => $future,
            'body.required_unless' => 'اكتب نص البند',
            'body.max' => $long,
            'value.required_if' => 'أدخل القيمة المحققة',
            'value.numeric' => $number,
            'value.between' => $number,
            'source_url.required' => 'يجب إرفاق رابط مصدر',
            'source_url.url' => $link,
            'archive_url.url' => $link,
            'type.required' => 'اختر نوع البند',
            'type.in' => 'اختر نوع البند من القائمة',
            'reason.max' => $long,
            'note.max' => $long,
            'image.required' => 'اختر صورة',
            'image.image' => 'الملف ليس صورة',
            'image.mimes' => 'الصيغ المقبولة: JPG وPNG وWebP',
            'image.max' => 'حجم الصورة يتجاوز 8 ميغابايت',
            'ref.required_without' => 'اختر شخصاً أو اكتب اسمه',
            'name.required' => 'اكتب الاسم',
            'name.required_without' => 'اختر شخصاً أو اكتب اسمه',
            'name.max' => $long,
            'image_url.regex' => $link,
            'x_handle.regex' => 'اكتب اسم الحساب على إكس بأحرف إنكليزية وأرقام فقط (15 حرفاً كحد أقصى)',
            'id.required' => 'اكتب المعرّف',
            'id.regex' => 'المعرّف بأحرف إنكليزية صغيرة وأرقام وشرطات فقط',
            'id.unique' => 'هذا المعرّف مستخدم',
            'id.max' => 'المعرّف طويل جداً',
            'label.required' => 'اكتب اسم القطاع',
            'label.max' => $long,
            'ids.required' => 'تعذّر حفظ الترتيب',
            'ids.*.exists' => 'تعذّر حفظ الترتيب',
        ];
    }
}
