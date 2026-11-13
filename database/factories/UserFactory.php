<?php

namespace Database\Factories;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            // An ordinary member of the community, holding nothing.
            //
            // This defaulted to `admin`, which meant every bare
            // User::factory()->create() in the suite was a full-capability
            // account via the isAdmin() short-circuit. Tests asserting that a
            // capability-gated route admits a caller therefore passed for the
            // wrong reason: they would have passed with the capability check
            // deleted outright. Defaulting to `user` makes an under-specified
            // test fail, which is the only way the assertion means anything.
            //
            // Staff accounts are explicit: superadmin(), admin() for the
            // deprecated alias, or moduleStaff()/agentUser() with a capability
            // list.
            'role' => 'user',
            'permissions' => [],
        ];
    }

    /**
     * A full-capability account, for tests about authority rather than access
     * control. Named so the grant is visible at the call site.
     */
    public function superadmin(): static
    {
        return $this->state(fn () => ['role' => 'superadmin']);
    }

    /**
     * A staff account holding exactly one module's capabilities.
     */
    public function module(string $module): static
    {
        return $this->state(fn () => [
            'permissions' => PermissionCatalogue::forModule($module),
        ]);
    }

    /**
     * A staff account holding an explicit capability list.
     *
     * @param  array<int, string>  $capabilities
     */
    public function withPermissions(array $capabilities): static
    {
        return $this->state(fn () => ['permissions' => $capabilities]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
