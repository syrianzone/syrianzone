<?php

namespace App\Console\Commands;

use App\Models\OfficialEntity;
use Illuminate\Console\Command;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;

class CheckSyOfficialUrls extends Command
{
    protected $signature = 'syofficial:check-urls {--limit= : Limit number of entities to check} {--platform= : Filter by platform (facebook, twitter, telegram, instagram, etc.)}';
    protected $description = 'Smart health check for SyOfficial social media links by inspecting HTML page content for deleted/unavailable notices';

    // Signatures indicating an account or page has been deleted or is unavailable
    private array $deletedSignatures = [
        'facebook' => [
            "This content isn't available right now",
            "This page isn't available",
            "هذا المحتوى غير متوفر حالياً",
            "الصفحة غير متوفرة",
            "The link you followed may be broken",
            "محتوى غير متوفر",
        ],
        'instagram' => [
            "Sorry, this page isn't available",
            "Page Not Found",
            "عذراً، هذه الصفحة غير متوفرة",
            "الصفحة غير متوفرة",
        ],
        'twitter' => [
            "This account doesn't exist",
            "Account suspended",
            "هذا الحساب غير موجود",
            "تم تعليق الحساب",
            "Hmm... this page doesn’t exist",
        ],
        'telegram' => [
            "If you have Telegram, you can contact",
            "Channel not found",
            "Group not found",
            "User not found",
        ],
        'youtube' => [
            "This page isn't available",
            "This channel does not exist",
            "هذه الصفحة غير متوفرة",
        ],
    ];

    public function handle()
    {
        $this->info('Starting Smart Content Audit for SyOfficial Social Media URLs...');

        $query = OfficialEntity::whereNotNull('socials');
        if ($limit = $this->option('limit')) {
            $query->limit((int)$limit);
        }

        $entities = $query->get();
        $urlsToCheck = [];
        $filterPlatform = $this->option('platform');

        foreach ($entities as $entity) {
            $socials = $entity->socials ?? [];
            foreach ($socials as $platform => $url) {
                if ($filterPlatform && !str_contains(strtolower($platform), strtolower($filterPlatform))) {
                    continue;
                }

                if (filter_var($url, FILTER_VALIDATE_URL)) {
                    $urlsToCheck[] = [
                        'entity_id' => $entity->id,
                        'name_ar' => $entity->name_ar,
                        'platform' => $platform,
                        'url' => $url,
                    ];
                }
            }
        }

        $this->info('Auditing ' . count($urlsToCheck) . ' social media URLs...');

        $broken = [];
        $suspicious = [];
        $verifiedLive = 0;
        $geoRestricted = 0;

        $chunks = array_chunk($urlsToCheck, 10);
        $bar = $this->output->createProgressBar(count($urlsToCheck));
        $bar->start();

        foreach ($chunks as $chunk) {
            $responses = Http::pool(function (Pool $pool) use ($chunk) {
                $requests = [];
                foreach ($chunk as $item) {
                    $requests[] = $pool->withHeaders([
                        'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept-Language' => 'ar,en-US;q=0.9,en;q=0.8',
                        'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    ])
                    ->timeout(8)
                    ->connectTimeout(5)
                    ->get($item['url']);
                }
                return $requests;
            });

            foreach ($responses as $index => $response) {
                $item = $chunk[$index];
                $bar->advance();

                $isSyrianGov = str_contains(strtolower($item['url']), '.gov.sy');

                if ($response instanceof \Throwable) {
                    if ($isSyrianGov) {
                        $geoRestricted++;
                        continue;
                    }
                    $broken[] = [
                        'entity_id' => $item['entity_id'],
                        'platform' => $item['platform'],
                        'url' => $item['url'],
                        'issue' => 'Connection Failed / Timeout',
                    ];
                    continue;
                }

                $status = $response->status();
                $body = $response->body();
                $basePlatform = explode('_', $item['platform'])[0];

                if ($status === 404) {
                    if ($isSyrianGov) {
                        $geoRestricted++;
                        continue;
                    }
                    $broken[] = [
                        'entity_id' => $item['entity_id'],
                        'platform' => $item['platform'],
                        'url' => $item['url'],
                        'issue' => 'HTTP 404 (Deleted / Removed)',
                    ];
                    continue;
                }

                // Check HTML signatures for deleted/unavailable account pages
                $isDeleted = false;
                $matchedSignature = '';
                if (isset($this->deletedSignatures[$basePlatform])) {
                    foreach ($this->deletedSignatures[$basePlatform] as $signature) {
                        if (mb_stripos($body, $signature) !== false) {
                            $isDeleted = true;
                            $matchedSignature = $signature;
                            break;
                        }
                    }
                }

                if ($isDeleted) {
                    $broken[] = [
                        'entity_id' => $item['entity_id'],
                        'platform' => $item['platform'],
                        'url' => $item['url'],
                        'issue' => "Deleted Notice Found ('{$matchedSignature}')",
                    ];
                } else {
                    $verifiedLive++;
                }
            }
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("SMART CONTENT AUDIT RESULTS:");
        $this->info("🟢 Confirmed Active Accounts: {$verifiedLive}");
        $this->comment("🇸🇾 Syrian Geo-Restricted (.gov.sy Ignored): {$geoRestricted}");
        $this->warn("🔴 Confirmed Deleted / Removed Accounts: " . count($broken));

        if (count($broken) > 0) {
            $this->newLine();
            $this->error("DELETED / BROKEN SOCIAL MEDIA ACCOUNTS FOUND:");
            $this->table(
                ['Entity ID', 'Platform', 'Issue / Notice', 'URL'],
                array_map(fn($b) => [
                    $b['entity_id'],
                    $b['platform'],
                    $b['issue'],
                    $b['url'],
                ], $broken)
            );
        }

        return 0;
    }
}
