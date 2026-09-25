<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ApiTokenResource\Pages;
use App\Models\User;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use BackedEnum;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Collection;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Mint and revoke agent API tokens.
 *
 * Reached only through the superadmin panel, whose gate is
 * User::canAccessPanel(). Tokens are the credentials an AI agent uses against
 * /mcp/admin, so this screen is the whole supply chain for that surface: it
 * decides who holds a credential, which capabilities it carries, and how long
 * it lives.
 *
 * There is deliberately no edit action. Capabilities and expiry are fixed at
 * issue time: a credential that can be quietly widened after the fact is a
 * credential nobody audited. Changing one means revoking and re-issuing.
 *
 * The plaintext token is shown exactly once, in the confirmation notification.
 * Only its hash is stored, so a lost token cannot be recovered — mint a
 * replacement.
 */
class ApiTokenResource extends Resource
{
    protected static ?string $model = PersonalAccessToken::class;

    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-key';

    protected static ?string $navigationLabel = 'رموز الوكلاء';

    protected static ?string $modelLabel = 'رمز وكيل';

    protected static ?string $pluralModelLabel = 'رموز الوكلاء';

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('الاسم')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('tokenable.name')
                    ->label('المستخدم')
                    ->searchable()
                    ->sortable(),

                Tables\Columns\TextColumn::make('abilities')
                    ->label('الصلاحيات')
                    ->badge()
                    ->separator('، ')
                    ->wrap()
                    ->formatStateUsing(fn ($state) => collect($state ?: [])->map(
                        fn (string $ability) => PermissionCatalogue::label($ability)
                    )->all()),

                Tables\Columns\TextColumn::make('last_used_at')
                    ->label('آخر استخدام')
                    ->dateTime()
                    ->sortable()
                    ->placeholder('لم يُستخدم'),

                Tables\Columns\TextColumn::make('expires_at')
                    ->label('ينتهي في')
                    ->dateTime()
                    ->sortable()
                    ->color(fn ($record) => $record->expires_at?->isPast() ? 'danger' : null)
                    ->description(fn ($record) => $record->expires_at?->isPast() ? 'منتهٍ' : null),

                Tables\Columns\TextColumn::make('created_at')
                    ->label('تاريخ الإنشاء')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->actions([
                Actions\Action::make('revoke')
                    ->label('إبطال')
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('إبطال رمز الوكيل')
                    ->modalDescription('سيتوقف الوكيل عن العمل فوراً. لا يمكن التراجع عن هذا الإجراء.')
                    ->action(function (PersonalAccessToken $record) {
                        $name = $record->name;
                        $record->delete();

                        Notification::make()
                            ->title("تم إبطال الرمز «{$name}»")
                            ->success()
                            ->send();
                    }),

                Actions\Action::make('revoke_all')
                    ->label('إبطال كل رموز المستخدم')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('إبطال كل رموز هذا المستخدم')
                    ->modalDescription('سيتم إبطال جميع رموز الوكيل الخاصة بهذا المستخدم. استخدمه عند الاشتباه في تسريب رمز.')
                    ->action(function (PersonalAccessToken $record) {
                        $count = $record->tokenable?->tokens()->delete() ?? 0;

                        Notification::make()
                            ->title("تم إبطال {$count} رمز")
                            ->success()
                            ->send();
                    }),
            ])
            ->bulkActions([
                Actions\BulkActionGroup::make([
                    Actions\DeleteBulkAction::make()->label('إبطال المحدد'),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListApiTokens::route('/'),
        ];
    }

    /**
     * The users an agent token may be issued to: anyone who actually holds at
     * least one capability.
     *
     * Evaluated in PHP rather than SQL because "holds a capability" is a
     * domain predicate — role-implied prefixes, the '*' wildcard and the JSON
     * array all feed it — and expressing that in SQL would mean dialect-specific
     * JSON functions for no benefit on an admin-sized population.
     *
     * @return Collection<int, User>
     */
    public static function eligibleOwners(): Collection
    {
        $capabilities = PermissionCatalogue::all();

        // No role filter here: the capability check below is the whole
        // predicate. A `role=user` account with explicit capabilities is
        // legitimately eligible, and a staff role with none is not.
        return User::query()
            ->get()
            ->filter(fn (User $user) => collect($capabilities)
                ->contains(fn (string $permission) => $user->hasPermission($permission)))
            ->sortBy('name')
            ->values();
    }

    public static function ttlOptions(): array
    {
        return collect(TokenIssuer::TTL_OPTIONS)
            ->map(fn (int $days) => $days === 1 ? 'يوم واحد' : $days.' يوم')
            ->all();
    }
}
