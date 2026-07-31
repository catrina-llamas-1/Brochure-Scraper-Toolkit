# Selector reference / brittle points

Where to look first if the site changes and something starts failing.
Filled in as selectors are confirmed during implementation — this is a
placeholder for now (matches this project's current stub-only state).

## Confirmed by the brief (do not re-derive)

| What | Rule |
|---|---|
| Listing card link | `<a href>` containing `/properties/for-lease/` |
| Pagination | append `?page=N` to the **path-form** URL only — see `src/discover/discoverListings.js` header comment for why the query-string multi-city form can't paginate |
| `property_id` | from `<meta property="og:image">`, URL contains `/pmedia/{id}/` |
| Brochure link | `<a href>` matching `assets.cushmanwakefield.com/-/pmedia/{id}/0/{filename}.pdf?rev=...` |

## NOT yet confirmed — needs a live-HTML inspection pass before `parseDetailPage.js` is implemented

The brief names these fields but not their exact markup:
- `<h1>` title (straightforward, low risk)
- Labelled fields: Available Space, Rental Price, Max Contiguous, Min
  Divisible — exact container/class unknown
- Broker contact block: name, title, office, profile link — exact
  structure unknown

Recommended approach when implementation starts: same inspect-first method
used on the sibling Python-scraper project in this repo (`scraper/inspect_html.py`)
— fetch one real detail page, dump the actual DOM around these fields,
confirm selectors against real markup before writing `parseDetailPage.js`.
Do not guess class names here either.

## Property type / city slugs — partially unverified

See `src/config/propertyTypes.js` — only `office` is confirmed (it's the
brief's own example URL). `retail` and `industrial` are unverified guesses.
Confirm each resolves to a real filtered results page (not a 404, not a
silent fallback to "all types") before using it in a saved search.
