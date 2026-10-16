<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Base class for transport-agnostic domain refusal exceptions.
 *
 * Services throw subclasses of this exception when an operation is refused by
 * a business rule (e.g. a draft is no longer pending, a record does not exist,
 * or a user cannot ban themselves). HTTP controllers and the global exception
 * handler map `httpStatus()` to a standardized JSON error response
 * (`{"message": "..."}`), while MCP tools catch the exception to report an
 * agent-readable refusal.
 */
abstract class DomainActionException extends RuntimeException
{
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
     * HTTP status code for this domain refusal.
     */
    abstract public function httpStatus(): int;
}
