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
     * This used to set `role => 'admin'` and nothing else, relying on
     * User::isAdmin() short-circuiting every permission check. That made the
     * account all-powerful by role and impossible to scope, which is the thing
     * the move to capabilities is undoing. Access is now written explicitly.
     *
     * The default is still the whole catalogue, so a newly minted account has
     * exactly the access it had before. Trim it per user afterwards — that is
     * the intended workflow now, and the Filament user form is where it happens.
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
