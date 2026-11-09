<?php

namespace App\Services\Promises;

use App\Models\Promise;
use App\Models\PromiseSource;
use App\Models\PromiseUpdate;
use App\Support\Governorates;
use Illuminate\Validation\Rule;

/**
 * Shared validation rules and messages for promises, speakers and change log entries.
 *
 * Shared between PromisesAdminController and the MCP tools so validation
 * rules and Arabic validation error messages cannot drift.
 */
final class PromiseRules
{
    /** Links rendered as hrefs or image sources: web URLs or our own uploads. */
    public const LINK_PATTERN = '#^(https?://|/storage/)#i';

    /** A handle on X: letters, digits and underscores, up to 15, optional @. */
    public const X_HANDLE_PATTERN = '/^@?[A-Za-z0-9_]{1,15}$/';

    /** Comfortably inside the decimal(18,2) columns that store measurements. */
    public const MAX_MEASURE = 999_999_999_999;

    /**
     * @return array<string, mixed>
     */
    public function promise(?Promise $promise = null): array
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
    public function update(): array
    {
        return [
            'type' => ['required', Rule::in(array_diff(PromiseUpdate::TYPES, ['status_change']))],
            'happened_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Promise::today()->format('Y-m-d')],
            'body' => ['nullable', 'string', 'max:2000', 'required_unless:type,progress'],
            'value' => ['nullable', 'numeric', 'between:-'.self::MAX_MEASURE.','.self::MAX_MEASURE, 'required_if:type,progress'],
            'source_url' => ['nullable', 'url:http,https', 'max:2048'],
            'archive_url' => ['nullable', 'url:http,https', 'max:2048'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function status(Promise $promise): array
    {
        return [
            'status' => ['required', Rule::in(Promise::STATUSES), Rule::notIn([$promise->status])],
            'happened_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Promise::today()->format('Y-m-d')],
            'body' => ['nullable', 'string', 'max:2000'],
            'source_url' => ['required', 'url:http,https', 'max:2048'],
            'archive_url' => ['nullable', 'url:http,https', 'max:2048'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function speaker(bool $required): array
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
     * Arabic messages for every admin form. Keys a given form does not use are
     * ignored by the validator.
     *
     * @return array<string, string>
     */
    public function messages(): array
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
