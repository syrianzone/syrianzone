<?php

namespace App\Support;

/**
 * The reviewer's reason for turning a submission down.
 *
 * A rejected place, transit draft, promise suggestion and proposed person all
 * carry the same `reason` field, it is shown to the submitter, and the length
 * cap and its Arabic refusal are the same on every surface. Places, Transit and
 * Promises each carried their own copy of the number — one of them with an
 * English message — so lowering the cap could reach only some of the five
 * entry points (dashboard plus agent tool).
 */
final class RejectionReason
{
    public const MAX_LENGTH = 1000;

    /**
     * @return array<int, string>
     */
    public static function rules(): array
    {
        return ['nullable', 'string', 'max:'.self::MAX_LENGTH];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return ['reason.max' => self::message()];
    }

    public static function message(): string
    {
        return sprintf('سبب الرفض يجب ألا يتجاوز %d حرفاً', self::MAX_LENGTH);
    }
}
