<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\City;
use App\Models\User;
use App\Support\Permissions\PermissionCatalogue;
use BackedEnum;
use Filament\Actions;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\HtmlString;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'المستخدمون';

    protected static ?string $modelLabel = 'مستخدم';

    protected static ?string $pluralModelLabel = 'المستخدمون';

    /**
     * Assignable roles and their Arabic labels.
     *
     * Kept as a method rather than an inline array so a test can assert it
     * covers every role User knows about. A role that exists in
     * User::ROLE_MODULE_PREFIXES but is missing here can never be assigned to
     * anyone, which is exactly how phonebook_admin became unassignable.
     *
     * @return array<string, string>
     */
    public static function roleOptions(): array
    {
        return [
            'superadmin' => 'مدير عام (وصول كامل غير مقيد)',
            'admin' => 'مشرف (أساسي) — كل الصلاحيات',
            'transit_admin' => 'مشرف نقل',
            'syofficial_admin' => 'مشرف الحسابات الرسمية',
            'govapps_admin' => 'مشرف التطبيقات الحكومية',
            'phonebook_admin' => 'مشرف دليل الهاتف',
            'places_admin' => 'مشرف مشوار',
            'users_admin' => 'مشرف المستخدمين',
            'user' => 'مستخدم عادي',
        ];
    }

    /**
     * Permission capabilities grouped by module. Keys are the capability ids
     * stored in users.permissions; labels are shown inside each project group
     * (the module name is the group heading, so it is not repeated here).
     *
     * The list itself lives in PermissionCatalogue, which the agent token
     * issuer and the MCP authorizer also read. Keeping it here as a thin
     * delegate preserves the existing call sites.
     *
     * @return array<string, array<string, string>>
     */
    public static function permissionGroups(): array
    {
        return PermissionCatalogue::groups();
    }

    /**
     * Display metadata per module group: heading label and the project icon
     * (see resources/views/components/project-icon.blade.php, ported from the
     * homepage ProjectIcons.tsx).
     *
     * @return array<string, array{label: string, icon: string}>
     */
    public static function permissionGroupMeta(): array
    {
        return PermissionCatalogue::groupMeta();
    }

    /**
     * Split stored permissions + scopes into the per-group form state used by
     * the grouped checkboxes. Unknown capability ids are preserved by
     * mergePermissionFormData(), not here.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function splitPermissionFormData(array $data): array
    {
        $permissions = is_array($data['permissions'] ?? null) ? $data['permissions'] : [];

        foreach (static::permissionGroups() as $group => $options) {
            $data["perm_{$group}"] = array_values(array_intersect(array_keys($options), $permissions));
        }

        $scopes = is_array($data['permission_scopes'] ?? null) ? $data['permission_scopes'] : [];
        $data['transit_scope'] = is_array($scopes['transit'] ?? null) ? array_values($scopes['transit']) : [];

        return $data;
    }

    /**
     * Merge the grouped form state back into users.permissions +
     * users.permission_scopes. Capability ids that are not part of any known
     * group (e.g. the '*' wildcard or future modules) are preserved.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, array<int, string>>  $existingScopes
     * @return array<string, mixed>
     */
    public static function mergePermissionFormData(array $data, array $existingScopes = []): array
    {
        $known = [];
        foreach (static::permissionGroups() as $options) {
            $known = array_merge($known, array_keys($options));
        }

        $selected = [];
        foreach (static::permissionGroups() as $group => $options) {
            $groupState = $data["perm_{$group}"] ?? [];
            unset($data["perm_{$group}"]);

            if (! is_array($groupState)) {
                continue;
            }

            foreach (array_keys($options) as $key) {
                if (in_array($key, $groupState, true)) {
                    $selected[] = $key;
                }
            }
        }

        $existing = is_array($data['permissions'] ?? null) ? $data['permissions'] : [];
        $unknown = array_values(array_diff($existing, $known));

        $data['permissions'] = array_values(array_unique(array_merge($selected, $unknown)));

        $transitScope = $data['transit_scope'] ?? [];
        unset($data['transit_scope']);

        if (is_array($transitScope) && $transitScope !== []) {
            $existingScopes['transit'] = array_values(array_filter(
                $transitScope,
                fn ($city) => is_string($city) && $city !== '',
            ));
        } else {
            unset($existingScopes['transit']);
        }

        $data['permission_scopes'] = $existingScopes === [] ? null : $existingScopes;

        return $data;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Section::make([
                    Forms\Components\TextInput::make('name')
                        ->label('الاسم')
                        ->required()
                        ->maxLength(255),
                    Forms\Components\TextInput::make('email')
                        ->label('البريد الإلكتروني')
                        ->email()
                        ->required()
                        ->unique(ignoreRecord: true)
                        ->maxLength(255),
                    Forms\Components\Select::make('role')
                        ->label('الدور')
                        ->options(static::roleOptions())
                        ->default('user')
                        ->required()
                        ->live(),
                    Forms\Components\Toggle::make('is_banned')
                        ->label('محظور')
                        ->default(false),
                    Forms\Components\TextInput::make('password')
                        ->label('كلمة المرور')
                        ->password()
                        ->maxLength(255)
                        ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                        ->dehydrated(fn ($state) => filled($state))
                        ->required(fn (string $context): bool => $context === 'create'),
                ]),
                Section::make('الصلاحيات التفصيلية')
                    ->description('منح صلاحيات مخصصة لكل وحدة للمستخدمين من غير المدير العام')
                    ->schema(
                        collect(static::permissionGroupMeta())
                            ->map(function (array $meta, string $group): Section {
                                $children = [
                                    Forms\Components\CheckboxList::make("perm_{$group}")
                                        ->hiddenLabel()
                                        ->options(static::permissionGroups()[$group])
                                        ->columns(2)
                                        // Only the transit group drives the reactive
                                        // governorate-scope selector below.
                                        ->live($group === 'transit'),
                                ];

                                if ($group === 'transit') {
                                    $children[] = Forms\Components\Select::make('transit_scope')
                                        ->label('نطاق المحافظات')
                                        ->helperText('اتركه فارغاً للسماح بجميع المحافظات، وينطبق ذلك على دور مشرف النقل كذلك.')
                                        ->multiple()
                                        ->searchable()
                                        ->options(fn () => City::query()->orderBy('name_ar')->pluck('name_ar', 'id')->all())
                                        ->visible(fn (Get $get) => filled($get('perm_transit')) || $get('role') === 'transit_admin');
                                }

                                return Section::make($meta['label'])
                                    ->icon(new HtmlString(Blade::render('<x-project-icon name="'.$meta['icon'].'" />')))
                                    ->schema($children)
                                    ->collapsible();
                            })
                            ->all()
                    ),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->label('الاسم')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('email')
                    ->label('البريد الإلكتروني')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('role')
                    ->label('الدور')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'superadmin' => 'danger',
                        'admin' => 'warning',
                        'transit_admin' => 'success',
                        'syofficial_admin' => 'success',
                        'govapps_admin' => 'success',
                        'phonebook_admin' => 'success',
                        'places_admin' => 'success',
                        'users_admin' => 'success',
                        'user' => 'info',
                        default => 'gray',
                    })
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_banned')
                    ->boolean()
                    ->label('محظور')
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->label('تاريخ الإنشاء')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('deleted_at')
                    ->label('تاريخ الحذف')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\TrashedFilter::make(),
            ])
            ->actions([
                Actions\EditAction::make(),
                Actions\DeleteAction::make(),
                Actions\RestoreAction::make(),
                Actions\ForceDeleteAction::make(),
            ])
            ->bulkActions([
                Actions\BulkActionGroup::make([
                    Actions\DeleteBulkAction::make(),
                    Actions\ForceDeleteBulkAction::make(),
                    Actions\RestoreBulkAction::make(),
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
