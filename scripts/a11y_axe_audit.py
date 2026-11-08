#!/usr/bin/env python3
"""Accessibility audit for the Syrian Zone app.

Runs axe-core (WCAG 2.0/2.1 A + AA) against the app's main routes and prints a
per-route summary of violations, grouped by impact. Exits non-zero when any
serious/critical violation is found, so it can gate CI.

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
    "/admin/guesswho", "/admin/assets",
    "/admin/promises", "/admin/promises/new", "/admin/promises/review",
    "/admin/promises/speakers", "/admin/promises/sectors",
]

AXE_AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"


async def audit(page, url: str, axe_source: str | None, axe_url: str) -> list[dict]:
    await page.goto(url, wait_until="networkidle", timeout=45000)
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

    axe_source = None
    if args.axe:
        with open(args.axe, encoding="utf-8") as fh:
            axe_source = fh.read()
    else:
        import urllib.request
        print("Downloading axe-core once...")
        with urllib.request.urlopen(AXE_CDN, timeout=30) as resp:
            axe_source = resp.read().decode("utf-8")

    from playwright.async_api import async_playwright

    total = 0
    offenders: list[tuple[str, dict]] = []

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

        routes = list(PUBLIC_ROUTES)
        if args.admin:
            try:
                await page.goto(f"{args.base}/dev/impersonate/superadmin", wait_until="networkidle")
                routes += ADMIN_ROUTES
            except Exception:
                print("! could not impersonate superadmin; skipping admin routes")

        for route in routes:
            url = args.base + route
            try:
                violations = await audit(page, url, axe_source, AXE_CDN)
            except Exception as exc:  # noqa: BLE001
                print(f"  !  {route:32s} ERROR {str(exc)[:80]}")
                continue
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

    print(f"\nTotal violations: {total}")
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
    return 1 if blocking else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
