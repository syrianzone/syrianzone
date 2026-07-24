<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PhonebookCategory extends Model
{
    use HasFactory;

    protected $table = 'phonebook_categories';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'label_ar',
        'label_en',
        'icon',
        'order_column',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'order_column' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function entries()
    {
        return $this->hasMany(PhonebookEntry::class, 'category_id', 'id');
    }
}
