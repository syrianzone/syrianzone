<?php

namespace App\Filament\Resources\GuessWhoCategoryResource\Pages;

use App\Filament\Resources\GuessWhoCategoryResource;
use Filament\Actions;
use Filament\Resources\Pages\ManageRecords;

class ManageGuessWhoCategories extends ManageRecords
{
    protected static string $resource = GuessWhoCategoryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
