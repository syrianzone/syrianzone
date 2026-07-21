<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('permissions')->nullable()->after('role');
        });

        // Backfill permissions based on legacy role string for existing accounts
        User::chunk(100, function ($users) {
            foreach ($users as $user) {
                $perms = [];
                if ($user->role === 'admin') {
                    $perms = [
                        'syofficial.create', 'syofficial.edit', 'syofficial.toggle', 'syofficial.delete', 'syofficial.reorder',
                        'transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes', 'transit.delete_routes',
                        'places.review', 'places.approve', 'places.edit', 'places.moderate_photos', 'places.delete',
                        'polls.create', 'polls.edit', 'polls.delete'
                    ];
                } elseif ($user->role === 'syofficial_admin') {
                    $perms = [
                        'syofficial.create', 'syofficial.edit', 'syofficial.toggle', 'syofficial.delete', 'syofficial.reorder'
                    ];
                } elseif ($user->role === 'transit_admin') {
                    $perms = [
                        'transit.review_drafts', 'transit.approve', 'transit.reject', 'transit.edit_routes'
                    ];
                }

                if (!empty($perms)) {
                    $user->update(['permissions' => $perms]);
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('permissions');
        });
    }
};
