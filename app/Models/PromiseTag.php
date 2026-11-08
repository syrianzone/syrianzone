<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pivot row: a free-form tag on a promise. */
class PromiseTag extends Model
{
    protected $table = 'promise_tags';

    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = null;

    protected $fillable = ['promise_id', 'tag'];
}
