// Pure rules for the launchpad's site tiles. Nothing in this file touches the
// DOM or the chrome.* APIs, so every function can be tested with plain Node.

const MAX_TITLE_LENGTH = 22;

/**
 * The key we use to say "these two URLs are the same site".
 * Why the host and not the full URL: Chrome's most-visited list often holds
 * several pages from one site, and a launchpad wants one tile per site.
 * Returns null for anything that is not a normal web page, which is also what
 * keeps `javascript:` or `chrome://` URLs from ever becoming a clickable tile.
 */
export function hostKey(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// The separators sites put between the page name and the site name,
// as in "Inbox (3) - me@example.com - Gmail" or "Pull requests · GitHub".
const TITLE_SEPARATOR = /\s+[-–—|·•]\s+/;

/**
 * A short name for a tile, chosen in this order:
 *  1. the page title, when it is already short ("YouTube");
 *  2. the last part of a long title, where sites usually put their own name
 *     ("Inbox (3) - me@example.com - Gmail" becomes "Gmail");
 *  3. the host, which is always short enough to recognise.
 */
export function siteLabel(title, url) {
  const cleanTitle = (title ?? "").trim();
  const host = hostKey(url) ?? "";
  const looksLikeUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(cleanTitle);
  if (!cleanTitle || looksLikeUrl) return host || cleanTitle;
  if (cleanTitle.length <= MAX_TITLE_LENGTH) return cleanTitle;
  const lastPart = cleanTitle.split(TITLE_SEPARATOR).at(-1).trim();
  if (lastPart && lastPart !== cleanTitle && lastPart.length <= MAX_TITLE_LENGTH) return lastPart;
  return host || cleanTitle;
}

/** The single letter shown on the brand-coloured tile when a site has no icon. */
export function monogramFor(label) {
  const firstUseful = [...(label ?? "")].find((character) => /[\p{L}\p{N}]/u.test(character));
  return firstUseful ? firstUseful.toUpperCase() : "•";
}

/**
 * Builds the address of Chrome's local favicon endpoint for one page.
 * `base` is `chrome.runtime.getURL("/_favicon/")`; it is passed in so this
 * function stays pure. The icon comes from Chrome's own on-disk cache, so no
 * request leaves the machine.
 */
export function faviconUrl(base, pageUrl, size = 64) {
  if (!base || hostKey(pageUrl) === null) return null;
  const url = new URL(base);
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}

/**
 * Combines the user's pinned shortcuts with Chrome's most-visited sites.
 * Order of the rules, and why:
 *  1. Pinned sites come first and keep the user's order: a pin is a promise
 *     that the tile stays where it is.
 *  2. Most-visited sites fill the remaining slots, in Chrome's ranking.
 *  3. A site appears once: a host that is pinned, hidden, or already listed
 *     is skipped.
 */
export function mergeSites({ shortcuts = [], topSites = [], hiddenHosts = [], limit = 9 }) {
  const merged = [];
  const seenUrls = new Set();
  const usedHosts = new Set();

  for (const shortcut of shortcuts) {
    const host = hostKey(shortcut.url);
    if (host === null || seenUrls.has(shortcut.url)) continue;
    seenUrls.add(shortcut.url);
    usedHosts.add(host);
    merged.push({
      key: `pin:${shortcut.id}`,
      id: shortcut.id,
      host,
      url: shortcut.url,
      label: shortcut.label,
      title: shortcut.label,
      pinned: true
    });
  }

  const hidden = new Set(hiddenHosts);
  for (const site of topSites) {
    const host = hostKey(site.url);
    if (host === null || usedHosts.has(host) || hidden.has(host)) continue;
    usedHosts.add(host);
    merged.push({
      key: `top:${host}`,
      id: null,
      host,
      url: site.url,
      label: siteLabel(site.title, site.url),
      title: (site.title ?? "").trim() || host,
      pinned: false
    });
  }

  return merged.slice(0, Math.max(0, limit));
}

// Lower is better. A match at the start of the name beats a match at the
// start of the address, which beats a match somewhere in the middle.
function matchRank(site, query) {
  const label = site.label.toLowerCase();
  const host = site.host.toLowerCase();
  if (label.startsWith(query)) return 0;
  if (host.startsWith(query)) return 1;
  if (label.split(/[\s\-_.]+/).some((word) => word.startsWith(query))) return 2;
  if (label.includes(query) || host.includes(query)) return 3;
  return null;
}

/** The user's own sites that match what they are typing, best match first. */
export function matchSites(sites, query, limit = 4) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return sites
    .map((site, index) => ({ site, index, rank: matchRank(site, normalized) }))
    .filter((entry) => entry.rank !== null)
    // Ties keep their original order, so pinned sites stay ahead.
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.site);
}

export const EXIT_UP = -1;

/**
 * Where an arrow key moves focus inside the tile grid.
 * Returns the new index, the same index when there is nowhere to go, or
 * EXIT_UP when the user presses Up on the first row (focus returns to search).
 */
export function nextTileIndex(index, key, count, columns) {
  if (count <= 0) return 0;
  const lastIndex = count - 1;
  switch (key) {
    case "ArrowRight": return Math.min(lastIndex, index + 1);
    case "ArrowLeft": return Math.max(0, index - 1);
    case "ArrowDown": return index + columns <= lastIndex ? index + columns : index;
    case "ArrowUp": return index - columns >= 0 ? index - columns : EXIT_UP;
    case "Home": return 0;
    case "End": return lastIndex;
    default: return index;
  }
}

/**
 * The few recent pages for the History card: web pages only, newest first,
 * one row per site so three visits to one inbox don't fill the card.
 */
export function recentPages(items, limit = 3) {
  const seenHosts = new Set();
  const rows = [];
  const sorted = [...items].sort((a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0));
  for (const item of sorted) {
    const host = hostKey(item.url);
    if (host === null || seenHosts.has(host)) continue;
    seenHosts.add(host);
    rows.push({ url: item.url, host, title: (item.title ?? "").trim() || host, visitedAt: item.lastVisitTime ?? 0 });
    if (rows.length >= limit) break;
  }
  return rows;
}
