export const SEARCH_ENGINES = Object.freeze({
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  brave: { label: "Brave", url: "https://search.brave.com/search?q=" }
});

export function buildSearchUrl(engine, query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;
  const selectedEngine = SEARCH_ENGINES[engine] ?? SEARCH_ENGINES.google;
  return `${selectedEngine.url}${encodeURIComponent(normalizedQuery)}`;
}

export function normalizeUrl(input) {
  const candidate = input.trim();
  if (!candidate) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function timerRemaining(timer, now = Date.now()) {
  if (timer.mode === "stopwatch") {
    const activeElapsed = timer.status === "running" ? now - timer.startedAt : 0;
    return Math.max(0, timer.elapsedMs + activeElapsed);
  }
  if (timer.status !== "running") return Math.max(0, timer.remainingMs);
  return Math.max(0, timer.endsAt - now);
}

export function formatDuration(milliseconds, countUp = false) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0 || countUp) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function uid(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Morning, afternoon or evening, from the local hour (0-23). */
export function greetingPeriod(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function greetingText(hour, name = "") {
  const cleanName = name.trim();
  return `Good ${greetingPeriod(hour)}${cleanName ? `, ${cleanName}` : ""}`;
}

/**
 * The quiet line under the greeting. It reflects the real shortlist so the
 * first thing the user reads is true and useful, not a slogan.
 */
export function heroSubline(totalTasks, tasksLeft) {
  if (totalTasks === 0) return "What deserves your attention next?";
  if (tasksLeft === 0) return "Shortlist cleared. Nice work.";
  return tasksLeft === 1 ? "One thing left on your shortlist." : `${tasksLeft} things left on your shortlist.`;
}

/**
 * Splits a time into its digits and its AM/PM marker so the UI can draw the
 * marker smaller than the digits. `locale` is a parameter only so tests are
 * not at the mercy of the machine's language settings.
 */
export function clockParts(date, hour12, locale = undefined) {
  const parts = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12 }).formatToParts(date);
  const period = parts.find((part) => part.type === "dayPeriod")?.value ?? "";
  const time = parts
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim();
  return { time, period };
}

/** How far round the focus ring should be, from 0 to 1. */
export function timerProgress(timer, now = Date.now()) {
  if (timer.status === "finished") return 1;
  const value = timerRemaining(timer, now);
  // A stopwatch has no end, so its ring laps once an hour like a clock hand.
  if (timer.mode === "stopwatch") return (value % 3600000) / 3600000;
  if (!timer.durationMs) return 0;
  return Math.min(1, Math.max(0, 1 - value / timer.durationMs));
}

// Date keys ("2026-11-16") are compared as calendar days. Building them with
// Date.UTC from the parts means a daylight-saving change can never make a day
// 23 or 25 hours long and shift the answer.
function dayNumber(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey ?? "");
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
}

/** Whole days from `todayKey` to `targetKey`; negative once it has passed, null when either is missing. */
export function daysUntil(targetKey, todayKey) {
  const target = dayNumber(targetKey);
  const today = dayNumber(todayKey);
  return target === null || today === null ? null : target - today;
}

/** Adds a day to the focus log once, keeping it sorted and bounded to about a year. */
export function addFocusDay(days, dateKey, limit = 400) {
  if (dayNumber(dateKey) === null) return [...days];
  return [...new Set([...days, dateKey])].sort().slice(-limit);
}

/**
 * Days in a row with a finished focus session. A streak still counts when
 * the latest day was yesterday, so it doesn't read 0 every morning before
 * the first session.
 */
export function focusStreak(days, todayKey) {
  const numbers = new Set(days.map(dayNumber).filter((value) => value !== null));
  const today = dayNumber(todayKey);
  if (today === null) return 0;
  let cursor = numbers.has(today) ? today : today - 1;
  let streak = 0;
  while (numbers.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function relativeTime(then, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
