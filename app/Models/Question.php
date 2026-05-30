<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $fillable = ['poll_id', 'text', 'image_url'];

    public function poll() { return $this->belongsTo(Poll::class); }
}
