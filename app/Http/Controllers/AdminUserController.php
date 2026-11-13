<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    public function index()
    {
        return User::select('id', 'name', 'email', 'role', 'created_at')->get();
    }

    /**
     * Mint a staff account.
     *
     * Access is written explicitly as a capability list rather than by role: a
     * role cannot be scoped to one account.
     *
     * The default is the whole catalogue; trim it per user afterwards, in the
     * Filament user form.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|unique:users,email',
            'name' => 'required|string',
        ]);

        return response()->json(User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make(Str::random(16)),
            'role' => 'user',
            'permissions' => PermissionCatalogue::all(),
        ]), 201);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);

        if ($user->isSuperAdmin()) {
            return response()->json(['message' => 'Cannot delete superadmin'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }
}
