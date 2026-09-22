<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Filament\Resources\UserResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditUser extends EditRecord
{
    protected static string $resource = UserResource::class;

    protected function mutateFormDataBeforeFill(array $data): array
    {
        return UserResource::splitPermissionFormData($data);
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        $record = $this->getRecord();
        $existingScopes = $record->permission_scopes ?? [];

        // The form only carries perm_* keys; seed the stored values so
        // capabilities outside the known groups ('*', future modules) survive.
        if (! array_key_exists('permissions', $data)) {
            $data['permissions'] = $record->permissions ?? [];
        }

        return UserResource::mergePermissionFormData($data, is_array($existingScopes) ? $existingScopes : []);
    }

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
            Actions\ForceDeleteAction::make(),
            Actions\RestoreAction::make(),
        ];
    }
}
