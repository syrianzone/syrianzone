<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HouseMember2026;
use App\Support\Facts;
use App\Support\HouseMembers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class HouseApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $members = $this->loadMembers();

        $governorate = trim((string) $request->query('governorate', ''));
        $status = trim((string) $request->query('status', ''));
        $gender = trim((string) $request->query('gender', ''));
        $q = trim((string) $request->query('q', ''));

        if ($governorate !== '') {
            $govNeedle = mb_strtolower($governorate);
            $members = array_values(array_filter($members, function (array $m) use ($govNeedle): bool {
                return mb_strtolower((string) ($m['governorate_ar'] ?? '')) === $govNeedle
                    || mb_strtolower((string) ($m['governorate_display_ar'] ?? '')) === $govNeedle
                    || mb_strtolower((string) ($m['governorate_id'] ?? '')) === $govNeedle;
            }));
        }
        if ($status !== '') {
            $members = array_values(array_filter($members, fn (array $m) => ($m['status'] ?? null) === $status));
        }
        if ($gender !== '') {
            $genderUpper = strtoupper($gender);
            $members = array_values(array_filter($members, fn (array $m) => strtoupper((string) ($m['gender'] ?? '')) === $genderUpper));
        }
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $members = array_values(array_filter($members, function (array $m) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $m['name_ar'] ?? '',
                    $m['governorate_ar'] ?? '',
                    $m['district'] ?? '',
                    $m['town'] ?? '',
                    $m['member_number'] ?? '',
                    $m['management_position'] ?? '',
                    $m['category'] ?? '',
                ])));

                return str_contains($haystack, $needle);
            }));
        }

        return $this->cachedJson($request, [
            'members' => $members,
            'total' => count($members),
            'source_url' => HouseMembers::sourceUrl(),
        ]);
    }

    public function show(Request $request, string $memberNumber): JsonResponse
    {
        foreach ($this->loadMembers() as $member) {
            if ((string) ($member['member_number'] ?? '') === $memberNumber) {
                return $this->cachedJson($request, [
                    'member' => $member,
                    'source_url' => HouseMembers::sourceUrl(),
                ]);
            }
        }

        abort(404);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function loadMembers(): array
    {
        $cached = Cache::get(HouseMember2026::CACHE_KEY);
        if (is_array($cached) && $cached !== []) {
            return array_map(fn (array $row) => $this->normalizeRow($row), $cached);
        }

        try {
            $rows = HouseMember2026::query()
                ->orderBy('governorate_ar')
                ->orderBy('name_ar')
                ->get()
                ->toArray();

            if ($rows !== []) {
                Cache::put(HouseMember2026::CACHE_KEY, $rows, 600);

                return array_map(fn (array $row) => $this->normalizeRow($row), $rows);
            }
        } catch (\Throwable $e) {
            Log::warning('house_members_2026 DB read failed, falling back to CSV snapshot', ['error' => $e->getMessage()]);
        }

        try {
            return HouseMembers::all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function normalizeRow(array $row): array
    {
        $govRaw = trim((string) ($row['governorate_ar'] ?? ''));
        $gov = $govRaw !== '' ? Facts::governorateByAnyName($govRaw) : null;

        return array_merge($row, [
            'governorate_display_ar' => $gov !== null ? (string) $gov['name_ar'] : $govRaw,
            'governorate_id' => $gov !== null ? (string) $gov['id'] : null,
            'status' => ($row['status'] ?? 'active') ?: 'active',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function cachedJson(Request $request, array $data): JsonResponse
    {
        $response = response()->json($data);
        $response->setEtag(sha1($response->getContent() ?: ''));
        $response->setPublic();
        $response->setMaxAge(300);
        $response->setSharedMaxAge(300);
        $response->isNotModified($request);

        return $response;
    }
}
