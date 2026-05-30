<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class TransitAuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $expectedUser = env('TRANSIT_ADMIN_USER', 'admin');
        $expectedPass = env('TRANSIT_ADMIN_PASS', '');

        if (
            $validated['username'] !== $expectedUser ||
            $validated['password'] !== $expectedPass
        ) {
            return response()->json(['message' => 'اسم المستخدم أو كلمة المرور غير صحيحة'], 401);
        }

        $token = hash('sha256', $expectedUser . $expectedPass . config('app.key'));

        return response()->json(['token' => $token]);
    }
}
