<?php

namespace App\Support\Seo\Preview\Resolvers;

use App\Support\Facts;
use App\Support\Seo\Og\CardSource;
use App\Support\Seo\Og\RecordCard;
use App\Support\Seo\Preview\DescribesCards;
use App\Support\Seo\Preview\Preview;
use App\Support\Seo\Preview\PreviewResolver;
use App\Support\Seo\SeoMeta;
use Illuminate\Http\Request;

/** /muslim/prayer and /muslim/prayer/{city}: daily prayer times for Syria and each governorate. */
final class PrayerCityPreview implements CardSource, PreviewResolver
{
    use DescribesCards;

    private const SYRIAN_MONTHS_AR = [
        1 => 'كانون الثاني',
        2 => 'شباط',
        3 => 'آذار',
        4 => 'نيسان',
        5 => 'أيار',
        6 => 'حزيران',
        7 => 'تموز',
        8 => 'آب',
        9 => 'أيلول',
        10 => 'تشرين الأول',
        11 => 'تشرين الثاني',
        12 => 'كانون الأول',
    ];

    public static function cardType(): string
    {
        return 'prayer-city';
    }

    public static function fallbackCard(): string
    {
        return 'muslim-prayer';
    }

    public function resolve(Request $request, string $path): ?Preview
    {
        $base = rtrim((string) config('seo.base_url'), '/');

        if ($path === '/muslim/prayer') {
            $fixed = SeoMeta::fixedPage('/muslim/prayer');
            if ($fixed === null) {
                return null;
            }

            return new Preview(
                title: $fixed->title,
                description: $fixed->description,
                canonicalPath: $fixed->canonicalPath,
                image: $fixed->image,
                type: $fixed->type,
                noindex: $fixed->noindex,
                schema: $fixed->schema,
                parent: $fixed->parent,
                sharePath: $fixed->sharePath,
                shareTitle: $fixed->shareTitle,
                published: $fixed->published,
                modified: $fixed->modified,
                mainEntity: $fixed->mainEntity,
                extraGraph: [$this->faqEntity($base.'/muslim/prayer', null)],
                breadcrumbLabel: $fixed->breadcrumbLabel,
                parents: $fixed->parents,
            );
        }

        if (! preg_match('#^/muslim/prayer/([a-z0-9-]+)$#', $path, $m)) {
            return null;
        }

        $gov = Facts::governorate($m[1]);
        if ($gov === null) {
            return null;
        }

        $cityName = (string) $gov['name_ar'];
        $now = now()->timezone(Facts::syria()['timezone']);
        $monthName = self::SYRIAN_MONTHS_AR[(int) $now->format('n')] ?? '';
        $monthLabel = trim($monthName.' '.$now->format('Y'));

        return new Preview(
            title: 'مواقيت الصلاة في '.$cityName.' اليوم — '.$monthLabel.' | الركن الإسلامي',
            shareTitle: 'مواقيت الصلاة في '.$cityName.' — '.$monthLabel,
            description: 'مواقيت الصلاة اليومية والشهرية في '.$cityName.' لشهر '.$monthLabel.' (الفجر، الشروق، الظهر، العصر، المغرب، العشاء) بتوقيت سوريا مع اتجاه القبلة وعدّاد الصلاة القادمة.',
            canonicalPath: '/muslim/prayer/'.$gov['id'],
            image: $this->describe($gov)->url(),
            parent: ['/muslim/prayer', 'مواقيت الصلاة'],
            extraGraph: [$this->faqEntity($base.'/muslim/prayer/'.$gov['id'], $cityName)],
        );
    }

    /**
     * Build a Schema.org `FAQPage` node matching the verified Arabic FAQ block
     * rendered on `/muslim/prayer` and `/muslim/prayer/{city}`.
     *
     * @return array<string, mixed>
     */
    private function faqEntity(string $canonicalUrl, ?string $cityNameAr): array
    {
        $ramadanTitle = $cityNameAr !== null && $cityNameAr !== ''
            ? 'إمساكية رمضان 1448 هـ / 2027 م في '.$cityNameAr
            : 'إمساكية رمضان 1448 هـ / 2027 م في سوريا';

        $items = [
            [
                'q' => 'ما طريقة الحساب المعتمدة لمواقيت الصلاة في سوريا ولماذا؟',
                'a' => 'نعتمد افتراضياً طريقة رابطة العالم الإسلامي (زاوية الفجر 18° وزاوية العشاء 17°)، لأنها المعيار الفلكي المتوافق مع التوقيت الرسمي المعتمد في المساجد السورية. ويمكنك تغيير طريقة الحساب من زر الإعدادات أعلاه إذا كنت تتبع مذهباً أو تقويماً آخر.',
            ],
            [
                'q' => 'لماذا قد يختلف الوقت المعروض عن أذان المسجد القريب بدقيقة أو دقيقتين؟',
                'a' => 'تُحسب المواقيت لإحداثيات مركز المحافظة، بينما تعتمد بعض المساجد والمواقيت الورقية هوامش احتياط (دقيقة إلى دقيقتين) أو تختلف قليلاً بحسب الموقع الجغرافي داخل المحافظة والارتفاع عن سطح البحر وتقريب الثواني.',
            ],
            [
                'q' => 'ما علاقة وقت الإمساك بوقت صلاة الفجر؟',
                'a' => 'وقت الإمساك هو تنبيه احتياطي يسبق أذان الفجر بنحو عشر دقائق للتنبيه إلى قرب انتهاء وقت السحور، أما بداية الصيام شرعياً فتكون عند طلوع الفجر الصادق (وقت صلاة الفجر).',
            ],
            [
                'q' => 'كيف يُحسب اتجاه القبلة للمحافظة؟',
                'a' => 'يُحسب اتجاه القبلة هندسياً عبر مسار الدائرة العظمى من إحداثيات مركز المحافظة إلى الكعبة المشرفة في مكة المكرمة (21.4225° N, 39.8262° E)، وتُقاس الزاوية بالدرجات من الشمال الحقيقي باتجاه عقارب الساعة.',
            ],
            [
                'q' => 'أين أجد إمساكية شهر رمضان المبارك كاملةً؟',
                'a' => 'يمكنك تصفح جدول الشهر الكريم كاملاً مع مواعيد الإمساك والإفطار ونسخة مخصصة للطباعة في صفحة '.$ramadanTitle.'.',
            ],
        ];

        $questions = array_map(
            static fn (array $item): array => [
                '@type' => 'Question',
                'name' => $item['q'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $item['a'],
                ],
            ],
            $items,
        );

        return [
            '@type' => 'FAQPage',
            '@id' => $canonicalUrl.'#faq',
            'mainEntity' => $questions,
        ];
    }

    public function card(string $key): ?RecordCard
    {
        if ($key === '' || ! preg_match('/^[a-z0-9-]+$/', $key)) {
            return null;
        }

        $gov = Facts::governorate($key);

        return $gov === null ? null : $this->describe($gov);
    }

    /** @param  array<string, mixed>  $gov */
    private function describe(array $gov): RecordCard
    {
        return new RecordCard(self::cardType(), (string) $gov['id'], [
            'kind' => 'split',
            'url' => $this->address('/muslim/prayer/'.$gov['id']),
            'kicker' => ['icon' => 'muslim', 'label' => 'الركن الإسلامي'],
            'title' => 'مواقيت الصلاة في '.$gov['name_ar'],
            'subtitle' => 'الفجر · الشروق · الظهر · العصر · المغرب · العشاء',
            'art' => ['type' => 'icon', 'icon' => 'muslim'],
        ]);
    }
}
