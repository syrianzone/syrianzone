<?php

namespace Database\Seeders\Staging;

use App\Models\Ballot;
use App\Models\BallotItem;
use App\Models\Candidate;
use App\Models\CandidateGroup;
use App\Models\Poll;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Demo tier-list polls for staging.
 *
 * Three things about this module are load-bearing and easy to break:
 *
 * 1. The leaderboard (PollController::leaderboard) reads NOTHING but the
 *    `daily_scores` table. Ballots and ballot_items are write-only history as
 *    far as the ranking is concerned, and `daily_ranks` is not read at all.
 *    So the scores here are written directly rather than replayed through
 *    VotingService, and they are shaped to match what that service would have
 *    produced (tier minimum 0-50 plus a small position bonus, so a per-vote
 *    average lands in roughly the 10-55 band).
 *
 * 2. The leaderboard buckets results by `candidate_groups.key`, mapped through
 *    normalizeGroupKey(): minister -> ministers, governor -> governors,
 *    security -> security. Any other key becomes its own top-level array that
 *    the Inertia page does not know how to render, so stick to those three.
 *
 * 3. This module OWNS the `best-ministers` slug on staging, and it has to. The
 *    /tierlist routes carry no slug: PollController::renderTierList does
 *    firstOrFail() on the literal 'best-ministers', and
 *    renderTierListLeaderboard hands the same literal to leaderboard(). With no
 *    poll under that exact slug the site's flagship feature is simply a 404 on
 *    staging, which is what this seeder used to cause by routing around the
 *    name.
 *
 *    Claiming it is safe because staging runs an isolated database and nothing
 *    else writes that slug there: docker/10-startup.sh skips the production
 *    GuessWhoSeeder whenever APP_ENV=staging, and LegacyPollSeeder is never
 *    invoked at boot (it is dead code anyway, the create_poll_tables migration
 *    DROPs the `questions` table its Question::firstOrCreate calls need and
 *    nothing recreates it). The two remaining polls keep their `staging-*`
 *    slugs, and every title here stays marked بيئة تجريبية so nobody mistakes a
 *    staging box for production on the strength of a familiar slug.
 *
 *    One knock-on, on a dev box where both seeders do run: GuessWhoSeeder
 *    builds its characters from the best-ministers candidates, so it will pick
 *    up the cast below. That is the good branch of that seeder rather than its
 *    broken dummy fallback, and every candidate here has an image_url pointing
 *    at a file that exists, which is exactly what it needs.
 *
 * 4. Every date this seeder writes hangs off ANCHOR_DAY, never off now(). This
 *    module runs on EVERY container boot, and `daily_scores` is keyed by
 *    (poll_id, candidate_id, day). A window derived from now() therefore wrote
 *    a fresh set of rows the first time a boot landed on a new calendar day,
 *    and since the leaderboard sums `daily_scores` with no time window, the
 *    all-time totals grew a little every day forever. A fixed anchor is what
 *    makes "reseeding is a no-op" actually true rather than merely intended.
 *
 * 5. The seeded window ends STRICTLY BEFORE today, and seedScores writes
 *    ABSOLUTE votes/score values where VotingService::updateDailyScores
 *    INCREMENTS them. If the two ever shared a day, a reboot would silently
 *    overwrite the votes a human cast while testing. Real votes land on today,
 *    the demo data stops before it, and the two never touch.
 *
 * Candidate images point at the existing /tierlist-assets/images/gov*.jpg files
 * that ship in public/. Nothing is downloaded, and a populated image_url is
 * what keeps a candidate visible to the guess-who importer.
 */
class StagingPollsSeeder extends StagingSeed
{
  /** Images that actually exist under public/tierlist-assets/images/. */
  private const IMAGES = 12;

  /** Tiers in descending value, mirroring VotingService::TIER_MINIMUMS. */
  private const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];

  /**
   * The most recent day the demo data covers. Every date below is an offset
   * back from here, so the seeder writes byte-identical rows whatever day the
   * container happens to boot on.
   *
   * This is a hand-maintained constant on purpose. Deriving it from now() is
   * exactly the bug it exists to prevent, so the freshness/correctness trade is
   * settled in correctness' favour: the data ages, and somebody bumps this date
   * when it starts looking stale. Bumping it is safe, pruneStaleDays() below
   * clears the rows the previous anchor left behind.
   *
   * Two invariants, both enforced by assertAnchorIsPast():
   *   - it is a fixed calendar date, never computed
   *   - it is strictly before today, so the demo series can never collide with
   *     a vote a human casts on the staging site (those land on today)
   */
  private const ANCHOR_DAY = '2026-07-13';

  /**
   * Poll specs. Each candidate is [name, title, status].
   *
   * `dayFrom`/`dayTo` are offsets in days back from ANCHOR_DAY (not from
   * today) bounding the daily_scores series: the open polls run up to the
   * anchor, the archived one stops before its candidates' term_ended_at so the
   * "former" leaderboard filter still finds rows (that filter drops any day
   * AFTER the term end).
   */
  private const POLLS = [
    [
      // The slug the hardcoded /tierlist and /tierlist/leaderboard routes
      // resolve. It is the production name on purpose (see point 3 above); the
      // title is what tells you which box you are on. This entry stays FIRST in
      // the list: the module PRNG is a single stream, so reordering polls would
      // reshuffle every owner, term date and score below it.
      'slug' => 'best-ministers',
      'title' => 'تقييم الحكومة (بيئة تجريبية)',
      'is_active' => true,
      'dayFrom' => 6,
      'dayTo' => 0,
      'termEndedAt' => null,
      'groups' => [
        [
          'key' => 'minister',
          'name' => 'الوزراء',
          'is_default' => true,
          'candidates' => [
            ['هيثم النجار', 'وزير الاقتصاد', 'active'],
            ['ريم القاسمي', 'وزيرة التربية', 'active'],
            ['فادي الخوري', 'وزير الصحة', 'active'],
            ['بشرى العمري', 'وزيرة العدل', 'active'],
            ['وائل الجندي', 'وزير الطاقة', 'active'],
            ['سمر الحموي', 'وزيرة الثقافة', 'active'],
          ],
        ],
        [
          'key' => 'governor',
          'name' => 'المحافظون',
          'is_default' => false,
          'candidates' => [
            ['طارق البيروتي', 'محافظ دمشق', 'active'],
            ['لينا الأتاسي', 'محافظة حلب', 'active'],
            ['خالد الميداني', 'محافظ حمص', 'active'],
            ['عبير السلمون', 'محافظة اللاذقية', 'active'],
          ],
        ],
        [
          'key' => 'security',
          'name' => 'الأمن الداخلي',
          'is_default' => false,
          'candidates' => [
            ['مازن الرفاعي', 'مدير الأمن الداخلي', 'active'],
            ['جواد الصالح', 'مدير الدفاع المدني', 'active'],
          ],
        ],
      ],
    ],
    [
      'slug' => 'staging-mayors',
      'title' => 'أفضل رئيس بلدية (بيئة تجريبية)',
      'is_active' => true,
      'dayFrom' => 9,
      'dayTo' => 0,
      'termEndedAt' => null,
      'groups' => [
        [
          'key' => 'governor',
          'name' => 'رؤساء البلديات',
          'is_default' => true,
          'candidates' => [
            ['أمجد الزيتوني', 'بلدية دوما', 'active'],
            ['هدى المصري', 'بلدية جرمانا', 'active'],
            ['نبيل الشهابي', 'بلدية إدلب', 'active'],
            ['رنا الفراتي', 'بلدية دير الزور', 'active'],
            ['سليم الحوراني', 'بلدية درعا', 'active'],
            ['ميساء التلاوي', 'بلدية حماة', 'active'],
          ],
        ],
      ],
    ],
    [
      'slug' => 'staging-cabinet-2025',
      'title' => 'تقييم حكومة ٢٠٢٥ (مؤرشف - بيئة تجريبية)',
      'is_active' => false,
      'dayFrom' => 16,
      'dayTo' => 10,
      // matches the archived candidates below: the last seeded day is 10 days
      // before the anchor, so a term end 8 days before the anchor keeps every
      // row inside the filter.
      'termEndedAt' => 8,
      'groups' => [
        [
          'key' => 'minister',
          'name' => 'وزراء الحكومة السابقة',
          'is_default' => true,
          'candidates' => [
            ['غسان المعري', 'وزير المالية السابق', 'archived'],
            ['ياسمين الدالي', 'وزيرة الإعلام السابقة', 'archived'],
            ['أنس الحلبوني', 'وزير النقل', 'active'],
            ['دارين السويداوي', 'وزيرة السياحة', 'active'],
            ['رياض الجزراوي', 'وزير الزراعة', 'active'],
          ],
        ],
      ],
    ],
  ];

  /**
   * Slugs this module used to create and no longer does.
   *
   * The cabinet poll moved from `staging-cabinet` to `best-ministers`. Staging
   * databases persist across deploys, so without this the old poll would sit
   * there forever as a second, stale copy of the same demo data: duplicated in
   * the /polls index and double-counted by anything that sums across polls.
   *
   * Only ever slugs this file itself created, so the delete cannot reach data
   * it did not write. Cascades handle candidate_groups, candidates, ballots,
   * ballot_items, daily_scores and daily_ranks.
   */
  private const RETIRED_SLUGS = ['staging-cabinet'];

  public function run(): void
  {
    $this->assertAnchorIsPast();
    $this->retireOldPolls();
    $this->seedRandom('staging-polls');

    $users = StagingUsersSeeder::guides();
    $imageCursor = 0;

    foreach (self::POLLS as $spec) {
      $owner = $users->isNotEmpty() ? $users[$this->int(0, $users->count() - 1)] : null;

      $poll = Poll::updateOrCreate(
        ['slug' => $spec['slug']],
        [
          'title' => $spec['title'],
          'timezone' => 'Asia/Damascus',
          'is_active' => $spec['is_active'],
          'user_id' => $owner?->id,
        ]
      );

      $this->command?->getOutput()->writeln(sprintf(
        '  <fg=gray>poll</> %-24s %s',
        $poll->slug,
        $spec['is_active'] ? 'active' : 'archived'
      ));

      $termEndedAt = $spec['termEndedAt'] !== null
        ? $this->anchorDay()->subDays($spec['termEndedAt'])
        : null;

      // Ordered flat list of candidates for this poll. Position in this list is
      // the intended ranking: the score generator walks it top to bottom with a
      // descending per-vote average, so the leaderboard comes out clearly
      // ordered instead of a wall of ties.
      $ranked = [];
      $sort = 0;

      foreach ($spec['groups'] as $groupIndex => $groupSpec) {
        $group = CandidateGroup::updateOrCreate(
          ['poll_id' => $poll->id, 'key' => $groupSpec['key']],
          [
            'name' => $groupSpec['name'],
            'sort_order' => $groupIndex,
            'is_default' => $groupSpec['is_default'],
          ]
        );

        foreach ($groupSpec['candidates'] as [$name, $title, $status]) {
          $imageCursor++;
          $image = sprintf('/tierlist-assets/images/gov%02d.jpg', ($imageCursor % self::IMAGES) + 1);

          $candidate = Candidate::updateOrCreate(
            ['poll_id' => $poll->id, 'name' => $name],
            [
              'candidate_group_id' => $group->id,
              'title' => $title,
              'image_url' => $image,
              'category' => $groupSpec['key'],
              'sort' => $sort++,
              'status' => $status,
              // not pastDate(): that helper counts back from now(), which would
              // slide this column by a day on every boot that crossed midnight.
              'term_started_at' => $this->anchorDay()->subDays($this->int(400, 700))->toDateString(),
              'term_ended_at' => $status === 'archived' ? $termEndedAt?->toDateString() : null,
              'archive_reason' => $status === 'archived' ? 'انتهاء ولاية الحكومة السابقة' : null,
            ]
          );

          $ranked[] = $candidate;
        }
      }

      $days = $this->dayRange($spec['dayFrom'], $spec['dayTo']);
      $this->pruneStaleDays($poll, $days);
      $this->pruneStaleBallots($poll, $days, $users);
      $this->seedScores($poll, $ranked, $days);
      $this->seedBallots($poll, $ranked, $days, $users);

      $this->command?->getOutput()->writeln(sprintf(
        '    <fg=gray>%d groups, %d candidates, %d days of scores</>',
        count($spec['groups']),
        count($ranked),
        count($days)
      ));
    }
  }

  /** Drop polls this module has stopped creating. See RETIRED_SLUGS. */
  private function retireOldPolls(): void
  {
    foreach (Poll::whereIn('slug', self::RETIRED_SLUGS)->get() as $poll) {
      $poll->delete();

      $this->command?->getOutput()->writeln(sprintf(
        '  <fg=gray>poll</> %-24s retired',
        $poll->slug
      ));
    }
  }

  /** The fixed last day of the demo series. Never derived from now(). */
  private function anchorDay(): Carbon
  {
    return Carbon::createFromFormat('Y-m-d', self::ANCHOR_DAY)->startOfDay();
  }

  /**
   * Refuse to run if ANCHOR_DAY has stopped being in the past.
   *
   * That means either somebody bumped the constant past today or the box's
   * clock is wrong. Either way the demo window would overlap today and start
   * clobbering real votes, so stop instead. StagingSeeder catches per-module
   * failures, so this costs the poll data and nothing else.
   */
  private function assertAnchorIsPast(): void
  {
    if ($this->anchorDay()->greaterThanOrEqualTo(now()->startOfDay())) {
      throw new \RuntimeException(sprintf(
        'StagingPollsSeeder::ANCHOR_DAY (%s) must be strictly before today (%s); '
        .'seeding it would overwrite real staging votes.',
        self::ANCHOR_DAY,
        now()->toDateString()
      ));
    }
  }

  /** Consecutive whole days, oldest first, as offsets back from ANCHOR_DAY. */
  private function dayRange(int $from, int $to): array
  {
    $days = [];
    for ($i = $from; $i >= $to; $i--) {
      $days[] = $this->anchorDay()->subDays($i);
    }

    return $days;
  }

  /**
   * Drop score rows this poll picked up from a previous anchor.
   *
   * Needed for two reasons: staging boxes still carry the drifting rows the
   * old now()-derived window wrote, and bumping ANCHOR_DAY should move the
   * series rather than add a second one. Without this the leaderboard keeps
   * summing both.
   *
   * Scoped hard, on three axes:
   *
   *   - only the poll passed in, always one this file created;
   *   - only days strictly before today, so a vote a human tester casts today
   *     (VotingService always writes vote_day = today) is never in range;
   *   - on daily_scores, only rows carrying this seeder's own signature.
   *
   * That third axis matters now that this module owns `best-ministers`, the
   * slug /tierlist actually submits against. daily_scores is the one table here
   * that real voting also writes, so a bare poll+day delete would take a
   * tester's vote from an EARLIER day with it: the day is in the past, so the
   * second-axis guard does not cover it. seedScores stamps updated_at at the
   * exact end of the row's own day, where VotingService stamps now() during the
   * day, so matching on that leaves anything a human touched alone. daily_ranks
   * needs no such guard, nothing outside this seeder ever writes it.
   *
   * The day bounds are a contiguous range rather than a NOT IN list because
   * `day` is a timestamp column that MySQL and sqlite render differently, and
   * range comparisons survive both. For the same reason the signature match is
   * done in PHP rather than as SQL date arithmetic.
   */
  private function pruneStaleDays(Poll $poll, array $days): void
  {
    $start = $days[0]->toDateString();
    $end = $days[count($days) - 1]->copy()->endOfDay()->toDateTimeString();
    $today = now()->startOfDay()->toDateString();

    $outsideWindow = function ($q) use ($start, $end, $today) {
      $q->where('day', '<', $start)
        ->orWhere(fn($inner) => $inner->where('day', '>', $end)->where('day', '<', $today));
    };

    DB::table('daily_ranks')
      ->where('poll_id', $poll->id)
      ->where($outsideWindow)
      ->delete();

    $rows = DB::table('daily_scores')
      ->where('poll_id', $poll->id)
      ->where($outsideWindow)
      ->get(['candidate_id', 'day', 'updated_at']);

    foreach ($rows as $row) {
      $signature = Carbon::parse($row->day)->endOfDay()->toDateTimeString();
      if (Carbon::parse($row->updated_at)->toDateTimeString() !== $signature) {
        // a real vote, or something else we did not write. leave it.
        continue;
      }

      DB::table('daily_scores')
        ->where('poll_id', $poll->id)
        ->where('candidate_id', $row->candidate_id)
        ->where('day', $row->day)
        ->delete();
    }
  }

  /**
   * Drop ballots a previous anchor left outside the current window.
   *
   * Scoped to the exact voter_keys this seeder mints, so a real tester's
   * ballots (keyed off a device id hash) are untouchable here regardless of
   * which day they fall on. ballot_items go first: the FK cascades, but only
   * when the driver is actually enforcing constraints.
   */
  private function pruneStaleBallots(Poll $poll, array $days, $users): void
  {
    if ($users->isEmpty()) {
      return;
    }

    $keys = $users->map(fn($user) => $this->voterKey($user))->all();
    $start = $days[0]->toDateTimeString();
    $end = $days[count($days) - 1]->copy()->endOfDay()->toDateTimeString();

    $stale = DB::table('ballots')
      ->where('poll_id', $poll->id)
      ->whereIn('voter_key', $keys)
      ->where(fn($q) => $q->where('vote_day', '<', $start)->orWhere('vote_day', '>', $end))
      ->pluck('id');

    if ($stale->isEmpty()) {
      return;
    }

    DB::table('ballot_items')->whereIn('ballot_id', $stale)->delete();
    DB::table('ballots')->whereIn('id', $stale)->delete();
  }

  /**
   * The voter_key for a seeded user. Same shape VotingService uses (a sha256),
   * but over the staging email, so seeded and real ballots can never collide.
   */
  private function voterKey($user): string
  {
    return hash('sha256', 'staging-voter-'.$user->email);
  }

  /**
   * Write daily_scores (what the leaderboard sums) and daily_ranks (the
   * per-day standings snapshot) for every candidate on every day.
   *
   * Both tables have a composite primary key and the Eloquent models fake it
   * with a custom setKeysForSaveQuery, which updateOrCreate does not survive.
   * The query builder handles the same upsert without the drama.
   *
   * These writes are ABSOLUTE where VotingService::updateDailyScores is an
   * increment on the same (poll_id, candidate_id, day) key, so this must only
   * ever be handed days from before today. $days comes from dayRange(), which
   * is anchored to ANCHOR_DAY and checked by assertAnchorIsPast().
   */
  private function seedScores(Poll $poll, array $ranked, array $days): void
  {
    $count = max(1, count($ranked));

    foreach ($days as $day) {
      $rows = [];

      foreach ($ranked as $i => $candidate) {
        // 50 down to about 14 across the field, plus a sliver of daily noise
        // that is far too small to reorder neighbours.
        $average = 50.0 - ($i / $count) * 36.0 + $this->float(-0.4, 0.4, 2);
        $votes = $this->int(9, 26);

        $rows[] = [
          'candidate_id' => $candidate->id,
          'votes' => $votes,
          'score' => (int) round($votes * max(6.0, $average)),
        ];
      }

      usort($rows, fn($a, $b) => $b['score'] <=> $a['score']);

      foreach ($rows as $rank => $row) {
        $key = [
          'poll_id' => $poll->id,
          'candidate_id' => $row['candidate_id'],
          'day' => $day->toDateString(),
        ];

        // updated_at is the day itself, not now(): a value that moves on every
        // boot would make a reseed a real write rather than the no-op it claims
        // to be, and would mislead anyone diffing the table to spot drift.
        DB::table('daily_scores')->updateOrInsert($key, [
          'votes' => $row['votes'],
          'score' => $row['score'],
          'updated_at' => $day->copy()->endOfDay(),
        ]);

        DB::table('daily_ranks')->updateOrInsert($key, [
          'rank' => $rank + 1,
          'votes' => $row['votes'],
          'score' => $row['score'],
          'created_at' => $day->copy()->endOfDay(),
        ]);
      }
    }
  }

  /**
   * Ballot history for the staging cast.
   *
   * `ballots` has no user_id column: the app identifies a voter by
   * `voter_key`, which VotingService fills with a sha256 of the client device
   * id. The same hashing shape is used here over the staging user's email so
   * every ballot traces back to a real account without inventing a column.
   * Archived candidates are skipped, since a real submit would be rejected.
   */
  private function seedBallots(Poll $poll, array $ranked, array $days, $users): void
  {
    if ($users->isEmpty()) {
      return;
    }

    $votable = array_values(array_filter($ranked, fn($c) => $c->status !== 'archived'));
    if (count($votable) < 3) {
      return;
    }

    foreach ($users as $user) {
      // not everyone votes every day, and nobody votes on every poll
      if (!$this->chance(75)) {
        continue;
      }

      $day = $this->pick($days);
      $voterKey = $this->voterKey($user);

      $ballot = Ballot::updateOrCreate(
        [
          'poll_id' => $poll->id,
          'voter_key' => $voterKey,
          'vote_day' => $day,
        ],
        [
          'ip_hash' => hash('sha256', 'staging-ip-'.$user->id),
          'user_agent' => self::TAG.' Mozilla/5.0 (staging seeder)',
        ]
      );

      $picked = array_slice($votable, 0, min(count($votable), count(self::TIERS)));

      foreach ($picked as $position => $candidate) {
        // strongest candidates land in the strongest tiers, with the odd voter
        // knocking one down a tier so the ballots are not carbon copies.
        $tierIndex = $position;
        if ($this->chance(25) && $tierIndex < count(self::TIERS) - 1) {
          $tierIndex++;
        }

        BallotItem::updateOrCreate(
          ['ballot_id' => $ballot->id, 'candidate_id' => $candidate->id],
          ['tier' => self::TIERS[$tierIndex], 'position' => 0]
        );
      }

      $this->command?->getOutput()->writeln(sprintf(
        '    <fg=gray>ballot</> %-30s %s',
        $user->email,
        $day->toDateString()
      ));
    }
  }
}
