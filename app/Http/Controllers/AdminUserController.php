<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\UserDeletionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    public function index()
    {
        return User::select('id', 'name', 'email', 'role', 'created_at')->get();
    }

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
            'role' => 'admin',
        ]), 201);
    }

    public function destroy($id, UserDeletionService $deletion)
    {
        $deleted = $deletion->deleteAccountAndTransferOwnership(User::findOrFail($id));

        if (! $deleted) {
            return response()->json(['message' => 'Cannot delete final active superadmin'], 403);
        }

        return response()->json(['message' => 'User deleted']);
    }
}
