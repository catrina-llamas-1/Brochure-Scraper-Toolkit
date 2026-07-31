// Throwaway test runner, not part of the extension or CI.
import assert from "node:assert/strict";
import { groupTextItemsIntoLines } from "../src/pdf/lineGrouping.js";

// helper: font height 10 -> estimated space width = 10 * 0.3 = 3
// so: gap < 3 -> no separator, 3 <= gap < 12 -> space, gap >= 12 -> column
function item(str, x, width, y, fontSize = 10) {
  return { str, transform: [fontSize, 0, 0, fontSize, x, y], width };
}

// --- Test 1: normal sentence, ordinary word-gap spacing ---
{
  const items = [item("Hello", 0, 25, 700), item("World", 30, 28, 700), item("Test", 63, 20, 700)];
  // gaps: 30-25=5 (space), 63-58=5 (space)
  const result = groupTextItemsIntoLines(items);
  assert.equal(result, "Hello World Test");
  console.log("Test 1 (normal word spacing) PASSED");
}

// --- Test 2: kerning-split word, near-zero gap -> no separator ---
{
  const items = [item("He", 0, 10, 700), item("llo", 10.5, 15, 700)]; // gap = 0.5, well below spaceWidth=3
  const result = groupTextItemsIntoLines(items);
  assert.equal(result, "Hello");
  console.log("Test 2 (kerning-split word joins without space) PASSED");
}

// --- Test 3: table row, large gaps -> column separators ---
{
  const items = [
    item("Suite 100", 0, 50, 700),
    item("1,200 SF", 70, 40, 700), // gap = 70-50=20 >= 12 -> column
    item("$18.00/SF", 150, 45, 700), // gap = 150-110=40 >= 12 -> column
  ];
  const result = groupTextItemsIntoLines(items);
  assert.equal(result, "Suite 100 | 1,200 SF | $18.00/SF");
  console.log("Test 3 (table row -> column separators, not spaces) PASSED");
}

// --- Test 4: multiple lines, fed out of order, sorted top-to-bottom ---
{
  const lineB = item("Second line", 0, 60, 680); // lower y = further down the page
  const lineA = item("First line", 0, 55, 700); // higher y = nearer the top
  const result = groupTextItemsIntoLines([lineB, lineA]); // deliberately reversed input order
  assert.equal(result, "First line\nSecond line");
  console.log("Test 4 (multi-line, out-of-order input still sorts top-to-bottom) PASSED");
}

// --- Test 5: y-tolerance boundary (default tolerance = 3) ---
{
  const items = [
    item("A", 0, 8, 700), // anchor y=700
    item("B", 20, 8, 697), // |697-700|=3, exactly at tolerance -> same line
    item("C", 40, 8, 693.5), // |693.5-700|=6.5 -> new line
  ];
  const result = groupTextItemsIntoLines(items);
  const lines = result.split("\n");
  assert.equal(lines.length, 2, `expected 2 lines, got ${lines.length}: ${JSON.stringify(lines)}`);
  assert.ok(lines[0].includes("A") && lines[0].includes("B"));
  assert.ok(lines[1].includes("C"));
  console.log("Test 5 (y-tolerance boundary: <=3px same line, >3px new line) PASSED");
}

// --- Test 6: empty input ---
{
  assert.equal(groupTextItemsIntoLines([]), "");
  assert.equal(groupTextItemsIntoLines(null), "");
  assert.equal(groupTextItemsIntoLines(undefined), "");
  console.log("Test 6 (empty/null/undefined input -> empty string, no crash) PASSED");
}

// --- Test 7: items with missing width don't crash (degrade gracefully) ---
{
  const items = [
    { str: "NoWidth", transform: [10, 0, 0, 10, 0, 700] }, // no width property at all
    { str: "Field", transform: [10, 0, 0, 10, 50, 700] },
  ];
  const result = groupTextItemsIntoLines(items);
  assert.equal(typeof result, "string");
  assert.ok(result.includes("NoWidth") && result.includes("Field"));
  console.log("Test 7 (missing width property doesn't crash) PASSED");
}

// --- Test 8: single line with mixed small/large gaps in the same line ---
{
  const items = [
    item("Available:", 0, 55, 700),
    item("4,100", 70, 30, 700), // gap=15 >= 12 -> column (label:value table pattern)
    item("SF", 105, 15, 700), // gap=5 -> space (word gap within the value)
  ];
  const result = groupTextItemsIntoLines(items);
  assert.equal(result, "Available: | 4,100 SF");
  console.log("Test 8 (mixed column + word gaps within one line) PASSED");
}

console.log("\nALL lineGrouping.js TESTS PASSED");
