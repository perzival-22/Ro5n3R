// The launchpad UI: site tiles, their icons, the "jump to a site" list under
// the search bar, and keyboard movement. The decisions (which sites, in what
// order, which match) live in sites.js as pure functions; this file only
// draws them and reacts to clicks and keys.

import { uid } from "./logic.js";
import { EXIT_UP, faviconUrl, matchSites, mergeSites, monogramFor, nextTileIndex } from "./sites.js";
import { canOfferTopSites, faviconBase, hasTopSitesAccess, readTopSites, removeTopSitesAccess, requestTopSitesAccess, topSitesApiReady } from "./browser-sites.js";
import { showAddSiteTile, siteLimit } from "./widgets.js";

const SUGGESTION_LIMIT = 4;
const SKELETON_COUNT = 6;
const ICON_WAIT_MS = 350;
// A host that cannot exist (.invalid is reserved for exactly this). Asking
// Chrome for its favicon returns Chrome's generic globe, which we then use to
// recognise "this site has no icon of its own".
const NO_ICON_PROBE_URL = "https://ro5n3r-no-icon.invalid/";

export function createLaunchpad({ getState, commit, showToast, openPinDialog, escapeHtml }) {
  const grid = document.querySelector("#shortcut-list");
  const note = document.querySelector("#sites-note");
  const searchInput = document.querySelector("#search-input");
  const suggestionList = document.querySelector("#search-suggestions");
  const settingStatus = document.querySelector("#sites-setting-status");
  const settingToggle = document.querySelector("#sites-setting-toggle");
  const hiddenRow = document.querySelector("#hidden-sites-row");
  const hiddenStatus = document.querySelector("#hidden-sites-status");

  const iconBase = faviconBase();

  // "loading" | "on" | "off" | "declined" | "error" | "unavailable"
  let access = "loading";
  // Held in memory for this tab only. It is never written to storage.
  let topSites = [];
  let lastSignature = "";
  let introPlayed = false;
  let rovingIndex = 0;
  let suggestions = [];
  let activeSuggestion = -1;
  let noIconPixels = null;

  // ---------------------------------------------------------------- Icons

  function pixelsOf(image) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 16, 16);
      return context.getImageData(0, 0, 16, 16).data.join(",");
    } catch {
      return null;
    }
  }

  // Loads Chrome's generic globe once per tab and remembers its pixels.
  function loadNoIconPixels() {
    noIconPixels ??= new Promise((resolve) => {
      const src = faviconUrl(iconBase, NO_ICON_PROBE_URL);
      if (!src) return resolve(null);
      const probe = new Image();
      probe.onload = () => resolve(pixelsOf(probe));
      probe.onerror = () => resolve(null);
      probe.src = src;
    });
    return noIconPixels;
  }

  function settleIcon(image, kind) {
    const holder = image.closest("[data-icon]");
    if (holder) holder.dataset.icon = kind;
  }

  // Chrome never reports "no favicon": it answers with a generic globe
  // instead. A globe on every unknown site looks unfinished, so we compare
  // the pixels and show the brand letter tile when it is the globe.
  async function onIconLoad(event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.classList.contains("site-favicon")) return;
    const genericPixels = await loadNoIconPixels();
    const isGeneric = genericPixels !== null && pixelsOf(image) === genericPixels;
    settleIcon(image, isGeneric ? "letter" : "favicon");
  }

  function onIconError(event) {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.classList.contains("site-favicon")) settleIcon(image, "letter");
  }

  // `load` and `error` do not bubble, so we listen in the capture phase on
  // the container. One listener then covers every icon it will ever hold.
  function watchIcons(container) {
    container.addEventListener("load", onIconLoad, true);
    container.addEventListener("error", onIconError, true);
  }

  // If an icon has not arrived shortly, show the letter so no tile stays
  // blank. A late icon still replaces the letter when it lands.
  function settlePendingIcons(container) {
    window.setTimeout(() => {
      container.querySelectorAll('[data-icon="pending"]').forEach((holder) => { holder.dataset.icon = "letter"; });
    }, ICON_WAIT_MS);
  }

  function plateMarkup(site) {
    const src = faviconUrl(iconBase, site.url);
    const image = src ? `<img class="site-favicon" src="${escapeHtml(src)}" alt="" width="32" height="32" decoding="async">` : "";
    return `<span class="site-plate"><span class="site-letter" aria-hidden="true">${escapeHtml(monogramFor(site.label))}</span>${image}</span>`;
  }

  function iconState() {
    return iconBase ? "pending" : "letter";
  }

  // ---------------------------------------------------------------- Sites

  function sitesFor(limit) {
    const state = getState();
    return mergeSites({ shortcuts: state.shortcuts, topSites: state.settings.widgets.mostVisited ? topSites : [], hiddenHosts: state.hiddenHosts, limit });
  }

  function tileMarkup(site, index) {
    const label = escapeHtml(site.label);
    const key = escapeHtml(site.key);
    const pinButton = site.pinned
      ? `<button class="tile-action tile-action--pin" type="button" tabindex="-1" data-unpin-site="${key}" aria-pressed="true" aria-label="Unpin ${label}" title="Unpin (P)"><svg class="icon" aria-hidden="true"><use href="#i-pin" /></svg></button>`
      : `<button class="tile-action tile-action--pin" type="button" tabindex="-1" data-pin-site="${key}" aria-pressed="false" aria-label="Pin ${label}" title="Pin (P)"><svg class="icon" aria-hidden="true"><use href="#i-pin" /></svg></button>`;
    const hideButton = site.pinned
      ? ""
      : `<button class="tile-action tile-action--remove" type="button" tabindex="-1" data-hide-site="${key}" aria-label="Hide ${label} from suggestions" title="Hide (Delete)"><svg class="icon" aria-hidden="true"><use href="#i-close" /></svg></button>`;
    return `
      <li class="tile" data-key="${key}" data-icon="${iconState()}">
        <a class="tile-link" href="${escapeHtml(site.url)}" data-tile-focus tabindex="${index === rovingIndex ? 0 : -1}" title="${escapeHtml(site.title)}" aria-describedby="tiles-hint" aria-keyshortcuts="P Delete">
          ${plateMarkup(site)}
          <span class="tile-label">${label}</span>
        </a>
        ${pinButton}${hideButton}
      </li>`;
  }

  function addTileMarkup(index) {
    return `
      <li class="tile tile--add">
        <button class="tile-link" type="button" data-add-site data-tile-focus tabindex="${index === rovingIndex ? 0 : -1}">
          <span class="site-plate"><svg class="icon" aria-hidden="true"><use href="#i-plus" /></svg></span>
          <span class="tile-label">Add site</span>
        </button>
      </li>`;
  }

  function skeletonMarkup() {
    return `<li class="tile tile--skeleton" aria-hidden="true"><span class="site-plate"></span><span class="skeleton-line"></span></li>`;
  }

  // The message under the tiles. Each one says what is happening and offers
  // one next step; none of them blames the user.
  function noteMarkup(siteCount) {
    if (!getState().settings.widgets.mostVisited) return null;
    const dismissed = getState().settings.sitesPromptDismissed;
    const card = (title, body, actions) => ({
      quiet: false,
      html: `<div class="sites-note-text"><strong>${title}</strong><p>${body}</p></div><div class="sites-note-actions">${actions}</div>`
    });
    if (access === "off" && !dismissed) {
      return card(
        "Start from the sites you use most",
        "Read from Chrome when a tab opens. The list never leaves this browser.",
        `<button class="secondary-button" type="button" data-sites-dismiss>Not now</button><button class="primary-button" type="button" data-sites-enable>Show my sites</button>`
      );
    }
    if (access === "declined") {
      return card(
        "No problem",
        "Search and your pinned sites work just the same. You can turn this on later in Settings.",
        `<button class="secondary-button" type="button" data-sites-enable>Ask again</button><button class="primary-button" type="button" data-sites-dismiss>Got it</button>`
      );
    }
    if (access === "error") {
      return card(
        "Your most-visited sites didn't load",
        "Chrome didn't answer this time. Your pinned sites are still here.",
        `<button class="primary-button" type="button" data-sites-retry>Try again</button>`
      );
    }
    if (access === "on" && siteCount === 0) {
      return { quiet: true, html: `<p>Your most-visited sites will appear here as you browse.</p>` };
    }
    if ((access === "off" || access === "unavailable") && siteCount === 0) {
      return { quiet: true, html: `<p>Pin a site and it will be waiting here on every new tab.</p>` };
    }
    return null;
  }

  function tileFocusables() {
    // offsetParent is null for anything hidden by CSS (narrow windows hide
    // the last two tiles), so arrow keys only visit tiles you can see.
    return [...grid.querySelectorAll("[data-tile-focus]")].filter((element) => element.offsetParent !== null);
  }

  function render() {
    const state = getState();
    const oneRow = !state.settings.widgets.secondRow;
    const needsChrome = state.settings.widgets.mostVisited;
    const loading = access === "loading" && needsChrome;
    const limit = siteLimit(state.settings.widgets);
    const sites = loading ? sitesFor(limit).filter((site) => site.pinned) : sitesFor(limit);
    const signature = JSON.stringify([access, state.settings.sitesPromptDismissed, oneRow, needsChrome, sites.map((site) => [site.key, site.url, site.label])]);
    syncSettings();
    // Settings and other tabs trigger a full re-render. Skipping unchanged
    // sites stops icons from reloading and tiles from flickering.
    if (signature === lastSignature) return;
    lastSignature = signature;

    const focusedIndex = tileFocusables().indexOf(document.activeElement);
    const message = loading ? null : noteMarkup(sites.length);
    rovingIndex = Math.min(rovingIndex, sites.length);

    if (loading) {
      grid.removeAttribute("data-intro");
      grid.hidden = false;
      grid.innerHTML = sites.map(tileMarkup).join("") + Array.from({ length: Math.max(0, Math.min(SKELETON_COUNT, limit) - sites.length) }, skeletonMarkup).join("");
    } else {
      // Play the staggered entrance once, on the first real paint only.
      grid.toggleAttribute("data-intro", !introPlayed);
      introPlayed = true;
      // When a message card is the only thing to show, it carries the one
      // next step by itself; a lone "Pin a site" tile above it would compete.
      const cardOnly = sites.length === 0 && message !== null && !message.quiet;
      grid.innerHTML = sites.map(tileMarkup).join("") + (cardOnly || !showAddSiteTile(sites.length, state.settings.widgets) ? "" : addTileMarkup(sites.length));
      grid.hidden = cardOnly;
    }
    settlePendingIcons(grid);

    note.hidden = message === null;
    note.classList.toggle("sites-note--quiet", Boolean(message?.quiet));
    note.innerHTML = message?.html ?? "";

    if (focusedIndex >= 0) {
      const items = tileFocusables();
      items[Math.min(focusedIndex, items.length - 1)]?.focus();
    }
  }

  // ------------------------------------------------------- Chrome access

  async function loadSites() {
    if (!canOfferTopSites()) {
      access = "unavailable";
    } else if (!(await hasTopSitesAccess())) {
      access = "off";
    } else {
      try {
        topSites = await readTopSites();
        access = "on";
      } catch {
        access = "error";
      }
    }
    render();
  }

  async function enableTopSites() {
    // Must be the first thing that happens after the click: Chrome only shows
    // its permission prompt while the click is still "in progress".
    const granted = await requestTopSitesAccess();
    if (!granted) {
      access = "declined";
      render();
      return;
    }
    await commit((state) => { state.settings.sitesPromptDismissed = true; });
    if (!topSitesApiReady()) {
      // Chrome normally adds the API to the page as soon as access is
      // granted. If it has not, a reload picks it up.
      window.location.reload();
      return;
    }
    introPlayed = false; // The new tiles deserve their entrance.
    await loadSites();
    if (access === "on") showToast("Your sites are here.");
  }

  async function disableTopSites() {
    const removed = await removeTopSitesAccess();
    if (!removed) {
      showToast("Chrome kept this setting on. You can change it under chrome://extensions.");
      return;
    }
    topSites = [];
    access = "off";
    // Turning it off is an answer too, so the invitation should not return.
    await commit((state) => { state.settings.sitesPromptDismissed = true; });
    render();
    showToast("Most-visited sites turned off.");
  }

  function syncSettings() {
    const hiddenBeforeLoad = access === "loading" && !getState().settings.widgets.mostVisited;
    const text = {
      loading: "Checking…",
      on: "On. Read from Chrome when a tab opens, never stored or sent.",
      off: "Off. Only your pinned sites are shown.",
      declined: "Off. Only your pinned sites are shown.",
      error: "Chrome didn't answer just now.",
      unavailable: "Available when Ro5n3R runs as a Chrome extension."
    };
    const action = { on: "Turn off", off: "Turn on", declined: "Turn on", error: "Try again" };
    settingStatus.textContent = hiddenBeforeLoad ? "Hidden in Display. No sites read from Chrome." : text[access];
    settingToggle.hidden = hiddenBeforeLoad || !(access in action);
    settingToggle.textContent = action[access] ?? "";

    const hiddenCount = getState().hiddenHosts.length;
    hiddenRow.hidden = hiddenCount === 0;
    hiddenStatus.textContent = hiddenCount === 1 ? "1 site hidden from suggestions." : `${hiddenCount} sites hidden from suggestions.`;
  }

  // ------------------------------------------------- Pin, unpin and hide

  function findSite(key) {
    return sitesFor(Number.MAX_SAFE_INTEGER).find((site) => site.key === key);
  }

  async function pinSite(key) {
    const site = findSite(key);
    if (!site || site.pinned) return;
    const id = uid("shortcut");
    await commit((state) => { state.shortcuts.push({ id, label: site.label, url: site.url, monogram: monogramFor(site.label) }); });
    // The small celebration: the pin badge pops on the tile that was pinned.
    const tile = [...grid.querySelectorAll(".tile")].find((element) => element.dataset.key === `pin:${id}`);
    tile?.classList.add("is-just-pinned");
    showToast(`Pinned. ${site.label} stays put now.`, async () => {
      await commit((state) => { state.shortcuts = state.shortcuts.filter((shortcut) => shortcut.id !== id); });
    });
  }

  async function unpinSite(key) {
    const site = findSite(key);
    if (!site || !site.pinned) return;
    const index = getState().shortcuts.findIndex((shortcut) => shortcut.id === site.id);
    if (index < 0) return;
    const removed = getState().shortcuts[index];
    await commit((state) => { state.shortcuts = state.shortcuts.filter((shortcut) => shortcut.id !== site.id); });
    showToast(`Unpinned ${site.label}.`, async () => {
      await commit((state) => { state.shortcuts.splice(index, 0, removed); });
    });
  }

  async function hideSite(key) {
    const site = findSite(key);
    if (!site || site.pinned) return;
    await commit((state) => { if (!state.hiddenHosts.includes(site.host)) state.hiddenHosts.push(site.host); });
    showToast(`Hidden. ${site.label} won't be suggested.`, async () => {
      await commit((state) => { state.hiddenHosts = state.hiddenHosts.filter((host) => host !== site.host); });
    });
  }

  // ------------------------------------------------------ Tile keyboard

  function columnCount(items) {
    if (items.length === 0) return 1;
    // Tiles wrap with flexbox, so the column count is "how many share the
    // first row", measured rather than assumed.
    const firstTop = Math.round(items[0].getBoundingClientRect().top);
    return items.filter((item) => Math.round(item.getBoundingClientRect().top) === firstTop).length;
  }

  function setRovingIndex(items, index) {
    rovingIndex = index;
    // Roving tabindex: only one tile is a Tab stop, so Tab leaves the grid in
    // one press and the arrow keys move inside it.
    items.forEach((item, itemIndex) => { item.tabIndex = itemIndex === index ? 0 : -1; });
  }

  function onGridKeydown(event) {
    const current = event.target.closest("[data-tile-focus]");
    if (!current || event.metaKey || event.ctrlKey || event.altKey) return;
    const items = tileFocusables();
    const index = items.indexOf(current);
    if (index < 0) return;

    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = nextTileIndex(index, event.key, items.length, columnCount(items));
      if (next === EXIT_UP) {
        searchInput.focus();
        return;
      }
      setRovingIndex(items, next);
      items[next].focus();
      return;
    }

    const key = current.closest(".tile")?.dataset.key;
    if (!key) return;
    const pinned = key.startsWith("pin:");
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      if (pinned) unpinSite(key); else pinSite(key);
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (pinned) unpinSite(key); else hideSite(key);
    }
  }

  // --------------------------------------------------- Search suggestions

  function closeSuggestions() {
    suggestions = [];
    activeSuggestion = -1;
    suggestionList.hidden = true;
    suggestionList.innerHTML = "";
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }

  function paintActiveSuggestion() {
    [...suggestionList.children].forEach((option, index) => option.setAttribute("aria-selected", String(index === activeSuggestion)));
    if (activeSuggestion >= 0) searchInput.setAttribute("aria-activedescendant", `suggestion-${activeSuggestion}`);
    else searchInput.removeAttribute("aria-activedescendant");
  }

  function updateSuggestions() {
    suggestions = matchSites(sitesFor(Number.MAX_SAFE_INTEGER), searchInput.value, SUGGESTION_LIMIT);
    // Nothing is selected until the user presses Down, so Enter always does
    // the predictable thing: search for exactly what was typed.
    activeSuggestion = -1;
    if (suggestions.length === 0) {
      closeSuggestions();
      return;
    }
    suggestionList.innerHTML = suggestions.map((site, index) => `
      <li class="suggestion" id="suggestion-${index}" role="option" aria-selected="false" data-suggestion="${index}" data-icon="${iconState()}">
        ${plateMarkup(site)}
        <span class="suggestion-text"><span class="suggestion-label">${escapeHtml(site.label)}</span><span class="suggestion-host">${escapeHtml(site.host)}</span></span>
        <svg class="icon suggestion-hint" aria-hidden="true"><use href="#i-return" /></svg>
      </li>`).join("");
    suggestionList.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
    settlePendingIcons(suggestionList);
  }

  function onSearchKeydown(event) {
    const open = suggestions.length > 0;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) {
        activeSuggestion = (activeSuggestion + 1) % suggestions.length;
        paintActiveSuggestion();
      } else {
        const items = tileFocusables();
        items[Math.min(rovingIndex, items.length - 1)]?.focus();
      }
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      activeSuggestion = activeSuggestion <= 0 ? -1 : activeSuggestion - 1;
      paintActiveSuggestion();
    } else if (event.key === "Enter" && open && activeSuggestion >= 0) {
      // Stops the form from also running a web search.
      event.preventDefault();
      window.location.assign(suggestions[activeSuggestion].url);
    } else if (event.key === "Escape" && open) {
      // First Escape closes the list and keeps the text; a second clears it
      // (the browser's own behaviour for search fields).
      event.preventDefault();
      closeSuggestions();
    }
  }

  // --------------------------------------------------------------- Events

  watchIcons(grid);
  watchIcons(suggestionList);

  grid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-pin-site], [data-unpin-site], [data-hide-site], [data-add-site]");
    if (!target) return;
    if (target.dataset.pinSite) pinSite(target.dataset.pinSite);
    else if (target.dataset.unpinSite) unpinSite(target.dataset.unpinSite);
    else if (target.dataset.hideSite) hideSite(target.dataset.hideSite);
    else openPinDialog();
  });
  grid.addEventListener("keydown", onGridKeydown);
  grid.addEventListener("focusin", (event) => {
    const items = tileFocusables();
    const index = items.indexOf(event.target.closest("[data-tile-focus]"));
    if (index >= 0) setRovingIndex(items, index);
  });
  // Remove the celebration class once it has played so it can play again.
  grid.addEventListener("animationend", (event) => {
    event.target.closest(".tile")?.classList.remove("is-just-pinned");
  });

  note.addEventListener("click", async (event) => {
    if (event.target.closest("[data-sites-enable]")) {
      enableTopSites();
    } else if (event.target.closest("[data-sites-retry]")) {
      access = "loading";
      render();
      loadSites();
    } else if (event.target.closest("[data-sites-dismiss]")) {
      access = access === "declined" ? "off" : access;
      await commit((state) => { state.settings.sitesPromptDismissed = true; });
      render();
    }
  });

  settingToggle.addEventListener("click", () => {
    if (access === "on") disableTopSites();
    else if (access === "error") loadSites();
    else enableTopSites();
  });
  document.querySelector("#hidden-sites-restore").addEventListener("click", async () => {
    await commit((state) => { state.hiddenHosts = []; });
    showToast("Hidden sites restored.");
  });

  searchInput.addEventListener("input", updateSuggestions);
  searchInput.addEventListener("keydown", onSearchKeydown);
  searchInput.addEventListener("blur", closeSuggestions);
  // mousedown would move focus out of the field (closing the list) before
  // the click lands, so it is cancelled and the click still fires.
  suggestionList.addEventListener("mousedown", (event) => event.preventDefault());
  suggestionList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-suggestion]");
    const site = option ? suggestions[Number(option.dataset.suggestion)] : null;
    if (site) window.location.assign(site.url);
  });

  return { render, loadSites };
}
