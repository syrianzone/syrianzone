<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PhonebookEntry extends Model
{
    use HasFactory;

    protected $table = 'phonebook_entries';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'category_id',
        'name_ar',
        'name_en',
        'number',
        'is_whatsapp',
        'source_url',
        'order_column',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_whatsapp' => 'boolean',
            'order_column' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function category()
    {
        return $this->belongsTo(PhonebookCategory::class, 'category_id', 'id');
    }
}
