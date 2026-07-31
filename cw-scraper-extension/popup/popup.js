// Popup is a thin launcher — see manifest architecture note. This file
// itself is NOT a stub (it's plumbing, not extraction logic): it renders
// config UI and hands off to worker.html via chrome.tabs.create(). The
// modules it calls into for saved-search persistence are still stubs and
// will throw — handled below so the popup doesn't break before that's
// implemented.

import { DEFAULT_CITIES, slugifyCity } from "../src/config/cities.js";
import { PROPERTY_TYPES, TRANSACTION_TYPES } from "../src/config/propertyTypes.js";
import { DEFAULT_DELAY_MS } from "../src/config/constants.js";
import { listSavedSearches } from "../src/storage/savedSearches.js";

const cityCheckboxesEl = document.getElementById("city-checkboxes");
const propertyTypeEl = document.getElementById("property-type");
const transactionTypeEl = document.getElementById("transaction-type");
const delaySliderEl = document.getElementById("delay-slider");
const delayValueEl = document.getElementById("delay-value");
const savedSearchesListEl = document.getElementById("saved-searches-list");
const savedSearchesEmptyEl = document.getElementById("saved-searches-empty");

function renderCityCheckbox(label, slug, checked = true) {
  const wrapper = document.createElement("label");
  wrapper.style.display = "block";
  wrapper.style.fontWeight = "normal";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = slug;
  input.checked = checked;
  input.dataset.citySlug = slug;
  wrapper.appendChild(input);
  wrapper.append(` ${label}`);
  cityCheckboxesEl.appendChild(wrapper);
}

function initCities() {
  for (const { label, slug } of DEFAULT_CITIES) {
    renderCityCheckbox(label, slug, true);
  }
}

function initDropdowns() {
  for (const { label, slug } of PROPERTY_TYPES) {
    const opt = document.createElement("option");
    opt.value = slug;
    opt.textContent = label;
    propertyTypeEl.appendChild(opt);
  }
  for (const { label, value } of TRANSACTION_TYPES) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    transactionTypeEl.appendChild(opt);
  }
}

function initDelaySlider() {
  delaySliderEl.value = String(DEFAULT_DELAY_MS);
  delayValueEl.textContent = delaySliderEl.value;
  delaySliderEl.addEventListener("input", () => {
    delayValueEl.textContent = delaySliderEl.value;
  });
}

document.getElementById("city-add-btn").addEventListener("click", () => {
  const input = document.getElementById("city-add-input");
  const name = input.value.trim();
  if (!name) return;
  renderCityCheckbox(name, slugifyCity(name), true);
  input.value = "";
});

function currentConfig() {
  const cities = [...cityCheckboxesEl.querySelectorAll("input[type=checkbox]:checked")].map(
    (el) => el.dataset.citySlug
  );
  return {
    name: document.getElementById("search-name").value.trim(),
    cities,
    propertyType: propertyTypeEl.value,
    transactionType: transactionTypeEl.value,
    delayMs: Number(delaySliderEl.value),
  };
}

async function renderSavedSearches() {
  try {
    const searches = await listSavedSearches();
    const ids = Object.keys(searches);
    savedSearchesListEl.innerHTML = "";
    savedSearchesEmptyEl.style.display = ids.length ? "none" : "block";
    for (const id of ids) {
      const s = searches[id];
      const li = document.createElement("li");
      li.textContent = s.name;
      const runBtn = document.createElement("button");
      runBtn.textContent = "Run";
      runBtn.addEventListener("click", () => launchWorker(s));
      li.appendChild(runBtn);
      savedSearchesListEl.appendChild(li);
    }
  } catch (err) {
    // storage/savedSearches.js is still a stub — expected until that's implemented.
    savedSearchesEmptyEl.textContent = "Saved searches not available yet (storage module pending).";
    savedSearchesEmptyEl.style.display = "block";
  }
}

function launchWorker(config) {
  const url =
    chrome.runtime.getURL("worker/worker.html") + "?config=" + encodeURIComponent(JSON.stringify(config));
  chrome.tabs.create({ url });
}

document.getElementById("start-scrape-btn").addEventListener("click", () => {
  const config = currentConfig();
  if (config.cities.length === 0) {
    alert("Select at least one city.");
    return;
  }
  launchWorker(config);
});

document.getElementById("save-search-btn").addEventListener("click", async () => {
  const config = currentConfig();
  if (!config.name) {
    alert("Name this search before saving it.");
    return;
  }
  // src/storage/savedSearches.js is a stub — wire this up once it's implemented.
  alert("Saved-search persistence isn't implemented yet — see src/storage/savedSearches.js.");
});

document.getElementById("settings-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

initCities();
initDropdowns();
initDelaySlider();
renderSavedSearches();
