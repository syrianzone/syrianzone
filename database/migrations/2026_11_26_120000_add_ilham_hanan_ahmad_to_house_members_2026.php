<?php

use App\Models\HouseMember2026;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An empty roster (a fresh install or the test database) gets this
        // member from the seeder's CSV; only a seeded roster needs the insert.
        if (! Schema::hasTable('house_members_2026') || DB::table('house_members_2026')->doesntExist()) {
            return;
        }

        // Presidential Decree No. 200 of 2026 (26 Nov 2026) appointing Ilham Hanan Ahmad
        // to the People's Assembly.
        DB::table('house_members_2026')->updateOrInsert(
            ['member_number' => '208'],
            [
                'name_ar' => 'إلهام حنان أحمد',
                'governorate_ar' => 'حلب',
                'district' => 'عفرين',
                'town' => 'عفرين',
                'gender' => 'F',
                'birth_year' => 1963,
                'age' => 62,
                'selection_method' => 'تعيين',
                'category' => '',
                'status' => 'active',
                'management_position' => '',
                'facebook_url' => null,
                'twitter_url' => null,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        HouseMember2026::forgetRosterCache();
    }

    public function down(): void
    {
        if (! Schema::hasTable('house_members_2026')) {
            return;
        }

        DB::table('house_members_2026')->where('member_number', '208')->delete();
        HouseMember2026::forgetRosterCache();
    }
};
