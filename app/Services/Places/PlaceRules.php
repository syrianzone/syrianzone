<?php

namespace App\Services\Places;

use App\Support\Facts;
use Illuminate\Validation\Rule;

/**
 * Validation rules and messages for places, in one place.
 *
 * The public submission form, the owner management endpoints, the admin editor
 * and the agent tools all accept the same fields, and their Arabic refusals are
 * part of the product contract. One definition per field and one message map
 * mean a new limit or a reworded refusal cannot reach only one surface.
 *
 * Bounds and lengths are constants rather than inline numbers so the rule text
 * and the message that quotes it stay in step. The geography and the category
 * vocabulary are not owned here: they are shared facts
 * (resources/data/syria.json, places.json) that the browser reads too.
 */
final class PlaceRules
{
    public const MAX_NAME = 160;

    public const MIN_DESCRIPTION = 20;

    public const MAX_DESCRIPTION = 1000;

    /** The upload cap, in kilobytes, before GD touches the bitmap. */
    public const MAX_PHOTO_KILOBYTES = 12288;

    public const MIN_PHOTO_EDGE = 200;

    public const MAX_PHOTO_EDGE = 6000;

    /**
     * The Syrian box every coordinate must fall inside, as the strings the
     * Arabic message prints (the forms show "32.0", not "32"). The bounds
     * themselves live in resources/data/syria.json, next to the box the client
     * and the POI search use.
     */
    public static function latMin(): string
    {
        return self::bound('lat_min');
    }

    public static function latMax(): string
    {
        return self::bound('lat_max');
    }

    public static function lngMin(): string
    {
        return self::bound('lng_min');
    }

    public static function lngMax(): string
    {
        return self::bound('lng_max');
    }

    /**
     * @return array<int, string>
     */
    public static function statuses(): array
    {
        return Facts::placeStatuses();
    }

    /**
     * @return array<int, string>
     */
    public static function categories(): array
    {
        return Facts::placeCategories();
    }

    /**
     * The box as [minLng, minLat, maxLng, maxLat].
     *
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public static function syriaBox(): array
    {
        return Facts::syriaBox();
    }

    /**
     * One box boundary, printed the way the forms show it ("32.0", not "32").
     */
    private static function bound(string $edge): string
    {
        return number_format((float) Facts::syria()['bbox'][$edge], 1, '.', '');
    }

    /**
     * A new submission: every field, with at least one photo.
     *
     * @return array<string, mixed>
     */
    public function store(): array
    {
        return [
            'name' => $this->name(),
            'category' => $this->category(),
            'description' => $this->description(),
            'lat' => $this->lat(),
            'lng' => $this->lng(),
            ...$this->photos(),
        ];
    }

    /**
     * The owner's edit form: any subset of the text fields.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        return [
            'name' => $this->name(partial: true),
            'category' => $this->category(partial: true),
            'description' => $this->description(partial: true),
        ];
    }

    /**
     * The admin editor: the same text fields plus the pin.
     *
     * @return array<string, mixed>
     */
    public function edit(): array
    {
        return [
            ...$this->details(),
            'lat' => $this->lat(partial: true),
            'lng' => $this->lng(partial: true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function location(): array
    {
        return [
            'lat' => $this->lat(),
            'lng' => $this->lng(),
        ];
    }

    /**
     * The public list filters (/places).
     *
     * @return array<string, mixed>
     */
    public function listFilters(): array
    {
        return [
            'category' => ['sometimes', 'string', Rule::in(self::categories())],
            'q' => ['sometimes', 'string', 'max:100'],
            'sort' => ['sometimes', Rule::in(['newest', 'popular'])],
            'user_id' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * The geocoder proxy's query.
     *
     * @return array<string, mixed>
     */
    public function geocode(): array
    {
        return ['q' => ['required', 'string', 'min:2', 'max:100']];
    }

    /**
     * The nearby drawer's query. The bounds here are the geographic ones, not
     * the Syria box: a visitor near the border may legitimately ask about a
     * point outside it.
     *
     * @return array<string, mixed>
     */
    public function nearby(): array
    {
        $radius = Facts::places()['nearby'];

        return [
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'radius_km' => ['sometimes', 'numeric', 'between:'.$radius['radius_km_min'].','.$radius['radius_km_max']],
            // Strict boolean rule rejects the "true"/"false" strings axios puts in query params.
            'include_pending' => ['sometimes', 'in:0,1,true,false'],
        ];
    }

    /**
     * One or more photos, as the submission form sends them.
     *
     * @return array<string, mixed>
     */
    public function photos(): array
    {
        return [
            'photos' => ['required', 'array', 'min:1', 'max:'.PlaceModerationService::MAX_PHOTOS_PER_PLACE],
            'photos.*' => $this->photoFile(),
        ];
    }

    /**
     * A single photo, as the add-photo endpoint sends it.
     *
     * @return array<string, mixed>
     */
    public function photo(): array
    {
        return ['photo' => $this->photoFile()];
    }

    /**
     * The moderation status filter: the three stored values plus "all".
     *
     * @return array<int, mixed>
     */
    public function statusFilter(bool $partial = true): array
    {
        return [
            ...($partial ? ['sometimes'] : []),
            Rule::in([...self::statuses(), 'all']),
        ];
    }

    /**
     * @return array<int, mixed>
     */
    public function name(bool $partial = false): array
    {
        return [...($partial ? ['sometimes', 'required'] : ['required']), 'string', 'max:'.self::MAX_NAME];
    }

    /**
     * @return array<int, mixed>
     */
    public function category(bool $partial = false): array
    {
        return [...($partial ? ['sometimes', 'required'] : ['required']), 'string', Rule::in(self::categories())];
    }

    /**
     * @return array<int, mixed>
     */
    public function description(bool $partial = false): array
    {
        return [
            ...($partial ? ['sometimes', 'required'] : ['required']), 'string',
            'min:'.self::MIN_DESCRIPTION, 'max:'.self::MAX_DESCRIPTION,
        ];
    }

    /**
     * @return array<int, mixed>
     */
    public function lat(bool $partial = false): array
    {
        return [...($partial ? ['sometimes', 'required'] : ['required']), 'numeric', 'between:'.self::latMin().','.self::latMax()];
    }

    /**
     * @return array<int, mixed>
     */
    public function lng(bool $partial = false): array
    {
        return [...($partial ? ['sometimes', 'required'] : ['required']), 'numeric', 'between:'.self::lngMin().','.self::lngMax()];
    }

    /**
     * The one photo rule: the format and the size ceilings, plus dimension
     * bounds because max_width/max_height cap decompression bombs before GD
     * allocates the bitmap.
     *
     * @return array<int, string>
     */
    private function photoFile(): array
    {
        return [
            'required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_PHOTO_KILOBYTES,
            'dimensions:min_width='.self::MIN_PHOTO_EDGE.',min_height='.self::MIN_PHOTO_EDGE
            .',max_width='.self::MAX_PHOTO_EDGE.',max_height='.self::MAX_PHOTO_EDGE,
        ];
    }

    /**
     * Arabic messages for every place form. Keys a given form does not use are
     * ignored by the validator.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        $name = 'أدخل اسم المكان';
        $nameText = 'اسم المكان يجب أن يكون نصاً';
        $nameLong = sprintf('اسم المكان يجب ألا يتجاوز %d حرفاً', self::MAX_NAME);
        $category = 'اختر التصنيف';
        $categoryInvalid = 'التصنيف المختار غير صالح';
        $descriptionRequired = 'أدخل وصف المكان';
        $descriptionText = 'الوصف يجب أن يكون نصاً';
        $descriptionShort = sprintf('الوصف يجب ألا يقل عن %d حرفاً', self::MIN_DESCRIPTION);
        $descriptionLong = sprintf('الوصف يجب ألا يتجاوز %d حرف', self::MAX_DESCRIPTION);
        $pinRequired = 'حدد موقع المكان على الخريطة';
        $latNumber = 'خط العرض يجب أن يكون رقماً';
        $lngNumber = 'خط الطول يجب أن يكون رقماً';
        $latBetween = sprintf('خط العرض يجب أن يكون بين %s و %s (داخل سوريا)', self::latMin(), self::latMax());
        $lngBetween = sprintf('خط الطول يجب أن يكون بين %s و %s (داخل سوريا)', self::lngMin(), self::lngMax());
        $photosRequired = 'أضف صورة واحدة على الأقل';
        $photosInvalid = 'صيغة الصور المرسلة غير صالحة';
        $photosMax = sprintf('الحد الأقصى %d صور', PlaceModerationService::MAX_PHOTOS_PER_PLACE);
        $megabytes = self::MAX_PHOTO_KILOBYTES / 1024;
        $uploadFailed = sprintf('تعذر رفع الصورة، تأكد أن حجمها لا يتجاوز %d ميغابايت', $megabytes);
        $unreadable = 'تعذر قراءة إحدى الصور، أعد اختيارها';
        $notImage = 'الملف يجب أن يكون صورة';
        $formats = 'الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP';
        $tooBig = sprintf('حجم الصورة يجب ألا يتجاوز %d ميغابايت', $megabytes);
        $dimensions = sprintf(
            'أبعاد الصورة يجب أن تكون بين %dx%d و %dx%d بكسل',
            self::MIN_PHOTO_EDGE, self::MIN_PHOTO_EDGE, self::MAX_PHOTO_EDGE, self::MAX_PHOTO_EDGE,
        );

        return [
            'name.required' => $name,
            'name.string' => $nameText,
            'name.max' => $nameLong,
            'category.required' => $category,
            'category.string' => $categoryInvalid,
            'category.in' => $categoryInvalid,
            'description.required' => $descriptionRequired,
            'description.string' => $descriptionText,
            'description.min' => $descriptionShort,
            'description.max' => $descriptionLong,
            'lat.required' => $pinRequired,
            'lat.numeric' => $latNumber,
            'lat.between' => $latBetween,
            'lng.required' => $pinRequired,
            'lng.numeric' => $lngNumber,
            'lng.between' => $lngBetween,
            'photos.required' => $photosRequired,
            'photos.array' => $photosInvalid,
            'photos.min' => $photosRequired,
            'photos.max' => $photosMax,
            'photos.*.uploaded' => $uploadFailed,
            'photos.*.required' => $unreadable,
            'photos.*.image' => $notImage,
            'photos.*.mimes' => $formats,
            'photos.*.max' => $tooBig,
            'photos.*.dimensions' => $dimensions,
            'photo.required' => 'أضف صورة',
            'photo.uploaded' => $uploadFailed,
            'photo.image' => $notImage,
            'photo.mimes' => $formats,
            'photo.max' => $tooBig,
            'photo.dimensions' => $dimensions,
        ];
    }

    /**
     * The owner's move-pin form has always asked for the coordinates with the
     * shorter wording; every other place refusal is shared.
     *
     * @return array<string, string>
     */
    public function locationMessages(): array
    {
        return array_replace($this->messages(), [
            'lat.required' => 'أدخل الإحداثيات',
            'lng.required' => 'أدخل الإحداثيات',
        ]);
    }
}
