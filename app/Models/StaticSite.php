<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StaticSite extends Model
{
    use HasFactory;
    protected $fillable = ['name', 'slug', 'path', 'is_visible'];
    protected $casts = ['is_visible' => 'boolean'];
}
