// The only file that reads the user's browsing history. Like browser-sites.js,
// it reads on demand and hands the result to the page: nothing is saved to
// storage and nothing is sent anywhere.

// "history" is an *optional* permission (see manifest.json): Chrome asks only
// when the user clicks "Show recent pages", and the user can take it back.
const HISTORY_PERMISSION = { permissions: ["history"] };
const LOOK_BACK_MS = 7 * 24 * 60 * 60 * 1000;
// Asks for more rows than the card shows because several can belong to one
// site; recentPages() in sites.js then keeps one per site.
const MAX_RESULTS = 40;

function hasPermissionsApi() {
  return typeof chrome !== "undefined" && Boolean(chrome.permissions?.contains);
}

export function canOfferHistory() {
  return hasPermissionsApi();
}

export async function hasHistoryAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.contains(HISTORY_PERMISSION);
  } catch {
    return false;
  }
}

/** Call straight from a click handler: Chrome only shows the prompt during a user gesture. */
export async function requestHistoryAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.request(HISTORY_PERMISSION);
  } catch {
    return false;
  }
}

export async function removeHistoryAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.remove(HISTORY_PERMISSION);
  } catch {
    return false;
  }
}

export function historyApiReady() {
  return typeof chrome !== "undefined" && Boolean(chrome.history?.search);
}

/** The last week's visits, newest first. Throws when the API is missing. */
export async function readRecentHistory(now = Date.now()) {
  if (!historyApiReady()) throw new Error("history API is not available");
  const items = await chrome.history.search({ text: "", startTime: now - LOOK_BACK_MS, maxResults: MAX_RESULTS });
  return Array.isArray(items) ? items : [];
}
