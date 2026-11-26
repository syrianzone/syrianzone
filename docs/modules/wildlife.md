# Wildlife guide (`/wild`)

A reference guide to the mammals, birds, reptiles and other wildlife of Syria:
what each species is, where in the country it has been recorded, how it stands
in Syria, and its global IUCN Red List category. The guide's value is that it is
**accurate**, so the rules below matter more than the code.

## Where things live

| Piece | Path |
|---|---|
| The data (one record per species) | `resources/data/wildlife.json` |
| Page props (a card per species for the hub, one record plus three related cards for a species page, the species of a governorate) | `app/Services/Wildlife/WildlifeData.php` |
| Types, labels, helpers (the JSON is not bundled) | `resources/js/Domain/wildlife/wildlife.ts` |
| Hub and species pages | `resources/js/Pages/Wild/Index.tsx`, `Show.tsx`, `_components/` |
| Routes (404 on an unknown slug) | `WildlifeController` (`/wild`, `/wild/{slug}`) |
| Share preview, JSON-LD (`Taxon`, the hub's `ItemList`) and record card | `app/Support/Seo/Preview/Resolvers/WildSpeciesPreview.php` |
| Sitemap and image-sitemap entries | `SitemapBuilder::wildlifeUrls()`, `ImageSitemapBuilder::wildlifeImages()` |
| "Wildlife recorded here" on each governorate page | `GovernorateDataService` (`wildlife` prop) |
| Data rules, as tests | `tests/Feature/WildlifeDataTest.php`, `tests/Feature/WildlifeRoutesTest.php` |
| Cross-check against GBIF, the Red List and Commons | `scripts/wildlife/verify.py` |
| Copy the photos to R2 | `php artisan wildlife:mirror-images` |

## Sourcing rules

1. **Nothing from memory.** Every sentence on a species page (the summary,
   each fact, each threat) carries `sources`: indexes into that species'
   `sources` list. The page renders them as numbered citations. A statement no
   listed source supports does not go in.
2. **At least two sources per species**, one of them Syria-specific where one
   exists. In order of authority:
   - the **IUCN Red List** for the global category. Link the exact assessment
     (`https://www.iucnredlist.org/species/{taxonId}/{assessmentId}`);
     `verify.py` reads both the category and the URL from GBIF's mirror of the
     Red List, because the Red List site refuses scripted requests;
   - **Syria-specific literature** for status and distribution in Syria. For
     mammals start with Aidek et al. (2025), *Checklist of Mammals of Syria*,
     Zootaxa 5580(1): 1–130 (https://doi.org/10.11646/zootaxa.5580.1.1). Every
     species account in it is a Plazi treatment, citable on its own as
     `https://treatment.plazi.org/id/{id}`. For birds start with Aidek et al.
     (2025), *An annotated checklist of the birds of Syria*, Jordan Journal of
     Natural History 12(1): 12–97
     (https://www.rscn.org.jo/uploaded_files/journal/6987078a1acb61770456970.pdf),
     and use Murdoch & Betton (2008) for the older detail it does not repeat.
     For turtles and tortoises, Aidek et al. (2024), Zootaxa 5506(2).
     Use field papers (Oryx, Zootaxa, Journal of Zoology, …) for the rest;
   - **GBIF** occurrence records to confirm a species has been recorded in Syria;
   - reputable reporting by a named scientist (e.g. a Mongabay analysis) only
     for recent events that the literature has not covered yet.
   Wikipedia is never cited. Use it only to find primary sources and to check
   Arabic common names (through Wikidata labels).
3. **Say what the sources say, no more.** If the sources disagree or are old,
   say so (`statusNoteAr`, `iucnNoteAr`). If the status in Syria is not
   established, use `uncertain`. Use `possibly-extinct` when the latest
   published work says a population is functionally extinct but cannot rule out
   survivors, and `extinct-in-syria` only when a source says so outright.
   Keep the source's hedges ("may", "probably", "apparently", "at best")
   in the Arabic, and date the status statements by the list they come from
   ("بحسب قائمة 2025", "بحسب قائمة 2008") instead of writing them in the
   present tense. When the 2025 bird checklist updates a 2008 statement, the
   status follows the newer source and the older figure stays only with its
   date.
4. **The global category is not the Syrian status.** The brown bear is Least
   Concern worldwide and close to gone from Syria. The data keeps the two apart
   (`iucn.category` and `syriaStatus`), and `iucnNoteAr` says so where readers
   could confuse them.
5. **`governorates`** lists the governorates in which the cited sources place a
   documented record, past or recent. The page labels them as former records
   when the species is gone from Syria.
6. **Photos** come from Wikimedia Commons under CC0, public domain, CC BY or
   CC BY-SA, with the author and license copied exactly from the file page
   (`verify.py` compares them). The caption says where the photo was taken when
   that was not Syria, or that the animal is captive, mounted or a pet.
7. **`lastReviewed`** is the date the record was last checked against its
   sources. Update it whenever you touch the record.

## Adding or correcting a species

1. Collect the sources, read them, and write the record in
   `resources/data/wildlife.json`. Arabic copy follows the site's Arabic guide.
2. `python3 -I scripts/wildlife/verify.py --only <slug>` must report no
   mismatch. Paste its output into the pull request.
3. `vendor/bin/pest tests/Feature/WildlifeDataTest.php tests/Feature/WildlifeRoutesTest.php`.
4. A second person reviews each new or changed record against its sources
   before merge.
5. Before launch and after each merge that adds a photo,
   `php artisan wildlife:mirror-images --write` copies it to R2 at 500, 960
   and 1280 px (`IMAGE_WIDTHS`) and records its `r2Key`. Until then the pages
   load the photo from Commons, the share card is drawn with the guide's icon
   instead of the photo, and the photo is left out of the image sitemap.

Readers report errors through the "أبلغ عن خطأ" link on each species page,
which opens a prefilled GitHub issue naming the species and its review date.
