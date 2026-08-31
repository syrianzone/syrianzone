<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Accounts keyed by the exact candidate name in production, collected by
    // the maintainer and verified against official sites, Wikidata, and press
    // on 2026-08-31. A person without an account carries the official account
    // of the ministry or governorate they work in; security commanders carry
    // the interior ministry. Names with no verifiable account stay null.
    private const HANDLES = [
        // ministers without a personal account: ministry accounts
        'محمد يسر برنية' => 'SyrMOfF',
        'نضال الشعار' => 'SyMOEAI',
        'مازن الصالحاني' => 'MOTourismS',
        'يعرب بدر' => 'SyrSMOT',
        'محمد تركو' => 'SyrMOEgov',
        // agriculture has no X account, so باسل السويدان stays null
        'طلال الهلالي' => 'helalitalal',

        // governors: personal where one exists, else the governorate
        'عامر الشيخ' => 'AmerAlsheikh0',
        'عبد الرحمن السهيان' => 'alsahyan992',
        // his self-described personal account could not be independently
        // verified, so the governorate account stands in
        'ماهر مروان' => 'DamascusGov1',
        'عزام غريب' => 'AleppoGov1',
        'أحمد علي مصطفى' => 'LatakiaaGov1',
        'محمد عبد الرحمن' => 'IdlibGov1',
        'أنور الزعبي' => 'daraagov1',
        'عبد الرحمن سلامة' => 'raqqaaGov1',
        'زياد فواز العايش' => 'deirezzorGov1',
        'أحمد الشامي' => 'tartusgov1',
        'غسان السيد' => 'quneitragov1',
        // حمص، السويداء، الحسكة have no working governorate X account

        // security commanders: none has a personal account
        'عبد العزيز الأحمد' => 'syrianmoi',
        'أحمد الدالاتي' => 'syrianmoi',
        'غسان محمد باكير' => 'syrianmoi',
        'رامي أسعد الطه' => 'syrianmoi',
        'عبد العال عبد العال' => 'syrianmoi',
        'مروان العلي' => 'syrianmoi',
        'أسامة عاتكة' => 'syrianmoi',
        'محمد عبد الغني' => 'syrianmoi',
        'حسام الطحان' => 'syrianmoi',
        'ملهم الشنتوت' => 'syrianmoi',
        'محمد الناصير' => 'syrianmoi',
        'ضرار الشملان' => 'syrianmoi',

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
