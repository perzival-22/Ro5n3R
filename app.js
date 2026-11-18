import { buildSearchUrl, clockParts, greetingText, localDateKey, normalizeUrl, SEARCH_ENGINES, uid } from "./logic.js";
import { createLaunchpad } from "./launchpad.js";
import { createHistoryCard } from "./history.js";
import { createBookmarksCard } from "./bookmarks.js";
import { createWeatherCard } from "./weather.js";
import { monogramFor } from "./sites.js";
import { loadState, saveState, subscribeToState } from "./storage.js";
import { DEFAULT_WIDGETS, MINIMAL_WIDGETS, isMinimalLayout } from "./widgets.js";
import { deleteBackgroundImage, loadBackgroundImage, prepareBackgroundImage, saveBackgroundImage, subscribeToBackgroundImage } from "./background.js";

const $ = (selector) => document.querySelector(selector);

let state = await loadState();
let backgroundImage = await loadBackgroundImage();
let pendingBackgroundImage = null;
let removeBackgroundOnSave = false;
let backgroundPreparing = false;
let backgroundSelectionId = 0;
let clockTimeout = 0;
let toastTimeout = 0;

const SCHEDULE_ROWS = 4;
const MINUTE = 60000;

const elements = {
  dateLabel: $("#date-label"),
  scheduleDate: $("#schedule-date"),
  greeting: $("#greeting"),
  avatar: $("#avatar-initials"),
  clock: $("#clock"),
  clockTime: $("#clock-time"),
  clockPeriod: $("#clock-period"),
  subline: $("#hero-subline"),
  engineRow: $("#engine-row"),
  scheduleList: $("#schedule-list"),
  scheduleEmpty: $("#schedule-empty"),
  toast: $("#toast")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ------------------------------------------------------------------ Clock

function renderClock() {
  const now = new Date();
  const name = state.settings.name.trim();
  const { time, period } = clockParts(now, state.settings.timeFormat !== "24");
  // Replay the small "tick" animation only when the minute really changed,
  // never on the first paint (the entrance animation covers that).
  const minuteChanged = elements.clockTime.dataset.painted === "true" && elements.clockTime.textContent !== time;
  elements.clockTime.textContent = time;
  elements.clockTime.dateTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  elements.clockTime.dataset.painted = "true";
  elements.clockPeriod.textContent = period;
  if (minuteChanged) {
    elements.clock.classList.remove("is-ticking");
    // Reading a layout value makes the browser notice the class was removed,
    // so adding it back restarts the animation.
    void elements.clock.offsetWidth;
    elements.clock.classList.add("is-ticking");
  }
  elements.greeting.textContent = greetingText(now.getHours(), name);
  elements.avatar.textContent = name ? name.slice(0, 2).toUpperCase() : "R";
  elements.dateLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(now);
  elements.scheduleDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
}

function scheduleClock() {
  clearTimeout(clockTimeout);
  if (document.hidden) return;
  const widgets = state.settings.widgets;
  if (!widgets.clock && !widgets.today) return;
  if (widgets.clock) renderClock();
  // Today can change at midnight, so it rides with the minute clock.
  if (widgets.today) renderSchedule();
  const delay = MINUTE - (Date.now() % MINUTE) + 20;
  clockTimeout = window.setTimeout(scheduleClock, delay);
}

function renderEngines() {
  elements.engineRow.innerHTML = Object.entries(SEARCH_ENGINES).map(([key, engine]) => `
    <button class="engine-chip" type="button" role="radio" data-engine="${key}" aria-checked="${state.settings.engine === key}">${escapeHtml(engine.label)}</button>
  `).join("");
}

// -------------------------------------------------------------- Schedule

function formatScheduleTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: state.settings.timeFormat !== "24" }).format(date);
}

function renderSchedule() {
  const today = localDateKey();
  const items = state.schedule.filter((item) => item.date === today).sort((a, b) => a.time.localeCompare(b.time)).slice(0, SCHEDULE_ROWS);
  elements.scheduleList.innerHTML = items.map((item, index) => {
    const range = item.end ? `${formatScheduleTime(item.time)} – ${formatScheduleTime(item.end)}` : formatScheduleTime(item.time);
    return `
    <li class="schedule-row" style="--dot: var(--dot-${index % 4})">
      <span class="schedule-dot" aria-hidden="true"></span>
      <span class="schedule-title">${escapeHtml(item.title)}</span>
      <time class="schedule-time" datetime="${today}T${escapeHtml(item.time)}">${escapeHtml(range)}</time>
      <button class="row-delete" type="button" data-schedule-delete="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.title)}" title="Delete schedule item"><svg class="icon" aria-hidden="true"><use href="#i-close" /></svg></button>
    </li>`;
  }).join("");
  elements.scheduleList.hidden = items.length === 0;
  elements.scheduleEmpty.hidden = items.length !== 0;
}

// ------------------------------------------------------------ Rendering

function renderTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.clockColor = state.settings.clockColor;
  document.documentElement.dataset.panelColor = state.settings.panelColor;
  const usingPicture = state.settings.backgroundMode === "photo" && Boolean(backgroundImage);
  document.documentElement.dataset.background = usingPicture ? "photo" : "theme";
  if (usingPicture) document.documentElement.style.setProperty("--photo-image", `url("${backgroundImage}")`);
  else document.documentElement.style.removeProperty("--photo-image");
}

function renderVisibility() {
  const widgets = state.settings.widgets;
  const left = widgets.today || widgets.recent;
  const right = widgets.weather || widgets.bookmarks;
  const minimal = isMinimalLayout(widgets);
  const dashboard = $("#main-content");
  dashboard.dataset.layout = left && right ? "both" : left ? "left" : right ? "right" : "none";
  dashboard.dataset.minimal = String(minimal);
  dashboard.dataset.oneRow = String(!widgets.secondRow);
  $(".column--left").hidden = !left;
  $(".column--right").hidden = !right;
  $(".schedule-card").hidden = !widgets.today;
  $(".history-card").hidden = !widgets.recent;
  $(".weather-card").hidden = !widgets.weather;
  $(".bookmarks-card").hidden = !widgets.bookmarks;
  $(".hero-top").hidden = !widgets.clock;
  elements.engineRow.hidden = !widgets.searchEngines;
  $("#profile-open").hidden = minimal;
  $(".brand").hidden = minimal;
}

function renderAll() {
  renderTheme();
  renderVisibility();
  renderClock();
  renderEngines();
  launchpad.render();
  historyCard.render();
  bookmarksCard.render();
  weatherCard.render();
  renderSchedule();
}

async function persist(render = true) {
  state = await saveState(state);
  if (render) renderAll();
}

function showToast(message, undo) {
  clearTimeout(toastTimeout);
  elements.toast.replaceChildren(document.createTextNode(message));
  if (undo) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-undo";
    button.textContent = "Undo";
    button.addEventListener("click", async () => {
      await undo();
      elements.toast.hidden = true;
    }, { once: true });
    elements.toast.append(button);
  }
  elements.toast.hidden = false;
  toastTimeout = window.setTimeout(() => { elements.toast.hidden = true; }, undo ? 8000 : 3200);
}

function openSettings() {
  backgroundSelectionId++;
  pendingBackgroundImage = null;
  removeBackgroundOnSave = false;
  backgroundPreparing = false;
  $("#settings-background-file").value = "";
  $("#settings-background-error").hidden = true;
  $("#settings-name").value = state.settings.name;
  $("#settings-time").value = state.settings.timeFormat;
  $("#settings-theme").value = state.settings.theme;
  $("#settings-background-mode").value = state.settings.backgroundMode;
  $("#settings-clock-color").value = state.settings.clockColor;
  $("#settings-panel-color").value = state.settings.panelColor;
  $("#settings-weather-city").value = state.settings.weatherCity;
  $("#settings-weather-unit").value = state.settings.weatherUnit;
  document.querySelectorAll("[data-widget]").forEach((input) => {
    input.checked = state.settings.widgets[input.dataset.widget];
  });
  updateBackgroundControls();
  $("#settings-dialog").showModal();
}

function updateBackgroundControls() {
  const picture = removeBackgroundOnSave ? null : pendingBackgroundImage ?? backgroundImage;
  const preview = $("#settings-background-preview");
  preview.hidden = !picture;
  if (picture) preview.src = picture;
  else preview.removeAttribute("src");
  $("#settings-background-remove").hidden = !picture;
  $("#settings-background-mode").querySelector('[value="photo"]').disabled = !picture;
  if (!picture) $("#settings-background-mode").value = "theme";
  $("#settings-background-status").textContent = backgroundPreparing ? "Preparing picture…"
    : pendingBackgroundImage ? "Picture ready. Save settings to use it."
    : picture ? "Picture saved on this device." : "Choose a JPG, PNG, or WebP picture.";
}

function showBackgroundError(message) {
  const error = $("#settings-background-error");
  error.textContent = message;
  error.hidden = false;
}

function setWidgetChoices(choices) {
  document.querySelectorAll("[data-widget]").forEach((input) => {
    input.checked = choices[input.dataset.widget];
  });
}

/**
 * Every dialog form shares one rule: a Cancel or close button (value
 * "cancel") just closes. Those buttons also carry `formnovalidate` in the
 * HTML, which is what stops the browser from demanding required fields
 * before it lets the user back out.
 */
function onDialogSubmit(form, handler) {
  form.addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    await handler();
  });
}

// --------------------------------------------------------------- Events

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = $("#search-input").value.trim();
  if (!query) {
    $("#search-input").focus();
    showToast("Type something to search for.");
    return;
  }
  const directUrl = !query.includes(" ") && query.includes(".") ? normalizeUrl(query) : null;
  const destination = directUrl ?? buildSearchUrl(state.settings.engine, query);
  if (destination) window.location.assign(destination);
});

elements.engineRow.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-engine]");
  if (!button) return;
  state.settings.engine = button.dataset.engine;
  await persist();
});

function openPinDialog() {
  $("#shortcut-form").reset();
  $("#shortcut-error").hidden = true;
  $("#shortcut-dialog").showModal();
}

onDialogSubmit($("#shortcut-form"), async () => {
  const label = $("#shortcut-name").value.trim();
  const url = normalizeUrl($("#shortcut-url").value);
  if (!label || !url) {
    $("#shortcut-error").hidden = false;
    return;
  }
  state.shortcuts.push({ id: uid("shortcut"), label, url, monogram: monogramFor(label) });
  await persist();
  $("#shortcut-dialog").close();
  showToast(`Pinned. ${label} stays put now.`);
});

$("#schedule-add").addEventListener("click", () => {
  $("#schedule-form").reset();
  $("#schedule-dialog").showModal();
});

onDialogSubmit($("#schedule-form"), async () => {
  const title = $("#schedule-title").value.trim();
  const time = $("#schedule-time").value;
  const end = $("#schedule-end").value;
  if (!title || !time) return;
  // An end before the start is ignored rather than refused: the item still
  // gets saved, just without a range.
  state.schedule.push({ id: uid("schedule"), title, time, end: end > time ? end : "", date: localDateKey() });
  await persist();
  $("#schedule-dialog").close();
  showToast("Added to today.");
});

elements.scheduleList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-schedule-delete]");
  if (!button) return;
  const index = state.schedule.findIndex((item) => item.id === button.dataset.scheduleDelete);
  if (index < 0) return;
  const [removed] = state.schedule.splice(index, 1);
  await persist();
  showToast("Schedule item deleted.", async () => { state.schedule.splice(index, 0, removed); await persist(); });
});

$("#settings-open").addEventListener("click", openSettings);
$("#profile-open").addEventListener("click", openSettings);
$("#settings-background-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const selectionId = ++backgroundSelectionId;
  backgroundPreparing = true;
  $("#settings-background-error").hidden = true;
  updateBackgroundControls();
  try {
    const prepared = await prepareBackgroundImage(file);
    if (selectionId !== backgroundSelectionId) return;
    pendingBackgroundImage = prepared;
    removeBackgroundOnSave = false;
    $("#settings-background-mode").value = "photo";
  } catch (error) {
    if (selectionId !== backgroundSelectionId) return;
    showBackgroundError(error.message || "This picture could not be opened.");
  } finally {
    if (selectionId === backgroundSelectionId) {
      backgroundPreparing = false;
      updateBackgroundControls();
    }
  }
});
$("#settings-background-remove").addEventListener("click", () => {
  backgroundSelectionId++;
  backgroundPreparing = false;
  pendingBackgroundImage = null;
  removeBackgroundOnSave = true;
  $("#settings-background-file").value = "";
  $("#settings-background-mode").value = "theme";
  $("#settings-background-error").hidden = true;
  updateBackgroundControls();
});
$("#widgets-minimal").addEventListener("click", () => setWidgetChoices(MINIMAL_WIDGETS));
$("#widgets-full").addEventListener("click", () => setWidgetChoices(DEFAULT_WIDGETS));
onDialogSubmit($("#settings-form"), async () => {
  if (backgroundPreparing) {
    showBackgroundError("Wait for the picture to finish preparing.");
    return;
  }
  try {
    if (removeBackgroundOnSave) {
      await deleteBackgroundImage();
      backgroundImage = null;
    } else if (pendingBackgroundImage) {
      await saveBackgroundImage(pendingBackgroundImage);
      backgroundImage = pendingBackgroundImage;
    }
  } catch {
    showBackgroundError("The picture could not be saved. Try a smaller image.");
    return;
  }
  const previousCity = state.settings.weatherCity;
  const previousWeatherUnit = state.settings.weatherUnit;
  const previousWidgets = state.settings.widgets;
  state.settings.name = $("#settings-name").value.trim();
  state.settings.timeFormat = $("#settings-time").value;
  state.settings.theme = $("#settings-theme").value;
  state.settings.backgroundMode = backgroundImage ? $("#settings-background-mode").value : "theme";
  state.settings.clockColor = $("#settings-clock-color").value;
  state.settings.panelColor = $("#settings-panel-color").value;
  state.settings.weatherCity = $("#settings-weather-city").value.trim();
  state.settings.weatherUnit = $("#settings-weather-unit").value;
  state.settings.widgets = Object.fromEntries([...document.querySelectorAll("[data-widget]")].map((input) => [input.dataset.widget, input.checked]));
  await persist();
  if (state.settings.widgets.mostVisited && !previousWidgets.mostVisited) launchpad.loadSites();
  if (state.settings.widgets.recent && !previousWidgets.recent) historyCard.load();
  if (state.settings.widgets.bookmarks && !previousWidgets.bookmarks) bookmarksCard.load();
  if (state.settings.widgets.weather && (state.settings.weatherCity !== previousCity || state.settings.weatherUnit !== previousWeatherUnit || !previousWidgets.weather)) weatherCard.load();
  scheduleClock();
  $("#settings-dialog").close();
  showToast("Settings saved.");
});

document.addEventListener("keydown", (event) => {
  const editable = event.target.matches("input, textarea, select, [contenteditable='true']");
  if (editable || event.metaKey || event.ctrlKey || event.altKey || document.querySelector("dialog[open]")) return;
  if (event.key === "/") {
    event.preventDefault();
    $("#search-input").focus();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(clockTimeout);
  } else {
    scheduleClock();
    // Coming back to the tab is a natural moment to refresh "recent" pages.
    // It is one read per return, not a polling loop.
    if (state.settings.widgets.recent) historyCard.load();
    if (state.settings.widgets.bookmarks) bookmarksCard.load();
  }
});

// The launchpad owns the site tiles and search suggestions; the history card
// owns its own rows. Both read state through getState and change it through
// commit, so saving stays in one place.
const launchpad = createLaunchpad({
  getState: () => state,
  commit: async (mutate) => {
    mutate(state);
    await persist();
  },
  showToast,
  openPinDialog,
  escapeHtml
});

const historyCard = createHistoryCard({
  getState: () => state,
  commit: async (mutate) => {
    mutate(state);
    await persist();
  },
  showToast,
  escapeHtml
});

const bookmarksCard = createBookmarksCard({ getWidgets: () => state.settings.widgets, showToast, escapeHtml });
const weatherCard = createWeatherCard({
  getCity: () => state.settings.weatherCity,
  getUnit: () => state.settings.weatherUnit,
  setUnit: async (unit) => {
    state.settings.weatherUnit = unit;
    await persist();
  },
  openSettings
});

subscribeToState((updated) => {
  const weatherChanged = updated.settings.weatherCity !== state.settings.weatherCity
    || updated.settings.weatherUnit !== state.settings.weatherUnit;
  const weatherShown = updated.settings.widgets.weather && !state.settings.widgets.weather;
  state = updated;
  renderAll();
  if (state.settings.widgets.weather && (weatherChanged || weatherShown)) weatherCard.load();
});

subscribeToBackgroundImage((updated) => {
  backgroundImage = updated;
  renderTheme();
});

renderAll();
scheduleClock();
// Each asks Chrome once per tab. There is no polling.
if (state.settings.widgets.mostVisited) launchpad.loadSites();
if (state.settings.widgets.recent) historyCard.load();
if (state.settings.widgets.bookmarks) bookmarksCard.load();
if (state.settings.widgets.weather) weatherCard.load();
