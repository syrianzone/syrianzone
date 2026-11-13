# Accessibility Standards

Normative accessibility conventions for the whole app. Every change that adds or
edits UI is expected to follow these. The automated gate is
[`scripts/a11y_axe_audit.py`](../../scripts/a11y_axe_audit.py).

> **Why a document at all:** a11y drifts silently — a control loses its label, a
> page loses its heading, a colour pair falls below 4.5:1 in one theme. This file
> is the human/LLM-readable rulebook; the axe sweep is the machine check that
> keeps the rulebook honest.

## Non-negotiables (check these first)

1. **Every page has one `<main>` and one `<h1>`.** `<main id="main-content">` is
   rendered once by `Components/ConditionalLayout.tsx`; never add a second
   `<main>` in a page (use a `<div>`). A page with no visible title gets an
   `<h1 className="sr-only">`.
2. **Nothing is icon-only without an accessible name.** Use `aria-label` (mirror
   `title` when you have one); `title` alone is a weak name and invisible on
   touch.
3. **No native `alert()` / `confirm()`.** Use `Lib/notify.ts` and
   `Lib/confirm.ts` (`confirmDialog()`).
4. **Colour comes from tokens, never hardcoded.** A literal hex is a bug: it
   breaks the nine themes and the contrast guarantees.
5. **RTL uses logical utilities.** `ms/me/ps/pe`, `start/end`, `border-s/e` —
   never `ml/mr/pl/pr`, `left/right`, `text-left/right` outside a deliberate
   `dir="ltr"` island.
6. **Reuse the shared primitives.** Do not write a second dialog, toast, chip,
   tab set, image-uploader or search field — see [overlapping abstractions](#avoid-overlapping-abstractions).

## Structure & screen-reader navigation

| Concern | Where | Rule |
|---|---|---|
| Main landmark | `Components/ConditionalLayout.tsx` | one `<main id="main-content" tabIndex={-1}>` |
| Skip link | same | first focusable element; `href="#main-content"` |
| Route announcement | `Components/RouteAnnouncer.tsx` | focuses `#main-content` and announces the title on Inertia navigation |
| Headings | each page | one `h1`, then `h2`/`h3` without skips (no `h1 → h3`) |
| Dynamic updates | per component | `role="status"`/`aria-live="polite"` for result counts and loading; `aria-busy` on shells |

The axe `heading-order` and `region` rules (best-practice) will flag regressions
here. Keep decorative chrome (popups, toasts, mini-players) inside a landmark
role (`role="region"` + `aria-label`) or it counts as "content outside landmarks".

## Feedback & confirmation

- **Outcomes** (saved, deleted, copied, failed) → `notify.success/error/info/warning/copy`.
  The `<Toaster>` is mounted once in `Layouts/MainLayout.tsx`; never mount another.
- **Confirmations** → `await confirmDialog({ title, description, destructive })`
  from `Lib/confirm.ts` (renders `Components/ConfirmHost.tsx`). Never
  `window.confirm`.
- **Contextual messages** (form errors, disclaimers) → inline `<Alert>` from
  `Components/ui/alert.tsx` (`default | destructive | success | warning`).
  Errors that belong to a field get `role="alert"`.

## Forms

- Every control has a programmatic name: a `<Label htmlFor>` + `id`, or
  `aria-label`. A placeholder is **not** a label.
- On error: `aria-invalid` on the control, `aria-describedby` pointing at the
  error node, and the error node carries `role="alert"` (see
  `Pages/Places/_components/SubmitSheet.tsx` for the pattern).
- Identity/URL fields set `autoComplete` (`name`, `email`, `url`).
- Select triggers (`SelectTrigger`) need `aria-label` — the value placeholder
  does not name them.

## Interactive widgets

- **Tabs / segmented switchers** → `Lib/useTabList.ts`. It wires
  `role=tablist/tab/tabpanel`, roving `tabIndex`, and RTL-aware
  ArrowLeft/ArrowRight + Home/End. Applied in GuessWho, House (archive) and
  TierBoard. Do not hand-roll `aria-pressed` toggles for a real tab set.
- **Filter chips** → `Components/ui/filter-chip.tsx` (a real `<button>` with
  `aria-pressed`), never `<Badge onClick>`.
- **Comboboxes** → `role="combobox"` + `aria-expanded` + `aria-controls` +
  `aria-activedescendant`; see `Pages/Places/_components/FilterBar.tsx` and
  `Pages/Transit/_components/citymap/GlobalSearchBox.tsx`.
- **Icon-only buttons** → `aria-label`.
- **No nested interactive elements** — a `role="button"` card must not contain a
  `<button>`; move the inner control out as a sibling (see `TierBoard.tsx`).
- **Maps** are canvases: provide a keyboard-operable equivalent (a list of
  selectable features that triggers the same selection). See the Atlas province
  table (`role="checkbox"` buttons) and the Transit route sidebar.
- **Scrollable regions** with no focusable content need `tabIndex={0}` (handled
  centrally in `Components/ui/scroll-area.tsx`).

## RTL

- The document is RTL by default (`<html dir="rtl">`, `<DirectionProvider>`).
- Use logical properties everywhere. The only exceptions are deliberate LTR
  islands (`dir="ltr"` on times, slugs, URLs, code) and library internals.
- Watch for: icon order, absolute corners (`start/end` not `left/right`),
  progress bars, and back-chevron direction.
- The sweep that fixed the first pass: 44 physical margin/padding utilities and
  the positioning bugs in the dev switcher and notification popup.

## Theming & contrast

- Nine themes are attributes (`data-theme` for which theme, `data-scheme` for
  `light`/`dark`), not classes. Tokens are HSL CSS
  variables (`--background`, `--primary`, `--primary-foreground`, …).
- **`--primary-foreground` must contrast with `--primary` in every theme.** The
  `damascus-rose` theme shipped white-on-rose at 3.9:1 (fails AA); the fix was a
  dark `--primary-foreground` for that dark theme. When you touch a theme, check
  both directions: `bg-primary` + `text-primary-foreground` **and**
  `text-primary` on the theme background.
- Prefer tinted surfaces (`bg-primary/5 text-primary`) over solid
  `bg-primary text-primary-foreground` for small text.

## Motion

- Respect `prefers-reduced-motion`: `resources/css/app.css` has a catch-all that
  neutralises Tailwind `animate-*` and transitions. Don't add animations that
  bypass it with inline styles.

## Touch targets

- Interactive icon buttons should be ≥36px and ideally 44px. The 28px
  (`h-7`) ones were bumped; avoid reintroducing sub-32px targets.

## The automated gate

```bash
# requires a running app on :8000
python3 scripts/a11y_axe_audit.py --base http://localhost:8000        # public routes
python3 scripts/a11y_axe_audit.py --base http://localhost:8000 --admin # + admin panels
```

- Runs axe-core (WCAG 2.0/2.1 A+AA **and** best-practice) over every page the app renders: 40 public routes, plus 19 admin routes with `--admin`.
- **Blocks on WCAG serious/critical findings that reproduce across two passes**
  (a live clock can otherwise cause a one-off contrast hit). Best-practice rules
  (`region`, `heading-order`) are reported but advisory.
- **Fails closed.** Before auditing it checks that `--base` really serves this
  app (`lang="ar"`, `dir="rtl"`, the `<main id="main-content">` landmark);
  otherwise it refuses and exits 1 — a dev server on the wrong port, a fresh
  install or a proxy error page would otherwise produce a clean sweep of nothing.
  A route that errors, answers non-2xx (including a renamed route's 404) or
  cannot be reached fails the run instead of being skipped, as does an
  `--admin` run that cannot impersonate, and a run that audits zero routes.
- Exit code 1 when a blocking violation remains or the sweep could not audit
  what it was asked to. Current state: **0 violations**.
- It injects axe from the CDN unless `--axe ./axe.min.js` is given; it uses the
  system chromium (`--executable` to override).

## Manual pass (when automation can't see it)

Automated tools miss: focus order, reading order of complex widgets, whether a
live region is *useful*, and screen-reader phrasing. For new interactive
surfaces, tab through them with a screen reader (VoiceOver/NVDA) and confirm:
focus lands somewhere sensible on navigation, every control is reachable and
named, and dynamic changes are announced.

## Definition of done for a UI change

- [ ] One `h1`; content inside the shared `<main>`.
- [ ] Every control named; icon-only buttons have `aria-label`.
- [ ] Outcomes via `notify`; destructive actions via `confirmDialog`.
- [ ] Field errors wired with `aria-invalid`/`aria-describedby`/`role="alert"`.
- [ ] Logical RTL utilities; no hardcoded colours; tokens only.
- [ ] Real tabs/chips/comboboxes use the shared primitives, not ad-hoc ARIA.
- [ ] `axe` sweep still reports 0; `tsc`/`vitest` unaffected.
