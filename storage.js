import { DEFAULT_WIDGETS, normalizeWidgets } from "./widgets.js";

const DATA_KEY = "ro5n3rState";
const SCHEMA_VERSION = 1;

const DEFAULT_STATE = Object.freeze({
  version: SCHEMA_VERSION,
  settings: {
    name: "",
    engine: "google",
    timeFormat: "12",
    theme: "dark",
    backgroundMode: "theme",
    clockColor: "default",
    panelColor: "default",
    weatherCity: "",
    weatherUnit: "fahrenheit",
    widgets: DEFAULT_WIDGETS,
    // True once the user has answered the "show my most-visited sites" invitation.
    sitesPromptDismissed: false,
    // Same idea for the History card's invitation.
    historyPromptDismissed: false,
    focusMinutes: 25,
    timerMinutes: 10,
    // The third Quick Stats tile counts down to a date the user picks.
    countdownLabel: "",
    countdownDate: ""
  },
  // Starts empty on purpose: tiles come from the user's own most-visited
  // sites (read live from Chrome, never copied here) plus whatever they pin.
  shortcuts: [],
  // Hosts the user removed from the most-visited suggestions.
  hiddenHosts: [],
  tasks: [],
  captures: [],
  schedule: [],
  // Kept as a running count (not derived from tasks) so deleting a finished
  // task doesn't take it back off the "Tasks done" tile.
  stats: {
    tasksDone: 0,
    // Date keys ("2026-11-16") of days with a finished focus session.
    focusDays: []
  },
  timer: {
    mode: "focus",
    status: "idle",
    durationMs: 1500000,
    remainingMs: 1500000,
    startedAt: 0,
    endsAt: 0,
    elapsedMs: 0
  }
});

function cloneDefaultState() {
  return structuredClone(DEFAULT_STATE);
}

function mergeState(saved) {
  const defaults = cloneDefaultState();
  if (!saved || typeof saved !== "object" || saved.version !== SCHEMA_VERSION) return defaults;
  return {
    ...defaults,
    ...saved,
    settings: { ...defaults.settings, ...saved.settings, widgets: normalizeWidgets(saved.settings?.widgets) },
    shortcuts: Array.isArray(saved.shortcuts) ? saved.shortcuts : defaults.shortcuts,
    hiddenHosts: Array.isArray(saved.hiddenHosts) ? saved.hiddenHosts.filter((host) => typeof host === "string") : [],
    tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
    captures: Array.isArray(saved.captures) ? saved.captures : [],
    schedule: Array.isArray(saved.schedule) ? saved.schedule : [],
    stats: {
      tasksDone: Number.isFinite(saved.stats?.tasksDone) ? Math.max(0, saved.stats.tasksDone) : 0,
      focusDays: Array.isArray(saved.stats?.focusDays) ? saved.stats.focusDays.filter((day) => typeof day === "string") : []
    },
    timer: { ...defaults.timer, ...saved.timer }
  };
}

function hasChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function loadState() {
  if (hasChromeStorage()) {
    try {
      const result = await chrome.storage.local.get(DATA_KEY);
      return mergeState(result[DATA_KEY]);
    } catch {
      return cloneDefaultState();
    }
  }
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return mergeState(raw ? JSON.parse(raw) : null);
  } catch {
    return cloneDefaultState();
  }
}

export async function saveState(state) {
  const safeState = mergeState(state);
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [DATA_KEY]: safeState });
  } else {
    localStorage.setItem(DATA_KEY, JSON.stringify(safeState));
  }
  return safeState;
}

export function subscribeToState(callback) {
  if (!hasChromeStorage()) return () => {};
  const listener = (changes, area) => {
    if (area === "local" && changes[DATA_KEY]?.newValue) callback(mergeState(changes[DATA_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export { DATA_KEY };
