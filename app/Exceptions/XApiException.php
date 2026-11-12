<?php

namespace App\Exceptions;

use RuntimeException;

class XApiException extends RuntimeException
{
    public function __construct(string $message, public readonly ?int $statusCode = null)
    {
        parent::__construct($message);
    }

    public function diagnosticMessage(): string
    {
        return $this->getMessage().($this->statusCode === null ? '' : " (HTTP {$this->statusCode})");
    }
}
