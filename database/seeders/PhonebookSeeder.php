<?php

namespace Database\Seeders;

use App\Models\PhonebookCategory;
use App\Models\PhonebookEntry;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PhonebookSeeder extends Seeder
{
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT59DuQe_jOSrhrjVS7J7kB8YdVJiUHMxkB1-LsZc5MlAVFnUQrDXGM0n4qFm5yqQpPqFn5zkhTGgHS/pub?output=csv';

    public function run(): void
    {
        if (PhonebookCategory::count() > 0 && PhonebookEntry::count() > 0) {
            return;
        }

        $csvData = null;
        try {
            $response = Http::timeout(10)->get(self::CSV_URL);
            if ($response->successful()) {
                $csvData = $response->body();
            }
        } catch (\Exception $e) {
            Log::warning('PhonebookSeeder: CSV fetch failed, falling back to default seed', ['error' => $e->getMessage()]);
        }

        if ($csvData) {
            $this->seedFromCSV($csvData);
        } else {
            $this->seedDefault();
        }
    }

    private function seedFromCSV(string $csvText): void
    {
        $lines = explode("\n", trim($csvText));
        if (count($lines) < 2) {
            $this->seedDefault();
            return;
        }

        $firstLine = $lines[0];
        if (str_starts_with($firstLine, "\xEF\xBB\xBF")) {
            $firstLine = substr($firstLine, 3);
        }
        $headers = str_getcsv($firstLine);

        $categories = [];
        $entries = [];

        for ($i = 1; $i < count($lines); $i++) {
            if (empty(trim($lines[$i]))) continue;

            $values = str_getcsv($lines[$i]);
            $row = [];
            foreach ($headers as $index => $header) {
                $headerName = trim($header);
                $row[$headerName] = isset($values[$index]) ? trim($values[$index]) : '';
            }

            $number = $row['Number'] ?? '';
            if (empty($number)) continue;

            $catAr = $row['Category_AR'] ?? 'عام';
            $catEn = $row['Category_EN'] ?? 'General';
            $catSlug = Str::slug($catEn ?: $catAr, '_') ?: 'general';

            if (!isset($categories[$catSlug])) {
                $categories[$catSlug] = [
                    'id' => $catSlug,
                    'label_ar' => $catAr,
                    'label_en' => $catEn ?: $catAr,
                    'order_column' => count($categories) + 1,
                    'is_active' => true,
                ];
            }

            $entryId = $row['ID'] ?? ("phone_" . ($i));
            if (empty($entryId)) {
                $entryId = "phone_" . $i;
            }

            $entries[] = [
                'id' => $entryId,
                'category_id' => $catSlug,
                'name_ar' => $row['Name_AR'] ?? ($row['Name_EN'] ?? 'رقم هاتف'),
                'name_en' => $row['Name_EN'] ?? null,
                'number' => $number,
                'is_whatsapp' => in_array(strtolower($row['Is_WhatsApp'] ?? ''), ['yes', '1', 'true']),
                'source_url' => $row['Source_URL'] ?? null,
                'order_column' => count($entries) + 1,
                'is_active' => true,
            ];
        }

        foreach ($categories as $cat) {
            PhonebookCategory::updateOrCreate(['id' => $cat['id']], $cat);
        }

        foreach ($entries as $ent) {
            PhonebookEntry::updateOrCreate(['id' => $ent['id']], $ent);
        }
    }

    private function seedDefault(): void
    {
        $defaultCategories = [
            ['id' => 'emergency', 'label_ar' => 'الطوارئ والنجدة', 'label_en' => 'Emergency & Rescue', 'order_column' => 1, 'is_active' => true],
            ['id' => 'services', 'label_ar' => 'الخدمات العشائرية والمدنية', 'label_en' => 'Civil & Public Services', 'order_column' => 2, 'is_active' => true],
            ['id' => 'governorates', 'label_ar' => 'المحافظات', 'label_en' => 'Governorates', 'order_column' => 3, 'is_active' => true],
        ];

        foreach ($defaultCategories as $cat) {
            PhonebookCategory::updateOrCreate(['id' => $cat['id']], $cat);
        }

        $defaultEntries = [
            ['id' => 'phone_red_crescent', 'category_id' => 'emergency', 'name_ar' => 'الهلال الأحمر العربي السوري', 'name_en' => 'Syrian Arab Red Crescent', 'number' => '133', 'is_whatsapp' => false, 'source_url' => null, 'order_column' => 1, 'is_active' => true],
            ['id' => 'phone_fire', 'category_id' => 'emergency', 'name_ar' => 'الإطفاء', 'name_en' => 'Fire Department', 'number' => '113', 'is_whatsapp' => false, 'source_url' => null, 'order_column' => 2, 'is_active' => true],
            ['id' => 'phone_police', 'category_id' => 'emergency', 'name_ar' => 'الشرطة / النجدة', 'name_en' => 'Police Rescue', 'number' => '110', 'is_whatsapp' => false, 'source_url' => null, 'order_column' => 3, 'is_active' => true],
            ['id' => 'phone_ambulance', 'category_id' => 'emergency', 'name_ar' => 'الإسعاف السريع', 'name_en' => 'Ambulance', 'number' => '110', 'is_whatsapp' => false, 'source_url' => null, 'order_column' => 4, 'is_active' => true],
        ];

        foreach ($defaultEntries as $ent) {
            PhonebookEntry::updateOrCreate(['id' => $ent['id']], $ent);
        }
    }
}
