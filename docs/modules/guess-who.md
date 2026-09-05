# Guess Who — Multiplayer WebRTC Game

Route: `/guesswho`. Realtime "Guess Who?" style game where two players pick characters and ask yes/no questions over a peer-to-peer WebRTC connection.

## Flow

1. **Lobby** — player creates a room (`POST /guesswho/rooms`) and shares the room code/URL.
2. **Join** — second player joins via `POST /guesswho/room/{roomCode}/join`.
3. **Selection** — both pick a secret character from the active category (stored as `character_ids` JSON on the game row).
4. **Play** — players exchange signals/signaling messages via `POST /guesswho/room/{roomCode}/signal`; broadcasting auth at `POST /guesswho/broadcasting/auth`.
5. **Finish** — winner recorded (`winner_session`), status `finished`.

## Data model

- `guess_who_categories` — name_ar/en, slug, is_active
- `guess_who_characters` — category_id, names ar/en, image_path, attributes JSON, is_active
- `guess_who_games` — room_code UUID unique, category_id, player_1/2_session, character_ids JSON, status lobby|selecting|playing|finished, winner_session

## Implementation notes

- Signaling runs through **Laravel Reverb** broadcast events (`app/Events`) + private channels registered in `routes/channels.php`; WebRTC handles the actual media/data exchange peer-to-peer.
- Session identity via `Lib/guessWhoSession.ts` client helper.
- Character/category content managed in the **Inertia admin page** `Admin/GuessWho/Index` (RTL tabs + search + dialogs) via `GuessWhoAdminController`, under the `admin` middleware group: page at `GET /admin/guesswho` (linked from the dashboard as "من هو"), APIs under `/api/v1/admin/guesswho/*` (categories + characters CRUD). Attributes edit as `key: value` lines (Filament KeyValue equivalent). Uploads go to the `public` disk under `guesswho/characters` and render via `/storage/...`. The Filament `GuessWhoCategory/CharacterResource` pages were removed; `/superadmin` (Filament) now serves Users only.
- Categories toggle with `is_active`.

## Tests / conventions

Follows repo conventions defined in [mishwar-places.md](mishwar-places.md) §2.
