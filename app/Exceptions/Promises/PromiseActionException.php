<?php

namespace App\Exceptions\Promises;

use App\Exceptions\DomainActionException;

/**
 * Domain refusal from the promises services. Transport-agnostic: controllers
 * map `httpStatus()` onto a response code (bootstrap/app.php renders it as
 * `{message}`), and an MCP tool can map it onto an error result.
 */
class PromiseActionException extends DomainActionException
{
    public const NOT_FOUND = 'not_found';

    public const NOT_PENDING = 'not_pending';

    public const NOT_PUBLISHED = 'not_published';

    public const ALREADY_PUBLISHED = 'already_published';

    public const SOURCE_REQUIRED = 'source_required';

    public const DATE_OUT_OF_ORDER = 'date_out_of_order';

    public const LOG_IS_PERMANENT = 'log_is_permanent';

    public const ONLY_LATEST_STATUS = 'only_latest_status';

    public const VOTING_CLOSED = 'voting_closed';

    public const MISSING_VOTER = 'missing_voter';

    public const SPEAKER_NOT_APPROVED = 'speaker_not_approved';

    public const SPEAKER_IN_USE = 'speaker_in_use';

    public const SECTOR_IN_USE = 'sector_in_use';

    public const BAD_SPEAKER_REF = 'bad_speaker_ref';

    public const BAD_RESTATEMENT = 'bad_restatement';

    public const BANNED = 'banned';

    public static function notFound(string $what = 'الوعد'): self
    {
        return new self(self::NOT_FOUND, "{$what} غير موجود");
    }

    public static function notPending(string $status): self
    {
        return new self(self::NOT_PENDING, 'تمت مراجعة هذا العنصر مسبقاً', ['status' => $status]);
    }

    public static function alreadyPublished(): self
    {
        return new self(self::ALREADY_PUBLISHED, 'الوعد منشور مسبقاً');
    }

    public static function notPublished(): self
    {
        return new self(self::NOT_PUBLISHED, 'الوعد غير منشور');
    }

    public static function sourceRequired(): self
    {
        return new self(self::SOURCE_REQUIRED, 'يجب إرفاق رابط مصدر لهذا التحديث');
    }

    public static function promiseNeedsSource(): self
    {
        return new self(self::SOURCE_REQUIRED, 'لا يمكن نشر وعد بلا مصدر واحد على الأقل');
    }

    public static function dateOutOfOrder(string $earliest): self
    {
        return new self(
            self::DATE_OUT_OF_ORDER,
            "لا يمكن أن يسبق تاريخ الحالة الجديدة {$earliest}: سجل الوعد يُقرأ بترتيب التواريخ",
            ['earliest' => $earliest],
        );
    }

    public static function statementAfterLog(string $firstEntry): self
    {
        return new self(
            self::DATE_OUT_OF_ORDER,
            "لا يمكن أن يأتي تاريخ التصريح بعد أول بند في سجل الوعد ({$firstEntry})",
            ['first_entry' => $firstEntry],
        );
    }

    public static function sameStatus(): self
    {
        return new self(self::NOT_PENDING, 'هذه هي الحالة الحالية للوعد');
    }

    public static function logIsPermanent(): self
    {
        return new self(
            self::LOG_IS_PERMANENT,
            'لا يمكن حذف تغيير الحالة من سجل وعد نُشر سابقاً، أضف تغييراً جديداً لتصحيحه',
        );
    }

    public static function onlyLatestStatus(): self
    {
        return new self(self::ONLY_LATEST_STATUS, 'يمكن التراجع عن آخر تغيير للحالة فقط');
    }

    public static function votingClosed(): self
    {
        return new self(self::VOTING_CLOSED, 'أُغلق التصويت على هذا الوعد بعد حسمه');
    }

    public static function missingVoter(): self
    {
        return new self(self::MISSING_VOTER, 'تعذّر تسجيل التصويت، أعد تحميل الصفحة وحاول مجدداً');
    }

    public static function speakerNotApproved(): self
    {
        return new self(self::SPEAKER_NOT_APPROVED, 'صاحب التصريح غير معتمد، اعتمده أولاً أو اختر شخصاً معتمداً');
    }

    public static function speakerInUse(int $count): self
    {
        return new self(self::SPEAKER_IN_USE, "لا يمكن حذف هذا الشخص لأنه مرتبط بـ {$count} من الوعود", ['count' => $count]);
    }

    public static function speakerHasPublishedPromises(): self
    {
        return new self(self::SPEAKER_IN_USE, 'لا يمكن رفض هذا الشخص لأن له وعوداً منشورة');
    }

    public static function sectorInUse(int $count): self
    {
        return new self(self::SECTOR_IN_USE, "لا يمكن حذف هذا القطاع لأنه مستخدم في {$count} من الوعود", ['count' => $count]);
    }

    public static function badSpeakerRef(): self
    {
        return new self(self::BAD_SPEAKER_REF, 'تعذّر العثور على الشخص المختار');
    }

    public static function badRestatement(): self
    {
        return new self(self::BAD_RESTATEMENT, 'لا يمكن ربط الوعد بهذا الوعد السابق');
    }

    public static function banned(): self
    {
        return new self(self::BANNED, 'حسابك موقوف عن المشاركة');
    }

    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::NOT_FOUND => 404,
            self::NOT_PENDING, self::NOT_PUBLISHED, self::ALREADY_PUBLISHED,
            self::VOTING_CLOSED, self::LOG_IS_PERMANENT, self::ONLY_LATEST_STATUS => 409,
            self::BANNED => 403,
            default => 422,
        };
    }
}
