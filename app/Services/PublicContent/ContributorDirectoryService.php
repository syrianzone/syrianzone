<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

use Illuminate\Support\Facades\Cache;

final class ContributorDirectoryService
{
    /** @return list<array<string, int|string>> */
    public function all(): array
    {
        $path = config('services.mobile_public.contributors_path', public_path('contributors.json'));
        if (! is_string($path)) {
            return [];
        }

        $cacheKey = 'mobile:contributors:'.sha1($path);

        return Cache::remember($cacheKey, 3600, function () use ($path): array {
            if (! is_file($path)) {
                return [];
            }

            $decoded = json_decode((string) file_get_contents($path), true);
            if (! is_array($decoded)) {
                return [];
            }

            $contributors = [];
            foreach ($decoded as $entry) {
                if (! is_array($entry) || ! is_string($entry['username'] ?? null)) {
                    continue;
                }

                $contributors[] = [
                    'username' => $entry['username'],
                    'daily_contributions' => (int) ($entry['daily_contributions'] ?? 0),
                    'monthly_contributions' => (int) ($entry['monthly_contributions'] ?? 0),
                    'yearly_contributions' => (int) ($entry['yearly_contributions'] ?? 0),
                    'total_contributions' => (int) ($entry['total_contributions'] ?? 0),
                    'avatar_url' => (string) ($entry['avatar_url'] ?? ''),
                ];
            }

            return $contributors;
        });
    }

    /** @return array<string, int|string>|null */
    public function find(string $username): ?array
    {
        foreach ($this->all() as $contributor) {
            if (strcasecmp((string) $contributor['username'], $username) === 0) {
                return $contributor;
            }
        }

        return null;
    }
}
