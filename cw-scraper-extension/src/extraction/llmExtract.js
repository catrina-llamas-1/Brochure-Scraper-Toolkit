// STUB — no logic yet, see docs/SCHEMA.md.
//
// Layer 2 (optional): send brochure text to the Anthropic Messages API
// with a strict JSON-only schema prompt, merge the result OVER the Layer 1
// regex output (regex stays as fallback for any field the LLM misses or
// disagrees on in a way we can't validate).
//
// Requires the "anthropic-dangerous-direct-browser-access: true" header —
// this is a browser-context call, not a backend proxy, by design (no
// server per the brief).
//
// Only called when settings.llmExtractionEnabled is true AND an API key is
// present in chrome.storage.local. The UI must warn, before the key is
// ever saved, that (a) anything in extension storage is readable by anyone
// with access to the browser profile, and (b) this sends brochure text to
// a third party (Anthropic). See settings/settings.html.

/**
 * @param {string} lineGroupedText from extractPdfText().lines
 * @param {string} apiKey
 * @returns {Promise<object>} partial Listing fields, each as
 *   {value, source: "pdf_llm"}, only for fields the model returned
 * @throws on API/network failure — caller must catch and fall back to
 *   Layer 1 output alone, never abort the listing over an LLM failure
 */
export async function llmExtractFields(lineGroupedText, apiKey) {
  throw new Error("llmExtractFields: not implemented");
}
