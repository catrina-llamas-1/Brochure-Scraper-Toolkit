// City -> URL slug for the path-form search URL:
//   https://www.cushmanwakefield.com/en/canada/properties/lease/search/{type}/alberta/city-{slug}
//
// Popup defaults per the brief (Edmonton, Leduc, Sherwood Park) plus a
// free-text "add city" field. slugify() handles the free-text case —
// it's a plain kebab-case of whatever the user types, which matches the
// pattern of the known slugs below, but ISN'T verified against the site
// for cities outside the default three. Confirm a new free-text city
// actually resolves (doesn't 404 / doesn't silently show all-Alberta
// results) before relying on it in a saved search.

export const DEFAULT_CITIES = [
  { label: "Edmonton", slug: "edmonton" },
  { label: "Leduc", slug: "leduc" },
  { label: "Sherwood Park", slug: "sherwood-park" },
];

export function slugifyCity(freeTextCityName) {
  return freeTextCityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// province is hardcoded to "alberta" throughout this tool (matches the
// Greater Edmonton scope this was built for). If that ever needs to be
// configurable, it becomes a third saved-search field alongside city and
// property type — not done here since nothing in the brief asked for it.
export const PROVINCE_SLUG = "alberta";
