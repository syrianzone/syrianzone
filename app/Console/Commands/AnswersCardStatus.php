<?php

namespace App\Console\Commands;

use App\Models\AnswerSocialPost;
use Illuminate\Console\Command;

class AnswersCardStatus extends Command
{
    protected $signature = 'answers:card-status {answer_id? : show only this answer}';

    protected $description = 'Show the recorded answer card posts, newest first';

    public function handle(): int
    {
        $query = AnswerSocialPost::query()->latest('created_at');
        if ($answerId = $this->argument('answer_id')) {
            $query->where('answer_id', $answerId);
        }

        $rows = $query->limit(10)->get();
        if ($rows->isEmpty()) {
            $this->info('No recorded answer posts.');

            return self::SUCCESS;
        }

        foreach ($rows as $row) {
            $this->line(sprintf(
                '%s  %-8s  x_post=%s  posted_at=%s  error=%s',
                $row->answer_id,
                $row->status,
                $row->x_post_id ?? '-',
                $row->posted_at?->toDateTimeString() ?? '-',
                $row->last_error ?? '-',
            ));
        }

        return self::SUCCESS;
    }
}
