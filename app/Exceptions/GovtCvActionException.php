<?php

namespace App\Exceptions;

/**
 * Domain refusal from the Government CVs services (`السير الذاتية للمسؤولين`).
 *
 * Transport-agnostic: HTTP controllers and bootstrap/app.php map `httpStatus()`
 * onto a JSON error response (`{message}`), while MCP tools catch it to return
 * an agent-readable refusal.
 */
class GovtCvActionException extends DomainActionException
{
    public const NOT_FOUND = 'not_found';

    public const ALREADY_PUBLISHED = 'already_published';

    public const ALREADY_ARCHIVED = 'already_archived';

    public const SLOT_IN_USE = 'slot_in_use';

    public const SLUG_TAKEN = 'slug_taken';

    public const DATE_OUT_OF_ORDER = 'date_out_of_order';

    public const STALE = 'stale';

    public const INVALID_ACTION = 'invalid_action';

    public static function notFound(string $what = 'المسؤول'): self
    {
        return new self(self::NOT_FOUND, "{$what} غير موجود");
    }

    public static function alreadyPublished(): self
    {
        return new self(self::ALREADY_PUBLISHED, 'ملف المسؤول منشور مسبقاً');
    }

    public static function alreadyArchived(): self
    {
        return new self(self::ALREADY_ARCHIVED, 'ملف المسؤول مؤرشف مسبقاً');
    }

    public static function slotInUse(int $count): self
    {
        return new self(
            self::SLOT_IN_USE,
            "لا يمكن حذف هذا المنصب لأنه مرتبط بـ {$count} من فترات الخدمة",
            ['count' => $count],
        );
    }

    public static function slugTaken(string $slug): self
    {
        return new self(
            self::SLUG_TAKEN,
            "المعرّف الرابطي ({$slug}) مستخدم مسبقاً",
            ['slug' => $slug],
        );
    }

    public static function dateOutOfOrder(string $startedAt, string $endedAt): self
    {
        return new self(
            self::DATE_OUT_OF_ORDER,
            "لا يمكن أن يسبق تاريخ انتهاء المنصب ({$endedAt}) تاريخ بدايته ({$startedAt})",
            ['started_at' => $startedAt, 'ended_at' => $endedAt],
        );
    }

    public static function staleEdit(int $version): self
    {
        return new self(
            self::STALE,
            'عدّل أحدٌ ملف المسؤول بعد أن فتحته، أعد تحميل الصفحة ثم طبّق تعديلك',
            ['version' => $version],
        );
    }

    public static function invalidAction(string $message): self
    {
        return new self(self::INVALID_ACTION, $message);
    }

    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::NOT_FOUND => 404,
            self::ALREADY_PUBLISHED, self::ALREADY_ARCHIVED, self::SLOT_IN_USE, self::SLUG_TAKEN, self::STALE => 409,
            default => 422,
        };
    }
}
