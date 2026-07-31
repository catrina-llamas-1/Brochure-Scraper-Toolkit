// Turns pdf.js's raw per-item text output into readable lines. Isolated
// from pdf.js itself (takes plain text-item objects, no pdf.js types) so
// it's unit-testable against fixture arrays without a real PDF, a real
// pdf.js instance, or a worker thread.
//
// Algorithm (per the brief, not reinvented):
//   1. Sort items by y descending (PDF y-axis grows upward, so this is
//      top-to-bottom reading order), then x ascending (left-to-right).
//   2. Group into lines using a y-tolerance (each line anchored to the y
//      of its first item, not compared item-to-item, to avoid gradual
//      drift across many small y differences accumulating past tolerance).
//   3. Within a line, join items based on the x-gap between them, scaled
//      against an estimated space-character width (itself estimated from
//      the item's font height, since pdf.js text items don't report a
//      literal "space width"):
//        - gap below ~1 space-width  -> no separator (kerning-split word)
//        - gap ~1-4 space-widths     -> a single space (word boundary)
//        - gap beyond ~4 space-widths -> a column separator (" | "),
//          preserving table/column structure that a plain space would lose.
//
// Known limitation, accepted rather than engineered around (the brief
// doesn't ask for more): sequential tolerance-grouping after a global sort
// assumes same-line items share near-identical y values and different
// lines are separated by much more than yTolerance, which holds for
// normal body text/tables but can misgroup in unusual layouts (e.g.
// overlapping text boxes). Simple 1D clustering, not 2D layout analysis.

const DEFAULTS = {
  yTolerance: 3,
  // Estimated space-character width, as a fraction of the preceding item's
  // font height. ~0.25-0.3 is a commonly used approximation across common
  // fonts; exposed as an option since brochure fonts vary.
  spaceWidthToHeightRatio: 0.3,
  // Gap-to-estimated-space-width ratios that decide the separator. Between
  // the two ratios below: a single space. At or above columnGapRatio: a
  // column separator instead. Below spaceGapRatio: no separator at all
  // (items are treated as parts of the same word/token).
  spaceGapRatio: 1.0,
  columnGapRatio: 4.0,
  columnSeparator: " | ",
  // Floor so a degenerate/zero font-height estimate doesn't produce a
  // zero threshold that turns every nonzero gap into a column separator.
  minSpaceWidthPx: 2,
};

function estimateFontHeight(transform) {
  // transform = [a, b, c, d, e, f] (2D affine matrix + translation), the
  // shape pdf.js gives every text item. hypot(c, d) is a robust general
  // font-size estimate that degrades gracefully for rotated text; for the
  // common axis-aligned case (b = c = 0) it reduces to |d|.
  const c = transform[2] || 0;
  const d = transform[3] || 0;
  return Math.hypot(c, d);
}

/**
 * @param {Array<{str: string, transform: number[], width?: number}>} textItems
 *   raw items from a single page's getTextContent().items
 * @param {object} [opts] see DEFAULTS above
 * @returns {string} the page's line-grouped text, lines joined by "\n"
 */
export function groupTextItemsIntoLines(textItems, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!textItems || textItems.length === 0) return "";

  const enriched = textItems
    .filter((item) => item && typeof item.str === "string" && item.str.length > 0 && Array.isArray(item.transform))
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: typeof item.width === "number" ? item.width : 0,
      height: estimateFontHeight(item.transform),
    }));

  if (enriched.length === 0) return "";

  enriched.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  let currentLine = [enriched[0]];
  let anchorY = enriched[0].y;

  for (let i = 1; i < enriched.length; i++) {
    const item = enriched[i];
    if (Math.abs(item.y - anchorY) <= o.yTolerance) {
      currentLine.push(item);
    } else {
      lines.push(currentLine);
      currentLine = [item];
      anchorY = item.y;
    }
  }
  lines.push(currentLine);

  const renderedLines = lines.map((line) => {
    // Cheap insurance: a line is normally already x-ascending (contiguous
    // slice of the global sort), but re-sort in case an item right at the
    // tolerance boundary landed out of x-order relative to its line-mates.
    line.sort((a, b) => a.x - b.x);

    let out = line[0].str;
    for (let i = 1; i < line.length; i++) {
      const prev = line[i - 1];
      const curr = line[i];
      const gap = curr.x - (prev.x + prev.width);
      const spaceWidth = Math.max(prev.height * o.spaceWidthToHeightRatio, o.minSpaceWidthPx);

      if (gap >= spaceWidth * o.columnGapRatio) {
        out += o.columnSeparator + curr.str;
      } else if (gap >= spaceWidth * o.spaceGapRatio) {
        out += " " + curr.str;
      } else {
        out += curr.str;
      }
    }
    return out;
  });

  return renderedLines.join("\n");
}
