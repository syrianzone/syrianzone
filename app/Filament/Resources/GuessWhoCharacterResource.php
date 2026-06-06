<?php

namespace App\Filament\Resources;

use App\Filament\Resources\GuessWhoCharacterResource\Pages;
use App\Models\GuessWhoCharacter;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class GuessWhoCharacterResource extends Resource
{
    protected static ?string $model = GuessWhoCharacter::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Guess Who Characters';

    protected static ?string $modelLabel = 'Guess Who Character';

    protected static ?string $pluralModelLabel = 'Guess Who Characters';

    protected static ?string $navigationGroup = 'Guess Who Game';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Card::make()
                    ->schema([
                        Forms\Components\Select::make('category_id')
                            ->relationship('category', 'name_ar')
                            ->required()
                            ->label('Category'),
                        Forms\Components\TextInput::make('name_ar')
                            ->required()
                            ->label('Name (Arabic)')
                            ->maxLength(255),
                        Forms\Components\TextInput::make('name_en')
                            ->required()
                            ->label('Name (English)')
                            ->maxLength(255),
                        Forms\Components\FileUpload::make('image_path')
                            ->image()
                            ->directory('guesswho/characters')
                            ->visibility('public')
                            ->required()
                            ->label('Character Image'),
                        Forms\Components\KeyValue::make('attributes')
                            ->keyLabel('Attribute Name')
                            ->valueLabel('Attribute Value')
                            ->label('Attributes')
                            ->helperText('Define flags like gender: male, glasses: true, etc.')
                            ->nullable(),
                        Forms\Components\Toggle::make('is_active')
                            ->default(true)
                            ->label('Active'),
                    ])
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\ImageColumn::make('image_path')
                    ->label('Image')
                    ->circular(),
                Tables\Columns\TextColumn::make('name_ar')
                    ->label('Name (Arabic)')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('category.name_ar')
                    ->label('Category')
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean()
                    ->label('Active')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('category')
                    ->relationship('category', 'name_ar')
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ManageGuessWhoCharacters::route('/'),
        ];
    }
}
