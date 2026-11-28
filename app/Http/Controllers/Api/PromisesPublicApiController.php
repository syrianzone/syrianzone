<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promise;
use App\Models\PromiseSector;
use App\Services\Promises\PromisePresenter;
use App\Support\ArabicSearch;
use App\Support\Facts;
use App\Support\Governorates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public read-only JSON API for the promises tracker (`عداد الوعود`).
 */
class PromisesPublicApiController extends Controller
{
    public function __construct(
        private readonly PromisePresenter $presenter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $index = $this->presenter->index();
        $promises = is_array($index['promises'] ?? null) ? $index['promises'] : [];

        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);
        $state = trim((string) $request->query('state', (string) $request->query('status', '')));
        $sector = trim((string) $request->query('sector', ''));
        $governorate = trim((string) $request->query('governorate', ''));
        $speakerId = trim((string) $request->query('speaker_id', ''));
        $institutionId = trim((string) $request->query('institution_id', ''));

        $filtered = $promises;

        if ($state !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => (string) ($p['displayState'] ?? $p['status'] ?? '') === $state
                    || (string) ($p['status'] ?? '') === $state,
            ));
        }

        if ($sector !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => (string) ($p['sector']['slug'] ?? $p['sector']['id'] ?? '') === $sector,
            ));
        }

        if ($governorate !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => in_array($governorate, (array) ($p['governorates'] ?? []), true),
            ));
        }

        if ($speakerId !== '') {
            $filtered = array_values(array_filter($filtered, function (array $p) use ($speakerId): bool {
                if ((string) ($p['speaker']['id'] ?? '') === $speakerId) {
                    return true;
                }
                foreach ((array) ($p['coSpeakers'] ?? []) as $co) {
                    if ((string) ($co['id'] ?? '') === $speakerId) {
                        return true;
                    }
                }

                return false;
            }));
        }

        if ($institutionId !== '') {
            $filtered = array_values(array_filter(
                $filtered,
                fn (array $p): bool => (string) ($p['institution']['id'] ?? '') === $institutionId,
            ));
        }

        $folded = ArabicSearch::fold($query);
        if ($folded !== '') {
            $filtered = array_values(array_filter($filtered, function (array $p) use ($folded): bool {
                $haystack = ArabicSearch::fold(implode(' ', [
                    (string) ($p['number'] ?? ''),
                    (string) ($p['title'] ?? ''),
                    (string) ($p['speaker']['name'] ?? ''),
                    (string) ($p['institution']['name'] ?? ''),
                    (string) ($p['sector']['name'] ?? ''),
                    implode(' ', (array) ($p['tags'] ?? [])),
                ]));

                return str_contains($haystack, $folded);
            }));
        }

        return response()->json([
            'data' => [
                'promises' => $filtered,
                'stats' => $index['stats'] ?? [],
                'filters' => $index['filters'] ?? [],
                'due_soon_days' => $index['dueSoonDays'] ?? Promise::DUE_SOON_DAYS,
            ],
            'meta' => [
                'count' => count($filtered),
                'total' => count($promises),
                'filters' => [
                    'q' => $query !== '' ? $query : null,
                    'state' => $state !== '' ? $state : null,
                    'sector' => $sector !== '' ? $sector : null,
                    'governorate' => $governorate !== '' ? $governorate : null,
                    'speaker_id' => $speakerId !== '' ? $speakerId : null,
                    'institution_id' => $institutionId !== '' ? $institutionId : null,
                ],
            ],
        ], 200, [
            'Cache-Control' => 'public, max-age=60',
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $payload = [
            'data' => [
                'sectors' => PromiseSector::active()->orderBy('order_column')->get()->map->toOption()->all(),
                'governorates' => Governorates::options(),
                'statuses' => Facts::promiseStatuses(),
                'states' => Facts::promiseStates(),
                'venues' => Facts::promiseVocabulary('venues'),
                'source_types' => Facts::promiseVocabulary('source_types'),
                'earliest_statement_date' => Promise::EARLIEST_STATEMENT_DATE,
                'due_soon_days' => Promise::DUE_SOON_DAYS,
            ],
            'meta' => [
                'today' => Promise::today()->format('Y-m-d'),
            ],
        ];

        $etag = '"'.sha1((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)).'"';
        $headers = [
            'Cache-Control' => 'public, max-age=300',
            'ETag' => $etag,
        ];

        if ($request->header('If-None-Match') === $etag) {
            return response()->json(null, 304, $headers);
        }

        return response()->json($payload, 200, $headers);
    }

    public function show(int $number): JsonResponse
    {
        $promise = Promise::published()
            ->with([...PromisePresenter::PUBLIC_WITH, 'updates' => fn ($q) => $q->orderBy('occurred_on')->orderBy('id')])
            ->where('number', $number)
            ->firstOrFail();

        return response()->json([
            'data' => $this->presenter->detail($promise),
            'meta' => [
                'number' => $promise->number,
            ],
        ], 200, [
            'Cache-Control' => 'public, max-age=60',
        ]);
    }
}
