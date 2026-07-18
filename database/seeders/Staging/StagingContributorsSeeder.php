<?php

namespace Database\Seeders\Staging;

use App\Models\Contribution;
use App\Models\Contributor;

/**
 * Demo rows for the contributors tables.
 *
 * Read this before you go looking for the output on screen: the /syrian-contributors
 * page DOES NOT render these rows. ExternalDataController::contributors() just
 * returns Inertia::render('SyrianContributors/Index'), and the React page fetches
 * the static file /contributors.json client-side (Index.tsx, `fetch('/contributors.json')`).
 * The database tables are exposed only through the JSON API:
 *
 *   GET /api/contributors        ContributorController::index, paginate(20)
 *                                ordered by total_contributions desc
 *   GET /api/contributors/{id}   ContributorController::show, with('contributions')
 *
 * So this module exists to give that API something to return. Fifteen rows is
 * deliberately under the page size of 20, which keeps page 1 complete and still
 * exercises the paginator envelope.
 *
 * The schema is much thinner than it sounds. contributors is only
 * (name, avatar_url, profile_url, total_contributions) and there is no bio,
 * no field/category and no links column: nothing has ever altered the table
 * since 2025_12_17_165415. All the descriptive text lives on contributions.
 */
class StagingContributorsSeeder extends StagingSeed
{
  /**
   * Handles, not display names. The real data behind this feature is GitHub
   * contributor stats (contributors.json is keyed on `username` with
   * avatars.githubusercontent.com URLs), so a handle is what actually belongs in
   * `name`. These are invented, with plausibly Syrian given names.
   *
   * Handles only: there is nowhere to put a display name. contributors has no
   * such column (see the class docblock) and inventing one for console output
   * alone would just be dead data.
   */
  private const PEOPLE = [
    'nour-aldin',
    'samer-kh',
    'hala-dev',
    'omar-mansour',
    'rimaz',
    'kareem-hs',
    'lujain-code',
    'tarek-ftw',
    'sana-t',
    'yaman-b',
    'dima-rs',
    'ghaith-n',
    'maya-sh',
    'zaid-alk',
    'farah-q',
  ];

  /** Repos under the org. Kept realistic so the API payload looks like the real thing. */
  private const REPOS = [
    'syrianzone/syrian.zone',
    'syrianzone/transit',
    'syrianzone/tierlist',
    'syrianzone/population-atlas',
    'syrianzone/flag-replacer',
    'syrianzone/docs',
  ];

  /**
   * contributions.type is a free-text string column with only a
   * `// PR, Issue, etc.` comment for guidance: no enum, no check constraint and
   * nothing in the app validates it. These are the conventional GitHub event
   * names, which is the closest thing to a contract that exists.
   */
  private const TYPES = ['PR', 'Issue', 'Review', 'Commit', 'Docs'];

  /** Sentence fragments for the description blob. There is no status column to vary. */
  private const SUBJECTS = [
    'إصلاح',
    'تحسين',
    'توثيق',
    'إعادة هيكلة',
    'إضافة اختبارات إلى',
  ];

  private const AREAS = [
    'صفحة الخرائط',
    'واجهة التصويت',
    'خطوط النقل',
    'لوحة الإدارة',
    'دعم اللغة العربية',
    'تحميل الصور',
    'مسار تسجيل الدخول',
  ];

  public function run(): void
  {
    $this->seedRandom('staging-contributors');

    $out = $this->command?->getOutput();

    foreach (self::PEOPLE as $index => $handle) {
      // `name` has no unique index, but it is the only stable natural key the
      // table offers and handles are unique by construction.
      $contributor = Contributor::updateOrCreate(
        ['name' => $handle],
        [
          // Rendered straight into an <img src> with no /storage/ prefix, unlike
          // guess who character art, so a full external URL is correct here.
          // Same dicebear trick as StagingUsersSeeder: deterministic, no api key.
          'avatar_url' => 'https://api.dicebear.com/7.x/thumbs/svg?seed='.$handle,
          'profile_url' => 'https://github.com/'.$handle,
          // Overwritten below with the real row count so the API's
          // orderBy('total_contributions') agrees with what show() returns.
          'total_contributions' => 0,
        ]
      );

      $count = $this->int(2, 7);

      for ($i = 1; $i <= $count; $i++) {
        $repo = $this->pick(self::REPOS);
        // Deterministic per (contributor, slot), which makes url a stable natural
        // key and keeps a rerun from stacking up duplicate contributions.
        $number = 100 + ($index * 20) + $i;
        $type = $this->pick(self::TYPES);
        $url = 'https://github.com/'.$repo.'/'.($type === 'Issue' ? 'issues' : 'pull').'/'.$number;

        Contribution::updateOrCreate(
          [
            'contributor_id' => $contributor->id,
            'url' => $url,
          ],
          [
            'repository' => $repo,
            'type' => $type,
            'description' => $this->pick(self::SUBJECTS).' '.$this->pick(self::AREAS).' '.self::TAG,
            // `date` is a DATE column, not a timestamp, so hand it a date string.
            'date' => $this->pastDate(540, 3)->toDateString(),
          ]
        );
      }

      // Reconcile the denormalised counter. Counting the rows rather than
      // trusting $count keeps this correct on a rerun, where some contributions
      // are updated rather than inserted.
      $total = Contribution::where('contributor_id', $contributor->id)->count();
      $contributor->update(['total_contributions' => $total]);

      $out?->writeln(sprintf(
        '  <fg=gray>contributor</> %-16s %2d contributions',
        $handle,
        $total
      ));
    }

    $out?->writeln(sprintf(
      '  <fg=gray>contributor</> %d contributors, %d contributions total',
      count(self::PEOPLE),
      Contribution::count()
    ));
  }
}
