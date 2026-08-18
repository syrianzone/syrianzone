<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use BackedEnum;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use UnitEnum;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string | BackedEnum | null $navigationIcon = 'heroicon-o-users';

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Section::make([
                    Forms\Components\TextInput::make('name')
                        ->required()
                        ->maxLength(255),
                    Forms\Components\TextInput::make('email')
                        ->email()
                        ->required()
                        ->unique(ignoreRecord: true)
                        ->maxLength(255),
                    Forms\Components\Select::make('role')
                        ->options([
                            'superadmin' => 'Superadmin (Full Unrestricted Access)',
                            'admin' => 'Admin (Core)',
                            'transit_admin' => 'Transit Admin',
                            'syofficial_admin' => 'SyOfficial Admin',
                            'govapps_admin' => 'GovApps Admin',
                            'user' => 'Normal User',
                        ])
                        ->default('user')
                        ->required(),
                    Forms\Components\Toggle::make('is_banned')
                        ->label('Banned')
                        ->default(false),
                    Forms\Components\TextInput::make('password')
                        ->password()
                        ->maxLength(255)
                        ->dehydrateStateUsing(fn ($state) => \Illuminate\Support\Facades\Hash::make($state))
                        ->dehydrated(fn ($state) => filled($state))
                        ->required(fn (string $context): bool => $context === 'create'),
                ]),
                Section::make('Granular Permissions')
                    ->description('Grant custom module capabilities for non-superadmin users')
                    ->schema([
                        Forms\Components\CheckboxList::make('permissions')
                            ->label('Module Capabilities')
                            ->options([
                                // SyOfficial
                                'syofficial.create' => 'SyOfficial: Create Entities & Categories',
                                'syofficial.edit' => 'SyOfficial: Edit Entity Data & Social Links',
                                'syofficial.toggle' => 'SyOfficial: Toggle Entity/Category Visibility',
                                'syofficial.delete' => 'SyOfficial: Delete Entities & Categories',
                                'syofficial.reorder' => 'SyOfficial: Drag & Drop Sorting',

                                // GovApps
                                'govapps.create' => 'GovApps: Add Government Apps',
                                'govapps.edit' => 'GovApps: Edit App Details & Links',
                                'govapps.toggle' => 'GovApps: Toggle Visibility',
                                'govapps.delete' => 'GovApps: Delete Apps',
                                'govapps.reorder' => 'GovApps: Drag & Drop Sorting',

                                // Transit
                                'transit.review_drafts' => 'Transit: Review Proposed Routes',
                                'transit.approve' => 'Transit: Approve & Publish Routes',
                                'transit.reject' => 'Transit: Reject Route Drafts',
                                'transit.edit_routes' => 'Transit: Edit Published Routes & Stops',
                                'transit.delete_routes' => 'Transit: Delete Routes',

                                // Mishwar Places
                                'places.review' => 'Mishwar: Review Pending Places',
                                'places.approve' => 'Mishwar: Approve & Publish Places',
                                'places.edit' => 'Mishwar: Edit Place Details',
                                'places.moderate_photos' => 'Mishwar: Rotate/Delete Photos',
                                'places.delete' => 'Mishwar: Delete Places',

                                // Phonebook
                                'phonebook.create' => 'Phonebook: Create Phone Entries & Categories',
                                'phonebook.edit' => 'Phonebook: Edit Numbers, Names & Details',
                                'phonebook.toggle' => 'Phonebook: Toggle Active/Hidden Visibility',
                                'phonebook.delete' => 'Phonebook: Delete Entries & Categories',
                                'phonebook.reorder' => 'Phonebook: Drag & Drop Sorting',

                                // Polls
                                'polls.create' => 'Polls: Create Polls',
                                'polls.edit' => 'Polls: Edit Polls & Candidates',
                                'polls.delete' => 'Polls: Delete Polls',
                            ])
                            ->columns(2),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('email')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('role')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'superadmin' => 'danger',
                        'admin' => 'warning',
                        'transit_admin' => 'success',
                        'user' => 'info',
                        default => 'gray',
                    })
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_banned')
                    ->boolean()
                    ->label('Banned')
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('deleted_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TrashedFilter::make(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
                Tables\Actions\RestoreAction::make(),
                Tables\Actions\ForceDeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                    Tables\Actions\ForceDeleteBulkAction::make(),
                    Tables\Actions\RestoreBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->withoutGlobalScopes([
                SoftDeletingScope::class,
            ]);
    }
}
