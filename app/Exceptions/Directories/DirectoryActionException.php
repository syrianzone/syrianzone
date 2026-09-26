<?php

namespace App\Exceptions\Directories;

use RuntimeException;

/**
 * Domain refusal from the directory modules (SyOfficial and Gov Apps).
 *
 * One exception for both because they are structurally the same module: a
 * string-keyed, ordered, is_active-flagged record with an admin form behind it.
 * Sharing it keeps the `httpStatus()` mapping in one place instead of two
 * copies that can disagree.
 *
 * Transport-agnostic, like App\Exceptions\Places\PlaceActionException: the HTTP
 * controller maps `kind` onto a status code, the MCP tool maps it onto an
 * agent-readable sentence.
 */
class DirectoryActionException extends RuntimeException
{
    public const NOT_FOUND = 'not_found';

    public const ID_TAKEN = 'id_taken';

    public const ID_REQUIRED = 'id_required';

    public const CATEGORY_NOT_FOUND = 'category_not_found';

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

    /**
     * @param  class-string  $label  Human noun for the message, e.g. 'Entity'.
     */
    public static function notFound(string $id, string $label = 'Record'): self
    {
        return new self(
            self::NOT_FOUND,
            "No {$label} exists with id {$id}.",
            ['id' => $id],
        );
    }

    public static function idTaken(string $id, string $label = 'Record'): self
    {
        return new self(
            self::ID_TAKEN,
            "The id \"{$id}\" is already in use by another {$label}. Choose a different id.",
            ['id' => $id],
        );
    }

    public static function idRequired(string $label = 'Record'): self
    {
        return new self(
            self::ID_REQUIRED,
            "A {$label} id is required and cannot be blank.",
        );
    }

    public static function categoryNotFound(string $id): self
    {
        return new self(
            self::CATEGORY_NOT_FOUND,
            "No category exists with id {$id}. List the categories first to see the valid ids.",
            ['id' => $id],
        );
    }

    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::NOT_FOUND, self::CATEGORY_NOT_FOUND => 404,
            self::ID_TAKEN => 422,
            default => 422,
        };
    }
}
