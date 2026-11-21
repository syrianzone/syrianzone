<?php

namespace App\Models;

use App\Models\Concerns\FoldsSearchColumns;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class GovApp extends Model
{
    use FoldsSearchColumns, HasFactory, SoftDeletes;

    protected $table = 'gov_apps';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'name_ar',
        'description',
        'description_ar',
        'official_entity_id',
        'overview_ar',
        'features',
        'requirements',
        'faqs',
        'verified_at',
        'icon',
        'images',
        'links',
        'order_column',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'images' => 'array',
            'links' => 'array',
            'features' => 'array',
            'requirements' => 'array',
            'faqs' => 'array',
            'verified_at' => 'date',
            'is_active' => 'boolean',
            'order_column' => 'integer',
        ];
    }

    public function officialEntity()
    {
        return $this->belongsTo(OfficialEntity::class, 'official_entity_id');
    }

    /**
     * Whether this app has enough structured guide content to stand alone as an
     * indexed SEO page rather than a thin directory card.
     */
    public function hasRichGuide(): bool
    {
        return filled($this->overview_ar)
            && is_array($this->features)
            && count($this->features) >= 3;
    }
}
