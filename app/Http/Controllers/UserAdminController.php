<?php

namespace App\Http\Controllers;

use App\Models\City;
use App\Models\User;
use App\Services\Users\UserAdministrationService;
use App\Support\Permissions\PermissionCatalogue;
use App\Support\Permissions\UserPermissionForm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserAdminController extends Controller
{
    public const SORTS = ['name', 'email', 'role', 'is_banned', 'created_at', 'deleted_at'];

    public function __construct(private readonly UserAdministrationService $users) {}

    public function options(Request $request): JsonResponse
    {
        $groups = [];
        foreach (PermissionCatalogue::groups() as $id => $permissions) {
            $meta = PermissionCatalogue::groupMeta()[$id];
            $groups[] = ['id' => $id, ...$meta, 'permissions' => collect($permissions)->map(fn ($label, $key) => ['id' => $key, 'label' => $label])->values()];
        }

        return response()->json([
            'can_manage_users' => true, 'actor_id' => $request->user()->id,
            'default_role' => 'user',
            'roles' => collect(UserPermissionForm::roleOptions())->map(fn ($label, $value) => ['value' => $value, 'label' => $label, 'can_be_banned' => $value !== 'superadmin'])->values(),
            'groups' => $groups, 'cities' => City::orderBy('name_ar')->get(['id', 'name_ar']),
            'limits' => ['per_page_max' => 100, 'bulk_max' => 500], 'sort_columns' => self::SORTS,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'q' => 'nullable|string|max:255', 'sort' => ['nullable', Rule::in(self::SORTS)],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])], 'trashed' => ['nullable', Rule::in(['without', 'with', 'only'])],
            'per_page' => 'nullable|integer|min:1|max:100', 'page' => 'nullable|integer|min:1',
        ]);
        $query = User::query();
        if (($input['trashed'] ?? '') === 'with') {
            $query->withTrashed();
        } elseif (($input['trashed'] ?? '') === 'only') {
            $query->onlyTrashed();
        }
        if (($input['q'] ?? '') !== '') {
            $term = '%'.$input['q'].'%';
            $query->where(fn ($builder) => $builder->where('name', 'like', $term)->orWhere('email', 'like', $term));
        }
        $page = $query->orderBy($input['sort'] ?? 'name', $input['direction'] ?? 'asc')->orderBy('id')
            ->paginate($input['per_page'] ?? 25);
        $page->setCollection($page->getCollection()->map(fn (User $user) => $this->users->present($user, $request->user()->id)));

        return response()->json($page);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json(['user' => $this->users->present(User::withTrashed()->findOrFail($id), $request->user()->id)]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->users->create($request->user(), $this->form($request));

        return response()->json(['success' => true, 'user' => $this->users->present($user, $request->user()->id), 'actor_can_manage_users' => true], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $existing = User::withTrashed()->findOrFail($id);
        $user = $this->users->update($request->user(), $id, $this->form($request, $existing));

        return response()->json(['success' => true, 'user' => $this->users->present($user, $request->user()->id), 'actor_can_manage_users' => UserAdministrationService::allows(User::find($request->user()->id))]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        return $this->single($request, $id, 'delete');
    }

    public function restore(Request $request, int $id): JsonResponse
    {
        return $this->single($request, $id, 'restore');
    }

    public function forceDestroy(Request $request, int $id): JsonResponse
    {
        return $this->single($request, $id, 'force-delete');
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['delete', 'restore', 'force-delete'])], 'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'required|integer|min:1|distinct', 'versions' => 'required|array|max:500', 'versions.*' => 'required|string|regex:/^[a-f0-9]{64}$/',
        ]);
        foreach ($data['ids'] as $id) {
            abort_unless(isset($data['versions'][$id]), 422, 'نسخة أحد السجلات مفقودة. أعد قراءة القائمة.');
        }
        $ids = array_map('intval', $data['ids']);
        $this->users->mutate($request->user(), $ids, $data['versions'], $data['action'], true);

        return response()->json(['success' => true, 'ids' => $ids, 'actor_deleted' => $data['action'] !== 'restore' && in_array($request->user()->id, $ids, true)]);
    }

    private function single(Request $request, int $id, string $action): JsonResponse
    {
        $data = $request->validate(['version' => 'required|string|regex:/^[a-f0-9]{64}$/']);
        $this->users->mutate($request->user(), [$id], [$id => $data['version']], $action);
        $response = ['success' => true, 'ids' => [$id], 'actor_deleted' => $action !== 'restore' && $id === $request->user()->id];
        if ($action === 'restore') {
            $response['user'] = $this->users->present(User::withTrashed()->findOrFail($id), $request->user()->id);
        }

        return response()->json($response);
    }

    private function form(Request $request, ?User $existing = null): array
    {
        $scopeOptions = array_unique([...City::pluck('id')->all(), ...($existing?->permission_scopes['transit'] ?? [])]);
        $rules = [
            'name' => 'required|string|max:255', 'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($existing?->id)],
            'role' => ['required', Rule::in(array_keys(UserPermissionForm::roleOptions()))], 'is_banned' => 'required|boolean',
            'password' => [$existing ? 'nullable' : 'required', 'string', 'max:255'],
            'permissions' => 'present|array|max:100', 'permissions.*' => ['required', 'string', 'distinct', Rule::in(PermissionCatalogue::all())],
            'transit_scope' => 'present|array|max:100', 'transit_scope.*' => ['required', 'string', 'distinct', Rule::in($scopeOptions)],
        ];
        if ($existing) {
            $rules['version'] = 'required|string|regex:/^[a-f0-9]{64}$/';
        }

        return $request->validate($rules, [
            'name.required' => 'اكتب اسم المستخدم.', 'name.max' => 'الاسم يجب ألا يتجاوز 255 حرفاً.',
            'email.required' => 'اكتب البريد الإلكتروني.', 'email.email' => 'أدخل بريداً إلكترونياً صالحاً.', 'email.unique' => 'هذا البريد الإلكتروني مستخدم.',
            'password.required' => 'أدخل كلمة مرور للمستخدم الجديد.', 'password.max' => 'كلمة المرور يجب ألا تتجاوز 255 حرفاً.',
            'role.in' => 'اختر دوراً من القائمة المتاحة.', 'permissions.*.in' => 'اختر صلاحيات معروفة من القائمة.',
            'transit_scope.*.in' => 'اختر محافظة من القائمة المتاحة.', 'version.required' => 'أعد قراءة سجل المستخدم قبل الحفظ.',
        ]);
    }
}
