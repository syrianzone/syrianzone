<?php

namespace App\Services\Directories;

use App\Models\DirectorySuggestion;
use App\Models\GovApp;
use App\Models\GovtOfficial;
use App\Models\OfficialEntity;
use App\Models\PhonebookEntry;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Shared public submission and editorial review workflow for directory
 * suggestions (`add` and `edit`) across `govtcvs`, `syofficial`, `govapps`,
 * and `phonebook`.
 */
final class DirectorySuggestionService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function submit(User $user, string $module, array $data): DirectorySuggestion
    {
        if (! in_array($module, DirectorySuggestion::MODULES, true)) {
            throw new NotFoundHttpException('القسم المطلوب غير موجود.');
        }

        if ($user->is_banned) {
            throw new HttpException(403, 'حسابك محظور من إرسال الاقتراحات.');
        }

        $kind = (string) ($data['kind'] ?? 'add');
        $rawTargetId = isset($data['target_id']) ? trim((string) $data['target_id']) : '';
        $targetId = $rawTargetId !== '' ? $rawTargetId : null;
        $targetLabel = null;

        if ($kind === 'edit' && $targetId !== null) {
            $resolved = $this->resolveTarget($module, $targetId);
            if ($resolved === null) {
                throw ValidationException::withMessages([
                    'target_id' => ['العنصر المحدد غير موجود في هذا القسم.'],
                ]);
            }
            $targetId = $resolved['id'];
            $targetLabel = $resolved['label'];
        } else {
            $targetId = null;
        }

        $payload = $this->sanitizePayload($module, is_array($data['payload'] ?? null) ? $data['payload'] : []);
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' && $targetLabel !== null) {
            $title = $targetLabel;
        }

        return DirectorySuggestion::create([
            'module' => $module,
            'kind' => $kind,
            'target_id' => $targetId,
            'target_label' => $targetLabel,
            'title' => $title,
            'payload' => $payload !== [] ? $payload : null,
            'details' => trim((string) $data['details']),
            'source_url' => isset($data['source_url']) && trim((string) $data['source_url']) !== ''
                ? trim((string) $data['source_url'])
                : null,
            'user_id' => $user->id,
            'status' => 'pending',
        ]);
    }

    /**
     * @return array{suggestions: array<int, array<string, mixed>>, counts: array{pending: int, accepted: int, dismissed: int, total: int}}
     */
    public function listForAdmin(string $module, string $status = 'pending'): array
    {
        $countsRaw = DirectorySuggestion::forModule($module)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $counts = [
            'pending' => (int) ($countsRaw['pending'] ?? 0),
            'accepted' => (int) ($countsRaw['accepted'] ?? 0),
            'dismissed' => (int) ($countsRaw['dismissed'] ?? 0),
            'total' => (int) $countsRaw->sum(),
        ];

        $query = DirectorySuggestion::forModule($module)
            ->with(['user:id,name,email', 'reviewer:id,name'])
            ->when(
                in_array($status, DirectorySuggestion::STATUSES, true),
                fn ($q) => $q->where('status', $status),
            )
            ->orderByRaw("case when status = 'pending' then 0 else 1 end")
            ->orderByDesc('created_at')
            ->limit(200);

        return [
            'suggestions' => $query->get()->map(fn (DirectorySuggestion $s) => $this->present($s))->values()->all(),
            'counts' => $counts,
        ];
    }

    public function pendingCount(string $module): int
    {
        return DirectorySuggestion::forModule($module)->pending()->count();
    }

    public function review(User $reviewer, string $module, int $id, string $decision, ?string $note = null): DirectorySuggestion
    {
        if (! in_array($decision, ['accepted', 'dismissed'], true)) {
            throw new ConflictHttpException('حالة المراجعة غير صالحة.');
        }

        return DB::transaction(function () use ($reviewer, $module, $id, $decision, $note): DirectorySuggestion {
            $suggestion = DirectorySuggestion::forModule($module)
                ->whereKey($id)
                ->lockForUpdate()
                ->first();

            if (! $suggestion) {
                throw new NotFoundHttpException('الاقتراح المطلوب غير موجود.');
            }

            if ($suggestion->status !== 'pending') {
                throw new ConflictHttpException('تمت مراجعة هذا الاقتراح مسبقاً.');
            }

            $cleanNote = $note !== null && trim($note) !== '' ? trim($note) : null;

            $suggestion->update([
                'status' => $decision,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'resolution_note' => $cleanNote,
            ]);

            return $suggestion->fresh(['user:id,name,email', 'reviewer:id,name']);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function present(DirectorySuggestion $suggestion): array
    {
        return [
            'id' => $suggestion->id,
            'module' => $suggestion->module,
            'kind' => $suggestion->kind,
            'target_id' => $suggestion->target_id,
            'target_label' => $suggestion->target_label,
            'target_edit_url' => $this->targetEditUrl($suggestion->module, $suggestion->target_id),
            'title' => $suggestion->title,
            'payload' => $suggestion->payload ?? [],
            'details' => $suggestion->details,
            'source_url' => $suggestion->source_url,
            'status' => $suggestion->status,
            'submitter_name' => $suggestion->user?->name ?? 'مستخدم محذوف',
            'reviewer_name' => $suggestion->reviewer?->name,
            'reviewed_at' => $suggestion->reviewed_at?->toIso8601String(),
            'resolution_note' => $suggestion->resolution_note,
            'created_at' => $suggestion->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array{id: string, label: string}|null
     */
    private function resolveTarget(string $module, string $targetId): ?array
    {
        return match ($module) {
            'govtcvs' => $this->resolveGovtOfficial($targetId),
            'syofficial' => $this->resolveSyOfficial($targetId),
            'govapps' => $this->resolveGovApp($targetId),
            'phonebook' => $this->resolvePhonebook($targetId),
            default => null,
        };
    }

    /**
     * @return array{id: string, label: string}|null
     */
    private function resolveGovtOfficial(string $targetId): ?array
    {
        $official = GovtOfficial::published()
            ->where(function ($q) use ($targetId) {
                $q->where('id', $targetId)->orWhere('slug', $targetId);
            })
            ->first(['id', 'display_name_ar', 'full_name_ar']);

        if (! $official) {
            return null;
        }

        return [
            'id' => (string) $official->id,
            'label' => $official->display_name_ar ?: $official->full_name_ar,
        ];
    }

    /**
     * @return array{id: string, label: string}|null
     */
    private function resolveSyOfficial(string $targetId): ?array
    {
        $entity = OfficialEntity::query()
            ->where('id', $targetId)
            ->where('is_active', true)
            ->first(['id', 'name_ar', 'name']);

        if (! $entity) {
            return null;
        }

        return [
            'id' => (string) $entity->id,
            'label' => $entity->name_ar ?: $entity->name,
        ];
    }

    /**
     * @return array{id: string, label: string}|null
     */
    private function resolveGovApp(string $targetId): ?array
    {
        $app = GovApp::query()
            ->where('id', $targetId)
            ->where('is_active', true)
            ->first(['id', 'name_ar', 'name']);

        if (! $app) {
            return null;
        }

        return [
            'id' => (string) $app->id,
            'label' => $app->name_ar ?: $app->name,
        ];
    }

    /**
     * @return array{id: string, label: string}|null
     */
    private function resolvePhonebook(string $targetId): ?array
    {
        $entry = PhonebookEntry::query()
            ->where('id', $targetId)
            ->where('is_active', true)
            ->first(['id', 'name_ar', 'name_en']);

        if (! $entry) {
            return null;
        }

        return [
            'id' => (string) $entry->id,
            'label' => $entry->name_ar ?: ($entry->name_en ?: $entry->id),
        ];
    }

    private function targetEditUrl(string $module, ?string $targetId): ?string
    {
        if (! $targetId) {
            return null;
        }

        return match ($module) {
            'govtcvs' => "/admin/govtcvs/officials/{$targetId}",
            'syofficial' => '/admin/syofficial?edit='.rawurlencode($targetId),
            'govapps' => '/admin/govapps?edit='.rawurlencode($targetId),
            'phonebook' => '/admin/phonebook?edit='.rawurlencode($targetId),
            default => null,
        };
    }

    /**
     * Keep only known, non-empty module-specific payload keys.
     *
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function sanitizePayload(string $module, array $raw): array
    {
        $allowedKeys = match ($module) {
            'govtcvs' => ['role_title_ar', 'institution_name_ar', 'decree_ref'],
            'syofficial' => ['category_id', 'name_en', 'account_url'],
            'govapps' => ['official_url', 'android_url', 'apple_url'],
            'phonebook' => ['category_id', 'number', 'is_whatsapp'],
            default => [],
        };

        $clean = [];
        foreach ($allowedKeys as $key) {
            if (! array_key_exists($key, $raw)) {
                continue;
            }
            $value = $raw[$key];
            if ($key === 'is_whatsapp') {
                if (is_bool($value)) {
                    $clean[$key] = $value;
                }

                continue;
            }
            if (is_string($value)) {
                $trimmed = trim($value);
                if ($trimmed !== '') {
                    $clean[$key] = $trimmed;
                }
            }
        }

        return $clean;
    }
}
