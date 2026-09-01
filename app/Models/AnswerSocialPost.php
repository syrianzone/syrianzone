<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AnswerSocialPost extends Model
{
    use HasUuids;

    protected $fillable = [
        'answer_id',
        'question_id',
        'title',
        'url',
        'caption',
        'status',
        'x_post_id',
        'last_error',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'posted_at' => 'datetime',
        ];
    }
}
