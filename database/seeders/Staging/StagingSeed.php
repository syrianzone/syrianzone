<?php

namespace Database\Seeders\Staging;

use Illuminate\Database\Seeder;

/**
 * Base for the staging demo-data seeders.
 *
 * Two constraints shape this whole directory, and both are non-obvious:
 *
 * 1. NO FAKER. fakerphp is a require-dev package and the production image runs
 *    `composer install --no-dev`, so `$this->faker` and every `Model::factory()`
 *    call fatals inside the container. Staging deliberately runs the SAME image
 *    as production (that is the point of a staging env), so the demo data has to
 *    come from hand-rolled word lists instead.
 *
 * 2. DETERMINISTIC RANDOM STREAM. Every module seeds its own PRNG from a fixed
 *    string, so the nth draw in a module is always the same value. A test that
 *    asserts "place #3 is approved" keeps passing after a reseed, and re-running
 *    is a no-op in terms of rows rather than a second pile of random ones.
 *    The exception is dates: pastDate() is relative to now(), so a backdated
 *    timestamp slides forward on every boot. That is deliberate, it keeps demo
 *    data from ageing into looking stale, but it means timestamps are stable in
 *    their offset, not in their absolute value.
 *
 * Everything here is idempotent (updateOrCreate keyed on a stable natural key),
 * so the boot-time seed can run on every container start without duplicating.
 */
abstract class StagingSeed extends Seeder
{
  /** rolling PRNG state; seeded per-module so modules do not perturb each other */
  private int $state = 0;

  /** Seed the module PRNG. Call once at the top of run(). */
  protected function seedRandom(string $key): void
  {
    // crc32 of a fixed string: stable across php versions and architectures,
    // unlike mt_srand whose stream is not guaranteed stable long-term.
    $this->state = crc32($key) & 0x7fffffff;
  }

  /** Deterministic 31-bit LCG. Numerical Recipes constants, mod 2^31. */
  protected function next(): int
  {
    $this->state = (1664525 * $this->state + 1013904223) & 0x7fffffff;

    return $this->state;
  }

  /** Inclusive integer in [$min, $max]. */
  protected function int(int $min, int $max): int
  {
    return $min + ($this->next() % max(1, $max - $min + 1));
  }

  /** Deterministic pick from a list. */
  protected function pick(array $items): mixed
  {
    return $items[$this->next() % count($items)];
  }

  /** True with probability $percent (0-100). */
  protected function chance(int $percent): bool
  {
    return $this->int(1, 100) <= $percent;
  }

  /** Deterministic float in [$min, $max] with $decimals places. */
  protected function float(float $min, float $max, int $decimals = 7): float
  {
    $scale = 10 ** $decimals;
    // a zero-width range (or one narrower than the requested precision) would
    // make the modulo below a division by zero. return the bound instead.
    $steps = (int) round(($max - $min) * $scale);
    if ($steps <= 0) {
      return round($min, $decimals);
    }

    return round($min + ($this->next() % $steps) / $scale, $decimals);
  }

  /** A timestamp $daysAgo-ish in the past, deterministic per call. */
  protected function pastDate(int $maxDaysAgo, int $minDaysAgo = 0): \Illuminate\Support\Carbon
  {
    return now()
      ->subDays($this->int($minDaysAgo, $maxDaysAgo))
      ->subMinutes($this->int(0, 1439))
      ->startOfMinute();
  }

  /** Join $count deterministic picks into a sentence-ish blob. */
  protected function sentence(array $fragments, int $count = 2): string
  {
    $parts = [];
    for ($i = 0; $i < $count; $i++) {
      $parts[] = $this->pick($fragments);
    }

    return implode(' ', array_unique($parts));
  }

  /** Marker written into every seeded row we can tag, so demo data is greppable. */
  public const TAG = '[staging demo]';
}
