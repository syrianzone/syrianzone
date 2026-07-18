<?php

namespace Database\Seeders\Staging;

use App\Models\Place;
use App\Models\PlacePhoto;
use App\Models\PlaceSave;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * The staging map: ~40 places spread over eight Syrian cities, hung off the
 * guide accounts from StagingUsersSeeder (so that seeder must run first).
 *
 * Four things here are deliberate and easy to break:
 *
 * 1. NO FAKER, NO FACTORIES. See StagingSeed. Every name, description and
 *    coordinate below is a literal; the only variation comes from the base
 *    class PRNG helpers.
 *
 * 2. saves_count IS A DENORMALISED COUNTER. PlaceEngagementController
 *    increments/decrements it on save/unsave, and PlaceDiscoveryController's
 *    guides leaderboard SUMs it. So we write the place_saves rows first and
 *    then read the real count back out of the database. Never guess it: a
 *    counter that disagrees with the rows makes the leaderboard look broken
 *    while every individual page still looks fine.
 *
 * 3. THE AUTHOR/STATUS SPLIT IS EXPLICIT, NOT ROLLED. A chance(60) over 40
 *    rows can land anywhere, and the leaderboard needs a stable, obviously
 *    ranked top guide to be worth looking at. The table below fixes it at
 *    24 approved / 10 pending / 6 rejected, with guide-nour clearly first.
 *
 * 4. THE PHOTOS ARE GENERATED, NOT DOWNLOADED. Every place_photos row used to
 *    point at a staging/places/sample-N file that was never written, so the
 *    whole gallery rendered as broken thumbnails. We now write the art at seed
 *    time as flat SVG, the same way StagingGuessWhoSeeder does, which keeps the
 *    seeder offline and keeps binaries out of the repo. See writePlaceholders().
 *
 * 5. THE BANNED AND SOFT-DELETED ACCOUNTS ARE STOCKED ON PURPOSE. See
 *    EXCLUDED_PLACES. They exist to make the leaderboard's exclusion filters
 *    falsifiable, which they are not if the accounts own nothing.
 */
class StagingPlacesSeeder extends StagingSeed
{
  /** City centres, real coordinates. Places jitter around these by JITTER degrees. */
  public const CITIES = [
    'damascus' => [33.5138, 36.2765],
    'aleppo' => [36.2021, 37.1343],
    'homs' => [34.7324, 36.7137],
    'latakia' => [35.5196, 35.7915],
    'tartus' => [34.8890, 35.8866],
    'hama' => [35.1318, 36.7578],
    'deir' => [35.3359, 40.1408],
    'sweida' => [32.7090, 36.5690],
  ];

  /**
   * ~5km of wobble. Small enough that a pin stays inside its own city and well
   * inside the Syria box the submit form enforces (lat 32.0-37.5, lng 35.5-42.5);
   * Latakia is the tight one, at lng 35.79 it still clears the 35.5 floor.
   */
  public const JITTER = 0.045;

  /**
   * [city, name, category, description, author handle, status]
   *
   * Categories are exactly the nine the controller's `in:` rule accepts
   * (historical, natural, cultural, religious, abandoned, viewpoint, market,
   * food, other). Anything else validates fine on the way in here and then
   * fails the moment an owner edits the place.
   */
  public const PLACES = [
    // Damascus
    ['damascus', 'الجامع الأموي الكبير', 'religious', 'أقدم جوامع دمشق وأكثرها زخرفة، بفسيفسائه الذهبية وصحنه الواسع الذي يمتلئ بالزوار عند المغرب.', 'guide-nour', 'approved'],
    ['damascus', 'سوق الحميدية', 'market', 'السوق المسقوف الأشهر في دمشق القديمة، أقواسه المثقوبة تسقط ضوءاً منقطاً على البسطات طوال النهار.', 'guide-nour', 'approved'],
    ['damascus', 'مطل جبل قاسيون', 'viewpoint', 'الطريق الصاعد على كتف الجبل يطل على دمشق كلها، وأفضل وقت له قبل الغروب بنصف ساعة.', 'guide-nour', 'approved'],
    ['damascus', 'حديقة تشرين', 'natural', 'أكبر متنفس أخضر في المدينة، ممرات طويلة تحت الصنوبر وبحيرة صغيرة في طرفها الشمالي.', 'guide-kareem', 'approved'],
    ['damascus', 'مقهى النوفرة', 'food', 'مقهى قديم خلف الجامع الأموي، يقدم الشاي والنرجيلة وما زال الحكواتي يروي فيه مساء.', 'guide-kareem', 'pending'],
    ['damascus', 'التكية السليمانية', 'historical', 'مجمع عثماني على ضفة بردى بقببه الرصاصية ومئذنتيه، وساحته الداخلية هادئة بشكل مفاجئ.', 'guide-nour', 'approved'],
    ['damascus', 'مقام السيدة رقية', 'religious', 'مزار بقاشاني أزرق وذهبي كثيف الزخرفة، يقع في قلب حي العمارة داخل السور.', 'guide-nour', 'approved'],

    // Aleppo
    ['aleppo', 'قلعة حلب', 'historical', 'القلعة على تلتها في وسط المدينة، الجسر الحجري المؤدي إلى بابها من أشهر مشاهد سوريا.', 'guide-hala', 'approved'],
    ['aleppo', 'سوق المدينة المسقوف', 'market', 'كيلومترات من الأقبية الحجرية والخانات، أعيد ترميم أجزاء منها وعادت المحال تفتح تدريجياً.', 'guide-hala', 'pending'],
    ['aleppo', 'الجامع الأموي في حلب', 'religious', 'صحن مبلط واسع ومئذنة سلجوقية شهيرة، يقع على الحافة الشمالية للسوق المسقوف.', 'guide-kareem', 'approved'],
    ['aleppo', 'حديقة السبيل', 'natural', 'حديقة عامة كبيرة بأشجارها المعمرة، وجهة العائلات الحلبية في نهايات الأسبوع.', 'guide-nour', 'approved'],
    ['aleppo', 'بيت سيسي', 'food', 'مطعم في بيت حلبي قديم بباحة مكشوفة، مشهور بالكباب بالكرز والمقبلات الحلبية.', 'guide-nour', 'approved'],

    // Homs
    ['homs', 'جامع خالد بن الوليد', 'religious', 'معلم حمص الأول بقببه السوداء والبيضاء ومئذنتيه المتماثلتين، ويحيط به ميدان واسع.', 'guide-kareem', 'approved'],
    ['homs', 'ساعة حمص القديمة', 'cultural', 'برج الساعة في قلب المدينة، نقطة اللقاء المتعارف عليها لأهل حمص منذ عقود.', 'guide-omar', 'approved'],
    ['homs', 'السوق المسقوف في حمص', 'market', 'سوق طويل ضيق يبيع البهارات والأقمشة، وتفتح على جانبيه خانات حجرية صغيرة.', 'guide-omar', 'pending'],
    ['homs', 'دير مار إليان', 'historical', 'دير قديم على أطراف المدينة بجدران حجرية سميكة وفناء داخلي مظلل بالكرمة.', 'guide-hala', 'approved'],
    ['homs', 'حديقة العاصي في حمص', 'natural', 'مساحة خضراء على ضفة النهر مع ممشى وناعورة صغيرة تدور طوال النهار.', 'guide-hala', 'pending'],

    // Latakia
    ['latakia', 'كورنيش اللاذقية', 'other', 'ممشى بحري طويل بالنخيل، يمتلئ بالمشاة والباعة المتجولين بعد صلاة العشاء.', 'guide-nour', 'pending'],
    ['latakia', 'شاطئ الرمل الذهبي', 'natural', 'شاطئ رملي مفتوح شمال المدينة، مياهه هادئة وأفضل أوقاته أول الصباح.', 'guide-nour', 'pending'],
    ['latakia', 'تترابيلون اللاذقية', 'historical', 'بقايا قوس روماني رباعي في حي قديم، أعمدته الأربعة ما زالت قائمة كما هي.', 'guide-kareem', 'approved'],
    ['latakia', 'سوق الصليبة', 'market', 'سوق شعبي مزدحم يبيع السمك والخضار، ويعمل من الفجر حتى قبل الظهر.', 'guide-nour', 'pending'],
    ['latakia', 'منارة رأس ابن هانئ', 'viewpoint', 'رأس صخري تطل منارته على البحر مباشرة، ومنه يرى خط الساحل كاملاً حتى المدينة.', 'guide-nour', 'rejected'],

    // Tartus
    ['tartus', 'جزيرة أرواد', 'natural', 'الجزيرة السورية المأهولة الوحيدة، تصلها بقارب في عشرين دقيقة وأزقتها لا تتسع لسيارة.', 'guide-kareem', 'approved'],
    ['tartus', 'كاتدرائية طرطوس', 'historical', 'كاتدرائية صليبية محصنة تحولت إلى متحف، حجارتها الرمادية سميكة كأنها قلعة.', 'guide-kareem', 'pending'],
    ['tartus', 'قلعة المرقب', 'historical', 'قلعة من البازلت الأسود على تلة بركانية، تطل على البحر من ارتفاع يقارب أربعمئة متر.', 'guide-hala', 'approved'],
    ['tartus', 'كورنيش طرطوس', 'viewpoint', 'واجهة بحرية تقابل أرواد مباشرة، والمقاهي على طولها تفتح حتى وقت متأخر.', 'guide-hala', 'approved'],

    // Hama
    ['hama', 'نواعير حماة', 'cultural', 'النواعير الخشبية الضخمة على العاصي، أنينها المتواصل هو صوت المدينة المعروف.', 'guide-omar', 'approved'],
    ['hama', 'قصر العظم في حماة', 'historical', 'قصر عثماني بباحات متدرجة وقاعات مزخرفة بالخشب، يقع قرب ضفة النهر.', 'guide-omar', 'approved'],
    ['hama', 'الجامع النوري', 'religious', 'جامع أيوبي على العاصي بمنبر خشبي قديم، ويلاصقه أحد أكبر النواعير.', 'guide-omar', 'pending'],
    ['hama', 'حديقة العاصي', 'natural', 'حديقة ممتدة على ضفتي النهر بممشى مظلل، وتصل إليها رذاذ النواعير في الصيف.', 'guide-sana', 'approved'],

    // Deir ez-Zor
    ['deir', 'الجسر المعلق في دير الزور', 'cultural', 'جسر مشاة معلق فوق الفرات، رمز المدينة الأول ومنه أوسع مشهد للنهر.', 'guide-sana', 'approved'],
    ['deir', 'كورنيش الفرات', 'viewpoint', 'ممشى على ضفة الفرات مقابل الجزر الرملية، ويهدأ الجو عليه بعد المغرب.', 'guide-sana', 'pending'],
    ['deir', 'مدينة دورا أوروبوس', 'abandoned', 'مدينة هلنستية مهجورة على حافة الهضبة فوق الفرات، أسوارها الترابية ما زالت واضحة.', 'guide-sana', 'rejected'],
    ['deir', 'قلعة الرحبة', 'abandoned', 'قلعة طينية متهدمة على تل معزول جنوب المدينة، الصعود إليها يستغرق ربع ساعة.', 'guide-omar', 'rejected'],

    // Sweida
    ['sweida', 'المدرج الروماني في شهبا', 'historical', 'مدرج روماني صغير محفوظ بشكل جيد من البازلت الأسود، ما زالت مقاعده كاملة.', 'guide-hala', 'rejected'],
    ['sweida', 'متحف شهبا للفسيفساء', 'cultural', 'لوحات فسيفساء رومانية بألوان حية معروضة في مكانها الأصلي داخل بيت قديم.', 'guide-kareem', 'rejected'],
    ['sweida', 'قنوات الأثرية', 'historical', 'موقع أثري بأعمدة وكنيسة قديمة وسط قرية عامرة، وحجارته كلها بازلت أسود.', 'guide-nour', 'approved'],
    ['sweida', 'مطل تل قني', 'viewpoint', 'تل بركاني يطل على سهل حوران كله، وفي الأيام الصافية يرى منه الجولان.', 'visitor', 'approved'],
    ['sweida', 'مطعم دار الجبل', 'food', 'مطعم في بيت حجري قديم يقدم المأكولات الدرزية التقليدية في باحة مظللة.', 'visitor', 'rejected'],
    ['sweida', 'سوق السويداء الشعبي', 'market', 'سوق أسبوعي يبيع العنب والتفاح الجبلي وزيت الزيتون المحلي من مزارع القرى.', 'guide-kareem', 'approved'],
  ];

  /**
   * The bait. [city, name, category, description, author handle]
   *
   * Nine places each for the banned and the soft-deleted account, every one
   * approved, recently approved, and saved by every live user. The top real
   * guide (guide-nour) has 8 approved places and nowhere near the save total, so
   * either of these accounts outranks the whole cast on all three leaderboard
   * sorts (submissions, saves, recent) the moment PlaceDiscoveryController::
   * guides stops filtering on users.deleted_at / users.is_banned.
   *
   * Kept in its own table rather than folded into PLACES so the documented
   * 24/10/6 status split up there stays true, and so it is obvious that removing
   * a row here weakens a test rather than just trimming demo data.
   */
  public const EXCLUDED_PLACES = [
    ['damascus', 'مقهى الروضة', 'food', 'مقهى واسع قرب البرلمان، طاولاته الرخامية مشغولة دائماً بلاعبي الشطرنج والصحفيين.', 'banned'],
    ['damascus', 'باب توما', 'historical', 'أحد أبواب دمشق القديمة السبعة، وما زال الحي خلفه يحمل اسمه ومقاهيه مفتوحة حتى الفجر.', 'banned'],
    ['aleppo', 'خان الوزير', 'historical', 'خان عثماني ببوابة حجرية منقوشة وباحة داخلية واسعة، على الحافة الشرقية للسوق.', 'banned'],
    ['homs', 'كنيسة أم الزنار', 'religious', 'كنيسة سريانية قديمة تحت مستوى الشارع، وفي قبوها مزار صغير يقصده الزوار.', 'banned'],
    ['latakia', 'قلعة صلاح الدين', 'historical', 'قلعة على نتوء صخري بين واديين عميقين، والخندق المنحوت في الصخر أمامها هو أشهر ما فيها.', 'banned'],
    ['tartus', 'ميناء طرطوس القديم', 'other', 'رصيف صيد صغير بمراكب خشبية ملونة، وأفضل وقت له عند عودة الصيادين صباحاً.', 'banned'],
    ['hama', 'قلعة شميميس', 'abandoned', 'قلعة أيوبية مهجورة على قمة بركان خامد، تطل على بادية السلمية من كل الجهات.', 'banned'],
    ['deir', 'متحف دير الزور', 'cultural', 'متحف يعرض لقى من ماري وتل حريري، وقاعته الأولى إعادة بناء لبيت من العصر البرونزي.', 'banned'],
    ['sweida', 'بحيرة العرام', 'natural', 'بحيرة بركانية صغيرة بين تلال سوداء، يحيط بها طريق ترابي يمكن قطعه مشياً في ساعة.', 'banned'],

    ['damascus', 'الشارع المستقيم', 'historical', 'المحور الروماني الذي يشق دمشق القديمة من باب شرقي إلى باب الجابية، ويمر بأسواق عدة.', 'deleted'],
    ['damascus', 'مطل المزة', 'viewpoint', 'كتف جبلي غربي المدينة يطل على الغوطة، ويهدأ الهواء عليه بعد المغرب مباشرة.', 'deleted'],
    ['aleppo', 'مدرسة الفردوس', 'religious', 'مدرسة أيوبية جنوب المدينة، باحتها ببركتها الثمانية من أجمل ما بقي من العمارة الأيوبية.', 'deleted'],
    ['homs', 'حي الحميدية', 'cultural', 'الحي المسيحي القديم بأزقته الضيقة وكنائسه المتجاورة، وبيوته من الحجر الأسود والأبيض.', 'deleted'],
    ['latakia', 'غابة الفرنلق', 'natural', 'غابة صنوبر وسنديان في جبال الساحل، فيها مسارات مشي مظللة ومخيم صيفي قديم.', 'deleted'],
    ['tartus', 'قلعة الخوابي', 'historical', 'قلعة إسماعيلية ما زالت مأهولة، القرية كلها مبنية داخل أسوارها على قمة التل.', 'deleted'],
    ['hama', 'أفاميا', 'historical', 'شارع الأعمدة الروماني بطول كيلومترين، وأعمدته الملولبة قائمة على امتداد الهضبة.', 'deleted'],
    ['deir', 'سوق دير الزور المسقوف', 'market', 'سوق طويل يبيع الأقمشة والبهارات، ويفتح على ساحة صغيرة قرب الجسر القديم.', 'deleted'],
    ['sweida', 'قرية عتيل', 'abandoned', 'موقع أثري بمعبدين رومانيين متهدمين وسط بيوت بازلتية مهجورة على أطراف القرية.', 'deleted'],
  ];

  /** Arabic rejection reasons, so the moderation UI has real text to wrap. */
  public const REJECTIONS = [
    'الصور غير واضحة، أعد رفعها بجودة أعلى',
    'الموقع على الخريطة لا يطابق العنوان المذكور',
    'الوصف مختصر جداً ولا يعرّف بالمكان',
    'المكان مكرر، تمت إضافته سابقاً',
    'الصور مأخوذة من الإنترنت وليست تصويراً أصلياً',
  ];

  /** Where the public disk keeps the generated staging photo art. */
  private const IMAGE_DIR = 'staging/places';

  /**
   * [sky, hills, ground, caption bar] per card. Six landscape moods, picked by a
   * hash of the place name so a given place always looks the same.
   */
  private const PALETTE = [
    ['#b8d4e3', '#6f8f7a', '#3f5b46', '#22332a'],
    ['#e8c9a0', '#a97b4f', '#6b4a2e', '#3a2a1c'],
    ['#c6d9ea', '#7f93ab', '#4e5f78', '#2b3546'],
    ['#f0d2b8', '#c08a6a', '#7c5340', '#402b22'],
    ['#cfe2cc', '#7fa07c', '#4c6a4b', '#2a3b2a'],
    ['#dcd2e6', '#8f7fa8', '#5c4f70', '#332b40'],
  ];

  /**
   * The three variant sizes, matching the shape PlaceImageService produces for a
   * real upload: a full-size original, a scaled display copy and a square crop.
   *
   * [suffix, extension, width, height]
   */
  private const VARIANTS = [
    ['', 'svg', 1600, 1200],
    ['_display', 'svg', 800, 600],
    ['_thumb', 'svg', 400, 400],
  ];

  public function run(): void
  {
    $this->seedRandom('staging-places');

    $users = StagingUsersSeeder::guides();
    if ($users->isEmpty()) {
      $this->command?->getOutput()->writeln('  <fg=yellow>places</> no staging users found, run StagingUsersSeeder first');

      return;
    }

    // handle => user, so the table above can name its author in a readable way
    $byHandle = $users->keyBy(fn ($user) => str_replace(StagingUsersSeeder::DOMAIN, '', $user->email));
    $saverIds = $users->pluck('id')->all();

    $counts = ['approved' => 0, 'pending' => 0, 'rejected' => 0];
    $photoTotal = 0;
    $saveTotal = 0;

    foreach (self::PLACES as [$city, $name, $category, $description, $handle, $status]) {
      $author = $byHandle->get($handle);
      if (!$author) {
        continue;
      }

      $place = $this->writePlace($author->id, $city, $name, $category, $description, $status);

      $counts[$status]++;
      $photoTotal += $this->seedPhotos($place);
      $saveTotal += $this->seedSaves($place, $saverIds, $status === 'approved');

      $this->command?->getOutput()->writeln(sprintf(
        '  <fg=gray>place</> %-34s %-10s %-10s %s',
        $name,
        $city,
        $status,
        $place->saves_count.' saves'
      ));
    }

    $this->command?->getOutput()->writeln(sprintf(
      '  <fg=green>places</> %d rows (%d approved, %d pending, %d rejected), %d photos, %d saves',
      array_sum($counts),
      $counts['approved'],
      $counts['pending'],
      $counts['rejected'],
      $photoTotal,
      $saveTotal
    ));

    $excludedTotal = $this->seedExcluded($saverIds, $photoTotal, $saveTotal);

    // The transit module forgets its keys at the end of its run and this one did
    // not, so a fresh seed sat behind a 300s TTL of pre-seed data. Both readers
    // are listed here: PlaceController's map geojson and the guides leaderboard,
    // which is cached per sort. Add a key here if you add a cached place read.
    Cache::forget('places:map');
    foreach (['submissions', 'saves', 'recent'] as $sort) {
      Cache::forget("places:guides:{$sort}");
    }

    $this->command?->getOutput()->writeln(sprintf(
      '  <fg=green>places</> %d photos, %d saves in total (incl. %d excluded-author places), place caches forgotten',
      $photoTotal,
      $saveTotal,
      $excludedTotal
    ));
  }

  /**
   * Stock the banned and soft-deleted accounts, so the leaderboard's exclusion
   * filters have something they are actually excluding.
   *
   * Every one of these is approved, approved inside the 30-day "recent" window,
   * and saved by every live user, which is the maximum any place can score. If
   * the whereNull(deleted_at) / is_banned clauses in PlaceDiscoveryController::
   * guides ever go missing, حساب محظور and حساب محذوف take the top two ranks in
   * all three sorts. A silent regression becomes an obvious one.
   *
   * $photoTotal and $saveTotal are by-ref so the caller's totals stay honest.
   */
  private function seedExcluded(array $saverIds, int &$photoTotal, int &$saveTotal): int
  {
    $authors = StagingUsersSeeder::excluded()
      ->keyBy(fn ($user) => str_replace(StagingUsersSeeder::DOMAIN, '', $user->email));

    if ($authors->isEmpty()) {
      $this->command?->getOutput()->writeln('  <fg=yellow>places</> no banned/deleted staging users, leaderboard filters are untested');

      return 0;
    }

    $written = 0;

    foreach (self::EXCLUDED_PLACES as [$city, $name, $category, $description, $handle]) {
      $author = $authors->get($handle);
      if (!$author) {
        continue;
      }

      $place = $this->writePlace($author->id, $city, $name, $category, $description, 'approved', true);
      $written++;
      $photoTotal += $this->seedPhotos($place);
      $saveTotal += $this->seedSaves($place, $saverIds, true, true);
    }

    $this->command?->getOutput()->writeln(sprintf(
      '  <fg=green>places</> %d approved places on the banned/soft-deleted accounts (bait for the leaderboard filters)',
      $written
    ));

    return $written;
  }

  /**
   * One place row, keyed on user_id + name so a reseed rewrites it in place.
   *
   * $recent forces approval inside the leaderboard's 30-day window; the normal
   * table spreads over 60 days instead, so the "recent" sort has a real spread.
   */
  private function writePlace(
    int $userId,
    string $city,
    string $name,
    string $category,
    string $description,
    string $status,
    bool $recent = false
  ): Place {
    [$centreLat, $centreLng] = self::CITIES[$city];
    $approved = $status === 'approved';
    // approved_at first, then back-date created_at behind it: a place approved
    // before it was submitted is the kind of thing that breaks the "recent" sort
    $approvedAt = $approved ? ($recent ? $this->pastDate(25, 1) : $this->pastDate(60)) : null;
    $createdAt = $approvedAt
      ? $approvedAt->copy()->subDays($this->int(1, 20))
      : $this->pastDate(90, 1);

    $place = Place::updateOrCreate(
      // user_id + name: stable across reseeds, and no author repeats a name
      ['user_id' => $userId, 'name' => $name],
      [
        'category' => $category,
        'description' => $description,
        'lat' => round($centreLat + $this->float(-self::JITTER, self::JITTER), 7),
        'lng' => round($centreLng + $this->float(-self::JITTER, self::JITTER), 7),
        'status' => $status,
        // TAG rides on rejection_reason, which is admin/owner-only text, so the
        // demo marker stays greppable without leaking into the public cards
        'rejection_reason' => $status === 'rejected'
          ? $this->pick(self::REJECTIONS).' '.self::TAG
          : null,
        'approved_at' => $approvedAt,
      ]
    );

    // created_at and saves_count are outside Place::$fillable, but `php artisan
    // db:seed` runs the whole seeder inside Model::unguarded(), so they would
    // mass-assign fine. forceFill is kept because it does not care how the
    // seeder was invoked, and because writing a timestamp explicitly is clearer
    // than relying on an ambient unguard three frames up the stack.
    $place->forceFill(['created_at' => $createdAt])->save();

    return $place;
  }

  /**
   * 1-3 photos per place, keyed on place_id + sort so a reseed rewrites in place.
   *
   * ART IS PER PHOTO, NOT PER PLACE. This used to generate one triple per place
   * and point all 1-3 rows at it, which is fine on a place page (you never see
   * two at once) and broken on /mishwar: PlaceDiscoveryController::photos
   * paginates photo ROWS ordered by id, so a place's duplicates land adjacent
   * and the grid renders the same image two or three times in a row. Keying the
   * art on (place, sort) costs a few hundred more bytes per file and makes every
   * cell of that grid distinct.
   */
  private function seedPhotos(Place $place): int
  {
    $wanted = $this->int(1, 3);

    for ($sort = 0; $sort < $wanted; $sort++) {
      [$original, $display, $thumb] = $this->writePlaceholders($place->name, $sort);

      PlacePhoto::updateOrCreate(
        ['place_id' => $place->id, 'sort' => $sort],
        ['original_path' => $original, 'display_path' => $display, 'thumb_path' => $thumb]
      );
    }

    return $wanted;
  }

  /**
   * Write the original/display/thumb art for one photo and return the three paths.
   *
   * Same approach as StagingGuessWhoSeeder::writePlaceholder(): flat SVG built
   * from a string and dropped on the public disk, so there is no download, no GD
   * and no committed binary, and the same place produces the same bytes on every
   * run. SVG also means the Arabic name renders correctly without shipping a
   * font: the browser shapes and orders it, which nothing we could do to a raster
   * offline would manage.
   *
   * The three files are genuinely different images at 1600x1200, 800x600 and a
   * 400x400 crop, mirroring what PlaceImageService writes for a real upload, so
   * anything that reads a variant's dimensions sees sensible ones.
   *
   * @return array{string, string, string} original, display, thumb
   */
  private function writePlaceholders(string $name, int $sort): array
  {
    // crc32 of the name and the photo's slot, not the module PRNG: the look of a
    // photo must not shift when an unrelated row is added above it in the table.
    // Mixing $sort in is what makes a place's second and third photo different
    // pictures rather than three copies of the first.
    $seed = $name.'#'.$sort;
    $key = crc32($seed);
    $slug = substr(hash('crc32b', $seed), 0, 8);
    $colours = self::PALETTE[$key % count(self::PALETTE)];
    // The app resolves photo URLs through config('filesystems.media_disk') (see
    // PlacePhoto::versionedUrl), so we write to whatever that names. Hardcoding
    // 'public' happens to work while staging leaves MEDIA_DISK unset, and would
    // 404 every gallery the day it is set, with the seeder still reporting fine.
    $disk = Storage::disk(config('filesystems.media_disk'));
    $paths = [];

    foreach (self::VARIANTS as [$suffix, $ext, $width, $height]) {
      $path = self::IMAGE_DIR.'/'.$slug.$suffix.'.'.$ext;
      $paths[] = $path;

      // Deterministic bytes, so a file that is already there is already right.
      // Skipping keeps a reseed from churning mtimes under the immutable cache.
      if ($disk->exists($path)) {
        continue;
      }

      $disk->put($path, $this->placeholderSvg($name, $colours, $key, $width, $height));
    }

    return $paths;
  }

  /** One flat landscape card: sky, sun, two ridges, ground, and the name on a bar. */
  private function placeholderSvg(string $name, array $colours, int $key, int $width, int $height): string
  {
    [$sky, $hills, $ground, $bar] = $colours;

    // Horizon and sun position wobble with the name hash so two places sharing a
    // palette still look like two different photographs.
    $horizon = (int) round($height * (0.52 + (($key >> 3) % 12) / 100));
    $sunX = (int) round($width * (0.18 + (($key >> 7) % 60) / 100));
    $sunR = (int) round(min($width, $height) * 0.09);
    $barTop = $height - (int) round($height * 0.18);
    $fontSize = (int) round($height * 0.075);

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '.$width.' '.$height.'" width="'.$width.'" height="'.$height.'">'
      .'<rect width="'.$width.'" height="'.$height.'" fill="'.$sky.'"/>'
      .'<circle cx="'.$sunX.'" cy="'.(int) round($horizon * 0.45).'" r="'.$sunR.'" fill="#ffffff" fill-opacity="0.65"/>'
      .'<path d="M0 '.$horizon.' L'.(int) round($width * 0.3).' '.(int) round($horizon * 0.72)
      .' L'.(int) round($width * 0.55).' '.$horizon.' L'.(int) round($width * 0.78).' '.(int) round($horizon * 0.8)
      .' L'.$width.' '.$horizon.' Z" fill="'.$hills.'"/>'
      .'<rect y="'.$horizon.'" width="'.$width.'" height="'.($height - $horizon).'" fill="'.$ground.'"/>'
      .'<rect y="'.$barTop.'" width="'.$width.'" height="'.($height - $barTop).'" fill="'.$bar.'" fill-opacity="0.75"/>'
      .'<text x="'.($width - (int) round($width * 0.04)).'" y="'.($barTop + (int) round($fontSize * 1.35))
      .'" text-anchor="end" direction="rtl" font-family="sans-serif" font-size="'.$fontSize.'" fill="#ffffff">'
      .htmlspecialchars($name, ENT_XML1 | ENT_QUOTES, 'UTF-8')
      .'</text></svg>';
  }

  /**
   * Saves for approved places only, then saves_count read back from the rows.
   *
   * Reading the count instead of trusting $wanted matters: place_saves has a
   * unique(place_id, user_id), so a duplicate pick or a leftover row from an
   * earlier seed would otherwise drift the counter away from the truth.
   *
   * $everyone maxes the row out for the excluded-author bait: nothing a real
   * guide owns can beat a place saved by the entire live cast.
   */
  private function seedSaves(Place $place, array $saverIds, bool $approved, bool $everyone = false): int
  {
    if (!$approved) {
      $place->forceFill(['saves_count' => 0])->save();

      return 0;
    }

    $wanted = $everyone ? count($saverIds) : $this->int(2, count($saverIds));
    foreach (array_slice($this->shuffled($saverIds), 0, $wanted) as $userId) {
      // the unique pair IS the whole row, so there is nothing to update on a rerun
      PlaceSave::updateOrCreate(['place_id' => $place->id, 'user_id' => $userId], []);
    }

    $actual = $place->saves()->count();
    $place->forceFill(['saves_count' => $actual])->save();

    return $actual;
  }

  /** Deterministic Fisher-Yates off the base PRNG; array_rand/shuffle are not seedable here. */
  private function shuffled(array $items): array
  {
    for ($i = count($items) - 1; $i > 0; $i--) {
      $j = $this->int(0, $i);
      [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
    }

    return $items;
  }
}
