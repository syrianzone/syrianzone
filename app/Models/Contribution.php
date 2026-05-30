<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contribution extends Model
{
    protected $fillable = ['contributor_id', 'type', 'description', 'repository', 'url', 'date'];

    public function contributor() { return $this->belongsTo(Contributor::class); }
}
