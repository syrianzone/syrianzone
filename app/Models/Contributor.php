<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contributor extends Model
{
    use HasFactory;
    protected $fillable = ['name', 'avatar_url', 'profile_url', 'total_contributions'];

    public function contributions() { return $this->hasMany(Contribution::class); }
}
