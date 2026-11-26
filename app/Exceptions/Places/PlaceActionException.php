<?php

namespace App\Exceptions\Places;

use App\Exceptions\DomainActionException;

/**
 * Domain refusal from the places moderation layer.
 *
 * Deliberately transport-agnostic: the HTTP controller maps `status` onto a
 * response code, the MCP tool maps it onto an error response. Neither knows
 * about the other, and a third caller would not have to care either.
 */
class PlaceActionException extends DomainActionException
{
    public const NOT_PENDING = 'not_pending';

    public const NOT_FOUND = 'not_found';

    public const NOT_APPROVED = 'not_approved';

    public const PHOTO_LIMIT = 'photo_limit';

    public const LAST_PHOTO = 'last_photo';

    public const PHOTO_FILE_MISSING = 'photo_file_missing';

    public const MERGE_SAME_PLACE = 'merge_same_place';

    public const ALREADY_MERGED = 'already_merged';

    public const MERGE_REQUIRES_APPROVED = 'merge_requires_approved';

    public const INVALID_MERGE_OPTION = 'invalid_merge_option';

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

    public static function notApproved(string $status): self
    {
        return new self(
            self::NOT_APPROVED,
            "Place is {$status}, only approved places can be unpublished",
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

    /**
     * A photo whose file is gone from disk. The dashboard and the agent surface
     * follow it with what to do next; the owner endpoint has never included
     * that sentence, and both wordings are pinned by their tests.
     */
    public static function photoFileMissing(bool $withRecoveryHint = true): self
    {
        return new self(
            self::PHOTO_FILE_MISSING,
            $withRecoveryHint
                ? 'ملف الصورة مفقود على الخادم، استخدم إعادة الرفع'
                : 'ملف الصورة مفقود على الخادم',
        );
    }

    public static function cannotMergeSamePlace(int $id): self
    {
        return new self(
            self::MERGE_SAME_PLACE,
            "Cannot merge place {$id} into itself: source_id and target_id must be different.",
            ['id' => $id],
        );
    }

    public static function alreadyMerged(int $sourceId, int $mergedIntoId): self
    {
        return new self(
            self::ALREADY_MERGED,
            "Place {$sourceId} has already been merged into place {$mergedIntoId}.",
            ['source_id' => $sourceId, 'merged_into_id' => $mergedIntoId],
        );
    }

    public static function mergeRequiresApproved(string $role, int $id, string $status): self
    {
        return new self(
            self::MERGE_REQUIRES_APPROVED,
            "Merge {$role} place {$id} has status '{$status}'; both source and target must be approved.",
            ['role' => $role, 'id' => $id, 'status' => $status],
        );
    }

    public static function invalidMergeOption(string $field, string $value): self
    {
        return new self(
            self::INVALID_MERGE_OPTION,
            "Invalid {$field} option '{$value}'.",
            ['field' => $field, 'value' => $value],
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
            self::NOT_PENDING, self::NOT_APPROVED => 400,
            self::ALREADY_MERGED => 409,
            default => 422,
        };
    }
}
