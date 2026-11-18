// The History card: draws the three most recent sites and the opt-in
// messages around them. Which pages to show is decided by recentPages() in
// sites.js; this file only draws and reacts to clicks.

import { relativeTime } from "./logic.js";
import { faviconUrl, monogramFor, recentPages, siteLabel } from "./sites.js";
import { faviconBase } from "./browser-sites.js";
import { canOfferHistory, hasHistoryAccess, historyApiReady, readRecentHistory, removeHistoryAccess, requestHistoryAccess } from "./browser-history.js";

const ROW_LIMIT = 6;
const ICON_WAIT_MS = 350;

export function createHistoryCard({ getState, commit, showToast, escapeHtml }) {
  const list = document.querySelector("#history-list");
  const note = document.querySelector("#history-note");
  const settingStatus = document.querySelector("#history-setting-status");
  const settingToggle = document.querySelector("#history-setting-toggle");
  const openAll = document.querySelector("#history-open-all");
  const iconBase = faviconBase();

  // "loading" | "on" | "off" | "declined" | "error" | "unavailable"
  let access = "loading";
  // In memory for this tab only; never written to storage.
  let rows = [];
  let lastSignature = "";

  function rowMarkup(row) {
    const src = faviconUrl(iconBase, row.url, 32);
    const label = siteLabel(row.title, row.url);
    const image = src ? `<img class="site-favicon" src="${escapeHtml(src)}" alt="" width="24" height="24" decoding="async">` : "";
    return `
      <li class="history-row" data-icon="${src ? "pending" : "letter"}">
        <a class="history-link" href="${escapeHtml(row.url)}" title="${escapeHtml(row.title)}">
          <span class="site-plate"><span class="site-letter" aria-hidden="true">${escapeHtml(monogramFor(label))}</span>${image}</span>
          <span class="history-text">
            <span class="history-title">${escapeHtml(row.title)}</span>
            <span class="history-meta">${escapeHtml(row.host)} · ${escapeHtml(relativeTime(row.visitedAt))}</span>
          </span>
        </a>
      </li>`;
  }

  // Same rule as the site tiles: if the icon hasn't arrived quickly, show
  // the letter instead of an empty square.
  function settleIcons() {
    window.setTimeout(() => {
      list.querySelectorAll('[data-icon="pending"]').forEach((row) => { row.dataset.icon = "letter"; });
    }, ICON_WAIT_MS);
  }

  function noteMarkup() {
    const dismissed = getState().settings.historyPromptDismissed;
    if (access === "loading") return "";
    if (access === "unavailable") return "<p>Recent pages appear here when Ro5n3R runs as a Chrome extension.</p>";
    if (access === "off" && !dismissed) {
      return `<p>Jump back to what you were just reading. Read from Chrome when a tab opens, never stored or sent.</p>
        <div class="note-actions"><button class="secondary-button" type="button" data-history-dismiss>Not now</button><button class="primary-button" type="button" data-history-enable>Show recent pages</button></div>`;
    }
    if (access === "off" || access === "declined") {
      return `<p>History stays private. You can turn it on any time.</p>
        <div class="note-actions"><button class="secondary-button" type="button" data-history-enable>Turn on</button></div>`;
    }
    if (access === "error") {
      return `<p>Chrome didn't answer this time.</p><div class="note-actions"><button class="secondary-button" type="button" data-history-retry>Try again</button></div>`;
    }
    if (rows.length === 0) return "<p>Pages you visit will show up here.</p>";
    return "";
  }

  function syncSettings() {
    if (access === "loading" && !getState().settings.widgets.recent) {
      settingStatus.textContent = "Hidden in Display. No history read from Chrome.";
      settingToggle.hidden = true;
      return;
    }
    const text = {
      loading: "Checking…",
      on: "On. Read from Chrome when a tab opens, never stored or sent.",
      off: "Off.",
      declined: "Off.",
      error: "Chrome didn't answer just now.",
      unavailable: "Available when Ro5n3R runs as a Chrome extension."
    };
    const action = { on: "Turn off", off: "Turn on", declined: "Turn on", error: "Try again" };
    settingStatus.textContent = text[access];
    settingToggle.hidden = !(access in action);
    settingToggle.textContent = action[access] ?? "";
  }

  function render() {
    syncSettings();
    // app.js re-renders everything after any save. Skipping when nothing here
    // changed stops the favicons from reloading and the rows from flickering.
    const signature = JSON.stringify([access, getState().settings.historyPromptDismissed, rows.map((row) => [row.url, row.visitedAt])]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    list.innerHTML = access === "on" ? rows.map(rowMarkup).join("") : "";
    list.hidden = list.innerHTML === "";
    const message = noteMarkup();
    note.innerHTML = message;
    note.hidden = message === "";
    settleIcons();
  }

  async function load() {
    if (!canOfferHistory()) {
      access = "unavailable";
    } else if (!(await hasHistoryAccess())) {
      access = "off";
    } else {
      try {
        rows = recentPages(await readRecentHistory(), ROW_LIMIT);
        access = "on";
      } catch {
        access = "error";
      }
    }
    render();
  }

  async function enable() {
    // First thing after the click, so Chrome still counts it as a user gesture.
    const granted = await requestHistoryAccess();
    if (!granted) {
      access = "declined";
      render();
      return;
    }
    await commit((state) => { state.settings.historyPromptDismissed = true; });
    if (!historyApiReady()) {
      window.location.reload();
      return;
    }
    await load();
  }

  async function disable() {
    if (!(await removeHistoryAccess())) {
      showToast("Chrome kept this setting on. You can change it under chrome://extensions.");
      return;
    }
    rows = [];
    access = "off";
    await commit((state) => { state.settings.historyPromptDismissed = true; });
    render();
    showToast("Recent history turned off.");
  }

  // `load` and `error` don't bubble, so listen in the capture phase.
  list.addEventListener("load", (event) => {
    event.target.closest?.("[data-icon]")?.setAttribute("data-icon", "favicon");
  }, true);
  list.addEventListener("error", (event) => {
    event.target.closest?.("[data-icon]")?.setAttribute("data-icon", "letter");
  }, true);

  note.addEventListener("click", async (event) => {
    if (event.target.closest("[data-history-enable]")) enable();
    else if (event.target.closest("[data-history-retry]")) load();
    else if (event.target.closest("[data-history-dismiss]")) {
      await commit((state) => { state.settings.historyPromptDismissed = true; });
      render();
    }
  });

  settingToggle.addEventListener("click", () => {
    if (access === "on") disable();
    else if (access === "error") load();
    else enable();
  });

  openAll.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) chrome.tabs.create({ url: "chrome://history/" });
    else window.location.assign("chrome://history/");
  });

  return { load, render };
}
