# vendor/

Not yet populated. This extension has no build step, so `pdf.js` and
`SheetJS` are vendored as plain files here rather than imported from
`node_modules` at runtime.

Needed before the extension can run:
- `pdf.js` (or `pdf.min.mjs`) — from `pdfjs-dist` (see `package.json`)
- `pdf.worker.min.js` — from the same package; referenced via
  `pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.js')`
- `xlsx.full.min.js` — from the `xlsx` (SheetJS) package

Setup (once `npm install` has been run in this directory):
```
cp node_modules/pdfjs-dist/build/pdf.min.mjs vendor/pdf.js
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs vendor/pdf.worker.min.js
cp node_modules/xlsx/dist/xlsx.full.min.js vendor/xlsx.full.min.js
```

Exact filenames depend on the installed package version — verify against
`node_modules/pdfjs-dist/build/` and `node_modules/xlsx/dist/` once
installed, and update the copy step / worker.html script tags to match.

Not committing these to git in this pass — vendoring happens once
extraction logic is implemented and there's something to test against.
