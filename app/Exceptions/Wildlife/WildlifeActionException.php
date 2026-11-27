<?php

namespace App\Exceptions\Wildlife;

use App\Exceptions\DomainActionException;

/**
 * Domain refusal from the wildlife guide editor. Transport-agnostic: the MCP
 * tools turn `kind` into an agent-readable sentence, and an HTTP caller gets
 * `httpStatus()`.
 */
class WildlifeActionException extends DomainActionException
{
    public const NOT_FOUND = 'not_found';

    public const SLUG_TAKEN = 'slug_taken';

    public const SLUG_CHANGED = 'slug_changed';

    public const INVALID = 'invalid';

    public const STALE = 'stale';

    public const NOTHING_TO_PUBLISH = 'nothing_to_publish';

    public const NOT_PUBLIC = 'not_public';

    public static function notFound(string $slug): self
    {
        return new self(self::NOT_FOUND, "No species exists with slug \"{$slug}\".", ['slug' => $slug]);
    }

    public static function slugTaken(string $slug): self
    {
        return new self(self::SLUG_TAKEN, "The slug \"{$slug}\" is already used by another species.", ['slug' => $slug]);
    }

    public static function slugChanged(string $slug): self
    {
        return new self(
            self::SLUG_CHANGED,
            "The record's slug must stay \"{$slug}\": a slug is the species' public URL and cannot be changed.",
            ['slug' => $slug],
        );
    }

    /**
     * @param  list<string>  $errors
     */
    public static function invalid(array $errors): self
    {
        return new self(
            self::INVALID,
            'The record breaks the sourcing rules: '.implode(' ', $errors),
            ['errors' => $errors],
        );
    }

    public static function stale(string $slug, int $expected, int $current): self
    {
        return new self(
            self::STALE,
            "Species \"{$slug}\" changed since you read it (version {$expected}, now {$current}). Read it again and redo your change.",
            ['slug' => $slug, 'current_version' => $current],
        );
    }

    public static function nothingToPublish(string $slug): self
    {
        return new self(self::NOTHING_TO_PUBLISH, "Species \"{$slug}\" has no draft to publish and is already public.", ['slug' => $slug]);
    }

    public static function notPublic(string $slug): self
    {
        return new self(self::NOT_PUBLIC, "Species \"{$slug}\" is not on the public site, so there is nothing to unpublish.", ['slug' => $slug]);
    }

    public function httpStatus(): int
    {
        return match ($this->kind) {
            self::NOT_FOUND => 404,
            self::SLUG_TAKEN, self::STALE, self::NOTHING_TO_PUBLISH, self::NOT_PUBLIC => 409,
            default => 422,
        };
    }
}
