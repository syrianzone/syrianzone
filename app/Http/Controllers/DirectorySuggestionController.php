<?php

namespace App\Http\Controllers;

use App\Models\DirectorySuggestion;
use App\Services\Directories\DirectorySuggestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Public visitor submission endpoint for adding new entries or suggesting
 * corrections across `govtcvs`, `syofficial`, `govapps`, and `phonebook`.
 */
class DirectorySuggestionController extends Controller
{
    public function __construct(private readonly DirectorySuggestionService $service) {}

    public function store(Request $request, string $module): JsonResponse
    {
        if (! in_array($module, DirectorySuggestion::MODULES, true)) {
            abort(404);
        }

        $rules = [
            'kind' => ['required', Rule::in(DirectorySuggestion::KINDS)],
            'target_id' => ['nullable', 'string', 'max:128'],
            'title' => [
                Rule::requiredIf(fn () => ($request->input('kind') ?? 'add') === 'add' || blank($request->input('target_id'))),
                'nullable',
                'string',
                'min:2',
                'max:200',
            ],
            'details' => ['required', 'string', 'min:10', 'max:2000'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'payload' => ['nullable', 'array'],
        ];

        $rules = array_merge($rules, $this->modulePayloadRules($module, (string) ($request->input('kind') ?? 'add')));

        $validated = $request->validate($rules, [
            'kind.required' => 'يرجى اختيار نوع الاقتراح.',
            'kind.in' => 'نوع الاقتراح غير صالح.',
            'title.required' => 'يرجى كتابة العنوان أو الاسم المقترح.',
            'title.min' => 'يجب أن لا يقل العنوان عن حرفين.',
            'title.max' => 'العنوان طويل جداً (الحد الأقصى 200 حرف).',
            'details.required' => 'يرجى كتابة تفاصيل الإضافة أو التعديل.',
            'details.min' => 'يرجى كتابة تفاصيل أوضح (10 أحرف على الأقل).',
            'details.max' => 'التفاصيل طويلة جداً (الحد الأقصى 2000 حرف).',
            'source_url.url' => 'يرجى إدخال رابط مصدر صحيح يبدأ بـ https:// أو http://.',
            'payload.number.required' => 'يرجى إدخال رقم الهاتف المقترح.',
            'payload.account_url.url' => 'يرجى إدخال رابط حساب صحيح يبدأ بـ https:// أو http://.',
            'payload.official_url.url' => 'يرجى إدخال رابط موقع رسمي صحيح.',
            'payload.android_url.url' => 'يرجى إدخال رابط Google Play صحيح.',
            'payload.apple_url.url' => 'يرجى إدخال رابط App Store صحيح.',
        ]);

        $suggestion = $this->service->submit($request->user(), $module, $validated);

        return response()->json([
            'id' => $suggestion->id,
            'message' => 'شكراً لمساهمتك، وصل اقتراحك وسيراجعه فريق التحرير قبل اعتماده.',
        ], 201);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function modulePayloadRules(string $module, string $kind): array
    {
        return match ($module) {
            'govtcvs' => [
                'payload.role_title_ar' => ['nullable', 'string', 'max:200'],
                'payload.institution_name_ar' => ['nullable', 'string', 'max:200'],
                'payload.decree_ref' => ['nullable', 'string', 'max:200'],
            ],
            'syofficial' => [
                'payload.category_id' => ['nullable', 'string', 'max:64'],
                'payload.name_en' => ['nullable', 'string', 'max:200'],
                'payload.account_url' => ['nullable', 'url:http,https', 'max:2048'],
            ],
            'govapps' => [
                'payload.official_url' => ['nullable', 'url:http,https', 'max:2048'],
                'payload.android_url' => ['nullable', 'url:http,https', 'max:2048'],
                'payload.apple_url' => ['nullable', 'url:http,https', 'max:2048'],
            ],
            'phonebook' => [
                'payload.category_id' => ['nullable', 'string', 'max:64'],
                'payload.number' => [
                    Rule::requiredIf(fn () => $kind === 'add'),
                    'nullable',
                    'string',
                    'max:64',
                ],
                'payload.is_whatsapp' => ['nullable', 'boolean'],
            ],
            default => [],
        };
    }
}
