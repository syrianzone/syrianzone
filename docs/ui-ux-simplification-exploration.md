# UI/UX Simplification Exploration — Syrian Zone

> **Type:** Exploration / audit. **No code was changed to produce this document.**
> **Goal:** find where the interface can be simpler (less clutter, fewer duplicate
> controls, clearer hierarchy) while **keeping every existing feature working and
> easy to use** — micro-interactions, edge states, RTL and mobile included.
>
> **How to read it:** each section gives *What it does* → *Clutter / duplication* →
> *Small details* → *Feature-preserving simplification proposals*. Findings carry
> `file:line` anchors. A prioritised backlog and a shared-primitive plan are at the
> end. Priority markers: **P0** highest leverage / lowest risk, **P3** polish.

---

## 0. Executive summary

The app is feature-rich and mostly well-built, but it grew organically: each
section solved the same problems again in its own way. The simplification
opportunity is not "remove features" — it is **unification and de-duplication**.
The five recurring themes:

1. **Duplicate navigation surfaces.** The homepage grid, the Navbar mega-menu and
   the mobile sheet all render the same `SITE_LINKS`; hub pages repeat their own
   nav; two focus-mode mechanisms exist (Games vs Quran).
2. **The same "searchable directory" shell is re-implemented 6×** (SyOfficial,
   Phonebook, GovApps, Party, Sites, House) with drifting hero, search, chips,
   view-toggle, empty-state and result-count markup.
3. **The same "admin CRUD" shell is re-implemented 8+×** (GovApps, GuessWho,
   SyOfficial, Phonebook, Compass Figures/Personas) with copy-pasted dialogs,
   two divergent reorder lists and a mix of `alert`/`confirm`/custom toasts.
4. **Feedback and confirmation are inconsistent.** Native `alert()`/`confirm()`,
   a hand-rolled toast in three places, inline `Alert`s, and Sonner mounted only
   inside the Transit studio. A user never learns one feedback language.
5. **Accessibility and RTL drift.** Physical `ml/mr/left/right` classes in RTL
   trees, icon-only buttons with no `aria-label`, clickable `<Badge>`s that are
   not focusable, no visible focus rings on raw `<button>`s, and hidden map
   attribution.

None of the proposals below remove a control; they **relocate, merge, standardise
or delete dead code**. Estimated net effect: several thousand lines of duplicated
JSX deleted, and a consistent feel across sections.

---

## 1. Global shell

### 1.1 `Layouts/MainLayout.tsx`, `Components/ConditionalLayout.tsx`

**What it does.** `MainLayout` wraps every page in `AuthProvider` →
`ConditionalLayout` → page, plus ambient `SettingsSync`, the usage tracker
(`useUsageTracker`, called straight from the layout) and `RadioMiniPlayer`.
`ConditionalLayout` owns focus mode and decides navbar
stickiness per section (`resources/js/Components/ConditionalLayout.tsx:19-34`).

**Clutter / duplication.**
- Focus mode has **two implementations**: Games uses `FocusModeContext`
  (`ConditionalLayout.tsx:14-17`), while the Quran reader uses a zustand flag
  `quranFocus` and hides the navbar inside `Navbar.tsx:338`. Two mechanisms, two
  labels (`تركيز` vs `وضع التركيز`), two visuals (text button vs icon button).
- Navbar stickiness is a growing conditional expression
  (`ConditionalLayout.tsx:34`): `/muslim/*` and `/games/*` non-sticky, `/roznama`
  sticky, `/transit/*` full-height. Three different page-height idioms follow.
- `AuthProvider` is mounted **inside** `MainLayout`, which is why several admin
  pages re-implement `can()` by reading `usePage().props` (see §19.2).

**Proposals (P1).**
- One `focus` context for both Games and Quran; both expose the same label/icon.
- Extract `usePageShell()` returning `{ fullHeight, sticky, focus }` so the
  conditional doesn't keep growing.
- Hoist `AuthProvider` above the page (or expose a `useCan()` hook from Inertia
  props) so pages stop re-implementing capability checks.

### 1.2 `Components/Navbar.tsx` (626 lines)

**What it does.** Desktop top links + a click-only "المزيد" mega-menu of tiles;
mobile `Sheet`; page-scoped settings gears; appearance menu; account/login.

**Clutter / duplication.**
- The mega-menu renders `SITE_LINKS` as one flat 24-tile grid with no headings or
  grouping (`Navbar.tsx:130-204`), matching the equally flat homepage grid.
- The same list appears in three surfaces: `Navbar` mega-menu, mobile sheet
  (`Navbar.tsx:431`), homepage tool grid (`Home.tsx:543-569`).
- Transit mode swaps the top nav to two links + "أقسام الموقع"
  (`Navbar.tsx:487-491`) but offers **no link to Transit admin**, so a moderator
  cannot reach the queue from the map (see §9.5).
- Page-scoped gears (Roznama `:564-575`, Prayer `:576-587`, Quran bookmarks
  `:552-563`) **duplicate gears drawn again on the pages themselves**.

**Small details.**
- `NavTile` is a good reusable shape; but several links flagged `isInternal` are
  actually external (`Lib/siteLinks.ts:58,59,70,71`) and have no external glyph.
- The login button is icon-only until `xl` (`Navbar.tsx:592-620`) — good
  compaction, but no `title` for the icon-only state.
- Homepage hides the desktop navbar and replaces it with a settings gear
  (`Navbar.tsx:342-352`) while the homepage renders its own header — two headers
  whose controls differ slightly.

**Proposals (P1).**
- Group `SITE_LINKS` into named sections (خدمات / مواصلات / مجتمع / بيانات) and
  reuse that grouping in the navbar, mobile sheet and homepage grid.
- Mark external links with a corner arrow consistently.
- Add the missing Transit-admin link (capability-gated) in transit mode.
- Kill one of each duplicated settings gear (§1.3).

### 1.3 `Components/AppearanceMenu.tsx`, `UserNav.tsx`

**What it does.** `AppearanceMenu` = theme + font picker, in the navbar for all
visitors. `UserNav` = avatar dropdown (dashboard/profile/logout).

**Clutter / duplication.**
- `Components/ThemeToggle.tsx` was a second, unused theme+font dropdown that
  duplicated `AppearanceMenu`; it has been deleted.
- The AppearanceMenu's heritage-theme row special-cases `damascus-rose` to move
  its swatch after the label (`AppearanceMenu.tsx:99-115`) — a layout hack that a
  uniform swatch-before-label would remove.

**Proposals (P0).** Simplify the heritage row.

### 1.4 Ambient notifications — the bottom-corner pile-up

`Components/UnblockSyriaNotification.tsx`, `DevRoleSwitcher.tsx`,
`RadioMiniPlayer.tsx`, and Sonner all float at the bottom and conflict:

- Site popup: `left-4 z-[9999]` physical (`UnblockSyriaNotification.tsx:66`).
- Sonner: `position="bottom-left"` (`ui/sonner.tsx:29`) — only mounted in the
  Transit studio today.
- Radio mini-player: desktop `right-4`, mobile a FAB (`RadioMiniPlayer.tsx`).
- Dev switcher anchor is effectively broken in RTL (`DevRoleSwitcher.tsx:44`:
  `fixed bottom-4 start-4 z-[100] rtl:start-auto ltr:end-4`).

**Proposals (P1).** Introduce one corner policy: toaster bottom-**start**,
mini-player bottom-**end**, popup as a queued toast (not a `z-[9999]` overlay),
fix the dev switcher to a single logical anchor, and move it into a dev toolbar.
`RadioMiniPlayer` also duplicates its transport markup for desktop and mobile —
extract one `<NowPlaying>` (see §6.4).

---

## 2. Home / Startpage

**Files:** `Pages/Home.tsx` (920 lines), `Pages/Home/_components/*`.

**What it does.** A personal start page: hero meta (prayer · weather · date),
optional events block, internal tools grid, external/sister links, custom links
with an edit mode, footer, and a settings sheet (widget visibility + location).

**Clutter / duplication.**
- **Dead theme swatch row** at `Home.tsx:489-507`: unreachable because `theme` is
  always set before render, and it duplicates `AppearanceMenu`. Delete it (P0).
- **Three link blocks with three different layouts**: internal grid
  (`Home.tsx:544`), external `flex-wrap` (`:576`), custom grid (`:627`).
- **Two delete affordances for custom links**, neither confirmed: tile overlay X
  (`Home.tsx:718-730`) and the edit dialog footer (`EditLinkDialog.tsx:103-106`).
- **Two add/edit dialogs** (`AddLinkDialog.tsx`, `EditLinkDialog.tsx`) are the
  same ~110-line form.
- The mobile date block + quick row (`Home.tsx:510-533`) re-implement the desktop
  info strip (`:437-460`); `getWeatherIcon` hard-codes size so consumers override
  with `[&>svg]:w-5` (`:519`).
- The events block has no section heading while the two link blocks do.

**Small details / real bugs.**
- **Events governorate never saves** (`HomeSettingsDialog.tsx:250`
  `onValueChange={setEventsGovernorate}` skips localStorage + account save, unlike
  every other control) and the select has **no option for the default `all`**
  (`:253-255`), so it renders empty. Board's events widget already does this
  right (`Board/_widgets/events-today/index.ts:29` adds `كل سوريا`) — copy it.
- The gear button has only `title`, no `aria-label` (`Home.tsx:464`).
- The "last visited" badge is icon-only with a `title` (`Home.tsx:556-560`).
- The edit-mode tile is a clickable `<div>` (`Home.tsx:636-639`) — not focusable.
- `maxLength={4}` on the emoji field (`AddLinkDialog.tsx:94`) breaks multi-unit
  emoji.

**Proposals (P1).**
- Delete the dead swatches; one theme control (AppearanceMenu) only.
- Collapse add/edit into one `LinkDialog` with an optional confirm-delete; remove
  the overlay X.
- Merge the three link regions behind one tile component with an origin badge.
- Merge desktop strip + mobile block into one `<HeroMeta>`.
- Fix events-governorate persistence + add `كل سوريا`; give the gear an
  `aria-label`; make the link tile a real `<button>`/`<a>`.

---

## 3. Board (`/board`)

**Files:** `Pages/Board/Index.tsx`, `_components/*`, `_widgets/*` (14 widgets).

**What it does.** A customizable widget dashboard with drag/resize, size menu,
per-widget config, multiple dashboards (tabs) and gallery.

**Clutter / duplication.**
- **Two resize models coexist**: a discrete `SizeMenu` dropdown
  (`BoardTile.tsx:120`) *and* a pointer drag-handle with a live `w × h` overlay
  (`BoardTile.tsx:160-179`). The `SizeMenu` comment even argues against drag —
  one of them should go (~90 lines).
- Each tile header can carry **four** icon-only actions in edit mode (size,
  settings, delete, drag) (`BoardTile.tsx:118-149`).
- The toolbar `h1` duplicates the dashboard name shown in the tabs
  (`BoardToolbar.tsx:14` vs `DashboardTabs.tsx:61-63`).
- Tabs render rename/delete only on the active tab while editing
  (`DashboardTabs.tsx:65`) — two gates for a simple action.

**Small details.**
- **No empty state**: a fresh dashboard renders an empty grid; the only add
  affordance is the toolbar's `إضافة`, visible only in edit mode
  (`Board/Index.tsx` + `layout.ts:166`).
- Gallery hides the 40-widget cap; `addWidget` silently no-ops when full
  (`layout.ts:122`).
- `SizeMenu` shows all sizes even below a widget's `minSize`/`maxSize`, and
  `resizeWidget` doesn't clamp (`layout.ts:137-142`).
- Widget config dialog has no explicit close button and writes numbers on every
  keystroke (`WidgetConfigDialog.tsx:78-89`).
- Auth-required widgets are shown but not disabled in the gallery
  (`WidgetGallery.tsx:45-47`), leading to a dead-end tile.
- `grid-auto-flow: dense` (`BoardGrid.tsx:80`) makes tiles silently reflow.
- `WidgetShell` error state has no icon and the refreshing bar is `aria-hidden`.

**Proposals (P1).** Pick one resize model; move tile actions into a `⋯` menu; add
an empty-board state with a primary "add widget"; surface the cap and auth
requirement; clamp sizes from the menu; add a "تم" close to the config dialog;
drop `dense` for predictable layout.

---

## 4. Muslim Corner (`/muslim`, `/muslim/prayer`, `/muslim/quran`, `/muslim/radio`)

**What it does.** Hub + three tools: prayer times with a completion tracker,
the Quran reader (mushaf + audio), and the Quran radio.

**Clutter / duplication.**
- **Two settings entries**: navbar gear (`Navbar.tsx:576-587`) + in-card gear
  (`PrayerView.tsx:230-268`). Same modal, two buttons.
- **Two prayer-settings bodies**: `PrayerView.tsx:46-114` and
  `Roznama/Index.tsx:174-264` are near-copies.
- **Quran bypasses `MuslimShell`** and uses a different back label (`رجوع` vs
  `الركن الإسلامي`) with no tool header (`Quran/Index.tsx:69-86`).
- The hub grid is `lg:grid-cols-9` for only **3** tools (`Muslim/Index.tsx:153`).
- **Preference-key drift**: Roznama writes legacy Home keys
  (`Roznama/Index.tsx:549-551`) while Prayer/sync use `sz-muslim-*`
  (`prefs.ts:40-50`, `settingsSync.ts:96-102`) — custom coords set in Roznama are
  invisible to sync and partly to Prayer.

**Small details.**
- Quran reader stacks ~5 toolbars plus a sticky player
  (`QuranReader.tsx:296-482`); ayah interaction (tap = select, double-tap = play)
  and keyboard shortcuts (`h`/`l`/`[`/`]`) are **undocumented**.
- Ayah spans are not keyboard-focusable (`MushafPage.tsx:212-222`).
- The reader's volume slider is duplicated (`AudioPlayer.tsx:83-111`).
- The radio's 6 sleep presets are always visible (`RadioView.tsx:166-181`) and the
  sleep timer is not persisted though other prefs are.
- Prayer completion toggle is a 7px target with `title` only
  (`PrayerView.tsx:321-336`).
- `LocationModeSelector` re-resolves GPS on every tap and disables all rows while
  busy (`LocationModeSelector.tsx:26-34,59`).
- Settings-conflict modal: Escape silently snoozes (`SettingsSync.tsx:47-56`).

**Proposals (P0/P1).**
- One settings entry; extract `<PrayerLocationSettings>` shared by Prayer/Roznama.
- Point Roznama at the `sz-muslim-*` keys so sync agrees.
- Add a `؟` help dialog for Quran interaction + keyboard shortcuts; make ayahs
  focusable; always mount the transport.
- Collapse sleep presets into one dropdown; persist the sleep timer; normalise
  labels.
- Size the Muslim hub grid to its item count.

---

## 5. Games (`/games/*`)

**What it does.** Hub of 6 games with a shared `GameShell`.

**Clutter / duplication.**
- **Focus mode is Games-text vs Quran-icon** (see §1.1).
- Game header accumulates 4–5 buttons on card games (rules, focus, stats,
  options + game actions) and wraps on phones (`GameShell.tsx:91-117`).
- **Inconsistent placement of the same actions per game**: Solitaire puts
  undo/hint/cards/new in the header (`Solitaire.tsx:368-381`); Tarneeb/Trix bury
  cards/new in the options dialog (`Tarneeb.tsx:270-285`, `Trix.tsx:276-300`);
  2048 puts "new game" inline in the stat row (`Game2048.tsx:167-174`).
- Solitaire re-implements `CardStyleToggle` as its own `Hash` button
  (`Solitaire.tsx:375-377`) while Tarneeb/Trix use the shared component.
- `Games/Index.tsx` has a dead `comingSoon` badge branch (`games.ts:30-35`).
- The Trix mode switch (`يهودية`/`فريقين`) is hidden inside options behind a bare
  `⇄` glyph (`Trix.tsx:279-287`).

**Small details.**
- `GameMenu` dialogs lack `DialogDescription` (`GameMenu.tsx:32-49`).
- 2048 has no loading skeleton (`Game2048.tsx:54-57`).
- Non-interactive cards are rendered as `<button>`s, flooding tab order
  (`PlayingCard.tsx:76-94`, `Solitaire.tsx:430-432`).
- `/games/solitare` is misspelled in the route and registry (`routes/web.php:72`,
  `games.ts:41`).

**Proposals (P1).** One header action set for all games + `⋯` overflow
(`جديد`, `القوانين`, `أرقام`, game-specific inside); make Solitaire use the shared
toggle; add `DialogDescription`; unify restart labels; fix the slug with a 301;
remove the dead `comingSoon` branch; render non-interactive cards as non-buttons.

---

## 6. Roznama (`/roznama`)

**What it does.** A daily planner: clock, weather, prayer times, holidays,
events.

**Clutter / duplication.**
- **Two settings gears** again (`Roznama/Index.tsx:915-921` + navbar).
- **The next event is shown twice**: inside the holiday card (`:860-891`) and as
  the first events-list row (`:1184-1234`).
- The **SANA source link appears three times** (`:1106-1114`, `:1244-1252`,
  `:1264-1266`); the bottom notes card restates the holiday card.
- **Three related governorate maps** in one file (`:35-66`, `:82-97`), the last
  duplicating the shared governorate table (`Domain/geography/governorates.ts`).
- Local `formatDuration` copy (`:637-645`) duplicates `Muslim/_lib/format.ts`.

**Small details / bugs.**
- **Hard-coded method footnote** (`:1000-1002`) always says "رابطة العالم
  الإسلامي" even when another method is selected — a trust bug.
- `showOtherGovEvents` is not persisted while `hidePassed` is (`:306` vs `:315`);
  the empty state duplicates its switch (`:1175-1180`).
- Variable holidays only cover 2026–2027 (`:99-116`) — silent content cliff.
- `if (!mounted) return null` (`:718`) blanks first paint.
- Clock/countdown have no `aria-live`.

**Proposals (P1).** One settings entry; remove the duplicate next-event block;
one notes/source location; **render the selected method's name/detail** from
`PRAYER_METHODS`; import `GOVERNORATES` from `Domain/geography/governorates`; persist + rename the events
toggle; render a shell instead of `null`.

---

## 7. Transit (`/transit`, city map, studio, admin)

### 7.1 Landing + city map
- Hero (`Hero.tsx:20-34`) and the grid header (`CityGrid.tsx:27-32`) both count
  "ready" cities; the contribute CTA appears here **and** in the navbar.
- The city-map error shows a raw English string (`useMapData.ts:15`) in an Arabic
  page (`city/[id]/Index.tsx:108-111`).
- The composite-city banner and the search box can overlap at `top-3`.

### 7.2 Sidebar and map overlays
- **Dead code**: `SidebarMapTools.tsx` (118 lines) is imported
  (`TransitSidebar.tsx:10`) but never rendered; studio `StopNamePopup`
  (`studio/Index.tsx:176-209`) is unreachable.
- "إضافة مسار" appears three times (`SidebarRoutes.tsx:97`,
  `SidebarRouteDetail.tsx:80`, navbar).
- **Two bottom-sheet mechanics** on the map (`BottomSheet.tsx` vs
  `NearbyTransitDrawer.tsx:172-194`), plus two FABs hard-positioned to clear the
  sidebar sheet (`NearbyTransitDrawer.tsx:146`).
- Two popup idioms: React card (`RouteLayer.tsx:145-193`) vs MapLibre HTML
  (`StopsLayer.tsx:104-107`).
- `StopsLayer.tsx:89` labels stops with the raw route **id**.
- `MapCanvas.tsx:33` starts `watchPosition` on mount (permission prompt + drain).
- `NearbyTransitDrawer` uses raw CSS vars instead of theme tokens.

### 7.3 Studio
- 1683-line monolith mixing map math, snapping, API and 5 panels.
- **Literal `**` markdown** renders as asterisks in the help text
  (`studio/Index.tsx:1270-1274`).
- **Toast spam**: info toasts on nearly every draw action (e.g. `:907,919,928,
  981,989,1001,1008,1028`).
- The `submission` accordion badge always says `جاهز` regardless of completeness
  (`:1506-1508`); validation is toast-only (`:1032-1046`).
- Three "exit" affordances (navbar, sidebar, success panel).

### 7.4 Admin
- Two parallel filter systems (drafts vs routes) written twice (`:736-753` vs
  `:824-840`).
- The route detail card is an **8-button grid** (`:1063-1117`).
- **Import gating mismatch**: fetch needs `canReview`, publish needs `canEdit`,
  so reviewers fetch then see disabled buttons (`ImportTab.tsx:296,454-476`).
- Custom toast div (`:1338-1345`) instead of Sonner.
- Clickable `<Badge>` filters are not keyboard-focusable (`:739,828`,
  `ImportTab.tsx:319`).

**Proposals (P0/P1).** Delete dead `SidebarMapTools`/`StopNamePopup`; fold
`NearbyTransitDrawer` into `BottomSheet`; add a Transit-admin navbar link; split
Studio/Admin into modules; fix the `**` bug; collapse the 8 buttons into primary
+ overflow; one `AdminFilterBar`; fix import gating; standardise on Sonner;
use route names in stop badges; start geolocation lazily.

---

## 8. Mishwar / Places (`/mishwar`)

**What it does.** A map of community places and hotels with a responsive panel,
filters, submission flow and owner management.

**Clutter / duplication.**
- The `PlacesPanel` prop block is **copy-pasted** for desktop and mobile
  (`Places/Index.tsx:374-411`).
- **`FilterBar` "النوع" (places/hotels) duplicates the panel tabs**
  (`FilterBar.tsx:297-314` vs `PlacesPanel.tsx:274-275`), allowing contradictory
  state ("فنادق" filter while on the "الأماكن" tab).
- Three stacked floating pill rows over the map (`Index.tsx:336-367`).
- Debug `console.log/warn` in the map layers (`Index.tsx:98-99`,
  `PlacesLayer.tsx`, `HotelsLayer.tsx`).
- `PlacesLayer`/`HotelsLayer` are near-identical 160-line files.

**Small details.**
- `window.confirm` in `SubmitSheet.tsx:103` and twice in
  `ManagePlaceDialog.tsx:198,261`.
- `ManagePlaceDialog` has two save buttons in one long dialog (`:359` and `:474`).
- 5 tabs in a `grid-cols-5` inside a short bottom sheet (`PlacesPanel.tsx:273`).
- The hotel HalaSyria link appears twice (`HotelDetailView.tsx:109,122`).
- `SubmitSheet` step "auth" is a whole step for one CTA.

**Proposals (P1).** One `<ResponsivePanel>`; remove the duplicate places/hotels
filter; make add-mode a panel banner; one save per dialog or a tabbed editor;
`AlertDialog` instead of `window.confirm`; extract a generic `<ClusterLayer>`.

---

## 9. Crossings (`/crossings`) and Shawarma (`/shawarma`)

**Crossings** is already clean.
- Status count pills duplicate `StatusPill` styling (`Index.tsx:176-189`).
- Two WhatsApp entries per crossing (row + detail) with different treatments.
- Hover-preview card shows buttons that don't work (`CrossingDetail.tsx:33,48`).
- Source attribution is a dense footer (`Index.tsx:198-210`).

**Shawarma** is a static tier list.
- **Social badge only shows on hover** (`Shawarma/Index.tsx:117`) — invisible on
  touch.
- Mixed language (`<title>` English, description Arabic) and no S/A/B/C legend.

**Proposals (P2).** One status palette; make the hover preview visually distinct;
move attribution into a "مصدر البيانات" popover; always show the Shawarma social
badge + a one-line legend.

---

## 10. Compass & Alignment

### 10.1 Compass (`/compass`, `/compass/stats`, `/compass/s/{id}`)
**Clutter / duplication.**
- Intro copy repeated 3× (`Index.tsx:32-34`, `CompassApp.tsx:254-257`, and the
  meta description).
- Two competing start actions; **"ابدأ من جديد" hard-codes `'standard'`**
  (`CompassApp.tsx:267`) ignoring the selected version — a bug.
- Quiz header shows **three** progress signals (`:348-353`) that disagree when the
  user navigates back.
- **Result page is a tall stack** of ~7 cards + four paragraph+button blocks
  (`CompassResult.tsx:344-413`), defaulting to a scary red "remove anonymous
  participation" button even though stats were auto-submitted.
- **Dead feature paths**: `showCharacterNames=false` disables the figure block
  (`flags.ts:9`, `CompassResult.tsx:226-256`); `AlignmentCard.powers` data is
  unused; `shareResult()` is never called.
- The 2D compass claims "مع أقرب الشخصيات" but plots only the user
  (`CompassResult.tsx:302`, `CompassCanvas.tsx:39-51`).

**Proposals (P1).** Collapse the action region into one primary + overflow +
inline privacy toggle; make anonymous stats opt-in; de-duplicate the intro; one
progress readout + a keyboard hint; make answers a radiogroup; either plot
figures or drop the claim; render or delete `powers`; add delete confirm.

### 10.2 Alignment (`/alignment`)
- Four stacked config cards; a `© 2025` author footer inside the tool
  (`CompassClient.tsx:486-501`); native `confirm()` (`:264`); no coordinate
  readout for dots; no reset/share.

**Proposals (P2).** Merge axes+colors, compact export toolbar, delete the
embedded footer, add a reset, replace `confirm()`.

---

## 11. Polls, TierList, Priorities, GuessWho

### 11.1 Polls & TierList
- **`Polls/Leaderboard.tsx` and `TierList/Leaderboard.tsx` are 99.5 % identical**
  (405 lines each) — the biggest single de-duplication in the app.
- The public disclaimer Alert is **triplicated** (`Polls/Leaderboard.tsx:290`,
  `TierList/Index.tsx:60`, `TierList/Leaderboard.tsx:290`).
- English leaks into the Arabic UI: `Polls/Index.tsx:35,47,60-61`,
  `Polls/Show.tsx:60`, and number formats `1.2M`.
- Leaderboards use `text-gray-*` (breaks the theme system) and have no real
  loading state (`:260`), telling users to "refresh".

**TierBoard** (`Domain/polls/TierBoard.tsx`, 864 lines):
- Over-explains the task three times (page hint, instruction card, tier legend).
- Silent destructive actions: switching category **wipes placements**
  (`:182-202`), "مسح الاختيارات" has no confirm (`:835`), and reset repopulates
  from the unfiltered list (`:839`) — a bug.
- Min-selection and cooldown are invisible until you click (`:284-304`).
- `role="button"` cards contain a real `<button>` (invalid nesting,
  `:543-564`).
- Success Alert uses `variant="default"` (neutral, not green).

### 11.2 Priorities (`/priorities`)
- Sliders **and** `-`/`+` buttons are redundant (`:868-905`).
- The welcome banner's dismiss state exists but the banner renders
  unconditionally with no dismiss button (`:123,276,776`).
- Three share actions in a row (`:1164-1191`); radar domain `[0,45]` clips values
  up to 100 (`:1026`); comparison labels are mangled by string-splitting
  (`:1003`).

### 11.3 GuessWho (`/guesswho`)
- Landing is instruction-heavy; the connectivity note describes **WebRTC that is
  no longer used** (`Index.tsx:278` vs Reverb relay in `Room.tsx`).
- Native `alert()`/`confirm()` for errors and copy (`Index.tsx:53`,
  `Room.tsx:406,522`).
- "العب مجدداً" reloads a finished room (`Room.tsx:688`) — replay likely broken.
- Literal `**` markdown in the help text (`Room.tsx:662`); `select-none` on the
  whole page blocks copying the room code (`:446`).

**Proposals (P0/P1).** Merge the two leaderboards; extract `PollDisclaimer` and
render it on Show + TierList + both leaderboards; fix TierBoard reset/wipe + show
min/cooldown; collapse Priorities to one allocation control + fixed radar domain
+ wired banner dismiss; replace GuessWho alerts with toasts, fix replay/copy,
correct the architecture note.

---

## 12. Directories — SyOfficial, Phonebook, GovApps, Party, House, Justice, Sites, SyrianContributors

These six pages are **six variations of one "searchable directory" screen**. The
biggest win is a shared shell.

**Duplication:**
- **Hero header**: 5 near-identical blocks (`SyOfficial/Index.tsx:292`,
  `Phonebook/Index.tsx:165`, `GovApps/GovAppsClient.tsx:85`,
  `Party/PartyClient.tsx:80`, `Sites/SitesClient.tsx:72`).
- **Search field**: 4 copies, two sizes, physical `right/left` in Phonebook
  (`:186,192`) vs logical elsewhere.
- **Grid/table toggle**: 4 implementations, one already exists as
  `Places/_components/ViewToggle.tsx`.
- **Category chips, empty state, result count**: repeated 3–4×, with drift.
- **Social icons**: SyOfficial's three switch statements
  (`Index.tsx:115-199`) + Party's inline array (`PartyClient.tsx:244-250`);
  Party already has `formatSocialUrl` (`Party/data.ts:1-15`) which SyOfficial
  doesn't reuse.
- **Real bug in Sites**: filter compares raw `site.type` while chips show a
  *grouped* label, so two chips can show the same label and filter different
  types (`SitesClient.tsx:24,30,53-58`).
- **House** controls the same four dimensions from both the chart legend and the
  table selects (`ParliamentChart2026.tsx:211-226` vs
  `MemberTable2026.tsx:64-85`), and has a status badge filter + status select
  for the same state.
- **Justice** and **GovApps** store attribution data that is never rendered
  (`Justice/Index.tsx:15,18`); GovApps has no search at all.
- **SyrianContributors** is over-decorated (blur/glow/animated background),
  uses `window.open` instead of anchors, `border-3`/`dir-ltr` no-op classes, and
  `ml/mr` in RTL.

**Cross-cutting proposals (P0).** Build and adopt six primitives:
`<DirectoryHero>`, `<SearchField>`, `<CategoryChips>`, `<DirectoryViewToggle>`,
`<EmptyState>` (+ `<ResultCount>`) and a `<SocialLinks>` registry. Then fix the
Sites filter bug, unify House filters, render Justice/GovApps attribution, and
flatten SyrianContributors.

---

## 13. SyId (`/syid`) and Atlas/Population (`/atlas`)

**SyId (1039 lines)** — the densest content page.
- **48 tiny copy buttons** for colour formats (`:323-371`) with no `aria-label`.
- **12 download rows** in the font modal (`:463-526`).
- **Two competing theme vocabularies** (`COLOR_PALETTES` `:35-68` vs
  `POSTER_THEMES` `:96-127`) sharing names but different values.
- Header CTA "زيارة الموقع الرسمي" points at a site the next line says is down
  (`:293-304`).
- Blob-download logic written three times; governorate download is undiscoverable
  (button + `title` only); map attribution disabled (`SyriaMap.tsx:142`).

**Atlas/Population (~1000 lines)**:
- Environmental panel stacks **13+ sub-cards** repeating temperature/pressure
  (`PopulationClient.tsx:488-899`).
- **Two weather-icon systems** (lucide in panel, emoji in tooltips).
- Comparison selection is hidden behind expanding a table (`:959-962`).
- English error string in an Arabic page (`:100`).
- Map attribution disabled and focus outline removed (`MapClient.tsx:326,203`).

**Proposals (P1).** Add a sticky in-page TOC to SyId; put non-hex colour formats
behind one popover; one theme registry; fix/demote the dead-site CTA; make
governorate downloads visible; regroup the environmental panel into an accordion;
unify weather icons; make comparison a checkbox + "قارن (n/2)" button; localise
the error; restore attribution and focus.

---

## 14. Static pages — About, Stats, Privacy, Terms

- **About** has three overlapping "people" sections (founders, manual credits,
  GitHub contributors) and inconsistent `@handle` linking
  (`About.tsx:159-204`) — merge into one "الفريق والمساهمون" card.
- **Stats**: deprecated `frameBorder` (`Stats.tsx:70`); missing OG tags.
- **Privacy / Terms**: no TOC; hardcoded "آخر تحديث" in both; dangling trailing
  `<Separator>` with nothing after; no cross-links; **Terms renders literal
  backticks** around `is_banned` (`Terms.tsx:61`).

**Proposals (P2).** Merge About people sections; add a shared "last updated"
constant + TOC + Privacy↔Terms cross-links; fix the backticks; remove
`frameBorder`.

---

## 15. Dashboard (`/dashboard`)

**What it does.** A unified console: sidebar, submissions tab, polls tab (table +
inline editor + create dialog), profile tab.

**Clutter / duplication.**
- **Tabs and links look identical but behave differently**
  (`Dashboard/Index.tsx:583-721`); clicking a "tab" swaps the pane, clicking a
  "link" leaves the page. The user cannot tell which is which.
- The sidebar duplicates every admin link already in the navbar.
- The polls tab is a page-within-a-page with deep-link synonyms
  (`?edit-poll=` / `?edit=`, `?create-poll=` / `?create=`, `:381-382`) and manual
  `window.history.replaceState` (`:357,368,512`).
- **17 `alert()` + 17 `confirm()`** across the admin surface; the Filament link
  is a large competing button (`:569-578`).

**Proposals (P0/P1).** Split the sidebar into labelled "لوحتي" (tabs) and
"أدوات الإدارة" (links with an external affordance); replace
`alert`/`confirm` with toast + `<ConfirmDialog>`; de-duplicate the deep-link
params; demote Filament.

---

## 16. Admin panels

| Panel | Main clutter |
|---|---|
| **ApiTokens** | Endpoint repeated 3×; revoke/revoke-all have **no confirm**; bespoke checkbox + toast |
| **AssetManager** | "Download all ZIP" ignores the active filter; folder pills are clickable `<Badge>` (not focusable); errors only in console |
| **Compass Index** | Local `StatCard` duplicates `ui/card`; two subpanel links share the `Compass` icon; `لا توجد بيانات بعد.` ×4 |
| **Compass Figures/Personas** | `align` is a free-text enum; raw `<textarea>`; two 11-row axis editors duplicated; `window.confirm` |
| **GovApps** | Reorder is a separate tab while the list tab shows a sort icon; fallback image hardcoded twice; `هل أنت تأكد` typo |
| **GuessWho** | Search in header but add-button per tab; no inline active toggle; attributes as free-text `key: value` |
| **Phonebook** | Two CRUD dialogs inline in one 553-line file; raw `<select>`; delete buried in the edit dialog; visibility toggle looks like a chip |
| **Places (moderation)** | Card can show 8 gated controls; photo actions are unlabeled overlays |
| **SitePopup** | No success/error feedback, no dirty guard |
| **SyOfficial** | 12 social inputs in one dialog; raw selects; header says "drag" while the list uses arrows; `GripVertical` has no drag handlers |

**Cross-panel primitives to extract (P0/P1).** `<AdminPageHeader>`,
`<CrudDialog>`, one `@dnd-kit <SortableList>` (replacing the two divergent ones
and the false grip), `<ConfirmDialog>`, `<EmptyState>`, `<ImageUpload>`,
`<SlugInput>`, `<FilterChips>`, `<PhotoActionsMenu>`. Also:
- **Mount the Sonner `<Toaster>` once in `MainLayout`** and replace every
  `alert`/`confirm` and the three custom toasts.
- Fix the repeated **`هل أنت تأكد`** typo (`GovApps:65`, `SyOfficial:76,82`,
  `Phonebook:128,182`, `AssetManager:133`).
- **Translate `AdminPollManager`** — it is the most jarring mix of English UI in
  an Arabic app, and its group arrows have three RTL inversions
  (`AdminPollManager.tsx:143,420,430`).
- Fix the **AdminPollManager** poll-count grammar `{n} مرشحين`.

---

## 17. Shared primitives — the unification matrix

| Concern | Current duplication | Proposed component |
|---|---|---|
| Directory hero | SyOfficial, Phonebook, GovApps, Party, Sites | `<DirectoryHero>` |
| Search field | 4 copies (2 sizes, physical RTL) | `<SearchField size="lg|sm">` |
| Category chips | SyOfficial, Phonebook, Sites | `<CategoryChips>` (scroll/overflow) |
| View toggle | SyOfficial, Phonebook, Party, Sites | `<DirectoryViewToggle>` (from `Places/ViewToggle`) |
| Empty state + count | 4+, one divergent | `<EmptyState>`, `<ResultCount>` |
| Social links | SyOfficial switches, Party array | `<SocialLinks>` registry |
| Admin page header | Dashboard, 7 admin pages | `<AdminPageHeader>` |
| CRUD dialog | 8+ dialogs | `<CrudDialog>` |
| Reorder list | 2 divergent implementations | one `@dnd-kit <SortableList>` |
| Destructive confirm | 17 `confirm` + 3 `window.confirm` | `<ConfirmDialog>` / `useConfirm` |
| Toast | 3 custom + alerts + Sonner (studio only) | one `<Toaster>` in `MainLayout` |
| Image upload | 5+ uploaders | `<ImageUpload>` |
| Slug input | 5 pages | `<SlugInput>` (latin hint) |
| Capability check | `AuthContext.can` + 3 local copies | `useCan()` from shared props |
| Responsive map panel | Transit, Places | `<ResponsivePanel>` |
| Cluster layer | Places/Hotels, Transit | `<ClusterLayer>` |
| Weather icon | Home, Roznama, Atlas (2 systems) | one `<WeatherIcon>` |
| Media query hook | Lightbox, PhotoGrid, SubmitSheet | `useMediaQuery` |

---

## 18. Small-details checklist (applies app-wide)

**Microcopy & correctness**
- `هل أنت تأكد` → `هل أنت متأكد` (5 files).
- Literal `**` renders as asterisks: `studio/Index.tsx:1270-1274`,
  `Room.tsx:662`.
- Literal backticks: `Terms.tsx:61`.
- English strings in Arabic UI: `Polls/Index.tsx:35,47,60-61`,
  `Polls/Show.tsx:60`, Atlas error (`PopulationClient.tsx:100`),
  `AdminPollManager` (many), map fetch error (`useMapData.ts:15`).
- Poll count grammar `{n} مرشحين` (`Dashboard/Index.tsx:836`).
- Shawarma social badge invisible on touch (`Shawarma/Index.tsx:117`).
- Roznama hardcoded prayer-method footnote (`Roznama/Index.tsx:1000-1002`).
- Transit "— ل.س" price fallback (`SidebarRouteDetail.tsx:69`) and raw route id
  in stop badges (`StopsLayer.tsx:89`).

**RTL / direction**
- Physical `ml/mr/left/right` in RTL trees: `Alignment/CompassClient.tsx`
  (many), `Polls/Show.tsx:59`, `PrioritiesApp.tsx:964,1179,1189`,
  `SyrianContributors/Index.tsx:86-88,152-154`, `Phonebook/Index.tsx:186,192`.
- Map attribution/controls anchored physical-left (`MapCanvas.tsx:71-72`);
  popup `left-4` (`UnblockSyriaNotification.tsx:66`).
- Dead classes `border-3` / `dir-ltr` (`SyrianContributors:62`,
  `SyidClient:348`).

**Accessibility**
- Icon-only buttons without `aria-label`: Home gear (`Home.tsx:464`), SyId copy
  buttons (`SyidClient.tsx:339-369,411-418`), ApiTokens revoke
  (`ApiTokens/Index.tsx:402-414`).
- Clickable `<Badge>` not focusable: AssetManager folder pills
  (`:288-308`), Transit admin status filters (`:739,828`), Import chips
  (`ImportTab.tsx:319`).
- Raw `<button>`s without focus rings throughout quiz/admin surfaces.
- Quran ayahs not focusable (`MushafPage.tsx:212-222`); compass answers not a
  radiogroup (`CompassApp.tsx:362`).
- Missing progressbar role (`CompassApp.tsx:351`), missing `aria-sort`
  (`HouseClient.tsx:511-523`), missing star-rating label
  (`HotelDetailView.tsx:92-99`).
- Map attribution `attributionControl={false}` (SyId `SyriaMap.tsx:142`,
  Atlas `MapClient.tsx:326`) and focus outline removed (`MapClient.tsx:203`).

**States**
- Missing/weak loading skeletons: 2048 (`Game2048.tsx:54`), Places list
  (`PlacesPanel.tsx:104`), leaderboards (`Polls/Leaderboard.tsx:260`).
- Silent destructive actions: list-edit deletes (`Home.tsx:718`),
  TierBoard category switch/clear (`TierBoard.tsx:182,835`), Priorities reset
  (`PrioritiesApp.tsx:958`), SavedResults delete (`SavedResults.tsx:90`).
- Dead/dangling UI: `SidebarMapTools`, `StopNamePopup`,
  `comingSoon` badge, Compass figure block, Priorities banner dismiss,
  `Coming soon` dead branches, unreachable `!myTurn` alerts.

---

## 19. Prioritised backlog

### P0 — highest leverage, lowest risk
1. **Mount Sonner once in `MainLayout`**; replace `alert`/`confirm` and the
   three custom toasts with `toast` + a shared `<ConfirmDialog>`.
2. **Delete dead code**: `Transit/_components/SidebarMapTools.tsx`,
   studio `StopNamePopup`,
   `Games` `comingSoon` branch, unused Compass `shareResult`/`powers`,
   unused props/imports.
3. **Merge the two Leaderboards** (`Polls`/`TierList`, 405 lines each) and
   **extract `PollDisclaimer`**.
4. **Fix user-visible bugs**: Home events-governorate save + `كل سوريا`;
   Roznama hardcoded method; TierBoard reset filter + silent wipe; GuessWho
   replay; Sites grouped-filter; `هل أنت تأكد` typo; literal `**`/backticks.
5. **Directory primitives**: `<DirectoryHero>`, `<SearchField>`,
   `<CategoryChips>`, `<DirectoryViewToggle>`, `<EmptyState>`, `<SocialLinks>`.

### P1 — high impact
6. One settings entry per page (Prayer/Roznama); extract
   `<PrayerLocationSettings>`; fix the `sz-muslim-*` pref drift.
7. Unify focus mode; add a help dialog + focusable ayahs to the Quran reader.
8. Board: one resize model, tile `⋯` menu, empty state, size clamping.
9. Transit: fold `NearbyTransitDrawer` into `BottomSheet`, add the admin navbar
   link, fix import gating, collapse the 8-button detail grid.
10. Admin primitives: `<AdminPageHeader>`, `<CrudDialog>`, one
    `@dnd-kit <SortableList>`, `<ImageUpload>`, `<SlugInput>`; translate
    `AdminPollManager`; fix its RTL arrow inversions.
11. One corner/notification policy for popup/toaster/mini-player/dev switcher.
12. Compass: collapse result actions, opt-in anonymous stats, radiogroup answers;
    Priorities: one allocation control, wired banner dismiss, fixed radar domain.
13. SyId TOC + colour-format popover + one theme registry; Atlas environmental
    accordion + unified weather icons + discoverable comparison + localised error.

### P2 — polish & consistency
14. Fix RTL physical classes, focus rings, `aria-label`s, `aria-sort`,
    progressbar roles; restore map attribution.
15. Shawarma social badge + legend; Crossings status palette + source popover.
16. About people merge; Privacy/Terms TOC + cross-links + shared update date;
    Stats `frameBorder`; missing OG tags.
17. Unify loading skeletons and destructive confirms everywhere.

### P3 — nice to have
18. In-page TOCs on long content pages; `useMediaQuery` extraction; a shared
    `<WeatherIcon>`; theming the `ui/alert` primitive and TimeseriesChart.

---

## 20. What is already good — do not regress

- The `FiltersBar` coordinates parser and "الانتقال إلى النقطة" option
  (`Places/_components/FilterBar.tsx:20-59,205`).
- RTL keyboard semantics in the photo Lightbox, incl. `aria-disabled` navigation
  (`Places/_components/Lightbox.tsx:56-65,197-219`).
- The Crossings `MapErrorBoundary` keeping the table usable
  (`Crossings/MapErrorBoundary.tsx`).
- `EditPlaceDialog`'s dirty guard on overlay/Escape dismissal — the best dialog
  pattern in the app (`Admin/Places/EditPlaceDialog.tsx:52-57,93-98`).
- Places' stale-response guards and duplicate-check on submit
  (`Places/Index.tsx:49,144,154`, `SubmitSheet.tsx:82-91`).
- Transit admin's `pickNextPendingDraft` queue continuation
  (`Transit/admin/Index.tsx:92-102`).
- Transit studio's login-redirect state restore via localStorage
  (`studio/Index.tsx:449-477`).
- The `QuranUsageCard` two-step inline confirm (a good pattern worth reusing
  instead of `confirm()`).
- `WidgetShell`'s centralised loading/error/empty states.

---

*End of exploration. Nothing here requires removing a feature; each item either
merges duplicate UI, relocates a control, fixes dead/misleading state, or
standardises a pattern.*
