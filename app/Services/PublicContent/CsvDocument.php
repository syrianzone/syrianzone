<?php

declare(strict_types=1);

namespace App\Services\PublicContent;

final class CsvDocument
{
    /**
     * @return list<array{number: int, values: array<string, string>}>
     */
    public function rows(string $csv, bool $lowercaseHeaders = false): array
    {
        $lines = preg_split('/\r\n|\n|\r/', trim($csv)) ?: [];
        if (count($lines) < 2) {
            return [];
        }

        $firstLine = $lines[0];
        if (str_starts_with($firstLine, "\xEF\xBB\xBF")) {
            $firstLine = substr($firstLine, 3);
        }

        $headers = array_map(function (string $header) use ($lowercaseHeaders): string {
            $header = trim($header);

            return $lowercaseHeaders ? strtolower($header) : $header;
        }, str_getcsv($firstLine));

        $rows = [];
        for ($index = 1; $index < count($lines); $index++) {
            if (trim($lines[$index]) === '') {
                continue;
            }

            $values = str_getcsv($lines[$index]);
            $row = [];
            foreach ($headers as $column => $header) {
                $row[$header] = isset($values[$column]) ? (string) $values[$column] : '';
            }

            $rows[] = [
                'number' => $index,
                'values' => $row,
            ];
        }

        return $rows;
    }
}
