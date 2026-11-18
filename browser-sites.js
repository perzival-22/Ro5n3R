// The only file that talks to Chrome about the user's browsing.
// Everything here reads from Chrome on demand and hands the result straight
// to the page. Nothing is saved to storage and nothing is sent anywhere.

// "topSites" is an *optional* permission (see manifest.json): Chrome only
// grants it after the user clicks our button, and the user can take it back.
const TOP_SITES_PERMISSION = { permissions: ["topSites"] };

function hasPermissionsApi() {
  return typeof chrome !== "undefined" && Boolean(chrome.permissions?.contains);
}

/** False when the page is opened outside the extension (for example as a plain file). */
export function canOfferTopSites() {
  return hasPermissionsApi();
}

export async function hasTopSitesAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.contains(TOP_SITES_PERMISSION);
  } catch {
    return false;
  }
}

/**
 * Shows Chrome's permission prompt. Chrome only allows this inside a user
 * gesture, so call it directly from a click handler with no `await` before it.
 * Resolves true when granted, false when the user declines.
 */
export async function requestTopSitesAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.request(TOP_SITES_PERMISSION);
  } catch {
    return false;
  }
}

/** Gives the permission back to Chrome. Resolves false if Chrome refuses. */
export async function removeTopSitesAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.remove(TOP_SITES_PERMISSION);
  } catch {
    return false;
  }
}

/** True once chrome.topSites exists in this page (it appears when access is granted). */
export function topSitesApiReady() {
  return typeof chrome !== "undefined" && Boolean(chrome.topSites?.get);
}

/**
 * Reads the most-visited list once. Throws when the API is missing so the
 * caller can show the "couldn't read" state instead of an empty grid.
 */
export async function readTopSites() {
  if (typeof chrome === "undefined" || !chrome.topSites?.get) throw new Error("topSites API is not available");
  const sites = await chrome.topSites.get();
  return Array.isArray(sites) ? sites : [];
}

/** Base address of Chrome's local favicon endpoint, or null outside the extension. */
export function faviconBase() {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return null;
  return chrome.runtime.getURL("/_favicon/");
}
