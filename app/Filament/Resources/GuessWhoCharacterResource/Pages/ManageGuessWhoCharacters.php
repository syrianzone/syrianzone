<?php

namespace App\Filament\Resources;

namespace App\Filament\Resources\GuessWhoCharacterResource\Pages;

use App\Filament\Resources\GuessWhoCharacterResource;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;

class ManageGuessWhoCharacters extends ManageRecords
{
    protected static string $resource = GuessWhoCharacterResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
