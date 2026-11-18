import test from "node:test";
import assert from "node:assert/strict";
import { loadState, saveState } from "../storage.js";
import { DEFAULT_WIDGETS, MINIMAL_WIDGETS } from "../widgets.js";

test("clock and panel colors persist independently with the existing state", async () => {
  const saved = new Map();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    }
  });

  try {
    const state = await loadState();
    assert.equal(state.settings.theme, "dark");
    assert.equal(state.settings.backgroundMode, "theme");
    assert.equal(state.settings.weatherUnit, "fahrenheit");
    assert.deepEqual(state.settings.widgets, DEFAULT_WIDGETS);
    state.settings.clockColor = "baby-pink";
    state.settings.panelColor = "ocean-blue";
    state.settings.weatherCity = "Portland, Maine";
    state.settings.weatherUnit = "celsius";
    state.settings.backgroundMode = "photo";
    state.settings.widgets = MINIMAL_WIDGETS;
    state.tasks.push({ id: "kept", title: "Keep this task" });
    await saveState(state);

    const reloaded = await loadState();
    assert.equal(reloaded.settings.clockColor, "baby-pink");
    assert.equal(reloaded.settings.panelColor, "ocean-blue");
    assert.equal(reloaded.settings.weatherCity, "Portland, Maine");
    assert.equal(reloaded.settings.weatherUnit, "celsius");
    assert.equal(reloaded.settings.backgroundMode, "photo");
    assert.deepEqual(reloaded.settings.widgets, MINIMAL_WIDGETS);
    assert.equal(reloaded.tasks[0].id, "kept");
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  }
});
