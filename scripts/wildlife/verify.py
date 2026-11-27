#!/usr/bin/env python3
"""Cross-check resources/data/wildlife.json against public biodiversity databases.

Read-only: it never writes the data file. For every species it checks that

  * the scientific name resolves to an accepted GBIF taxon (exact match),
  * the IUCN category and assessment URL match the IUCN Red List as GBIF mirrors
    it (the Red List site itself refuses scripted requests),
  * GBIF holds occurrence records from Syria (country=SY) — reported, not failed on,
  * the photo's author and license match what Wikimedia Commons records for it.

A mismatch fails the run (exit 1); notes (no Syrian GBIF records, which is
common because GBIF holds few Syrian datasets) are printed but do not.
Run it before every data change and paste its report into the pull request:

    python3 -I scripts/wildlife/verify.py
    python3 -I scripts/wildlife/verify.py --only golden-hamster striped-hyena
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "resources" / "data" / "wildlife.json"
GBIF = "https://api.gbif.org/v1"
COMMONS = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "syrianzone-wildlife-verify/1.0 (+https://syrian.zone/wild)"

# Statuses for which an absence of recent Syrian records is expected, not suspicious.
GONE_OR_RARE = {"uncertain", "possibly-extinct", "extinct-in-syria"}


def get_json(url: str, params: dict[str, str] | None = None) -> dict:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
    return json.loads(body) if body else {}


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", value)).strip()


def check_species(s: dict) -> tuple[list[str], list[str]]:
    problems: list[str] = []
    notes: list[str] = []

    match = get_json(f"{GBIF}/species/match", {"name": s["scientific"], "strict": "true"})
    key = match.get("usageKey")
    if match.get("matchType") != "EXACT" or key is None:
        return [f"scientific name '{s['scientific']}' has no exact GBIF match ({match.get('matchType')})"], notes
    if match.get("status") != "ACCEPTED":
        problems.append(f"GBIF lists '{s['scientific']}' as {match.get('status')}, not an accepted name")

    iucn = get_json(f"{GBIF}/species/{key}/iucnRedListCategory")
    code = iucn.get("code")
    if code is None:
        problems.append("GBIF has no IUCN Red List category for this taxon")
    elif code != s["iucn"]["category"]:
        problems.append(f"IUCN category is {code} on the Red List, the data says {s['iucn']['category']}")

    if iucn.get("usageKey"):
        record = get_json(f"{GBIF}/species/{iucn['usageKey']}")
        assessment = (record.get("references") or "").replace("http://", "https://")
        if assessment and assessment != s["iucn"]["url"]:
            problems.append(f"IUCN assessment URL is {assessment}, the data says {s['iucn']['url']}")

    occurrences = get_json(f"{GBIF}/occurrence/search", {"taxonKey": str(key), "country": "SY", "limit": "0"})
    count = occurrences.get("count", 0)
    if count == 0:
        # GBIF is incomplete for Syria: the published records the data cites
        # are the evidence, so an empty GBIF result is flagged for a human
        # look, never failed on its own.
        expected = s["syriaStatus"] in GONE_OR_RARE
        notes.append("GBIF holds no occurrence record from Syria" + ("" if expected else " — check the Syrian source"))
    else:
        notes.append(f"{count} GBIF occurrence record(s) from Syria")

    info = get_json(
        COMMONS,
        {
            "action": "query",
            "format": "json",
            "titles": f"File:{s['image']['commonsFile']}",
            "prop": "imageinfo",
            "iiprop": "extmetadata",
            "iiextmetadatafilter": "LicenseShortName|Artist",
        },
    )
    page = next(iter(info.get("query", {}).get("pages", {}).values()), {})
    if "missing" in page or not page.get("imageinfo"):
        problems.append(f"Commons has no file '{s['image']['commonsFile']}'")
    else:
        meta = page["imageinfo"][0]["extmetadata"]
        license_name = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
        artist = strip_html(meta.get("Artist", {}).get("value", ""))
        if license_name != s["image"]["license"]:
            problems.append(f"photo license is '{license_name}' on Commons, the data says '{s['image']['license']}'")
        if s["image"]["author"] not in artist:
            problems.append(f"photo author is '{artist}' on Commons, the data says '{s['image']['author']}'")

    return problems, notes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="*", metavar="SLUG", help="check only these species")
    args = parser.parse_args()

    species = json.loads(DATA.read_text(encoding="utf-8"))["species"]
    if args.only:
        species = [s for s in species if s["slug"] in set(args.only)]

    failed = 0
    for s in species:
        try:
            problems, notes = check_species(s)
        except Exception as error:  # a network failure is a failed check, never a pass
            problems, notes = [f"could not be checked: {error}"], []
        mark = "FAIL" if problems else "ok"
        print(f"[{mark}] {s['slug']} ({s['scientific']})")
        for line in problems:
            print(f"    ✗ {line}")
        for line in notes:
            print(f"    · {line}")
        failed += bool(problems)

    print(f"\n{len(species) - failed}/{len(species)} species verified.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
