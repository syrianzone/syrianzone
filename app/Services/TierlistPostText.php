<?php

namespace App\Services;

class TierlistPostText
{
    public function make(array $before, array $after): string
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
                    'group' => $group,
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

        $header = 'تغيّر ترتيب التيرليست 👀';
        $footer = "صوّت وشوف الترتيب الكامل:\nhttps://syrian.zone/tierlist";
        $lines = [];

        foreach (array_slice($movements, 0, 2) as $movement) {
            $candidate = $this->limit($movement['candidate']['name'], 42);
            $group = $this->limit($movement['group']['name'], 28);
            $newRank = $movement['candidate']['rank'];
            $oldRank = $movement['old_rank'];

            if ($oldRank === null) {
                $line = "• {$candidate} دخل الترتيب بالمركز {$newRank} في {$group}";
            } elseif ($newRank < $oldRank) {
                $line = "• {$candidate} صعد من {$oldRank} إلى {$newRank} في {$group} ⬆️";
            } else {
                $line = "• {$candidate} نزل من {$oldRank} إلى {$newRank} في {$group} ⬇️";
            }

            $candidateText = $this->compose($header, [...$lines, $line], $footer);
            if (mb_strlen($candidateText) <= 280) {
                $lines[] = $line;
            }
        }

        if ($lines === []) {
            $groupName = $this->limit($after[0]['name'] ?? 'التيرليست', 32);
            $lines[] = "• استقر ترتيب جديد في {$groupName}";
        }

        return $this->compose($header, $lines, $footer);
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
