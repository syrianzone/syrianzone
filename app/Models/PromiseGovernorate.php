<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pivot row: a promise scoped to one governorate (see App\Support\Governorates). */
class PromiseGovernorate extends Model
{
    protected $table = 'promise_governorate';

    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = null;

    protected $fillable = ['promise_id', 'governorate'];
}
