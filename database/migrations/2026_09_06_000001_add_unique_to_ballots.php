<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Deduplicate existing rows (keep earliest) so the unique index can be created
        // safely on production data that was written before the constraint existed.
        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement('DELETE b1 FROM ballots b1 INNER JOIN ballots b2 ON b1.poll_id = b2.poll_id AND b1.vote_day = b2.vote_day AND b1.voter_key = b2.voter_key AND b1.id > b2.id');
        } else {
            $dupes = DB::table('ballots')
                ->select('poll_id', 'vote_day', 'voter_key', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as c'))
                ->groupBy('poll_id', 'vote_day', 'voter_key')
                ->having('c', '>', 1)
                ->get();
            foreach ($dupes as $d) {
                DB::table('ballots')
                    ->where('poll_id', $d->poll_id)
                    ->where('vote_day', $d->vote_day)
                    ->where('voter_key', $d->voter_key)
                    ->where('id', '!=', $d->keep_id)
                    ->delete();
            }
        }

        Schema::table('ballots', function (Blueprint $table) {
            $table->unique(['poll_id', 'vote_day', 'voter_key'], 'ballots_poll_day_voter_unique');
            $table->index(['poll_id', 'vote_day'], 'ballots_poll_day_index');
        });
    }

    public function down(): void
    {
        Schema::table('ballots', function (Blueprint $table) {
            $table->dropUnique('ballots_poll_day_voter_unique');
            $table->dropIndex('ballots_poll_day_index');
        });
    }
};
