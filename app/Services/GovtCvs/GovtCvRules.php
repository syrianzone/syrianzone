<?php

namespace App\Services\GovtCvs;

use App\Models\GovtOfficeSlot;
use App\Models\GovtOfficial;
use Illuminate\Validation\Rule;

/**
 * Shared validation rules and Arabic messages for Government CVs (`السير الذاتية للمسؤولين`).
 *
 * Reused across `GovtCvAdminController` and MCP tools so validation rules and
 * Arabic error copy never drift.
 */
final class GovtCvRules
{
    public const LINK_PATTERN = '#^(https?://|/storage/|/images/|images/)#i';

    /**
     * Validation rules for creating or updating a `GovtOfficial`.
     *
     * @return array<string, mixed>
     */
    public function official(?GovtOfficial $official = null, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'slug' => [
                'nullable', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('govt_officials', 'slug')->ignore($official?->id),
            ],
            'full_name_ar' => [$req, 'string', 'max:255'],
            'display_name_ar' => ['nullable', 'string', 'max:255'],
            'full_name_en' => ['nullable', 'string', 'max:255'],
            'honorific_ar' => ['nullable', 'string', 'max:100'],
            'bio_summary_ar' => ['nullable', 'string', 'max:5000'],
            'office_status' => ['nullable', Rule::in(GovtCvVocabulary::officeStatuses())],
            'highest_tier' => ['nullable', Rule::in(GovtCvVocabulary::tiers())],
            'birth_year' => ['nullable', 'integer', 'between:1920,2015'],
            'birth_place_ar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'string', 'max:16', Rule::in(['male', 'female', 'M', 'F'])],
            'languages' => ['nullable', 'array', 'max:15'],
            'languages.*' => ['string', 'max:64'],
            'portrait_url' => ['nullable', 'string', 'max:500', 'regex:'.self::LINK_PATTERN],
            'cv_completeness' => ['nullable', Rule::in(GovtCvVocabulary::cvCompleteness())],
            'first_seen_in_office_at' => ['nullable', 'date_format:Y-m-d'],
            'last_seen_in_office_at' => ['nullable', 'date_format:Y-m-d'],
            'candidate_id' => [
                'nullable', 'string', 'exists:candidates,id',
                Rule::unique('govt_officials', 'candidate_id')->ignore($official?->id),
            ],
            'promise_speaker_id' => [
                'nullable', 'string', 'exists:promise_speakers,id',
                Rule::unique('govt_officials', 'promise_speaker_id')->ignore($official?->id),
            ],
            'official_entity_id' => [
                'nullable', 'string', 'max:255', 'exists:official_entities,id',
                Rule::unique('govt_officials', 'official_entity_id')->ignore($official?->id),
            ],
            'house_member_id' => [
                'nullable', 'integer', 'exists:house_members_2026,id',
                Rule::unique('govt_officials', 'house_member_id')->ignore($official?->id),
            ],
            'publish_status' => ['nullable', Rule::in(GovtCvVocabulary::publishStatuses())],
            'verification_level' => ['nullable', Rule::in(GovtCvVocabulary::verificationLevels())],
            'version' => ['nullable', 'integer', 'min:1'],
            'aliases' => ['nullable', 'array', 'max:25'],
            'aliases.*.alias_ar' => ['required', 'string', 'max:255'],
            'aliases.*.alias_type' => ['nullable', Rule::in(GovtCvVocabulary::aliasTypes())],
            'aliases.*.source_note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Validation rules for creating or updating a `GovtTenure`.
     *
     * @return array<string, mixed>
     */
    public function tenure(bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'office_slot_id' => ['nullable', 'string', 'exists:govt_office_slots,id'],
            'institution_id' => ['nullable', 'string', 'max:255', 'exists:official_entities,id'],
            'institution_name_ar' => ['nullable', 'string', 'max:255'],
            'role_title_ar' => [$req, 'string', 'max:255'],
            'tier' => [$req, Rule::in(GovtCvVocabulary::tiers())],
            'government_phase' => ['nullable', Rule::in(GovtCvVocabulary::governmentPhases())],
            'status' => ['nullable', Rule::in(GovtCvVocabulary::tenureStatuses())],
            'started_at' => ['nullable', 'date_format:Y-m-d'],
            'start_date_precision' => ['nullable', Rule::in(GovtCvVocabulary::datePrecisions())],
            'start_decree_ref' => ['nullable', 'string', 'max:160'],
            'ended_at' => ['nullable', 'date_format:Y-m-d'],
            'end_date_precision' => ['nullable', Rule::in(GovtCvVocabulary::datePrecisions())],
            'end_reason' => ['nullable', Rule::in(GovtCvVocabulary::endReasons())],
            'end_decree_ref' => ['nullable', 'string', 'max:160'],
            'first_operational_seen_at' => ['nullable', 'date_format:Y-m-d'],
            'last_operational_seen_at' => ['nullable', 'date_format:Y-m-d'],
            'operational_mentions_count' => ['nullable', 'integer', 'min:0'],
            'is_acting' => ['nullable', 'boolean'],
            'notes_ar' => ['nullable', 'string', 'max:5000'],
            'auto_close_incumbent' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Validation rules for creating or updating a `GovtCvEntry`.
     *
     * @return array<string, mixed>
     */
    public function cvEntry(bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'section' => [$req, Rule::in(GovtCvVocabulary::cvSections())],
            'title_ar' => [$req, 'string', 'max:255'],
            'organization_ar' => ['nullable', 'string', 'max:255'],
            'location_ar' => ['nullable', 'string', 'max:255'],
            'start_year' => ['nullable', 'integer', 'between:1930,2100'],
            'end_year' => ['nullable', 'integer', 'between:1930,2100'],
            'is_ongoing' => ['nullable', 'boolean'],
            'details_ar' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Validation rules for reordering CV entries.
     *
     * @return array<string, mixed>
     */
    public function cvEntryOrder(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'string', 'distinct', 'exists:govt_cv_entries,id'],
        ];
    }

    /**
     * Validation rules for creating or updating a `GovtEvidenceLink`.
     *
     * @return array<string, mixed>
     */
    public function evidenceLink(bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'tenure_id' => ['nullable', 'string', 'exists:govt_tenures,id'],
            'evidence_type' => [$req, Rule::in(GovtCvVocabulary::evidenceTypes())],
            'paperless_record_id' => ['nullable', 'integer', 'min:1'],
            'paperless_channel_id' => ['nullable', 'string', 'max:100'],
            'paperless_message_id' => ['nullable', 'integer', 'min:1'],
            'chunk_type' => ['nullable', 'string', 'max:24'],
            'source_title_ar' => [$req, 'string', 'max:255'],
            'source_channel_ar' => ['nullable', 'string', 'max:255'],
            'source_url' => ['nullable', 'url:http,https', 'max:500'],
            'published_date' => ['nullable', 'date_format:Y-m-d'],
            'excerpt_ar' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Validation rules for creating or updating a `GovtOfficeSlot`.
     *
     * @return array<string, mixed>
     */
    public function officeSlot(?GovtOfficeSlot $slot = null, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'slug' => [
                'nullable', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('govt_office_slots', 'slug')->ignore($slot?->id),
            ],
            'title_ar' => [$req, 'string', 'max:255'],
            'institution_id' => ['nullable', 'string', 'max:255', 'exists:official_entities,id'],
            'institution_name_ar' => ['nullable', 'string', 'max:255'],
            'tier' => [$req, Rule::in(GovtCvVocabulary::tiers())],
            'is_single_seat' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(GovtCvVocabulary::slotStatuses())],
            'active_from' => ['nullable', 'date_format:Y-m-d'],
            'ended_at' => ['nullable', 'date_format:Y-m-d'],
            'lineage_note_ar' => ['nullable', 'string', 'max:5000'],
            'replaced_by_slot_id' => [
                'nullable', 'string', 'exists:govt_office_slots,id',
                Rule::notIn(array_filter([$slot?->id])),
            ],
        ];
    }

    /**
     * Validation rules for uploading a portrait image.
     *
     * @return array<string, mixed>
     */
    public function portraitUpload(): array
    {
        return [
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ];
    }

    /**
     * Arabic validation error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $date = 'التاريخ غير صالح (استخدم الصيغة YYYY-MM-DD)';
        $long = 'النص طويل جداً';
        $link = 'يجب أن يكون الرابط صالحاً';

        return [
            'slug.regex' => 'المعرّف الرابطي يجب أن يتكون من أحرف إنكليزية صغيرة وأرقام وشرطات فقط',
            'slug.unique' => 'هذا المعرّف الرابطي مستخدم مسبقاً',
            'slug.max' => $long,
            'full_name_ar.required' => 'اكتب الاسم الكامل للمسؤول بالعربية',
            'full_name_ar.max' => $long,
            'display_name_ar.max' => $long,
            'full_name_en.max' => $long,
            'honorific_ar.max' => $long,
            'bio_summary_ar.max' => $long,
            'office_status.in' => 'اختر حالة المنصب من القائمة',
            'highest_tier.in' => 'اختر الفئة القيادية من القائمة',
            'birth_year.integer' => 'أدخل سنة ميلاد صحيحة',
            'birth_year.between' => 'سنة الميلاد خارج النطاق المقبول',
            'birth_place_ar.max' => $long,
            'gender.in' => 'قيمة الجنس غير صالحة',
            'portrait_url.regex' => $link,
            'portrait_url.max' => $long,
            'cv_completeness.in' => 'اختر مستوى اكتمال السيرة من القائمة',
            'first_seen_in_office_at.date_format' => $date,
            'last_seen_in_office_at.date_format' => $date,
            'candidate_id.exists' => 'سجل المرشح في تصنيف المسؤولين غير موجود',
            'candidate_id.unique' => 'هذا المرشح مرتبط بمسؤول آخر مسبقاً',
            'promise_speaker_id.exists' => 'سجل المتحدث في عداد الوعود غير موجود',
            'promise_speaker_id.unique' => 'هذا المتحدث مرتبط بمسؤول آخر مسبقاً',
            'official_entity_id.exists' => 'الجهة أو الشخصية في دليل الحسابات الرسمية غير موجودة',
            'official_entity_id.unique' => 'هذا السجل مرتبط بمسؤول آخر مسبقاً',
            'house_member_id.exists' => 'عضو مجلس الشعب غير موجود',
            'house_member_id.unique' => 'عضو مجلس الشعب مرتبط بمسؤول آخر مسبقاً',
            'publish_status.in' => 'اختر حالة النشر من القائمة',
            'verification_level.in' => 'اختر مستوى التوثيق من القائمة',
            'version.integer' => 'رقم النسخة غير صالح',
            'aliases.*.alias_ar.required' => 'اكتب الاسم البديل بالعربية',
            'aliases.*.alias_type.in' => 'اختر نوع الاسم البديل من القائمة',
            'office_slot_id.exists' => 'المنصب المختار غير موجود',
            'institution_id.exists' => 'الجهة الرسمية المختارة غير موجودة',
            'role_title_ar.required' => 'اكتب المسمى الوظيفي للمنصب',
            'role_title_ar.max' => $long,
            'tier.required' => 'اختر الفئة القيادية للمنصب',
            'tier.in' => 'اختر الفئة القيادية من القائمة',
            'government_phase.in' => 'اختر المرحلة الحكومية من القائمة',
            'status.in' => 'اختر الحالة من القائمة',
            'started_at.date_format' => $date,
            'start_date_precision.in' => 'اختر دقة تاريخ البداية من القائمة',
            'ended_at.date_format' => $date,
            'end_date_precision.in' => 'اختر دقة تاريخ النهاية من القائمة',
            'end_reason.in' => 'اختر سبب انتهاء الولاية من القائمة',
            'first_operational_seen_at.date_format' => $date,
            'last_operational_seen_at.date_format' => $date,
            'section.required' => 'اختر قسم السيرة الذاتية',
            'section.in' => 'اختر قسم السيرة الذاتية من القائمة',
            'title_ar.required' => 'اكتب العنوان بالعربية',
            'title_ar.max' => $long,
            'start_year.integer' => 'أدخل سنة البداية كرقم صحيح',
            'start_year.between' => 'سنة البداية خارج النطاق المقبول',
            'end_year.integer' => 'أدخل سنة النهاية كرقم صحيح',
            'end_year.between' => 'سنة النهاية خارج النطاق المقبول',
            'evidence_type.required' => 'اختر نوع الدليل أو المصدر',
            'evidence_type.in' => 'اختر نوع الدليل من القائمة',
            'source_title_ar.required' => 'اكتب عنوان المصدر بالعربية',
            'source_title_ar.max' => $long,
            'source_url.url' => 'يجب أن يكون رابط المصدر صالحاً ويبدأ بـ https://',
            'source_url.max' => $long,
            'published_date.date_format' => $date,
            'tenure_id.exists' => 'فترة الخدمة المختارة غير موجودة',
            'replaced_by_slot_id.exists' => 'المنصب البديل غير موجود',
            'replaced_by_slot_id.not_in' => 'لا يمكن استبدال المنصب بنفسه',
            'ids.required' => 'تعذّر حفظ الترتيب',
            'ids.*.exists' => 'أحد عناصر السيرة الذاتية غير موجود',
            'ids.*.distinct' => 'تعذّر حفظ الترتيب لوجود تكرار',
            'image.required' => 'اختر صورة للمسؤول',
            'image.image' => 'الملف المرفوع ليس صورة صالحة',
            'image.mimes' => 'الصيغ المقبولة للصورة: JPG وPNG وWebP',
            'image.max' => 'حجم الصورة يتجاوز 8 ميغابايت',
        ];
    }
}
