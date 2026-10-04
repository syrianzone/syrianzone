<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompassResult extends Model
{
    protected $fillable = [
        'user_id',
        'version',
        'share_id',
        'answers',
        'scores',
        'align',
        'top_figure',
        'top_score',
        'spectrum',
        'consistency',
        'answered',
        'stats_consent',
    ];

    protected $casts = [
        'answers' => 'array',
        'scores' => 'array',
        'align' => 'array',
        'top_score' => 'float',
        'consistency' => 'float',
        'answered' => 'integer',
        'stats_consent' => 'boolean',
    ];

    protected $hidden = ['user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Public payload for the client. */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'scores' => $this->scores,
            'align' => $this->align,
            'answers' => $this->answers,
            'topFigure' => $this->top_figure,
            'topScore' => $this->top_score,
            'spectrum' => $this->spectrum,
            'consistency' => $this->consistency,
            'answered' => $this->answered,
            'createdAt' => $this->created_at?->toIso8601String(),
            'statsConsent' => (bool) $this->stats_consent,
        ];
    }
}
