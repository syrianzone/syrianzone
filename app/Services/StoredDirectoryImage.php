<?php

namespace App\Services;

final readonly class StoredDirectoryImage
{
    public function __construct(
        public string $disk,
        public string $path,
        public string $url,
    ) {}
}
