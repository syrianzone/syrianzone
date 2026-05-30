<?php

namespace App\Console\Commands;

use App\Models\{Ballot, BallotItem, Candidate, DailyRank, DailyScore, Poll};
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportLegacyPollData extends Command
{
    protected $signature = 'poll:import-legacy {path : The base path to the CSV files}';
    protected $description = 'Import legacy poll data from CSV files';

    private const POLLS = [
        '2500bb5f-bcd0-4c31-a594-4409867bb82e' => ['slug' => 'best-ministers', 'title' => 'Best Ministers', 'is_active' => true],
        'e9d5dd2e-3bf5-48fa-8b08-802bc481d143' => ['slug' => 'jolani', 'title' => 'Jolani Scenarios', 'is_active' => true],
    ];

    public function handle()
    {
        $basePath = $this->argument('path');

        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::beginTransaction();

        try {
            foreach (self::POLLS as $id => $data) {
                Poll::updateOrCreate(['id' => $id], $data);
                $this->info("Upserted poll: {$data['title']}");
            }

            $this->importCsv($basePath . '/candidates.csv', Candidate::class, [
                'id', 'poll_id', 'name', 'image_url', 'sort', 'created_at', 'title', 'category'
            ], fn($r) => ['updated_at' => $r[5], 'sort' => $r[4] === '' ? 0 : (int)$r[4]]);

            $this->importCsv($basePath . '/daily_scores.csv', DailyScore::class, [
                'poll_id', 'candidate_id', 'day', 'votes', 'score', 'updated_at'
            ], null, ['poll_id', 'candidate_id', 'day']);

            $this->importCsv($basePath . '/daily_ranks.csv', DailyRank::class, [
                'poll_id', 'candidate_id', 'day', 'rank', 'votes', 'score', 'created_at'
            ], null, ['poll_id', 'candidate_id', 'day']);

            $this->importCsv($basePath . '/ballots.csv', Ballot::class, [
                'id', 'poll_id', 'vote_day', 'voter_key', 'ip_hash', 'user_agent', 'created_at'
            ], fn($r) => ['updated_at' => $r[6]], ['id'], true);

            $this->importCsv($basePath . '/ballot_items.csv', BallotItem::class, [
                'id', 'ballot_id', 'candidate_id', 'tier', 'position'
            ], null, ['id'], true);

            DB::commit();
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            $this->info('Import completed successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            $this->error('Import failed: ' . $e->getMessage());
        }
    }

    private function importCsv(string $file, string $model, array $columns, ?callable $transform = null, array $keys = ['id'], bool $showProgress = false)
    {
        $name = class_basename($model);
        $this->info("Importing {$name} from {$file}");

        if (!file_exists($file)) {
            $this->warn("File not found: {$file}");
            return;
        }

        $handle = fopen($file, 'r');
        fgetcsv($handle);

        $bar = $showProgress ? $this->output->createProgressBar() : null;

        while (($row = fgetcsv($handle)) !== false) {
            $data = array_combine($columns, $row);
            $keyData = array_intersect_key($data, array_flip($keys));
            $values = array_diff_key($data, $keyData);

            if ($transform) {
                $values = array_merge($values, $transform($row));
            }

            $model::updateOrCreate($keyData, $values);
            $bar?->advance();
        }

        fclose($handle);
        $bar?->finish();
        $this->newLine();
    }
}
