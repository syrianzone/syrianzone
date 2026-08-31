<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Personal accounts collected by the maintainer on 2026-08-31, keyed by the
    // exact candidate name in production. Candidates without a personal account
    // stay null here; a later backfill adds ministry accounts once verified.
    private const HANDLES = [
        'أحمد الشرع' => 'AH_AlSharaa',
        'أسعد حسن الشيباني' => 'AsaadHShaibani',
        'محمد عبدالله الفار' => 'alfarMoh81',
        'مرهف أبو قصرة' => 'Murhaf_abuqasra',
        'أنس خطاب' => 'Anas_Khattab_sy',
        'رائد الصالح' => 'RaedAlSaleh3',
        'محمد البشير' => 'EMAlbasheir',
        'مصعب نزال العلي' => 'Musaab_Al_Ali',
        'نور الدين البابا' => 'MOISyriaSpox',
        'قتيبة بدوي' => 'q_badawi',
        'عامر العلي' => 'Aameral_Ali',
        'محمد حسان سكاف' => 'Mhd_AlSkaf',
        'مظهر الويس' => 'maabdwalshamee1',
        'عبد السلام هيكل' => 'amhaykal',
        'محمد طه الأحمد' => 'Mohamad29169351',
        'عمر الحصري' => 'ohosari',
        'محمد رسلان' => 'SafwatRaslan',
        'محمد أبو الخير شكري' => 'mhdchukri',
        'هند قبوات' => 'hind_kabawat',
        'محمد صالح' => 'AL_SAALEH',
        'محمد عنجراني' => 'Mohamad_anjrani',
        'مصطفى عبد الرزاق' => 'MustafaAR_sy',
        'مروان الحلبي' => 'marwan_alhalabi',
        'خالد زعرور' => 'KhaledFZaarour',
        'محمد سامح حامض' => 'hamoud_sameh',
    ];

    public function up(): void
    {
        $pollIds = DB::table('polls')->where('slug', 'best-ministers')->pluck('id');
        if ($pollIds->isEmpty()) {
            return;
        }

        foreach (self::HANDLES as $name => $handle) {
            DB::table('candidates')
                ->whereIn('poll_id', $pollIds)
                ->where('name', $name)
                ->whereNull('x_handle')
                ->update(['x_handle' => $handle]);
        }
    }

    public function down(): void
    {
        // Keep the handles; the column migration removes them with the column.
    }
};
