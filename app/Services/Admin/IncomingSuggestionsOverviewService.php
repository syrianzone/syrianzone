<?php

namespace App\Services\Admin;

use App\Models\DirectorySuggestion;
use App\Models\Place;
use App\Models\PlaceReport;
use App\Models\Promise;
use App\Models\PromiseReport;
use App\Models\PromiseSpeaker;
use App\Models\RouteDraft;
use App\Models\User;
use App\Services\Directories\DirectorySuggestionService;

/**
 * Superadmin overview of every incoming community suggestion, submission,
 * report, and draft waiting for review across all platform sections.
 */
final class IncomingSuggestionsOverviewService
{
    /**
     * Ordered section metadata for the overview cards and filters.
     *
     * @var array<string, array{label: string, admin_url: string}>
     */
    private const SECTIONS = [
        'govtcvs' => [
            'label' => 'السير الذاتية للمسؤولين',
            'admin_url' => '/admin/govtcvs',
        ],
        'syofficial' => [
            'label' => 'الحسابات الرسمية',
            'admin_url' => '/admin/syofficial',
        ],
        'govapps' => [
            'label' => 'التطبيقات الحكومية',
            'admin_url' => '/admin/govapps',
        ],
        'phonebook' => [
            'label' => 'دليل الهاتف',
            'admin_url' => '/admin/phonebook',
        ],
        'promises' => [
            'label' => 'عداد الوعود',
            'admin_url' => '/admin/promises/review',
        ],
        'places' => [
            'label' => 'مشوار',
            'admin_url' => '/admin/places',
        ],
        'transit' => [
            'label' => 'ترانزيت',
            'admin_url' => '/transit/admin',
        ],
    ];

    public function __construct(
        private readonly DirectorySuggestionService $directorySuggestions,
    ) {}

    /**
     * Total count of pending incoming items across all sections (lightweight
     * aggregate for the superadmin dashboard badge).
     */
    public function totalPendingCount(): int
    {
        return DirectorySuggestion::pending()->count()
            + Promise::inReviewQueue()->count()
            + PromiseSpeaker::inReviewQueue()->count()
            + PromiseReport::inReviewQueue()->count()
            + Place::where('status', 'pending')->count()
            + PlaceReport::where('status', 'open')->whereHas('place')->count()
            + RouteDraft::where('status', 'pending')->count();
    }

    /**
     * Full cross-section overview: per-section pending summaries + unified
     * newest-first feed of incoming items.
     *
     * @return array{
     *   total_pending: int,
     *   sections: array<int, array<string, mixed>>,
     *   items: array<int, array<string, mixed>>,
     *   generated_at: string
     * }
     */
    public function overview(int $perQueueLimit = 60): array
    {
        $items = [];
        $sectionSummaries = [];

        // 1. Directory suggestions (govtcvs, syofficial, govapps, phonebook)
        $dirCountsRaw = DirectorySuggestion::pending()
            ->selectRaw('module, kind, count(*) as aggregate')
            ->groupBy('module', 'kind')
            ->get();

        $dirCounts = [];
        foreach (DirectorySuggestion::MODULES as $module) {
            $dirCounts[$module] = ['add' => 0, 'edit' => 0];
        }
        foreach ($dirCountsRaw as $row) {
            $mod = (string) $row->module;
            $kind = (string) $row->kind;
            if (isset($dirCounts[$mod][$kind])) {
                $dirCounts[$mod][$kind] = (int) $row->aggregate;
            }
        }

        foreach (DirectorySuggestion::MODULES as $module) {
            $pendingAdd = $dirCounts[$module]['add'];
            $pendingEdit = $dirCounts[$module]['edit'];
            $meta = self::SECTIONS[$module];

            $sectionSummaries[$module] = [
                'id' => $module,
                'label' => $meta['label'],
                'admin_url' => $meta['admin_url'],
                'pending_count' => $pendingAdd + $pendingEdit,
                'breakdown' => array_values(array_filter([
                    $pendingAdd > 0 ? ['label' => 'إضافة', 'count' => $pendingAdd] : null,
                    $pendingEdit > 0 ? ['label' => 'تعديل', 'count' => $pendingEdit] : null,
                ])),
            ];

            $rows = DirectorySuggestion::forModule($module)
                ->pending()
                ->with('user:id,name')
                ->latest('created_at')
                ->limit($perQueueLimit)
                ->get();

            foreach ($rows as $suggestion) {
                $presented = $this->directorySuggestions->present($suggestion);
                $items[] = [
                    'uid' => 'dir:'.$suggestion->id,
                    'section' => $module,
                    'item_type' => $suggestion->kind === 'add' ? 'directory_add' : 'directory_edit',
                    'record_id' => $suggestion->id,
                    'title' => $suggestion->title,
                    'subtitle' => $suggestion->target_label,
                    'details' => $suggestion->details,
                    'payload' => $presented['payload'],
                    'source_url' => $suggestion->source_url,
                    'submitter_name' => $presented['submitter_name'],
                    'created_at' => $presented['created_at'],
                    'section_admin_url' => $meta['admin_url'],
                    'item_admin_url' => $presented['target_edit_url'],
                    'action_meta' => [
                        'module' => $module,
                    ],
                ];
            }
        }

        // 2. Promises (pending promises, proposed speakers, visitor reports)
        $pendingPromisesCount = Promise::inReviewQueue()->count();
        $pendingSpeakersCount = PromiseSpeaker::inReviewQueue()->count();
        $pendingPromiseReportsCount = PromiseReport::inReviewQueue()->count();

        $sectionSummaries['promises'] = [
            'id' => 'promises',
            'label' => self::SECTIONS['promises']['label'],
            'admin_url' => self::SECTIONS['promises']['admin_url'],
            'pending_count' => $pendingPromisesCount + $pendingSpeakersCount + $pendingPromiseReportsCount,
            'breakdown' => array_values(array_filter([
                $pendingPromisesCount > 0 ? ['label' => 'وعود', 'count' => $pendingPromisesCount] : null,
                $pendingSpeakersCount > 0 ? ['label' => 'أشخاص', 'count' => $pendingSpeakersCount] : null,
                $pendingPromiseReportsCount > 0 ? ['label' => 'بلاغات وتحديثات', 'count' => $pendingPromiseReportsCount] : null,
            ])),
        ];

        $pendingPromises = Promise::inReviewQueue()
            ->with(['speaker:id,name,status', 'submitter:id,name'])
            ->withCount('sources')
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        foreach ($pendingPromises as $promise) {
            $items[] = [
                'uid' => 'promise:'.$promise->id,
                'section' => 'promises',
                'item_type' => 'promise_suggestion',
                'record_id' => $promise->id,
                'title' => $promise->title,
                'subtitle' => $promise->speaker?->name,
                'details' => $promise->submitter_note ?: ($promise->summary ?: $promise->quote),
                'payload' => array_filter([
                    'sources_count' => (int) ($promise->sources_count ?? 0),
                    'statement_date' => $promise->statement_date?->format('Y-m-d'),
                    'origin' => $promise->origin,
                ], fn ($v) => $v !== null && $v !== ''),
                'source_url' => null,
                'submitter_name' => $promise->submitter?->name ?? 'مستخدم',
                'created_at' => $promise->created_at?->toIso8601String(),
                'section_admin_url' => '/admin/promises/review',
                'item_admin_url' => "/admin/promises/{$promise->id}/edit",
                'action_meta' => [
                    'sources_count' => (int) ($promise->sources_count ?? 0),
                    'speaker_pending' => $promise->speaker?->status === 'pending',
                ],
            ];
        }

        $pendingSpeakers = PromiseSpeaker::inReviewQueue()
            ->withCount('promises')
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        $speakerSubmitterIds = $pendingSpeakers->pluck('submitted_by')->filter()->unique()->values()->all();
        $speakerSubmitters = $speakerSubmitterIds !== []
            ? User::withTrashed()->whereIn('id', $speakerSubmitterIds)->pluck('name', 'id')
            : collect();

        foreach ($pendingSpeakers as $speaker) {
            $items[] = [
                'uid' => 'promise_speaker:'.$speaker->id,
                'section' => 'promises',
                'item_type' => 'promise_speaker',
                'record_id' => $speaker->id,
                'title' => $speaker->name,
                'subtitle' => $speaker->title ?: 'بلا منصب محدد',
                'details' => null,
                'payload' => [
                    'promises_count' => (int) ($speaker->promises_count ?? 0),
                ],
                'source_url' => null,
                'submitter_name' => $speaker->submitted_by ? ($speakerSubmitters[$speaker->submitted_by] ?? 'مستخدم') : 'زائر',
                'created_at' => $speaker->created_at?->toIso8601String(),
                'section_admin_url' => '/admin/promises/review',
                'item_admin_url' => '/admin/promises/review',
                'action_meta' => [],
            ];
        }

        $pendingPromiseReports = PromiseReport::inReviewQueue()
            ->with(['promise:id,number,title', 'user:id,name'])
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        foreach ($pendingPromiseReports as $report) {
            $promiseLabel = $report->promise
                ? ($report->promise->number !== null ? "#{$report->promise->number} — {$report->promise->title}" : $report->promise->title)
                : null;

            $items[] = [
                'uid' => 'promise_report:'.$report->id,
                'section' => 'promises',
                'item_type' => $report->kind === 'error' ? 'promise_report_error' : 'promise_report_progress',
                'record_id' => $report->id,
                'title' => $promiseLabel ?? 'بلاغ على وعد',
                'subtitle' => $report->kind === 'error' ? 'بلاغ خطأ' : 'تحديث تقدّم',
                'details' => $report->body,
                'payload' => [],
                'source_url' => $report->source_url,
                'submitter_name' => $report->user?->name ?? 'مستخدم محذوف',
                'created_at' => $report->created_at?->toIso8601String(),
                'section_admin_url' => '/admin/promises/review',
                'item_admin_url' => $report->promise ? "/admin/promises/{$report->promise->id}/edit" : '/admin/promises/review',
                'action_meta' => [
                    'report_kind' => $report->kind,
                ],
            ];
        }

        // 3. Mishwar / Places (pending place submissions + open place reports)
        $pendingPlacesCount = Place::where('status', 'pending')->count();
        $openPlaceReportsCount = PlaceReport::where('status', 'open')->whereHas('place')->count();

        $sectionSummaries['places'] = [
            'id' => 'places',
            'label' => self::SECTIONS['places']['label'],
            'admin_url' => self::SECTIONS['places']['admin_url'],
            'pending_count' => $pendingPlacesCount + $openPlaceReportsCount,
            'breakdown' => array_values(array_filter([
                $pendingPlacesCount > 0 ? ['label' => 'أماكن جديدة', 'count' => $pendingPlacesCount] : null,
                $openPlaceReportsCount > 0 ? ['label' => 'بلاغات', 'count' => $openPlaceReportsCount] : null,
            ])),
        ];

        $pendingPlaces = Place::where('status', 'pending')
            ->with(['user:id,name'])
            ->withCount('photos')
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        foreach ($pendingPlaces as $place) {
            $items[] = [
                'uid' => 'place:'.$place->id,
                'section' => 'places',
                'item_type' => 'place_submission',
                'record_id' => $place->id,
                'title' => $place->name,
                'subtitle' => null,
                'details' => $place->description,
                'payload' => array_filter([
                    'place_category' => $place->category,
                    'photos_count' => (int) ($place->photos_count ?? 0),
                ], fn ($v) => $v !== null && $v !== ''),
                'source_url' => null,
                'submitter_name' => $place->user?->name ?? 'مستخدم محذوف',
                'created_at' => $place->created_at?->toIso8601String(),
                'section_admin_url' => '/admin/places',
                'item_admin_url' => '/admin/places',
                'action_meta' => [
                    'place_category' => $place->category,
                ],
            ];
        }

        $openPlaceReports = PlaceReport::where('status', 'open')
            ->whereHas('place')
            ->with(['user:id,name', 'place:id,name,status'])
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        foreach ($openPlaceReports as $report) {
            $items[] = [
                'uid' => 'place_report:'.$report->id,
                'section' => 'places',
                'item_type' => 'place_report',
                'record_id' => $report->id,
                'title' => $report->place?->name ?? 'مكان في مشوار',
                'subtitle' => null,
                'details' => $report->details,
                'payload' => [
                    'report_reason' => $report->reason,
                ],
                'source_url' => null,
                'submitter_name' => $report->user?->name ?? 'مستخدم محذوف',
                'created_at' => $report->created_at?->toIso8601String(),
                'section_admin_url' => '/admin/places',
                'item_admin_url' => '/admin/places',
                'action_meta' => [
                    'report_reason' => $report->reason,
                    'place_status' => $report->place?->status ?? 'approved',
                ],
            ];
        }

        // 4. Transit (pending route drafts: new routes + edits to existing routes)
        $pendingTransitNewCount = RouteDraft::where('status', 'pending')->whereNull('route_id')->count();
        $pendingTransitEditCount = RouteDraft::where('status', 'pending')->whereNotNull('route_id')->count();

        $sectionSummaries['transit'] = [
            'id' => 'transit',
            'label' => self::SECTIONS['transit']['label'],
            'admin_url' => self::SECTIONS['transit']['admin_url'],
            'pending_count' => $pendingTransitNewCount + $pendingTransitEditCount,
            'breakdown' => array_values(array_filter([
                $pendingTransitNewCount > 0 ? ['label' => 'مسار جديد', 'count' => $pendingTransitNewCount] : null,
                $pendingTransitEditCount > 0 ? ['label' => 'تعديل مسار', 'count' => $pendingTransitEditCount] : null,
            ])),
        ];

        $pendingDrafts = RouteDraft::where('status', 'pending')
            ->select([
                'id', 'user_id', 'city_id', 'route_id', 'name_ar', 'name_en',
                'price', 'notes', 'status', 'created_at',
            ])
            ->with(['user:id,name', 'city:id,name_ar,name_en', 'linkedRoute:id,name_ar'])
            ->latest('created_at')
            ->limit($perQueueLimit)
            ->get();

        foreach ($pendingDrafts as $draft) {
            $isEdit = $draft->route_id !== null;
            $items[] = [
                'uid' => 'transit_draft:'.$draft->id,
                'section' => 'transit',
                'item_type' => $isEdit ? 'transit_route_edit' : 'transit_new_route',
                'record_id' => $draft->id,
                'title' => $draft->name_ar ?: ($draft->name_en ?: "مسودة رقم #{$draft->id}"),
                'subtitle' => $draft->city?->name_ar ?: $draft->city_id,
                'details' => $draft->notes,
                'payload' => array_filter([
                    'city' => $draft->city?->name_ar ?: $draft->city_id,
                    'price' => $draft->price !== null ? (string) $draft->price : null,
                    'linked_route' => $draft->linkedRoute?->name_ar,
                ], fn ($v) => $v !== null && $v !== ''),
                'source_url' => null,
                'submitter_name' => $draft->user?->name ?? 'مساهم مجهول',
                'created_at' => $draft->created_at?->toIso8601String(),
                'section_admin_url' => '/transit/admin',
                'item_admin_url' => "/transit/studio?edit={$draft->id}",
                'action_meta' => [
                    'city_id' => $draft->city_id,
                    'is_edit' => $isEdit,
                ],
            ];
        }

        // Unified chronological sort: newest first
        usort($items, static function (array $a, array $b): int {
            return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
        });

        $orderedSections = array_values($sectionSummaries);
        $totalPending = array_sum(array_column($orderedSections, 'pending_count'));

        return [
            'total_pending' => $totalPending,
            'sections' => $orderedSections,
            'items' => $items,
            'generated_at' => now()->toIso8601String(),
        ];
    }
}
