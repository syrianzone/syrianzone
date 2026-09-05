<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('site_settings')->insert([
            'key' => 'homepage_popup',
            'value' => json_encode([
                'enabled' => true,
                'title' => 'صوتك بيعمل فرق!',
                'description' => 'ساهم في فك الحظر عن الخدمات التقنية في سوريا. صوّت للخدمات الأكثر أهمية بالنسبة لك لتكون من أولويات العمل.',
                'buttonText' => 'صوّت الآن',
                'dismissText' => 'لاحقاً',
                'link' => 'https://unblocksyria.com',
                'version' => 1,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
