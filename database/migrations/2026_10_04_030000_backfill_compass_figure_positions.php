<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
  /**
   * The first seed omitted explicit `null` entries for an axis that does not
   * apply, so a figure saved with N/A axes (ret_rec, ris_communal) was stored
   * with those keys missing rather than null and the editor rendered them blank.
   * Backfill the full 11-axis vector for every already-seeded row.
   */
  private const AXIS_IDS = [
    'auth_lib', 'rel_sec', 'soc_cap', 'nat_glob', 'mil_pac', 'ret_rec',
    'central_federal', 'identity_civic', 'ris_communal', 'women_rights', 'sect_memory',
  ];

  public function up(): void
  {
    DB::table('compass_figures')->orderBy('id')->each(function ($row) {
      $positions = json_decode($row->positions, true);
      if (! is_array($positions)) {
        return;
      }

      $normalised = [];
      foreach (self::AXIS_IDS as $axis) {
        $value = $positions[$axis] ?? null;
        $normalised[$axis] = $value === null ? null : (float) $value;
      }

      if ($normalised === $positions) {
        return;
      }

      DB::table('compass_figures')->where('id', $row->id)->update([
        'positions' => json_encode($normalised, JSON_UNESCAPED_UNICODE),
      ]);
    });
  }

  public function down(): void
  {
    // Forward-only data repair: the missing keys are the bug.
  }
};
