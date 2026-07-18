<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\RestoreAction::make(),
        ];
    }

    protected function handleRecordUpdate(Model $record, array $data): Model
    {
        return DB::transaction(function () use ($data, $record): Model {
            $activeSuperadmins = User::query()
                ->where('role', 'superadmin')
                ->where('is_banned', false)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $account = User::withTrashed()->lockForUpdate()->findOrFail($record->getKey());
            $role = $data['role'] ?? $account->role;
            $isBanned = (bool) ($data['is_banned'] ?? $account->is_banned);
            $hasActiveDelegate = $activeSuperadmins->contains(
                fn (User $candidate): bool => $candidate->id !== $account->id,
            );

            if ($account->isSuperAdmin() && ! $account->is_banned && ! $hasActiveDelegate) {
                $errors = [];

                if ($role !== 'superadmin') {
                    $errors['data.role'] = 'The final active superadmin cannot be demoted.';
                }
                if ($isBanned) {
                    $errors['data.is_banned'] = 'The final active superadmin cannot be banned.';
                }
                if ($errors) {
                    throw ValidationException::withMessages($errors);
                }
            }

            $account->update($data);

            return $account;
        });
    }
}
