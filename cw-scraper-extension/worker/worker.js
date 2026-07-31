// Worker tab: owns the entire job (see manifest architecture note — this
// is the only place DOMParser/pdf.js/xlsx can run). This file wires up the
// UI shell and reads the launch config; it does NOT run the pipeline yet —
// every module it would call (discover/detail/pdf/extraction/xlsx) is
// still a stub. Orchestration logic goes here once those are implemented.

import { loadRunState } from "../src/storage/state.js";

const params = new URLSearchParams(location.search);
const config = params.get("config") ? JSON.parse(params.get("config")) : null;

const runConfigEl = document.getElementById("run-config");
const logPaneEl = document.getElementById("log-pane");
const resumeBannerEl = document.getElementById("resume-banner");

function log(level, message) {
  const line = document.createElement("div");
  if (level !== "info") line.className = `log-${level}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logPaneEl.appendChild(line);
  logPaneEl.scrollTop = logPaneEl.scrollHeight;
}

if (config) {
  runConfigEl.textContent = `${config.name || "(unsaved search)"} — cities: ${config.cities.join(
    ", "
  )} — type: ${config.propertyType} — ${config.transactionType} — ${config.delayMs}ms delay`;
} else {
  runConfigEl.textContent = "No config passed — open this tab via the popup's Start Scrape button.";
}

async function checkForResume() {
  if (!config) return;
  try {
    const state = await loadRunState(config.name);
    if (state) resumeBannerEl.hidden = false;
  } catch (err) {
    // src/storage/state.js is still a stub — expected until implemented.
  }
}

log("info", "Worker tab loaded. Pipeline not implemented yet — see src/discover, src/detail, src/pdf, src/extraction, src/xlsx.");
checkForResume();

// Buttons are wired but inert until the pipeline exists.
document.getElementById("download-partial-btn").addEventListener("click", () => {
  log("warn", "Nothing to download yet — buildWorkbook() is not implemented.");
});
document.getElementById("resume-btn").addEventListener("click", () => {
  log("warn", "Resume is not implemented yet.");
});
document.getElementById("discard-btn").addEventListener("click", () => {
  resumeBannerEl.hidden = true;
});
