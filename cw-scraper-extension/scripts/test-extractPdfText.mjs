// Throwaway test runner, not part of the extension or CI.
import assert from "node:assert/strict";

function item(str, x, width, y, fontSize = 10) {
  return { str, transform: [fontSize, 0, 0, fontSize, x, y], width };
}

function mockPdfjsLib(pagesSpec) {
  // pagesSpec: array of either {items: [...]} or {throws: "message"}
  return {
    getDocument: ({ data }) => ({
      promise: Promise.resolve({
        numPages: pagesSpec.length,
        getPage: (pageNum) => {
          const spec = pagesSpec[pageNum - 1];
          if (spec.throws) return Promise.reject(new Error(spec.throws));
          return Promise.resolve({
            getTextContent: () => Promise.resolve({ items: spec.items }),
          });
        },
      }),
    }),
  };
}

const { extractPdfText } = await import("../src/pdf/extractPdfText.js");

// --- Test 1: two-page PDF, both with text, page markers present ---
{
  global.pdfjsLib = mockPdfjsLib([
    { items: [item("Hello", 0, 25, 700), item("World", 30, 28, 700)] }, // gap=5 -> space in both plain and lines
    { items: [item("Page", 0, 25, 700), item("Two", 30, 22, 700)] },
  ]);
  const result = await extractPdfText(new ArrayBuffer(8));

  assert.equal(result.pages.length, 2);
  assert.deepEqual(result.pages[0], { page: 1, item_count: 2, image_only: false });
  assert.deepEqual(result.pages[1], { page: 2, item_count: 2, image_only: false });
  assert.ok(result.plain.includes("[page 1]"));
  assert.ok(result.plain.includes("[page 2]"));
  assert.ok(result.plain.includes("Hello World"));
  assert.ok(result.plain.includes("Page Two"));
  assert.ok(result.lines.includes("Hello World"));
  console.log("Test 1 (two-page PDF, both with text) PASSED");
}

// --- Test 2: image-only page (zero text items) ---
{
  global.pdfjsLib = mockPdfjsLib([{ items: [] }]);
  const result = await extractPdfText(new ArrayBuffer(8));

  assert.equal(result.pages.length, 1);
  assert.deepEqual(result.pages[0], { page: 1, item_count: 0, image_only: true });
  assert.ok(result.plain.includes("image_only"));
  assert.ok(result.lines.includes("image_only"));
  console.log("Test 2 (image-only page marked, not an error) PASSED");
}

// --- Test 3: a page that throws doesn't crash extraction of the rest ---
{
  global.pdfjsLib = mockPdfjsLib([
    { items: [item("Good page", 0, 50, 700)] },
    { throws: "corrupt content stream" },
    { items: [item("Also good", 0, 50, 700)] },
  ]);
  const result = await extractPdfText(new ArrayBuffer(8));

  assert.equal(result.pages.length, 3);
  assert.equal(result.pages[0].image_only, false);
  assert.equal(result.pages[1].image_only, true);
  assert.equal(result.pages[1].error, "corrupt content stream");
  assert.equal(result.pages[2].image_only, false);
  assert.ok(result.plain.includes("Good page"));
  assert.ok(result.plain.includes("failed to process: corrupt content stream"));
  assert.ok(result.plain.includes("Also good"));
  console.log("Test 3 (one bad page doesn't abort the rest of the PDF) PASSED");
}

// --- Test 4: `lines` actually uses real line-grouping (column separator), `plain` doesn't ---
{
  global.pdfjsLib = mockPdfjsLib([
    {
      items: [
        item("Suite 100", 0, 50, 700),
        item("1,200 SF", 70, 40, 700), // gap=20 -> column separator in lines, plain space in naive plain
      ],
    },
  ]);
  const result = await extractPdfText(new ArrayBuffer(8));
  assert.ok(result.lines.includes("Suite 100 | 1,200 SF"), `lines should preserve column structure: ${result.lines}`);
  assert.ok(!result.plain.includes(" | "), `plain (naive) should NOT have column separators: ${result.plain}`);
  console.log("Test 4 (lines preserves table structure, plain is naive concatenation) PASSED");
}

console.log("\nALL extractPdfText.js TESTS PASSED");
