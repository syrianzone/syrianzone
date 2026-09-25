<?php

namespace App\Exceptions\Places;

use RuntimeException;

/**
 * Domain refusal from the places moderation layer.
 *
 * Deliberately transport-agnostic: the HTTP controller maps `status` onto a
 * response code, the MCP tool maps it onto an error response. Neither knows
 * about the other, and a third caller would not have to care either.
 */
class PlaceActionException extends RuntimeException
{
    public const NOT_PENDING = 'not_pending';

    public const NOT_FOUND = 'not_found';

    public const PHOTO_LIMIT = 'photo_limit';

    public const LAST_PHOTO = 'last_photo';

    public const PHOTO_FILE_MISSING = 'photo_file_missing';

    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public readonly string $kind,
        string $message,
        public readonly array $context = [],
    ) {
        parent::__construct($message);
    }

    public static function notPending(string $status): self
    {
        // Wording is pinned by the dashboard's contract (PlacesAdminTest asserts
        // on it verbatim). Agents get the "only pending can be moderated" hint
        // from the MCP tool layer instead of from here.
        return new self(
            self::NOT_PENDING,
            "Place is already {$status}",
            ['status' => $status],
        );
    }

    public static function notFound(int|string $id): self
    {
        return new self(
            self::NOT_FOUND,
            "No place exists with id {$id}.",
            ['id' => $id],
        );
    }

    public static function photoLimit(int $limit): self
    {
        return new self(
            self::PHOTO_LIMIT,
            "لا يمكن إضافة أكثر من {$limit} صور",
            ['limit' => $limit],
        );
    }

    public static function lastPhoto(): self
    {
        return new self(
            self::LAST_PHOTO,
            'لا يمكن حذف الصورة الأخيرة',
        );
    }

    public static function photoFileMissing(): self
    {
        return new self(
            self::PHOTO_FILE_MISSING,
            'ملف الصورة مفقود على الخادم، استخدم إعادة الرفع',
        );
    }

    /**
     * HTTP status the web admin has always returned for this refusal. Kept
     * here so the HTTP mapping is a lookup rather than a scattered if-chain.
     */
    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::NOT_FOUND => 404,
            self::NOT_PENDING => 400,
            default => 422,
        };
    }
}
