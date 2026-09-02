<?php

namespace App\Console\Commands;

use App\Models\AnswerSocialPost;
use Illuminate\Console\Command;

class ReleaseAnswerCard extends Command
{
    protected $signature = 'answers:release-card {answer_id : the frozen answer to release}';

    protected $description = 'Delete a failed answer card row so the next run retries it';

    public function handle(): int
    {
        $row = AnswerSocialPost::query()->where('answer_id', $this->argument('answer_id'))->first();
        if ($row === null) {
            $this->error('No row for that answer.');

            return self::FAILURE;
        }

        // Only failed rows release. A posted row is history and a sending row
        // is ambiguous: the tweet may exist, so a human checks the account and
        // clears it in the database directly if a repost really is wanted.
        if ($row->status !== 'failed') {
            $this->error("Row is {$row->status}, not failed; refusing to release it.");

            return self::FAILURE;
        }

        $row->delete();
        $this->info("Released answer {$row->answer_id}; the next run may post it again.");

        return self::SUCCESS;
    }
}
