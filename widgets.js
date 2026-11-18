export const DEFAULT_WIDGETS = Object.freeze({
  clock: true,
  searchEngines: true,
  today: true,
  recent: true,
  weather: true,
  bookmarks: true,
  mostVisited: true,
  secondRow: true
});

export const MINIMAL_WIDGETS = Object.freeze(Object.fromEntries(
  Object.keys(DEFAULT_WIDGETS).map((key) => [key, false])
));

export function normalizeWidgets(saved) {
  return Object.fromEntries(Object.entries(DEFAULT_WIDGETS).map(([key, fallback]) => [
    key, typeof saved?.[key] === "boolean" ? saved[key] : fallback
  ]));
}

export function isMinimalLayout(widgets) {
  return Object.keys(DEFAULT_WIDGETS).every((key) => widgets[key] === false);
}

export function siteLimit(widgets) {
  return widgets.secondRow ? 9 : 5;
}

export function showAddSiteTile(siteCount, widgets) {
  return widgets.secondRow || siteCount < 5;
}
