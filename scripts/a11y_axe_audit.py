#!/usr/bin/env python3
"""Accessibility audit for the Syrian Zone app.

Runs axe-core (WCAG 2.0/2.1 A + AA) against the app's main routes and prints a
per-route summary of violations, grouped by impact. Exits non-zero when any
serious/critical violation is found, so it can gate CI.

The gate fails closed: it refuses to run against a target that does not answer
as this app, and a route that errors, answers non-2xx or cannot be reached
fails the run instead of being skipped, so an empty or broken sweep can never
exit 0.

Usage:
    python3 scripts/a11y_axe_audit.py
    python3 scripts/a11y_axe_audit.py --base http://localhost:8000 --axe ./axe.min.js

Requirements: `pip install playwright` + a chromium (system chromium is used by
default; override with --executable). axe-core is fetched from the CDN unless
--axe points at a local copy.
"""
from __future__ import annotations
import os

import argparse
import asyncio
import sys

# Routes to audit. Public routes first; the dev impersonation route (if reachable)
# is visited before admin routes so a session cookie is present.
#
# Every route that renders an Inertia page must appear in one of these lists or
# in the exclusion list of tests/Feature/Tooling/A11yRouteCoverageTest.php, which
# reads this file: a new page fails that test until it is either swept or
# excluded there with a reason.
PUBLIC_ROUTES = [
    "/", "/about", "/privacy", "/terms", "/stats",
    "/syofficial", "/phonebook", "/govapps", "/party", "/house",
    "/justice", "/sites", "/syrian-contributors", "/syid", "/atlas",
    "/crossings", "/shawarma", "/roznama", "/priorities", "/alignment",
    "/compass", "/tierlist", "/polls", "/guesswho", "/muslim",
    "/muslim/prayer", "/muslim/quran", "/muslim/radio",
    "/games", "/games/2048", "/games/solitare", "/board",
    "/mishwar", "/transit", "/transit/studio",
    "/promises", "/promises/suggest",
]
ADMIN_ROUTES = [
    "/dashboard", "/admin/govapps", "/admin/phonebook", "/admin/syofficial",
    "/admin/guesswho", "/admin/assets", "/admin/navigation", "/admin/places",
    "/admin/site-popup", "/transit/admin",
    "/admin/promises", "/admin/promises/new", "/admin/promises/review",
    "/admin/promises/speakers", "/admin/promises/sectors",
]

AXE_AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"

# How the app identifies itself. A dev server on the wrong port, a fresh
# Laravel install or a proxy error page all answer 200 with plausible HTML, and
# every finding there is noise: the sweep checks these once before it starts.
APP_LANG = "ar"
APP_DIRECTION = "rtl"
APP_MAIN_ID = "main-content"


class AuditError(RuntimeError):
    """A route could not be audited: the run must not pass."""


def load_axe(source_path: str | None) -> str:
    if source_path:
        with open(source_path, encoding="utf-8") as fh:
            return fh.read()

    import urllib.request
    print("Downloading axe-core once...")
    with urllib.request.urlopen(AXE_CDN, timeout=30) as resp:
        return resp.read().decode("utf-8")


async def assert_target_is_the_app(page, url: str) -> None:
    """Fail unless `url` renders this app's document shell."""
    response = await page.goto(url, wait_until="networkidle", timeout=45000)
    status = response.status if response is not None else None

    if status is None or not 200 <= status < 300:
        raise AuditError(f"{url} answered {status or 'no response'}, not the app")

    # The app may render on the client (no SSR process running), so the
    # landmark only exists once React has mounted.
    has_main = True
    try:
        await page.wait_for_selector(f"main#{APP_MAIN_ID}", timeout=15000)
    except Exception:  # noqa: BLE001 - a missing landmark is a refusal, not a crash
        has_main = False

    document = await page.evaluate(
        """() => ({
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
        })"""
    )

    problems = []
    if not (document["lang"] or "").startswith(APP_LANG):
        problems.append(f'lang="{document["lang"]}" (expected "{APP_LANG}")')
    if document["dir"] != APP_DIRECTION:
        problems.append(f'dir="{document["dir"]}" (expected "{APP_DIRECTION}")')
    if not has_main:
        problems.append(f"no <main id=\"{APP_MAIN_ID}\"> landmark")

    if problems:
        raise AuditError(f"{url} is not this app: " + ", ".join(problems))


async def audit(page, url: str, axe_source: str | None, axe_url: str) -> list[dict]:
    response = await page.goto(url, wait_until="networkidle", timeout=45000)
    status = response.status if response is not None else None
    if status is None:
        # Without a status the page may be a browser error document, and axe
        # would happily report a clean sweep for it.
        raise AuditError("the navigation returned no response")
    if not 200 <= status < 300:
        raise AuditError(f"HTTP {status}")

    await page.wait_for_timeout(2500)
    # Inject axe once per navigation (SPA nav keeps window.axe, but full load resets).
    if await page.evaluate("() => typeof window.axe === 'undefined'"):
        if axe_source is not None:
            await page.add_script_tag(content=axe_source)
        else:
            await page.add_script_tag(url=axe_url)
    async def run_once():
        return await page.evaluate(
            """async (tags) => {
                return await axe.run(document, {
                    runOnly: { type: 'tag', values: tags },
                    resultTypes: ['violations'],
                });
            }""",
            AXE_AXE_TAGS,
        )

    result = await run_once()
    violations = result.get("violations", [])

    # Live-updating UI (clocks, countdowns) can produce a transient contrast hit.
    # If a serious/critical WCAG rule fires, re-scan once and keep the second
    # result, so the gate reflects a stable defect rather than a race.
    def serious(v: dict) -> bool:
        wcag = {"wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"}
        return v.get("impact") in ("serious", "critical") and bool(
            wcag.intersection(v.get("tags") or [])
        )

    if any(serious(v) for v in violations):
        await page.wait_for_timeout(1500)
        second = (await run_once()).get("violations", [])

        def key(v: dict):
            return (v.get("id"), tuple(n.get("target", [])[0] if n.get("target") else "" for n in v.get("nodes", [])))

        second_keys = {key(v) for v in second}
        # Keep non-serious findings from the first pass, but require serious
        # ones to reproduce on the second pass (filters live-update races).
        violations = [v for v in violations if not serious(v) or key(v) in second_keys]
    return violations


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--axe", default=None, help="path to a local axe.min.js")
    ap.add_argument("--executable", default="/usr/bin/chromium")
    ap.add_argument("--admin", action="store_true", help="also audit admin routes")
    args = ap.parse_args()

    from playwright.async_api import async_playwright

    total = 0
    audited = 0
    offenders: list[tuple[str, dict]] = []
    # Routes the sweep could not audit at all. They fail the run: a gate that
    # skips what it cannot read reports a clean sweep it never performed.
    failures: list[str] = []

    async with async_playwright() as p:
        import glob
        candidates = [args.executable] + sorted(
            glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")),
            reverse=True,
        ) + sorted(
            glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")),
            reverse=True,
        )
        browser = None
        for exe in candidates:
            if exe and os.path.exists(exe):
                try:
                    browser = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
                    break
                except Exception:
                    continue
        if browser is None:
            browser = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await ctx.new_page()

        try:
            await assert_target_is_the_app(page, args.base + PUBLIC_ROUTES[0])
        except Exception as exc:  # noqa: BLE001 - any failure here is a refusal
            print(f"! refusing to audit {args.base}: {str(exc)[:200]}")
            await browser.close()
            return 1

        axe_source = load_axe(args.axe)

        routes = list(PUBLIC_ROUTES)
        if args.admin:
            impersonate = f"{args.base}/dev/impersonate/superadmin"
            try:
                response = await page.goto(impersonate, wait_until="networkidle")
                status = response.status if response is not None else None
                if status is None or not 200 <= status < 300:
                    raise AuditError(f"HTTP {status or 'no response'}")
            except Exception as exc:  # noqa: BLE001
                print(f"  !  /dev/impersonate/superadmin ERROR {str(exc)[:80]}")
                print("! admin routes were asked for but cannot be reached as a superadmin")
                failures.append(impersonate)
            else:
                routes += ADMIN_ROUTES

        if not routes:
            print("! no routes to audit")
            await browser.close()
            return 1

        for route in routes:
            url = args.base + route
            try:
                violations = await audit(page, url, axe_source, AXE_CDN)
            except Exception as exc:  # noqa: BLE001
                print(f"  !  {route:32s} ERROR {str(exc)[:80]}")
                failures.append(route)
                continue
            audited += 1
            by_impact: dict[str, int] = {}
            for v in violations:
                by_impact[v.get("impact") or "unknown"] = by_impact.get(v.get("impact") or "unknown", 0) + 1
            total += len(violations)
            status = "OK " if not violations else "FAIL"
            counts = ", ".join(f"{k}:{n}" for k, n in sorted(by_impact.items())) or "0"
            print(f"  {status} {route:32s} {len(violations)} violations ({counts})")
            for v in violations:
                offenders.append((route, v))

        await browser.close()

    print(f"\nAudited {audited} of {len(routes)} route(s). Total violations: {total}")
    if offenders:
        print("\nRules triggered:")
        seen: dict[str, set[str]] = {}
        for route, v in offenders:
            seen.setdefault(v["id"], set()).add(route)
        for rule, routeset in sorted(seen.items(), key=lambda kv: -len(kv[1])):
            print(f"  {rule:28s} on {len(routeset)} route(s): {', '.join(sorted(routeset)[:6])}")

    # Gate on WCAG-tagged serious/critical only. axe's best-practice rules
    # (region, heading-order, ...) are advisory: reported above but not blocking.
    wcag_tags = {"wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"}
    def is_blocking(v: dict) -> bool:
        return v.get("impact") in ("serious", "critical") and bool(
            wcag_tags.intersection(v.get("tags") or [])
        )
    blocking = [v for _, v in offenders if is_blocking(v)]
    advisory = [v for _, v in offenders if not is_blocking(v)]
    print(f"Blocking (WCAG serious/critical): {len(blocking)}   Advisory (best-practice/minor): {len(advisory)}")

    if audited == 0:
        print("! the sweep audited no route at all, so it proves nothing")
        return 1
    if failures:
        print(f"! {len(failures)} route(s) could not be audited: {', '.join(failures)}")
        return 1
    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
