# scripts/

Two kinds of files here, neither part of the shipped extension:

**Live-inspection scripts** (`inspect_*.py`, `inspect_*.console.js`) — run
against the real site to confirm markup before writing/trusting a
selector. See `docs/SELECTORS.md` for what each has already confirmed.

**Test scripts** (`test-*.mjs`) — fixture-based checks for each
implemented `src/**` module (mocked `fetch`/`DOMParser`/`pdfjsLib`, no
network or real PDF/browser needed). Run them all:

```bash
npm install --no-save jsdom   # only needed for tests that parse HTML
node scripts/test-fetchWithRetry.mjs
node scripts/test-discoverListings.mjs
node scripts/test-parseDetailPage.mjs
node scripts/test-lineGrouping.mjs
node scripts/test-extractPdfText.mjs
```

`jsdom` is a throwaway dev dependency for these tests only (provides
`DOMParser` outside a real browser) — not vendored, not shipped, not
saved to `package.json`. Remove `node_modules/`/`package-lock.json`
afterward; they're gitignored but no reason to leave them lying around.
