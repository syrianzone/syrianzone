<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Role changes verified against press coverage on 2026-08-31:
    // - طلال الهلالي left the investment authority on 2026-08-06
    //   (Decree 162/2026 appointed أحمد رواد رمضان; sana.sy, enabbaladi.net).
    //   The successor has no photo yet, so admins add him separately.
    // - ملهم الشنتوت was promoted from Hama internal security commander to
    //   deputy interior minister in the July 2026 reshuffle (aljazeera.net).
    private const ARCHIVED = [
        'طلال الهلالي' => ['2026-08-06', 'انتهى تكليفه في هيئة الاستثمار'],
        'ملهم الشنتوت' => ['2026-07-19', 'رُقّي إلى معاونية وزير الداخلية'],
    ];

    public function up(): void
    {
        $pollIds = DB::table('polls')->where('slug', 'best-ministers')->pluck('id');
        if ($pollIds->isEmpty()) {
            return;
        }

        foreach (self::ARCHIVED as $name => [$termEndedAt, $reason]) {
            DB::table('candidates')
                ->whereIn('poll_id', $pollIds)
                ->where('name', $name)
                ->where('status', 'active')
                ->update([
                    'status' => 'archived',
                    'term_ended_at' => $termEndedAt,
                    'archive_reason' => $reason,
                ]);
        }
    }

    public function down(): void
    {
        // Restoring would need the previous term data; use the admin panel.
    }
};
