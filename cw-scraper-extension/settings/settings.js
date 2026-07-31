import { getSettings, saveSettings } from "../src/storage/settings.js";
import { exportAllHistoryAsJson } from "../src/storage/runHistory.js";
import { DEFAULT_DELAY_MS, TREND_METRICS } from "../src/config/constants.js";

const llmEnabledEl = document.getElementById("llm-enabled");
const apiKeyEl = document.getElementById("api-key");
const trendMetricEl = document.getElementById("trend-metric");
const defaultDelayEl = document.getElementById("default-delay");

async function load() {
  defaultDelayEl.value = String(DEFAULT_DELAY_MS);
  trendMetricEl.value = TREND_METRICS.NET_RENT;
  try {
    const settings = await getSettings();
    llmEnabledEl.checked = !!settings.llmExtractionEnabled;
    apiKeyEl.value = settings.anthropicApiKey || "";
    trendMetricEl.value = settings.trendMetric || TREND_METRICS.NET_RENT;
    defaultDelayEl.value = String(settings.defaultDelayMs || DEFAULT_DELAY_MS);
  } catch (err) {
    // src/storage/settings.js is still a stub — expected until implemented.
    console.warn("Settings storage not implemented yet:", err);
  }
}

document.getElementById("save-btn").addEventListener("click", async () => {
  try {
    await saveSettings({
      llmExtractionEnabled: llmEnabledEl.checked,
      anthropicApiKey: apiKeyEl.value.trim(),
      trendMetric: trendMetricEl.value,
      defaultDelayMs: Number(defaultDelayEl.value),
    });
    alert("Saved.");
  } catch (err) {
    alert("Settings storage isn't implemented yet — see src/storage/settings.js.");
  }
});

document.getElementById("export-history-btn").addEventListener("click", async () => {
  try {
    const history = await exportAllHistoryAsJson();
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `cw-run-history-${Date.now()}.json` });
  } catch (err) {
    alert("Run history isn't implemented yet — see src/storage/runHistory.js.");
  }
});

load();
