<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlaceReport extends Model
{
    public const REASONS = ['spam', 'wrong_info', 'inappropriate', 'duplicate', 'other'];

    public const STATUSES = ['open', 'resolved', 'dismissed'];

    protected $fillable = ['place_id', 'user_id', 'reason', 'details', 'status'];

    public function place()
    {
        return $this->belongsTo(Place::class);
    }

    // withTrashed: a reporter may soft-delete their account, the report stays reviewable
    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
