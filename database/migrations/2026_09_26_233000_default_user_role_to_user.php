<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase B: stop granting access by role.
 *
 * The `users.role` column has defaulted to 'admin' since it was introduced, and
 * that default is why an omitted role silently produced an all-powerful account:
 * User::isAdmin() short-circuits every permission check, so `role = 'admin'`
 * means "every capability" regardless of the permissions array.
 *
 * Nothing in the current code relies on the default — all three account-creation
 * paths set `role` explicitly — so flipping it to 'user' changes no existing
 * account. It just makes the next omission fail closed.
 *
 * Stated as a column definition rather than a driver-specific ALTER, so it
 * behaves identically on MySQL and on the SQLite database the tests run
 * against. SQLite cannot alter a column default in place; the grammar rebuilds
 * the table, which is why a raw `UPDATE sqlite_master` is not an option here.
 *
 * This restates the column, so it carries the current definition verbatim:
 * a non-nullable string, with no attributes beyond the default.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('admin')->change();
        });
    }
};
