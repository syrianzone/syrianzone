# Games (الألعاب)

The `/games` module is a hub-and-spoke arcade: `/games` lists every game as a
card, and each game lives at its own real URL under `/games/<slug>`. Pages are
fully client-side — no controller, no props, no database, no API.

Unlike `/muslim`, the sub-pages here are **real server routes**, not a
`?tab=` query parameter. A game URL is shareable, survives a reload, and
renders on the server like any other Inertia page.

---

## 1. Routes

| Method | Path | Inertia component | Notes |
|---|---|---|---|
| GET | `/games` | `Games/Index` | Hub; renders the card grid from `GAMES` |
| GET | `/games/2048` | `Games/2048/Index` | Playable |
| GET | `/games/solitare` | `Games/Solitare/Index` | Playable (Klondike) |
| GET | `/games/tarneeb` | `Games/Tarneeb/Index` | Playable (Tarneeb vs three AI) |
| GET | `/games/trix` | `Games/Trix/Index` | Playable (Trix vs three AI; single or coop) |

All three are public closures in `routes/web.php` with no middleware, no
throttle and no auth gate — they are static shells, exactly like `/muslim`.

## 2. Layout

```
resources/js/Pages/Games/
├── Index.tsx                    # hub: icon + title + card grid
├── 2048/Index.tsx               # page shell (Head, MainLayout, GameShell)
├── Solitare/Index.tsx           # page shell
├── Tarneeb/Index.tsx            # page shell
├── _components/
│   ├── GameShell.tsx            # shared sub-page chrome: back link + title
│   ├── PlayingCard.tsx          # shared card face/back, no game rules
│   ├── Game2048.tsx             # the board: state, input, rendering
│   ├── Solitaire.tsx            # clock, selection, undo, drag plumbing
│   └── Tarneeb.tsx              # the table: seats, trick, bidding, hand
└── _lib/
    ├── games.ts                 # GAMES registry — the single source of truth
    ├── cards.ts                 # shared deck, labels and pip geometry
    ├── cardGames/
    │   ├── trick.ts             # shared trick-taking primitives
    │   ├── bidding.ts           # shared ascending auction
    │   ├── match.ts             # shared rounds / target scoring
    │   ├── hand.ts              # shared hand-evaluation primitives
    │   ├── avoidance.ts         # shared no-trump trick-avoidance round
    │   └── shedding.ts          # shared domino layout (trix / fan tan)
    ├── engine2048.ts            # pure 2048 rules (no React)
    ├── solitaire.ts             # pure Klondike rules (no React)
    ├── tarneeb.ts               # tarneeb round engine + scoring (no React)
    ├── tarneebAi.ts             # tarneeb bidding and play heuristics (no React)
    ├── trix.ts                  # trix contracts, kingdom and scoring (no React)
    ├── trixAi.ts                # trix contract choice and play (no React)
    └── scores.ts                # localStorage records
```

`GameShell` is what keeps sub-games consistent: it renders the back link to
`/games`, the title block and the icon, so a new game only has to supply its
own board.

`PlayingCard` and `_lib/cards.ts` are the shared **card kit**: the card value,
the 52-card deck, the rank/suit labels and the pip geometry are game-agnostic,
and the component draws any card face or back from them. They are styled
entirely by the generic `.sz-card*` classes in `app.css`; a board supplies the
sizing context (`--sz-card-w`, `--sz-card-h-ratio`, `--sz-card-radius`) and
lays out its own piles. Solitaire is the first consumer; the trick-taking games
(tarneeb, trix) will reuse it rather than restate a card.

`_lib/cardGames/` is the shared **engine kit** for trick-taking games: the
follow-suit and trick-winner rules (`trick.ts`), the ascending auction
(`bidding.ts`) and the round/target scaffolding with per-team or per-seat
scoring (`match.ts`). A specific game is a thin module on top — the deck and the
trick rules are the same whether it is tarneeb or trix; only the number of
tricks, the trump convention and the round's point value differ.

`_lib/tarneeb.ts` is the first such module: four seats in two partnerships
(`teamOf`), a 13-card deal, the 7–13 auction driving `bidding.ts`, the declarer
choosing trump, and trick-by-trick play driving `trick.ts`. A round is a plain
value and every transition returns a new one (`bid`, `pass`, `chooseTrump`,
`playCard`), so the table treats it like solitaire's `Deal`. Scoring is a single
exported rule, `tarneebScore(bid, declarerTeam, tricks, options)` — the contract
team scores the tricks it took when it reaches the bid, and the defenders score
the bid when it does not.

**Conventions.** Tarneeb varies from table to table, so everything variable is
an option in `DEFAULT_TARNEEB`: `target` (41), the bid range (7–13), and the
kaboot numbers below. The scoring rule itself is a standalone function, so a
table that scores differently can swap it.

**Kaboot** is the whole hand. Bidding it (the maximum bid) and making it scores
`kabootMade` (26); failing it costs the declarer's team `kabootLoss` (16) while
the defenders score `kabootDefence` (2) times their own tricks. A team that
sweeps all thirteen on a lower bid is paid its tricks plus a `sweepBonus` (3).
A kaboot loss is the one case where the declarer's entry is negative, which the
match model carries directly. The doubles some tables allow are still not
modelled.

`_lib/tarneebAi.ts` is the opponent, built on the shared hand reads in
`cardGames/hand.ts` (`power`, `groupBySuit`, `topSequence`). It is a small,
readable table policy — `estimateTricks` / `bestTrump` for the auction,
`chooseBid` and `chooseTrump`, and `choosePlay`, which wins a trick with the
cheapest card that beats the table, dumps low while partner is safe, and cashes
an ace in a side suit when leading. It is pure, so the same functions drive one
opponent or all four seats; `tarneebAi.test.ts` plays 200 AI-vs-AI rounds and
asserts every one ends in thirteen tricks with a legal score.

`_components/Tarneeb.tsx` is the table. Seat 0 is the player and the other three
are driven by `tarneebAi` through a timed effect, so a turn is followable. It
shows the four seats (opponents as a counted back), the trick in a plus with the
trump in the middle, and the player's hand fanned below, where only the legal
cards are tappable. The whole round is one `TarneebRound` value; the component
only turns taps into `bid` / `pass` / `chooseTrump` / `playCard` and lets
`cardGames/match.ts` carry the score between rounds.

## Trix (تركس)

The second game on the kit, and the first with more than one rule set in it. Four
players, no trump, and a session of **twenty deals** — four **ممالك** (kingdoms)
of five **طلبات** (contracts). Each kingdom is owned by one player, who sees the
deal and names each contract, leading it. Highest total wins.

  queens       البنات      avoid taking queens            −25 each
  diamonds     الديناري    every diamond taken            −10 each
  tricks       اللطوش      every trick (لطش) taken         −15 each
  kingOfHearts شيخ الكبة   whoever takes the king of hearts −75
  trix         التركس      shed onto a layout from the Jacks +200/+150/+100/+50

Two ways to play, which is the **coop / single** split: **يهودية** every player
alone, or **فريقين** opposite seats are partners and their scores combine.

- The four avoidance contracts reduce to `cardGames/avoidance.ts` (a no-trump
  trick round that records what each seat collects); the positive التركس contract
  is `cardGames/shedding.ts` (a layout that grows out from a pivot — the Jacks).
- `_lib/trix.ts` is the Trix-specific part: the contracts and their scoring, and
  the kingdom/session structure (`createGame` → `beginDeal` → `chooseContract` →
  `finishDeal`). A deal is dealt *first* and the king names the contract from it,
  as at a real table.
- `_lib/trixAi.ts` is the opponent: it names a contract (picking التركس first,
  which is unavoidable — it is the only positive contract), and plays each
  avoidance contract by ducking and shedding the penalty card, sparing a winning
  partner in coop; the التركس contract is shed by building the longest suit.
- `_components/Trix.tsx` is the table; it shares the four-seat table boundary
  with tarneeb (`.sz-tbl*`, formerly `.sz-tar*`), and shows the trick plus or the
  shedding layout in the middle.

`scores.ts` tallies both tarneeb and trix (`GAMES_MATCH_KEYS`). The conventions
in `_lib/trix.ts` use the common numbers; doubling (التدبيل), early deal ends,
and redeal conditions are not modelled.

## The table (tarneeb and trix)

Both card tables share one invisible boundary, `.sz-tbl` in `app.css`, so a deal
*is* the page rather than something scrolled to. The games page passes
`fit` to `GameShell`, which turns the shell into a fixed-height flex column
(`h-[calc(100svh-4rem-1px)]`) with `overflow-hidden`; the game fills the leftover
space as `flex h-full flex-col` and the boundary is `flex: 1 1 auto; min-height:
0`. Nothing scrolls at any viewport.

Inside the boundary the seats (`__seat--north/west/east`) are pinned to the
edges, `__centre` is a reserved play area a game styles for its own cards (the
trick plus, or the التركس shedding layout), and `__hand` runs along the bottom.
The layout is horizontal when the screen is wide and turns tall on phones (a
single `max-width: 640px` query rescales the card sizes and the centre), so the
table works in both orientations. The boundary is also the future home of a
custom table background — paint it on `.sz-tbl`.

Both games keep only the line that changes a turn (the contract, or the running
deal) on the page; the rest sits behind two buttons, `الإحصائيات` and `خيارات`,
that `_components/GameMenu.tsx` portals into `GameShell`'s header slot beside
"القوانين" (`_components/gameHeaderActions.ts` holds that slot's context, so the
game keeps the state while the buttons live in the shared header).
"الإحصائيات" holds the live scores and the win/loss record; "خيارات" holds the
card-style toggle, the mode switch (trix) and "جديد" (which closes the modal as
it starts a new game). Each game passes its own nodes in, since they score
differently.

## The header strip

Every game's buttons live in one strip in `GameShell`, rendered through the shared
`_components/HeaderButton.tsx` (icon + label on one line, the shape "القوانين"
uses). A game that owns its state portals its buttons in with
`_components/HeaderPortal.tsx`; Solitaire puts its four actions there while
keeping the clock/moves readouts on the page.

The strip also carries a **focus mode** toggle. Focus mode has to hide the
navbar, which is a sibling of the page, so the state lives in
`ConditionalLayout` and is provided through `Contexts/FocusModeContext`; `GameShell`
reads it to drop the back link and the title and to grow from
`h-[calc(100svh-4rem-1px)]` to `h-[100svh]`. The strip and the game stay.

## Records

`_lib/scores.ts` keeps everything device-local in `localStorage` under
`sz-games-*` keys, in two shapes:

- **A best record** — one number, for a run game. `recordResult('2048', score,
  'higher')` and `recordResult('solitare', seconds, 'lower')` keep the best, and
  `readRecord` reads it.
- **A match tally** — `{ played, wins, losses, draws }`, for a match game.
  `recordMatch('tarneeb', 'win')` returns the updated tally and `readStats`
  reads it; the value is JSON with a `v` field so the shape can migrate.

A game declares which shape it uses by which key map it appears in
(`GAMES_RECORD_KEYS` or `GAMES_MATCH_KEYS`). Without a browser both reads come
back empty and writes are swallowed, so SSR and private mode are safe.

## 2a. Tests

The pure libraries are tested with Vitest (a JS runner alongside the Pest suite):

```
bun run test:js        # vitest run
bun run test:js:watch  # vitest
```

Tests live beside the code they cover (`_lib/cards.test.ts`,
`_lib/solitaire.test.ts`) and run in a plain Node environment — no DOM, no
browser — because the rules carry no React.

## 3. Adding a game

1. Add an entry to `GAMES` in `_lib/games.ts` (slug, title, icon,
   `comingSoon` if not playable yet).
2. Add a route in `routes/web.php` returning the new Inertia component.
3. Add `Pages/Games/<Slug>/Index.tsx` wrapping its board in `GameShell`.
4. Add the icon to `Components/Icons/ProjectIcons.tsx` following the house
   style (32×32 viewBox, light/dark Tailwind colour pairs, one
   `hsl(var(--primary))` accent).

The hub grid, the `comingSoon` badge and the back navigation all follow from
the registry, so nothing else needs touching.

## 4. 2048

- **Rules live in `_lib/engine2048.ts`** with no React import, so they can be
  unit-tested and reused. The board is a flat `Tile[]`, not a 4×4 matrix: each
  tile carries a stable `id`, which is what lets a slide animate (same DOM node,
  changed `transform`) rather than snap.
- **Input**: arrow keys, WASD, and touch swipe. The listener ignores events
  originating in an input/textarea so the page stays usable.
- **Seeding happens in a mount effect, not in `useState`.** The server renders
  an empty grid; seeding a random board during SSR would produce a board the
  client can never match, and React would report a hydration mismatch.
- **Win** is 2048 — the overlay offers "متابعة اللعب". A `keepPlaying` latch
  stops the overlay re-appearing on the next move, since the 2048 tile is still
  on the board. **Loss** is a full board with no adjacent pair.

### 4.1 Animation

Four rules, all of them load-bearing:

1. **Tiles are placed with `transform`, never `left`/`top`.** A surviving tile
   keeps its DOM node across moves, so a move is a transform change the browser
   can transition. Positioning by `left`/`top` produces identical output and no
   animation at all — the transition never fires.
2. **The pitch is a custom property, and the inset is applied explicitly.**
   Both halves of that rule are non-obvious, and both fail silently:
   - A percentage in `translate()` resolves against the element's *own* width,
     so `translate(25%)` moves a quarter of a cell, not a cell — every slot
     collapses into the corner. `.sz-2048-cell` therefore derives its width from
     the pad and gaps it has to share (`4·cell + 3·gap = 100% − 2·pad`) and
     exposes `--sz-2048-pitch: calc(100% + gap)`, so a cell index multiplied by
     the pitch lands exactly on its slot.
   - An absolutely positioned element lays out against the containing block's
     **padding** box, so `left: 0` sits on the border and silently ignores the
     board's `p-2`. The grid then butts against the top-left and strands the
     padding on the bottom and right. Cells offset by `--sz-2048-pad` to keep
     the inset even.

   Change `--sz-2048-gap` or the board's padding and the grid still fills
   correctly; hand-written percentages will not survive it.
3. **The coloured face is a child element, not the positioned wrapper.** Both
   the slide and the pop need the transform axis; a pop on the wrapper would
   clobber the translate doing the sliding.
4. **The face is keyed on `Tile.merges`, the wrapper on `Tile.id`.** A tile
   that merges on two consecutive moves keeps both its id and its `merged`
   flag, so the pop would never replay. Keying the face on the merge count
   remounts it and restarts the animation.

`move()` also returns the tiles it **absorbed**, with the cell their killer
landed in. The component keeps them mounted for one slide as "ghosts" that
travel into the merge point and fade, instead of blinking out of existence.
They accumulate rather than replace, so a fast second move does not yank a
still-sliding ghost off the board.

Styles live in `resources/css/app.css` under `sz-2048-*` (the repo's home for
module CSS, as with `.mushaf-page`). Timings are custom properties
(`--sz-2048-slide`, `--sz-2048-pop`, …) so the component can retune them, and
`GHOST_MS` in the component must stay in step with the CSS. The whole set is
disabled under `prefers-reduced-motion: reduce`.

## 5. Solitaire

Klondike draw-one. The rules are in `_lib/solitaire.ts` and are just as free of
React as the 2048 engine; the component owns the clock, the selection, the undo
stack and the two ways of moving a card.

- **`Deal` is an immutable value.** Every rule function returns a new `Deal` (or
  the same object when the move is illegal, so callers can compare), which is
  what makes undo a plain array of previous deals.
- **Moving a card two ways.** Native HTML5 drag for a pointer, tap-then-tap for
  touch, because `dragstart` never fires on touch. Card clicks call
  `stopPropagation` — they sit inside a clickable pile, and without it one tap
  is handled twice and cancels itself out.
- **`availableMoves()` returns *useful* moves, not legal ones.** It filters out
  a pile moving onto itself and any foundation-to-foundation move, which are
  legal under `canMove` but would bury the hint button.
- **`isFoundationSafe()` is the conventional heuristic, not a proof** — a King,
  or level opposite-colour foundations, or a 2 whose partner 2 is home. A false
  negative only means the player moves the card themselves.
- **The board is `dir="ltr"`** even though the page is RTL: a deal is read left
  to right, so the card corner index and centre pip are mirrored deliberately.
- **A column is three reserved bands, top to bottom:** the hidden stack, the
  face-up run, and a dock of empty space. Because the run is fanned sideways
  rather than cascaded, a column never grows downwards, so its height is
  decided entirely by those two reserved bands and a card dropped into a column
  moves nothing around it.
  - The hidden stack is given the height the column was **dealt** with
    (`colIndex + 1` cards), not the height it currently holds. Cards only ever
    leave a hidden stack, so reserving the original count pins the run below it
    in one place for the whole game.
  - The run is a `flex` row where each card after the first is pulled *left* by
    the fan step, leaving a strip of its left edge showing — which is exactly
    where the corner index is, so every card in the run stays identifiable and
    only the top one is fully visible. `--sz-sol-fan-step` therefore has to stay
    wider than the corner index, or a two-digit rank gets clipped. This is the
    one part of the board that gets *bigger* with more cards, so it is the part
    the layout has to be paid for in advance: `--sz-sol-fan-slots` is how many
    cards' worth of lane a column reserves, and the card is only
    `1 / (1 + step × slots)` as wide as its track. A run longer than the
    reservation keeps extending into the same lane and tucks under the next
    column rather than reflowing the board.
  - The waste is the one place still cascaded vertically, and it inherits the
    rule that is easy to get backwards: the sliver belongs to the card
    **underneath**, not the one being placed, which is why the component passes
    `--sz-sol-reveal` per card instead of CSS deriving it. The sliver is also
    the *opposite* of the pull — a card pulled up 8px still exposes most of
    itself, because the pull only decides how much of the card below gets
    covered — so the margin is `sliver − card height`. A card with nothing under
    it resets the margin, or it is pulled up over whatever is above the board.
- **Every card dimension is a `cqw` length against one container.** `.sz-sol`
  is the only element with `container-type: inline-size`, and the reserved
  heights, the fan step and even the corner index are all derived from it. That
  is not a style preference: the bands need *lengths*, and a percentage cannot
  supply them. `margin-top` percentages resolve against a width, but a
  `min-height` percentage resolves against an indefinite height and a
  `font-size` percentage against the parent's font-size — so the same expression
  that sizes a card silently resolves against a different box in each of those
  three places. Container units sidestep all of it, and nothing below `.sz-sol`
  may declare a container of its own or the inherited lengths shift underneath
  it.
- **The top row shares the tableau's tracks.** Stock, waste, a gap, then the
  four foundations, each card-sized slot left-aligned in its track, so the
  foundations sit over the rightmost columns the way a real deal is read. That
  is also why the Solitaire page asks `GameShell` for a wider container than
  2048 does: seven columns plus a fan lane each does not fit `max-w-3xl`.
- **A legal drop highlights the card that would receive it**, not the pile. The
  pile only takes a neutral hover tint; a background over the whole column
  paints across the hidden cards and reads as if they were the target. An empty
  column lights its placeholder instead, since that is the slot a card lands in.
- **Only the top waste card is grabbable.** Draw-one Klondike moves the single
  exposed card, so the ones fanned out beneath it are decoration and must not
  be draggable or clickable.
- **Card faces follow a real deck.** `PIP_LAYOUTS` in the engine places the
  number cards on the traditional three-column, seven-row grid, with each rank
  carrying exactly its own number of pips and everything below the middle line
  mirrored, as a printed deck is. Aces get one large centred pip; jacks, queens
  and kings get the letter with the suit beneath it. The corner index is inset
  from the centre treatments, because at small card sizes a centred pip
  otherwise overlaps it, and it — like every other piece of card text — is sized
  as a fraction of the card rather than in `rem`. A `rem` index has to be tuned
  per breakpoint to stay legible, and it silently stops matching the card the
  moment the board is scaled; the fan's step is derived from the same card
  width, so the two stay consistent instead.
- **The back follows the site theme.** Its tint, border and centre mark all come
  from the active theme's `primary`/`primary-foreground` tokens, so it changes
  with the theme the way the rest of the chrome does. The Syrian Zone mark is
  applied as a `mask` over a solid fill rather than as an image, which is what
  lets it take the theme's foreground colour instead of fighting the tint.

## 6. Storage

Device-local only, under the `sz-games-record-<slug>` localStorage keys
(`scores.ts`). There is no account sync and no migration: guests and logged-in
users share one store, and clearing site data clears the records. The keys are
namespaced away from `sz-muslim-*`, which is the only family the login
settings-sync engine walks. `recordResult(slug, value, compare)` takes
`higher` (2048's best score) or `lower` (solitaire's best time) and reports
whether the run set a record, so the UI can say so.

## 7. Not yet wired

The hub is intentionally **not linked from the navbar or the homepage grid**
while the module is in review, and `/games` is not in the sitemap's
`STATIC_PAGES`. Both are one-line changes once the section ships.
