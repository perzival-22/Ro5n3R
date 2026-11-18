const BACKGROUND_KEY = "ro5n3rBackgroundImage";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 24_000_000;
const MAX_STORED_LENGTH = 2_500_000;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isBackgroundImage(value) {
  return typeof value === "string"
    && value.length <= MAX_STORED_LENGTH
    && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

// Resizing before storage keeps photos below Chrome's local quota without
// retaining the original file or adding an image-processing dependency.
export async function prepareBackgroundImage(file) {
  if (!SUPPORTED_TYPES.has(file?.type)) throw new Error("Choose a JPG, PNG, or WebP picture.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Choose a picture smaller than 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error("Choose a picture below 24 megapixels.");
    const canvas = document.createElement("canvas");
    const baseScale = Math.min(1, 1920 / bitmap.width, 1080 / bitmap.height);
    for (const shrink of [1, 0.75, 0.55]) {
      canvas.width = Math.max(1, Math.round(bitmap.width * baseScale * shrink));
      canvas.height = Math.max(1, Math.round(bitmap.height * baseScale * shrink));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not prepare the picture.");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.48]) {
        const result = canvas.toDataURL("image/webp", quality);
        if (isBackgroundImage(result)) return result;
      }
    }
    throw new Error("This picture is still too large. Choose a simpler or smaller image.");
  } finally {
    bitmap.close();
  }
}

function hasChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function loadBackgroundImage() {
  try {
    const value = hasChromeStorage()
      ? (await chrome.storage.local.get(BACKGROUND_KEY))[BACKGROUND_KEY]
      : localStorage.getItem(BACKGROUND_KEY);
    return isBackgroundImage(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveBackgroundImage(value) {
  if (!isBackgroundImage(value)) throw new Error("This picture could not be saved.");
  if (hasChromeStorage()) await chrome.storage.local.set({ [BACKGROUND_KEY]: value });
  else localStorage.setItem(BACKGROUND_KEY, value);
}

export async function deleteBackgroundImage() {
  if (hasChromeStorage()) await chrome.storage.local.remove(BACKGROUND_KEY);
  else localStorage.removeItem(BACKGROUND_KEY);
}

export function subscribeToBackgroundImage(callback) {
  if (!hasChromeStorage()) return () => {};
  const listener = (changes, area) => {
    if (area === "local" && BACKGROUND_KEY in changes) {
      const value = changes[BACKGROUND_KEY].newValue;
      callback(isBackgroundImage(value) ? value : null);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
