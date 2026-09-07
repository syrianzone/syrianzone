<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HouseMembers2026Seeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/data/house_members_2026.csv');
        if (! file_exists($path)) {
            $this->command->warn("house_members_2026.csv not found at {$path}");

            return;
        }

        $rows = array_map('str_getcsv', file($path));
        $header = array_shift($rows);

        foreach ($rows as $row) {
            if (count($row) < count($header)) {
                continue;
            }
            $data = array_combine($header, $row);
            DB::table('house_members_2026')->updateOrInsert(
                ['member_number' => $data['member_number'] ?: null],
                [
                    'name_ar' => $data['name_ar'] ?? null,
                    'governorate_ar' => $data['governorate_ar'] ?? null,
                    'district' => $data['district'] ?? null,
                    'town' => $data['town'] ?? null,
                    'gender' => $data['gender'] ?? null,
                    'birth_year' => is_numeric($data['birth_year'] ?? null) ? (int) $data['birth_year'] : null,
                    'age' => is_numeric($data['age'] ?? null) ? (int) $data['age'] : null,
                    'selection_method' => $data['selection_method'] ?? null,
                    'category' => $data['category'] ?? null,
                    'status' => in_array($data['status'] ?? '', ['active', 'resigned', 'dead', 'inactive'], true) ? $data['status'] : 'active',
                    'management_position' => $data['management_position'] ?? null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
}
