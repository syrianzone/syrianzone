<?php

namespace App\Services;

class TierlistPostText
{
    // X counts most text as one unit per character and emoji as two; mb_strlen
    // matches that here because each arrow emoji is two code points. The raw
    // URL also measures 32 against X's flat 23, so the check stays conservative.
    private const LIMIT = 280;

    public function make(array $before, array $after): ?string
    {
        $movements = $this->movements($before, $after);
        $risers = array_values(array_filter(
            $movements,
            fn (array $movement) => $movement['old_rank'] === null || $movement['candidate']['rank'] < $movement['old_rank'],
        ));
        $fallers = array_values(array_filter(
            $movements,
            fn (array $movement) => $movement['old_rank'] !== null && $movement['candidate']['rank'] > $movement['old_rank'],
        ));

        $header = 'تغيّر جديد في ترتيب تقييم الحكومة السورية 📊';
        $footer = "صوّت الآن:\nhttps://syrian.zone/tierlist";
        $lines = [];

        foreach ([$risers[0] ?? null, $fallers[0] ?? null] as $movement) {
            if ($movement === null) {
                continue;
            }

            $line = $this->line($movement, function (string $line) use ($header, $lines, $footer) {
                return mb_strlen($this->compose($header, [...$lines, $line], $footer)) <= self::LIMIT;
            });

            if ($line !== null) {
                $lines[] = $line;
            }
        }

        // No nameable movement (for example a candidate left the ranking).
        // The caller publishes the new order silently instead of posting.
        return $lines === [] ? null : $this->compose($header, $lines, $footer);
    }

    private function movements(array $before, array $after): array
    {
        $movements = [];
        $beforeByGroup = collect($before)->keyBy('key');

        foreach ($after as $groupIndex => $group) {
            $oldRanks = collect($beforeByGroup->get($group['key'])['candidates'] ?? [])
                ->keyBy('id');

            foreach ($group['candidates'] as $candidate) {
                $oldRank = $oldRanks->get($candidate['id'])['rank'] ?? null;
                if ($oldRank === $candidate['rank']) {
                    continue;
                }

                $movements[] = [
                    'candidate' => $candidate,
                    'group_index' => $groupIndex,
                    'old_rank' => $oldRank,
                    'distance' => $oldRank === null ? 999 : abs($oldRank - $candidate['rank']),
                ];
            }
        }

        usort($movements, function (array $left, array $right) {
            return ($right['distance'] <=> $left['distance'])
                ?: ($left['group_index'] <=> $right['group_index'])
                ?: ($left['candidate']['rank'] <=> $right['candidate']['rank']);
        });

        return $movements;
    }

    private function line(array $movement, callable $fits): ?string
    {
        $candidate = $movement['candidate'];
        $newRank = $candidate['rank'];
        $oldRank = $movement['old_rank'];
        $name = $this->limit($candidate['name'], 42);
        $title = ($candidate['title'] ?? '') !== '' ? $this->limit($candidate['title'], 48) : null;
        $handle = ($candidate['x_handle'] ?? '') !== '' ? '@'.$candidate['x_handle'] : null;

        // Longest identity first; drop the title, then the handle, until it fits.
        $identities = array_unique([
            implode(' ', array_filter([$name, $title, $handle])),
            implode(' ', array_filter([$name, $handle])),
            $name,
        ]);

        foreach ($identities as $identity) {
            if ($oldRank === null) {
                $line = "⬆️ دخول {$identity} إلى الترتيب في المركز {$newRank}";
            } elseif ($newRank < $oldRank) {
                $line = "⬆️ صعود {$identity} من المركز {$oldRank} إلى المركز {$newRank}";
            } else {
                $line = "⬇️ تراجع {$identity} من المركز {$oldRank} إلى المركز {$newRank}";
            }

            if ($fits($line)) {
                return $line;
            }
        }

        return null;
    }

    private function compose(string $header, array $lines, string $footer): string
    {
        return $header."\n\n".implode("\n", $lines)."\n\n".$footer;
    }

    private function limit(string $value, int $length): string
    {
        return mb_strlen($value) <= $length
            ? $value
            : rtrim(mb_substr($value, 0, $length - 3)).'...';
    }
}
