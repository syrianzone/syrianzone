<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PhonebookAdmin
{
    /**
     * Handle an incoming request for Phonebook Admin panel & endpoints.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return redirect()->route('login');
        }

        if (
            $user->isSuperAdmin() ||
            $user->role === 'admin' ||
            $user->hasAnyPermission([
                'phonebook.create',
                'phonebook.edit',
                'phonebook.toggle',
                'phonebook.delete',
                'phonebook.reorder'
            ])
        ) {
            return $next($request);
        }

        abort(403, 'Unauthorized access to Phonebook Admin management.');
    }
}
