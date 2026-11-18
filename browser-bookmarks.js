// Chrome bookmarks stay in Chrome. The new-tab page reads them only after
// the user grants this optional permission, and never copies them to storage.
const BOOKMARKS_PERMISSION = { permissions: ["bookmarks"] };

function hasPermissionsApi() {
  return typeof chrome !== "undefined" && Boolean(chrome.permissions?.contains);
}

export function canOfferBookmarks() {
  return hasPermissionsApi();
}

export async function hasBookmarksAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.contains(BOOKMARKS_PERMISSION);
  } catch {
    return false;
  }
}

export async function requestBookmarksAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.request(BOOKMARKS_PERMISSION);
  } catch {
    return false;
  }
}

export async function removeBookmarksAccess() {
  if (!hasPermissionsApi()) return false;
  try {
    return await chrome.permissions.remove(BOOKMARKS_PERMISSION);
  } catch {
    return false;
  }
}

export function bookmarksApiReady() {
  return typeof chrome !== "undefined" && Boolean(chrome.bookmarks?.getTree);
}

export async function readBookmarks() {
  if (!bookmarksApiReady()) throw new Error("bookmarks API is not available");
  return chrome.bookmarks.getTree();
}
