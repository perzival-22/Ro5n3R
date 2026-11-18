import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WIDGETS, MINIMAL_WIDGETS, isMinimalLayout, normalizeWidgets, showAddSiteTile, siteLimit } from "../widgets.js";

test("minimal preset removes every optional widget", () => {
  assert.equal(isMinimalLayout(MINIMAL_WIDGETS), true);
  assert.equal(isMinimalLayout(DEFAULT_WIDGETS), false);
  assert.equal(Object.values(MINIMAL_WIDGETS).every((value) => value === false), true);
});

test("partial saved choices inherit newly added widget defaults", () => {
  const widgets = normalizeWidgets({ clock: false, weather: false, bookmarks: "false" });
  assert.equal(widgets.clock, false);
  assert.equal(widgets.weather, false);
  assert.equal(widgets.bookmarks, true);
  assert.equal(widgets.secondRow, true);
});

test("one-row mode fits pinned sites and the add action in five positions", () => {
  assert.equal(siteLimit(MINIMAL_WIDGETS), 5);
  assert.equal(showAddSiteTile(4, MINIMAL_WIDGETS), true);
  assert.equal(showAddSiteTile(5, MINIMAL_WIDGETS), false);
  assert.equal(siteLimit(DEFAULT_WIDGETS), 9);
  assert.equal(showAddSiteTile(9, DEFAULT_WIDGETS), true);
});
