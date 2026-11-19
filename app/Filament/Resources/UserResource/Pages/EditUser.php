<?php

namespace App\Filament\Resources\UserResource\Pages;

use App\Exceptions\Users\UserModerationException;
use App\Filament\Resources\UserResource;
use App\Services\Users\UserModerationService;
use Filament\Actions;
use Filament\Notifications\Notification;
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

        // A ban change goes through the moderation service like every other
        // door, so its refusals (superadmins, self-ban) and the revocation of
        // existing sessions and tokens apply here too.
        if (array_key_exists('is_banned', $data)) {
            if ((bool) $data['is_banned'] !== (bool) $record->is_banned) {
                try {
                    app(UserModerationService::class)->setBanned($record, (bool) $data['is_banned'], auth()->user());
                } catch (UserModerationException $e) {
                    Notification::make()->danger()->title($e->getMessage())->send();
                    $this->halt();
                }
            }
            unset($data['is_banned']);
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
