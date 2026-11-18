import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl, clockParts, formatDuration, greetingText, heroSubline, localDateKey, normalizeUrl, timerRemaining, addFocusDay, daysUntil, focusStreak, relativeTime, timerProgress } from "../logic.js";

test("search queries are safely encoded", () => {
  assert.equal(buildSearchUrl("google", "cats & dogs"), "https://www.google.com/search?q=cats%20%26%20dogs");
  assert.equal(buildSearchUrl("unknown", "  hello  "), "https://www.google.com/search?q=hello");
  assert.equal(buildSearchUrl("bing", "   "), null);
});

test("only web URLs are accepted", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("file:///private/data"), null);
});

test("countdown time derives from its deadline", () => {
  assert.equal(timerRemaining({ mode: "focus", status: "running", endsAt: 12000 }, 7000), 5000);
  assert.equal(timerRemaining({ mode: "focus", status: "paused", remainingMs: 4000 }, 9000), 4000);
  assert.equal(timerRemaining({ mode: "focus", status: "running", endsAt: 1000 }, 2000), 0);
});

test("stopwatch time derives from start plus saved elapsed time", () => {
  assert.equal(timerRemaining({ mode: "stopwatch", status: "running", startedAt: 1000, elapsedMs: 2500 }, 4000), 5500);
  assert.equal(timerRemaining({ mode: "stopwatch", status: "paused", elapsedMs: 2500 }, 4000), 2500);
  assert.equal(formatDuration(5500, true), "00:00:06");
});

test("local date keys do not shift through UTC", () => {
  const date = new Date(2026, 10, 16, 23, 30);
  assert.equal(localDateKey(date), "2026-11-16");
});

test("greeting follows the local hour and adds the name when there is one", () => {
  assert.equal(greetingText(5, ""), "Good morning");
  assert.equal(greetingText(11, "Kelvin"), "Good morning, Kelvin");
  assert.equal(greetingText(12, "  Kelvin  "), "Good afternoon, Kelvin");
  assert.equal(greetingText(18, ""), "Good evening");
  assert.equal(greetingText(2, ""), "Good evening");
});

test("hero line reflects the real shortlist", () => {
  assert.equal(heroSubline(0, 0), "What deserves your attention next?");
  assert.equal(heroSubline(3, 1), "One thing left on your shortlist.");
  assert.equal(heroSubline(3, 2), "2 things left on your shortlist.");
  assert.equal(heroSubline(3, 0), "Shortlist cleared. Nice work.");
});

test("clock splits digits from the AM/PM marker", () => {
  const evening = new Date(2026, 10, 16, 21, 5);
  assert.deepEqual(clockParts(evening, true, "en-US"), { time: "9:05", period: "PM" });
  assert.deepEqual(clockParts(evening, false, "en-GB"), { time: "21:05", period: "" });
});

test("focus ring progress follows the countdown and laps for a stopwatch", () => {
  assert.equal(timerProgress({ mode: "focus", status: "paused", durationMs: 1000, remainingMs: 250 }), 0.75);
  assert.equal(timerProgress({ mode: "focus", status: "idle", durationMs: 1000, remainingMs: 1000 }), 0);
  assert.equal(timerProgress({ mode: "focus", status: "finished", durationMs: 1000, remainingMs: 0 }), 1);
  assert.equal(timerProgress({ mode: "stopwatch", status: "paused", elapsedMs: 5400000 }), 0.5);
});

test("days until a date counts calendar days, not 24-hour blocks", () => {
  assert.equal(daysUntil("2026-11-22", "2026-11-16"), 6);
  assert.equal(daysUntil("2026-11-16", "2026-11-16"), 0);
  assert.equal(daysUntil("2026-11-10", "2026-11-16"), -6);
  // Crosses the US daylight-saving change on 2027-03-14.
  assert.equal(daysUntil("2027-03-15", "2027-03-13"), 2);
  assert.equal(daysUntil("", "2026-11-16"), null);
});

test("focus days are recorded once and the streak survives until the next morning", () => {
  const days = addFocusDay(addFocusDay(["2026-11-14", "2026-11-15"], "2026-11-16"), "2026-11-16");
  assert.deepEqual(days, ["2026-11-14", "2026-11-15", "2026-11-16"]);
  assert.equal(focusStreak(days, "2026-11-16"), 3);
  assert.equal(focusStreak(["2026-11-14", "2026-11-15"], "2026-11-16"), 2);
  assert.equal(focusStreak(["2026-11-13"], "2026-11-16"), 0);
  assert.deepEqual(addFocusDay([], "not a date"), []);
});

test("relative times stay short", () => {
  assert.equal(relativeTime(1000, 30000), "just now");
  assert.equal(relativeTime(0, 12 * 60000), "12 min ago");
  assert.equal(relativeTime(0, 3 * 3600000), "3 h ago");
  assert.equal(relativeTime(0, 50 * 3600000), "2 d ago");
});
