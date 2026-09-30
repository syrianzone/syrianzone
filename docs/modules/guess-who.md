# Guess Who — Multiplayer Game

Route: `/guesswho`. Realtime "Guess Who?" style game where two players pick characters and ask yes/no questions. Moves travel over **Laravel Reverb** WebSockets; the WebRTC data channel is being retired (see below).

## Flow

1. **Lobby** — player creates a room (`POST /guesswho/rooms`) and shares the room code/URL.
2. **Join** — second player joins via `POST /guesswho/room/{roomCode}/join`.
3. **Selection** — both pick a secret character; the server stores each choice on the game row (`player_1_character_id` / `player_2_character_id`).
4. **Start** — when both secrets are in, the server sets `status = playing` and gives the first turn to player 1; each move is `POST /guesswho/room/{roomCode}/action`, rebroadcast on the room's presence channel. Broadcasting auth at `POST /guesswho/broadcasting/auth`.
5. **Finish** — winner recorded (`winner_session`), status `finished`.

## Data model

- `guess_who_categories` — name_ar/en, slug, is_active
- `guess_who_characters` — category_id, names ar/en, image_path, attributes JSON, is_active
- `guess_who_games` — room_code UUID unique, category_id, player_1/2_session, player_1/2_character_id (the secrets), player_1/2_eliminated (each player's private board), character_ids JSON, status lobby|selecting|playing|finished, turn_session, winner_session

## Implementation notes

- **Transport.** Actions go through `GuessWhoController@action`, which validates the room, the sender being a player, and the rules the server owns — whose turn it is, the secrets, the eliminations — then broadcasts a `GuessWhoStateEvent` (`broadcastAs: 'state'`) on the `guesswho.{roomCode}` presence channel. The client listens for `.state` and reads the turn/phase/winner and the opponent's remaining count from it; it no longer decides turns locally.
- **Resume.** `GET /guesswho/room/{roomCode}/state?sender_session=…` returns the requesting player's own view (status, turn, winner, their secret, their eliminations, the opponent's remaining count). The client fetches it once it has joined, so a refresh or a rejoin picks the game back up.
- **Eliminations** are stored per player (`player_1_eliminated` / `player_2_eliminated`) and only the remaining *count* is broadcast — the opponent never learns which characters were crossed off.
- **WebRTC retirement.** The game used to run on two transports: Reverb for WebRTC signaling and an `RTCPeerConnection` data channel for the moves. Both are gone — the client uses one channel and the server relays nothing and owns all the state. `SignalingController` and `GuessWhoSignalingEvent` are deleted; `POST /guesswho/room/{roomCode}/signal` is gone.
- Session identity via `Lib/guessWhoSession.ts` client helper.
- Character/category content managed in the **Inertia admin page** `Admin/GuessWho/Index` (RTL tabs + search + dialogs) via `GuessWhoAdminController`, under the `admin` middleware group: page at `GET /admin/guesswho` (linked from the dashboard as "من هو"), APIs under `/api/v1/admin/guesswho/*` (categories + characters CRUD). Attributes edit as `key: value` lines (Filament KeyValue equivalent). Uploads go to the `public` disk under `guesswho/characters` and render via `/storage/...`. The Filament `GuessWhoCategory/CharacterResource` pages were removed; `/superadmin` (Filament) now serves Users only.
- Categories toggle with `is_active`.
- Tests: `GuessWhoActionTest` covers the relay and the server-owned rules (turn, secrets, guess resolution).

## Tests / conventions

Follows repo conventions defined in [mishwar-places.md](mishwar-places.md) §2.
