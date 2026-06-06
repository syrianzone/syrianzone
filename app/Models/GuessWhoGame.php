<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GuessWhoGame extends Model
{
    use HasFactory;

    protected $table = 'guess_who_games';

    protected $fillable = [
        'room_code',
        'category_id',
        'character_ids',
        'player_1_session',
        'player_2_session',
        'player_1_character_id',
        'player_2_character_id',
        'status',
        'winner_session',
    ];

    protected $casts = [
        'character_ids' => 'array',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(GuessWhoCategory::class, 'category_id');
    }

    public function player1Character(): BelongsTo
    {
        return $this->belongsTo(GuessWhoCharacter::class, 'player_1_character_id');
    }

    public function player2Character(): BelongsTo
    {
        return $this->belongsTo(GuessWhoCharacter::class, 'player_2_character_id');
    }
}
