<?php

namespace App\Filament\Resources\ApiTokenResource\Pages;

use App\Filament\Resources\ApiTokenResource;
use App\Support\Agents\ApiTokenIssuer;
use App\Support\Agents\TokenIssuer;
use App\Support\Permissions\PermissionCatalogue;
use Filament\Actions\Action;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Section;
use Illuminate\Validation\ValidationException;

class ListApiTokens extends ListRecords
{
    protected static string $resource = ApiTokenResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('createToken')
                ->label('رمز جديد')
                ->icon('heroicon-o-plus')
                ->modalHeading('إنشاء رمز وكيل')
                ->modalDescription(
                    'يُمنح الرمز ما يملكه المستخدم بالفعل فقط، ولا يمكن تضييقه أو توسيعه لاحقاً. '
                    .'سيظهر النص الصريح مرة واحدة.'
                )
                ->modalWidth('4xl')
                ->modalSubmitActionLabel('إصدار الرمز')
                ->schema($this->tokenFormSchema())
                ->action(function (array $data) {
                    $this->issueToken($data);
                }),
        ];
    }

    /**
     * @return array<int, mixed>
     */
    protected function tokenFormSchema(): array
    {
        return [
            Section::make('بيانات الرمز')->schema([
                Forms\Components\Select::make('tokenable_id')
                    ->label('المستخدم')
                    ->options(fn () => ApiTokenResource::eligibleOwners()
                        ->pluck('name', 'id')
                        ->all())
                    ->searchable()
                    ->required(),

                Forms\Components\TextInput::make('name')
                    ->label('اسم الرمز')
                    ->required()
                    ->maxLength(255)
                    ->helperText('مثال: claude-code أو github-actions. يظهر في سجل التدقيق وبه تميّز بين الرموز.'),

                Forms\Components\Select::make('ttl')
                    ->label('مدة الصلاحية')
                    ->options(ApiTokenResource::ttlOptions())
                    ->default(TokenIssuer::DEFAULT_TTL)
                    ->selectablePlaceholder(false)
                    ->required()
                    ->helperText('اختر أقل مدة تكفي. لا يمكن تغيير الصلاحية بعد الإصدار.'),
            ]),

            Section::make('الصلاحيات')
                ->description('تُمنح فقط ما يملكه المستخدم بالفعل. لا يوجد خيار "الكل" — عمداً.')
                ->schema(
                    collect(PermissionCatalogue::groupMeta())
                        ->map(fn (array $meta, string $group) => Section::make($meta['label'])
                            ->schema([
                                Forms\Components\CheckboxList::make("perm_{$group}")
                                    ->hiddenLabel()
                                    ->options(PermissionCatalogue::groups()[$group])
                                    ->columns(2)
                                    ->bulkToggleable(),
                            ])
                            ->collapsible())
                        ->all()
                ),
        ];
    }

    protected function issueToken(array $data): void
    {
        try {
            $issued = app(ApiTokenIssuer::class)->issueFromFormData($data);
        } catch (ValidationException $e) {
            Notification::make()
                ->title('تعذّر إصدار الرمز')
                ->body(collect($e->errors())->flatten()->implode(' '))
                ->danger()
                ->send();

            return;
        }

        $dropped = $issued['dropped'];

        Notification::make()
            ->title('تم إصدار الرمز — انسخه الآن')
            ->body(
                $issued['token']->plainTextToken
                ."\n\n"
                .'لن يظهر هذا النص مرة أخرى؛ يُحفظ في قاعدة البيانات تجزئة فقط. '
                .'اضبطه في وكيلك كـ Authorization: Bearer.'
                .($dropped === [] ? '' : "\n\nتم تجاهل: ".implode('، ', $dropped).' (لا يملكها المستخدم).')
            )
            ->success()
            ->persistent()
            ->send();
    }
}
