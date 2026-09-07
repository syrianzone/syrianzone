<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HouseMember2026 extends Model
{
    protected $table = 'house_members_2026';

    protected $fillable = [
        'name_ar', 'governorate_ar', 'district', 'town', 'gender',
        'birth_year', 'age', 'selection_method', 'category',
        'status', 'member_number', 'management_position',
    ];
}
