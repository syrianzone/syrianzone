<?php

namespace Database\Seeders\Staging;

use App\Models\GuessWhoCategory;
use App\Models\GuessWhoCharacter;
use App\Models\GuessWhoGame;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo boards for /guesswho.
 *
 * Three things about this module are not obvious:
 *
 * 1. ON STAGING THIS IS THE ONLY GUESSWHO SEEDER THAT RUNS. docker/10-startup.sh
 *    guards the production GuessWhoSeeder behind `if [ "${APP_ENV}" != "staging" ]`,
 *    because without the real best-ministers poll that seeder falls back to 12
 *    dummy characters whose images were never downloaded, filling the lobby with
 *    broken cards. So the boards you see on a staging box are entirely ours.
 *    Nothing collides even where both do run (a dev box, say): every slug here is
 *    prefixed 'staging-', so the two seeders own disjoint sets of categories and
 *    characters and neither can clobber the other.
 *
 * 2. NO NETWORK. The production seeder's unbounded image download is a known
 *    boot-stall risk, and adding a second one would make it worse. The character
 *    art here is generated locally as tiny SVG files, so a staging box with no
 *    egress still boots fast and still renders a full board.
 *
 * 3. image_path MUST BE A RELATIVE PATH ON THE PUBLIC DISK. GuessWho/Room.tsx
 *    builds the img src by raw interpolation, `/storage/${char.image_path}`, with
 *    no accessor and no http:// guard, so a full external URL would render as
 *    src="/storage/https://..." and 404. That is why we write real files instead
 *    of pointing at an avatar service the way StagingUsersSeeder does.
 */
class StagingGuessWhoSeeder extends StagingSeed
{
  /** Where the public disk keeps character art. Same directory the production seeder and Filament use. */
  private const IMAGE_DIR = 'guesswho/characters';

  /**
   * GuessWhoController::createRoom() does take(24) when it picks a board, so 24
   * is the intended size. The floor is lower and enforced in two places:
   * index() hides any category with characters_count < 12, and createRoom()
   * rejects a board of fewer than 12 ids. Nothing pads a short category up to
   * 24, so a category with 15 rows quietly produces a 15-card board. We give
   * every staging category the full 24 so the demo matches the real layout,
   * which is also why the grid is 4/6/8 columns wide.
   */
  private const BOARD_SIZE = 24;

  /** [slug, name_ar, name_en] */
  private const CATEGORIES = [
    ['staging-damascus-faces', 'وجوه دمشقية', 'Damascus Faces'],
    ['staging-aleppo-faces', 'وجوه حلبية', 'Aleppo Faces'],
  ];

  /**
   * Invented names, not real people: this is demo data and it should be obvious
   * that it is. Family names are Damascene and Aleppine quarter names, which
   * keeps them plausibly Syrian without impersonating anyone. Same convention as
   * StagingUsersSeeder's cast.
   *
   * [name_ar, name_en] keyed by category slug. Exactly BOARD_SIZE entries each.
   */
  private const CHARACTERS = [
    'staging-damascus-faces' => [
      ['أمجد الميداني', 'Amjad al-Midani'],
      ['بشرى القصاع', 'Bushra al-Qassaa'],
      ['تمام الشاغور', 'Tammam al-Shaghour'],
      ['ثائر المزة', 'Thaer al-Mazzeh'],
      ['جمانة الصالحية', 'Jumana al-Salihiyah'],
      ['حازم القيمرية', 'Hazem al-Qaymariyah'],
      ['خلود العمارة', 'Kholoud al-Amara'],
      ['دانا الشعلان', 'Dana al-Shaalan'],
      ['رامي السويقة', 'Rami al-Suwayqa'],
      ['زينب البرامكة', 'Zeinab al-Baramkeh'],
      ['سالم الجسر', 'Salem al-Jisr'],
      ['شادي العفيف', 'Shadi al-Afif'],
      ['صفاء الدويلعة', 'Safaa al-Duwaylaa'],
      ['ضياء الشيخ سعد', 'Diaa al-Sheikh Saad'],
      ['طارق الروضة', 'Tarek al-Rawda'],
      ['ظافر القنوات', 'Zafer al-Qanawat'],
      ['عابد المهاجرين', 'Abed al-Muhajireen'],
      ['غيداء الجابية', 'Ghaidaa al-Jabiyah'],
      ['فادي باب توما', 'Fadi Bab Touma'],
      ['قمر الحريقة', 'Qamar al-Hariqa'],
      ['كنان الأمين', 'Kinan al-Amin'],
      ['لمى المهدية', 'Lama al-Mahdiyah'],
      ['مازن الزاهرة', 'Mazen al-Zahira'],
      ['نورس القابون', 'Nawras al-Qaboun'],
    ],
    'staging-aleppo-faces' => [
      ['أنس الجميلية', 'Anas al-Jamiliyeh'],
      ['بلال السريان', 'Bilal al-Suryan'],
      ['تالا الفرقان', 'Tala al-Furqan'],
      ['جهاد السبيل', 'Jihad al-Sabeel'],
      ['حنين العزيزية', 'Haneen al-Aziziyeh'],
      ['خالد الشهباء', 'Khaled al-Shahba'],
      ['ديمة السليمانية', 'Dima al-Sulaymaniyeh'],
      ['رهف الحمدانية', 'Rahaf al-Hamdaniyeh'],
      ['زياد بستان الباشا', 'Ziad Bustan al-Basha'],
      ['سامي الشعار', 'Sami al-Shaar'],
      ['سهى الكلاسة', 'Suha al-Kallaseh'],
      ['شهد الفردوس', 'Shahd al-Firdaws'],
      ['صابر باب النيرب', 'Saber Bab al-Nayrab'],
      ['طلال السكري', 'Talal al-Sukkari'],
      ['عدنان الأشرفية', 'Adnan al-Ashrafiyeh'],
      ['غادة الميدان', 'Ghada al-Maydan'],
      ['فرح الصاخور', 'Farah al-Sakhour'],
      ['قيس المشارقة', 'Qais al-Mashareqa'],
      ['كرم السفيرة', 'Karam al-Safira'],
      ['لينا الحيدرية', 'Lina al-Haydariyeh'],
      ['مهند بانقوسا', 'Muhannad Banqusa'],
      ['نادين الشيخ مقصود', 'Nadine Sheikh Maqsoud'],
      ['هيثم الزبدية', 'Haitham al-Zabadiyeh'],
      ['وسيم قاضي عسكر', 'Wasim Qadi Askar'],
    ],
  ];

  /** Card background colours. Enough contrast that the flip-down state still reads. */
  private const PALETTE = ['#2f6f6b', '#8a4b3a', '#3f5b8a', '#7a6234', '#5c3f6b', '#356b45'];

  private const HAIR = ['black', 'brown', 'grey', 'blonde'];

  /**
   * Fixed room codes. room_code is a uuid column and createRoom() writes a full
   * Str::uuid(), so these have to be well-formed v4 UUIDs: postgres rejects a
   * short code outright. They double as the idempotency key.
   *
   * [room_code, category slug or null for a mixed board, status, has player 2, winner]
   */
  private const GAMES = [
    ['57a91060-0000-4000-8000-000000000001', 'staging-damascus-faces', 'lobby', false, null],
    ['57a91060-0000-4000-8000-000000000002', 'staging-aleppo-faces', 'selecting', true, null],
    ['57a91060-0000-4000-8000-000000000003', null, 'finished', true, 'p1'],
  ];

  public function run(): void
  {
    $this->seedRandom('staging-guesswho');

    $out = $this->command?->getOutput();

    $characterIds = [];

    foreach (self::CATEGORIES as [$slug, $nameAr, $nameEn]) {
      $category = GuessWhoCategory::updateOrCreate(
        ['slug' => $slug],
        [
          'name_ar' => $nameAr,
          'name_en' => $nameEn,
          'is_active' => true,
        ]
      );

      $characterIds[$slug] = [];

      foreach (self::CHARACTERS[$slug] as $i => [$charAr, $charEn]) {
        // The production seeder keys characters on (category_id, name_ar); match
        // it so the two seeders agree on what "the same character" means.
        $character = GuessWhoCharacter::updateOrCreate(
          [
            'category_id' => $category->id,
            'name_ar' => $charAr,
          ],
          [
            'name_en' => $charEn,
            'image_path' => $this->writePlaceholder($slug, $charEn, $charAr, $i),
            'attributes' => [
              'gender' => $this->pick(['male', 'female']),
              'glasses' => $this->chance(35),
              'beard' => $this->chance(40),
              'hat' => $this->chance(20),
              'hair' => $this->pick(self::HAIR),
              'tag' => self::TAG,
            ],
            'is_active' => true,
          ]
        );

        $characterIds[$slug][] = $character->id;
      }

      $out?->writeln(sprintf(
        '  <fg=gray>guesswho</> %-26s %d characters',
        $slug,
        count($characterIds[$slug])
      ));
    }

    $this->seedGames($characterIds, $out);
  }

  /**
   * Games in a few different states.
   *
   * Worth knowing before you go looking for these in the UI: nothing renders
   * them. There is no lobby list and no match history, GuessWhoGame rows are
   * only ever fetched by room_code, and there is no Filament resource for them.
   * They are here so /guesswho/room/{code} is reachable by hand and so anything
   * that later grows a history view has rows to render.
   *
   * Also note 'playing' and 'finished' are never written by the app: createRoom()
   * writes 'lobby', joinRoom() writes 'selecting', and the rest of the match
   * lives client-side in Room.tsx (which spells the end state 'ended', not
   * 'finished'). We seed the migration's spelling since that is the schema's
   * documented contract.
   */
  private function seedGames(array $characterIds, ?\Symfony\Component\Console\Output\OutputInterface $out): void
  {
    $categories = GuessWhoCategory::whereIn('slug', array_column(self::CATEGORIES, 0))
      ->get()
      ->keyBy('slug');

    foreach (self::GAMES as [$roomCode, $slug, $status, $hasPlayer2, $winner]) {
      // A mixed game draws from every staging category, the same way createRoom()
      // does when no category is chosen.
      $board = $slug !== null
        ? $characterIds[$slug]
        : array_merge(...array_map(
          fn (array $ids) => array_slice($ids, 0, (int) (self::BOARD_SIZE / count($characterIds))),
          array_values($characterIds)
        ));

      $board = array_slice($board, 0, self::BOARD_SIZE);

      if (count($board) < 12) {
        // createRoom() refuses a board this small, so seeding one would only
        // produce a room that renders an empty grid.
        $out?->writeln(sprintf('  <fg=yellow>guesswho</> skipped game %s (only %d characters)', $roomCode, count($board)));
        continue;
      }

      $player1 = 'staging-session-'.substr($roomCode, -4).'-p1';
      $player2 = $hasPlayer2 ? 'staging-session-'.substr($roomCode, -4).'-p2' : null;

      // Secret characters are only meaningful once both players are in and have
      // picked, which is the 'finished' row here.
      $picked = $status === 'finished';

      GuessWhoGame::updateOrCreate(
        ['room_code' => $roomCode],
        [
          'category_id' => $slug !== null ? $categories[$slug]->id : null,
          'character_ids' => $board,
          'player_1_session' => $player1,
          'player_2_session' => $player2,
          'player_1_character_id' => $picked ? $this->pick($board) : null,
          'player_2_character_id' => $picked ? $this->pick($board) : null,
          'status' => $status,
          'winner_session' => $winner === 'p1' ? $player1 : ($winner === 'p2' ? $player2 : null),
          'created_at' => $this->pastDate(60, 1),
        ]
      );

      $out?->writeln(sprintf(
        '  <fg=gray>guesswho</> game %s  %-10s %d cards',
        substr($roomCode, -12),
        $status,
        count($board)
      ));
    }
  }

  /**
   * Write a flat SVG portrait onto the public disk and return its relative path.
   *
   * Deterministic and offline: same character, same bytes, every run. SVG rather
   * than a raster because we can build one from a string with no GD, no Imagick
   * and no download, which is the whole point.
   */
  private function writePlaceholder(string $categorySlug, string $nameEn, string $nameAr, int $index): string
  {
    // $categorySlug already carries the 'staging-' prefix, so the filename is
    // greppable without adding a second one.
    $path = self::IMAGE_DIR.'/'.Str::slug($categorySlug.'-'.$nameEn).'.svg';

    $bg = self::PALETTE[$index % count(self::PALETTE)];
    // First Arabic letter of the given name. Renders right in any browser and
    // keeps the card readable even before you read the label under it.
    $initial = mb_substr($nameAr, 0, 1, 'UTF-8');

    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
      .'<rect width="200" height="200" fill="'.$bg.'"/>'
      .'<circle cx="100" cy="74" r="40" fill="#ffffff" fill-opacity="0.9"/>'
      .'<path d="M28 200a72 72 0 0 1 144 0z" fill="#ffffff" fill-opacity="0.9"/>'
      .'<text x="100" y="90" text-anchor="middle" font-family="sans-serif" font-size="42" fill="'.$bg.'">'
      .htmlspecialchars($initial, ENT_XML1 | ENT_QUOTES, 'UTF-8')
      .'</text></svg>';

    $disk = Storage::disk('public');

    // Deterministic bytes, so a file that is already there is already right.
    // Skipping keeps a reseed from churning mtimes under the immutable cache.
    // Same guard as StagingPlacesSeeder.
    if (! $disk->exists($path)) {
      $disk->put($path, $svg);
    }

    return $path;
  }
}
