<?php

declare(strict_types=1);

use App\Models\PromiseSpeaker;
use Illuminate\Support\Facades\DB;

/** The approved fictional baseline is read-only to native tests. */
function nativeFixtureEnsurePromiseSpeaker(): PromiseSpeaker
{
    $runtime = dirname(__DIR__, 2).'/.expo/local-fixture';
    if (PHP_SAPI !== 'cli' || ! app()->environment('testing') || config('app.url') !== 'https://127.0.0.1:9443'
        || DB::connection()->getDriverName() !== 'sqlite' || DB::connection()->getDatabaseName() !== $runtime.'/database.sqlite'
        || is_link($runtime.'/database.sqlite') || realpath($runtime.'/database.sqlite') !== $runtime.'/database.sqlite'
        || trim(file_get_contents($runtime.'/fixture-marker')) !== 'native-loopback-fixture-v1') {
        throw new RuntimeException('The Promise speaker requires the isolated local testing database.');
    }
    $expected = [
        'id' => '50000000-0000-4000-8000-000000000001',
        'name' => 'مسؤول الوعود التجريبي المحلي', 'title' => 'شخصية خيالية للاختبار', 'status' => 'approved',
        'institution_id' => null, 'image_url' => null, 'x_handle' => null,
        'candidate_id' => null, 'official_entity_id' => null, 'house_member_id' => null,
        'submitted_by' => null, 'reviewed_by' => null, 'reviewed_at' => null, 'rejection_reason' => null,
        'created_at' => null, 'updated_at' => null,
    ];

    return DB::transaction(function () use ($expected): PromiseSpeaker {
        if (PromiseSpeaker::where('name', $expected['name'])->whereKeyNot($expected['id'])->exists()) {
            throw new RuntimeException('The synthetic speaker name is already owned by another row.');
        }
        $speaker = PromiseSpeaker::query()->whereKey($expected['id'])->lockForUpdate()->first();
        if ($speaker === null) {
            $speaker = new PromiseSpeaker;
            $speaker->timestamps = false;
            $speaker->forceFill($expected);
            // Baseline setup must not run the source PromiseIndexCache observer or other side effects.
            $speaker->saveQuietly();
            $speaker->refresh();
        }
        $actual = $speaker->getRawOriginal();
        ksort($actual);
        $ordered = $expected;
        ksort($ordered);
        if ($actual !== $ordered) {
            throw new RuntimeException('The synthetic speaker ID has different content. No row was overwritten.');
        }

        return $speaker;
    });
}
