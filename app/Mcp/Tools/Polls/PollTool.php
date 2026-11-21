<?php

namespace App\Mcp\Tools\Polls;

use App\Mcp\Tools\AuditedTool;
use App\Models\Candidate;
use App\Models\Poll;
use App\Services\Directories\SquareWebpImageService;
use App\Services\TierlistLeaderboard;
use Illuminate\Support\Facades\Http;

/**
 * Shared helpers for Polls / Tierlist MCP tools.
 */
abstract class PollTool extends AuditedTool
{
    public const IMAGE_DIR = 'tierlist/candidates';

    protected function resolvePoll(string $idOrSlug): ?Poll
    {
        return Poll::idOrSlug($idOrSlug)->first();
    }

    protected function forgetLeaderboard(?Poll $poll): void
    {
        if ($poll !== null) {
            app(TierlistLeaderboard::class)->forgetCache($poll);
        }
    }

    /**
     * Ingest an external HTTP(S) image URL as a 200x200 square WebP on R2.
     * Existing R2 or relative site asset URLs are preserved as-is.
     */
    protected function resolveImageUrl(?string $imageUrl, string $basename): ?string
    {
        if ($imageUrl === null) {
            return null;
        }

        $trimmed = trim($imageUrl);
        if ($trimmed === '') {
            return null;
        }

        if (! str_starts_with($trimmed, 'http://') && ! str_starts_with($trimmed, 'https://')) {
            return $trimmed;
        }

        // Keep URLs already hosted on our R2 bucket without re-downloading.
        $r2Url = (string) config('filesystems.disks.r2.url', '');
        if (($r2Url !== '' && str_starts_with($trimmed, rtrim($r2Url, '/')))
            || str_contains($trimmed, '.r2.dev/')) {
            return $trimmed;
        }

        $response = Http::timeout(15)
            ->withUserAgent('Mozilla/5.0 (compatible; SyrianZoneBot/1.0)')
            ->get($trimmed);

        if ($response->successful() && $response->body() !== '') {
            $stored = app(SquareWebpImageService::class)->storeSquareWebpFromBytes(
                $response->body(),
                self::IMAGE_DIR,
                $basename,
            );

            if ($stored !== null) {
                return $stored;
            }
        }

        return $trimmed;
    }

    /**
     * @return array<string, mixed>
     */
    protected function formatCandidate(Candidate $candidate): array
    {
        $candidate->loadMissing('group');

        return [
            'id' => $candidate->id,
            'poll_id' => $candidate->poll_id,
            'candidate_group_id' => $candidate->candidate_group_id,
            'group_name' => $candidate->group?->name,
            'group_key' => $candidate->group?->key,
            'name' => $candidate->name,
            'title' => $candidate->title,
            'x_handle' => $candidate->x_handle,
            'image_url' => $candidate->image_url,
            'category' => $candidate->category,
            'sort' => (int) ($candidate->sort ?? 0),
            'status' => $candidate->status ?? 'active',
            'term_started_at' => $candidate->term_started_at?->toDateString(),
            'term_ended_at' => $candidate->term_ended_at?->toDateString(),
            'archive_reason' => $candidate->archive_reason,
            'successor_id' => $candidate->successor_id,
        ];
    }
}
