import { faviconUrl, hostKey, monogramFor } from "./sites.js";
import { faviconBase } from "./browser-sites.js";
import { bookmarksApiReady, canOfferBookmarks, hasBookmarksAccess, readBookmarks, removeBookmarksAccess, requestBookmarksAccess } from "./browser-bookmarks.js";

const ROW_LIMIT = 6;
const FOLDER_LIMIT = 4;

// Pure tree walk: keep web bookmarks and folders with usable direct children.
export function collectBookmarks(tree) {
  const bookmarks = [];
  const folders = [];
  function visit(node, parent = null) {
    if (typeof node?.url === "string") {
      const host = hostKey(node.url);
      if (host) bookmarks.push({ id: node.id, title: node.title || host, url: node.url, host, folderId: parent?.id ?? "", folder: parent?.title || "Bookmarks" });
      return;
    }
    if (!Array.isArray(node?.children)) return;
    const direct = node.children.filter((child) => typeof child.url === "string" && hostKey(child.url));
    if (parent && direct.length) folders.push({ id: node.id, title: node.title || "Folder" });
    for (const child of node.children) visit(child, node);
  }
  for (const root of Array.isArray(tree) ? tree : []) visit(root);
  return { bookmarks, folders };
}

export function createBookmarksCard({ getWidgets, showToast, escapeHtml }) {
  const list = document.querySelector("#bookmark-list");
  const foldersElement = document.querySelector("#bookmark-folders");
  const note = document.querySelector("#bookmark-note");
  const status = document.querySelector("#bookmarks-setting-status");
  const toggle = document.querySelector("#bookmarks-setting-toggle");
  const manage = document.querySelector("#bookmarks-manage");
  const iconBase = faviconBase();
  let access = "loading";
  let bookmarks = [];
  let folders = [];
  let selectedFolder = "all";

  function rowMarkup(bookmark) {
    const src = faviconUrl(iconBase, bookmark.url, 32);
    const image = src ? `<img class="site-favicon" src="${escapeHtml(src)}" alt="" width="24" height="24" decoding="async">` : "";
    return `<li class="bookmark-row" data-icon="${src ? "pending" : "letter"}">
      <a class="bookmark-link" href="${escapeHtml(bookmark.url)}" title="${escapeHtml(bookmark.title)}">
        <span class="site-plate"><span class="site-letter" aria-hidden="true">${escapeHtml(monogramFor(bookmark.title))}</span>${image}</span>
        <span class="bookmark-text"><span class="bookmark-title">${escapeHtml(bookmark.title)}</span><span class="bookmark-host">${escapeHtml(bookmark.host)}</span></span>
      </a></li>`;
  }

  function render() {
    const hiddenBeforeLoad = access === "loading" && !getWidgets().bookmarks;
    const action = { on: "Turn off", off: "Turn on", declined: "Turn on", error: "Try again" };
    const description = {
      loading: "Checking…", on: "On. Read from Chrome when this tab opens.", off: "Off.",
      declined: "Off.", error: "Chrome didn't answer just now.", unavailable: "Available in the Chrome extension."
    };
    status.textContent = hiddenBeforeLoad ? "Hidden in Display. No bookmarks read from Chrome." : description[access];
    toggle.hidden = hiddenBeforeLoad || !(access in action);
    toggle.textContent = action[access] ?? "";
    const visibleFolders = folders.slice(0, FOLDER_LIMIT);
    foldersElement.innerHTML = access === "on" && visibleFolders.length ? [
      `<button class="bookmark-folder" type="button" data-bookmark-folder="all" aria-pressed="${selectedFolder === "all"}">All</button>`,
      ...visibleFolders.map((folder) => `<button class="bookmark-folder" type="button" data-bookmark-folder="${escapeHtml(folder.id)}" aria-pressed="${selectedFolder === folder.id}"><svg class="icon" aria-hidden="true"><use href="#i-folder" /></svg>${escapeHtml(folder.title)}</button>`)
    ].join("") : "";
    foldersElement.hidden = !foldersElement.innerHTML;
    const shown = bookmarks.filter((bookmark) => selectedFolder === "all" || bookmark.folderId === selectedFolder).slice(0, ROW_LIMIT);
    list.innerHTML = access === "on" ? shown.map(rowMarkup).join("") : "";
    list.hidden = !list.innerHTML;
    const messages = {
      loading: "", off: "Show your Chrome bookmarks here for one-click access.", declined: "Bookmarks are off. You can turn them on whenever you like.",
      error: "Chrome couldn't load bookmarks. Try again.", unavailable: "Bookmarks appear here when Ro5n3R runs as a Chrome extension."
    };
    note.innerHTML = access === "on"
      ? (bookmarks.length ? "" : "No web bookmarks yet. Use Manage to add some in Chrome.")
      : `${messages[access] ?? ""}${access === "off" || access === "declined" || access === "error" ? `<div class="note-actions"><button class="primary-button" type="button" data-bookmarks-enable>${access === "error" ? "Try again" : "Show bookmarks"}</button></div>` : ""}`;
    note.hidden = !note.innerHTML;
    window.setTimeout(() => { list.querySelectorAll('[data-icon="pending"]').forEach((row) => { row.dataset.icon = "letter"; }); }, 350);
  }

  async function load() {
    if (!canOfferBookmarks()) access = "unavailable";
    else if (!(await hasBookmarksAccess())) access = "off";
    else if (!bookmarksApiReady()) access = "unavailable";
    else {
      try {
        ({ bookmarks, folders } = collectBookmarks(await readBookmarks()));
        if (selectedFolder !== "all" && !folders.some((folder) => folder.id === selectedFolder)) selectedFolder = "all";
        access = "on";
      } catch {
        access = "error";
      }
    }
    render();
  }

  async function enable() {
    const granted = await requestBookmarksAccess();
    if (!granted) { access = "declined"; render(); return; }
    if (!bookmarksApiReady()) { window.location.reload(); return; }
    await load();
  }

  async function disable() {
    if (!(await removeBookmarksAccess())) { showToast("Chrome kept bookmarks access on. Try Chrome extension settings."); return; }
    bookmarks = [];
    folders = [];
    selectedFolder = "all";
    access = "off";
    render();
  }

  list.addEventListener("load", (event) => { event.target.closest?.("[data-icon]")?.setAttribute("data-icon", "favicon"); }, true);
  list.addEventListener("error", (event) => { event.target.closest?.("[data-icon]")?.setAttribute("data-icon", "letter"); }, true);
  foldersElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bookmark-folder]");
    if (!button) return;
    selectedFolder = button.dataset.bookmarkFolder;
    render();
  });
  note.addEventListener("click", (event) => { if (event.target.closest("[data-bookmarks-enable]")) access === "error" ? load() : enable(); });
  toggle.addEventListener("click", () => { if (access === "on") disable(); else if (access === "error") load(); else enable(); });
  manage.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs?.create) chrome.tabs.create({ url: "chrome://bookmarks/" });
    else window.location.assign("chrome://bookmarks/");
  });
  if (typeof chrome !== "undefined" && chrome.bookmarks) {
    for (const event of [chrome.bookmarks.onCreated, chrome.bookmarks.onRemoved, chrome.bookmarks.onChanged, chrome.bookmarks.onMoved]) {
      event?.addListener(() => { if (access === "on") load(); });
    }
  }

  return { load, render };
}
