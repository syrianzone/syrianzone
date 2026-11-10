<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromiseCoSpeaker extends Model
{
    protected $table = 'promise_co_speakers';

    public $timestamps = false;

    protected $fillable = [
        'promise_id',
        'speaker_id',
        'speaker_title',
        'sort',
    ];

    protected $casts = [
        'sort' => 'integer',
    ];

    public function promise(): BelongsTo
    {
        return $this->belongsTo(Promise::class, 'promise_id');
    }

    public function speaker(): BelongsTo
    {
        return $this->belongsTo(PromiseSpeaker::class, 'speaker_id');
    }
}
