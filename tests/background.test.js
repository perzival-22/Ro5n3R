import test from "node:test";
import assert from "node:assert/strict";
import { deleteBackgroundImage, isBackgroundImage, loadBackgroundImage, prepareBackgroundImage, saveBackgroundImage } from "../background.js";

test("only bounded WebP data pictures can be stored", () => {
  assert.equal(isBackgroundImage("data:image/webp;base64,AAAA"), true);
  assert.equal(isBackgroundImage("data:image/svg+xml;base64,AAAA"), false);
  assert.equal(isBackgroundImage("data:image/webp;base64,AAAA\";color:red"), false);
  assert.equal(isBackgroundImage(`data:image/webp;base64,${"A".repeat(2_500_000)}`), false);
});

test("saved background picture can be loaded and removed independently", async () => {
  const saved = new Map();
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key)
  } });
  try {
    const picture = "data:image/webp;base64,AAAA";
    await saveBackgroundImage(picture);
    assert.equal(await loadBackgroundImage(), picture);
    await deleteBackgroundImage();
    assert.equal(await loadBackgroundImage(), null);
    await assert.rejects(saveBackgroundImage("https://example.com/image.webp"));
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  }
});

test("uploaded pictures are resized before they are stored", async () => {
  const previousBitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let closed = false;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
    toDataURL: () => "data:image/webp;base64,AAAA"
  };
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width: 4000, height: 2000, close() { closed = true; } }) });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  try {
    assert.equal(await prepareBackgroundImage({ type: "image/png", size: 1000 }), "data:image/webp;base64,AAAA");
    assert.equal(canvas.width, 1920);
    assert.equal(canvas.height, 960);
    assert.equal(closed, true);
    await assert.rejects(prepareBackgroundImage({ type: "image/svg+xml", size: 1000 }));
  } finally {
    if (previousBitmap) Object.defineProperty(globalThis, "createImageBitmap", previousBitmap);
    else delete globalThis.createImageBitmap;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
  }
});
