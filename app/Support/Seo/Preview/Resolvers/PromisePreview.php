<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Models\Promise;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\Arabic;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use Illuminate\Http\Request;

/** /promises/{number}: one published promise. */
final class PromisePreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    /**
     * Label, pill tone and glyph per display state. The labels are the ones the
     * page itself shows (Pages/Promises/_lib/status.ts); a test keeps them equal.
     */
    public const STATES = [
        'pending' => ['قيد الانتظار', 'outline', 'Hourglass'],
        'in_progress' => ['قيد التنفيذ', 'outline', 'Wrench'],
        'overdue' => ['متأخر', 'destructive', 'AlarmClock'],
        'fulfilled' => ['تحقق', 'primary', 'BadgeCheck'],
        'partially_fulfilled' => ['تحقق جزئياً', 'soft', 'CircleDashed'],
        'broken' => ['لم يتحقق', 'destructive', 'XCircle'],
        'postponed' => ['أُجّل', 'soft', 'CalendarClock'],
        'retracted' => ['سُحب', 'soft', 'Undo2'],
    ];

    public static function cardType(): string
    {
        return 'promise';
    }

    public static function fallbackCard(): string
    {
        return 'promises';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        if (! preg_match('#^/promises/(\d{1,9})$#', $path, $m)) {
            return null;
        }

        $promise = $this->find((int) $m[1]);
        if ($promise === null) {
            return null;
        }

        $speaker = $promise->speaker?->name;

        return new Preview(
            title: $promise->title.' — الوعد رقم '.$promise->number.' | عداد الوعود',
            description: Arabic::excerpt(($speaker ? $speaker.': ' : '').($promise->summary ?: $promise->quote), 200),
            canonicalPath: '/promises/'.$promise->number,
            image: $this->describe($promise)->url(),
            type: 'article',
            schema: 'Article',
            parent: ['/promises', 'عداد الوعود'],
        );
    }

    public function card(string $key): ?RecordCard
    {
        $promise = ctype_digit($key) ? $this->find((int) $key) : null;

        return $promise === null ? null : $this->describe($promise);
    }

    private function find(int $number): ?Promise
    {
        return Promise::published()
            ->where('number', $number)
            ->with(['speaker.candidate', 'speaker.officialEntity', 'institution', 'sector'])
            ->first();
    }

    private function describe(Promise $promise): RecordCard
    {
        // The state shown is the one the page shows today, so the card changes
        // (and gets a new address) the day a promise becomes overdue.
        [$label, $tone, $glyph] = self::STATES[$promise->displayState()] ?? self::STATES['pending'];
        if ($promise->wasKeptLate()) {
            $label .= ' (متأخراً)';
        }

        $pills = [
            ['label' => $label, 'tone' => $tone, 'glyph' => $glyph],
            ['label' => 'الوعد رقم '.$promise->number],
        ];
        if ($promise->sector && $promise->sector->id !== 'other') {
            $pills[] = ['label' => $promise->sector->label];
        }

        $model = [
            'kind' => 'split',
            'url' => $this->address('/promises/'.$promise->number),
            'kicker' => ['icon' => 'promises', 'label' => 'عداد الوعود'],
            'pills' => $pills,
            'title' => $promise->title,
        ];

        if ($promise->speaker) {
            $institution = $promise->institution?->name_ar ?: $promise->institution?->name;
            $model['person'] = array_filter([
                'name' => $promise->speaker->name,
                'role' => implode(' · ', array_filter([$promise->speaker_title ?: $promise->speaker->title, $institution])),
                'image' => $promise->speaker->resolvedImage(),
            ]);
        }

        // An absolute date, never a countdown: chat apps keep a preview for
        // weeks, and a number of days would be wrong the next morning.
        if ($deadline = $promise->deadline()) {
            $model['meta'] = ['glyph' => 'Calendar', 'label' => 'الموعد', 'value' => Arabic::date($deadline)];
        }

        return new RecordCard(self::cardType(), (string) $promise->number, $model);
    }
}
