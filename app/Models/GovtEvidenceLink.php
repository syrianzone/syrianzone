<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sourced evidence (official CV card, appointment/dismissal decree, handover,
 * operational mention, video interview, or external source) backing a GovtOfficial
 * or a specific GovtTenure.
 */
class GovtEvidenceLink extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'govt_evidence_links';

    protected $fillable = [
        'official_id',
        'tenure_id',
        'evidence_type',
        'paperless_record_id',
        'paperless_channel_id',
        'paperless_message_id',
        'chunk_type',
        'source_title_ar',
        'source_channel_ar',
        'source_url',
        'published_date',
        'excerpt_ar',
    ];

    protected $casts = [
        'paperless_record_id' => 'integer',
        'paperless_message_id' => 'integer',
        'published_date' => 'date:Y-m-d',
    ];

    public function official(): BelongsTo
    {
        return $this->belongsTo(GovtOfficial::class, 'official_id');
    }

    public function tenure(): BelongsTo
    {
        return $this->belongsTo(GovtTenure::class, 'tenure_id');
    }
}
