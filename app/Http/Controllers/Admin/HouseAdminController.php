<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\HouseMember2026;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HouseAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HouseMember2026::query()
            ->orderBy('governorate_ar')
            ->orderBy('name_ar');

        if ($request->filled('governorate')) {
            $query->where('governorate_ar', (string) $request->query('governorate'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->filled('gender')) {
            $query->where('gender', strtoupper((string) $request->query('gender')));
        }
        if ($request->filled('q')) {
            $q = '%'.trim((string) $request->query('q')).'%';
            $query->where(function ($sub) use ($q) {
                $sub->where('name_ar', 'like', $q)
                    ->orWhere('governorate_ar', 'like', $q)
                    ->orWhere('district', 'like', $q)
                    ->orWhere('town', 'like', $q)
                    ->orWhere('member_number', 'like', $q)
                    ->orWhere('management_position', 'like', $q);
            });
        }

        $members = $query->get();

        return response()->json([
            'success' => true,
            'members' => $members,
            'total' => $members->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $member = HouseMember2026::create([
            'name_ar' => $data['name_ar'],
            'governorate_ar' => $data['governorate_ar'] ?? null,
            'district' => $data['district'] ?? null,
            'town' => $data['town'] ?? null,
            'gender' => isset($data['gender']) ? strtoupper((string) $data['gender']) : null,
            'birth_year' => $data['birth_year'] ?? null,
            'age' => $data['age'] ?? null,
            'selection_method' => $data['selection_method'] ?? null,
            'category' => $data['category'] ?? null,
            'status' => $data['status'] ?? 'active',
            'member_number' => $data['member_number'] ?? null,
            'management_position' => $data['management_position'] ?? null,
            'facebook_url' => $data['facebook_url'] ?? null,
            'twitter_url' => $data['twitter_url'] ?? null,
        ]);

        HouseMember2026::forgetRosterCache();

        return response()->json([
            'success' => true,
            'member' => $member,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $member = HouseMember2026::findOrFail($id);
        $data = $request->validate($this->rules($member, isUpdate: true));

        if (array_key_exists('gender', $data) && $data['gender'] !== null) {
            $data['gender'] = strtoupper((string) $data['gender']);
        }

        $member->fill($data);
        $member->save();

        HouseMember2026::forgetRosterCache();

        return response()->json([
            'success' => true,
            'member' => $member->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $member = HouseMember2026::findOrFail($id);
        $member->delete();

        HouseMember2026::forgetRosterCache();

        return response()->json(['success' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?HouseMember2026 $member = null, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return [
            'name_ar' => [$required, 'string', 'max:255'],
            'governorate_ar' => ['nullable', 'string', 'max:128'],
            'district' => ['nullable', 'string', 'max:128'],
            'town' => ['nullable', 'string', 'max:128'],
            'gender' => ['nullable', 'string', Rule::in(['M', 'F', 'm', 'f'])],
            'birth_year' => ['nullable', 'integer', 'between:1900,2025'],
            'age' => ['nullable', 'integer', 'between:18,120'],
            'selection_method' => ['nullable', 'string', 'max:128'],
            'category' => ['nullable', 'string', 'max:128'],
            'status' => ['sometimes', 'string', Rule::in(['active', 'resigned', 'dead', 'inactive'])],
            'member_number' => [
                'nullable',
                'string',
                'max:64',
                Rule::unique('house_members_2026', 'member_number')->ignore($member?->id),
            ],
            'management_position' => ['nullable', 'string', 'max:255'],
            'facebook_url' => ['nullable', 'string', 'max:2048', 'starts_with:http://,https://'],
            'twitter_url' => ['nullable', 'string', 'max:2048', 'starts_with:http://,https://'],
        ];
    }
}
