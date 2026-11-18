import test from "node:test";
import assert from "node:assert/strict";
import { EXIT_UP, faviconUrl, hostKey, matchSites, mergeSites, monogramFor, nextTileIndex, recentPages, siteLabel } from "../sites.js";

test("hostKey treats www and letter case as the same site", () => {
  assert.equal(hostKey("https://www.GitHub.com/kelvin/repo"), "github.com");
  assert.equal(hostKey("http://mail.google.com/mail/u/0/"), "mail.google.com");
});

test("hostKey rejects anything that is not a web page", () => {
  assert.equal(hostKey("javascript:alert(1)"), null);
  assert.equal(hostKey("chrome://settings"), null);
  assert.equal(hostKey("file:///private/data"), null);
  assert.equal(hostKey("not a url"), null);
});

test("siteLabel keeps short titles, then the site name, then the host", () => {
  assert.equal(siteLabel("YouTube", "https://www.youtube.com/"), "YouTube");
  assert.equal(siteLabel("Inbox (3) - someone@example.com - Gmail", "https://mail.google.com/mail/"), "Gmail");
  assert.equal(siteLabel("A very long page title with no separator at all", "https://blog.example.com/post"), "blog.example.com");
  assert.equal(siteLabel("Short - but a very long trailing part that keeps on going", "https://x.example/"), "x.example");
  assert.equal(siteLabel("", "https://www.example.com/"), "example.com");
  assert.equal(siteLabel("https://example.com/some/page", "https://example.com/some/page"), "example.com");
});

test("monogramFor picks the first letter or digit", () => {
  assert.equal(monogramFor("github.com"), "G");
  assert.equal(monogramFor("  (1) Notion"), "1");
  assert.equal(monogramFor("éclair"), "É");
  assert.equal(monogramFor("—"), "•");
});

test("faviconUrl encodes the page address and never builds one for unsafe URLs", () => {
  const base = "chrome-extension://abc/_favicon/";
  assert.equal(
    faviconUrl(base, "https://example.com/a?b=c&d=e"),
    "chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc%26d%3De&size=64"
  );
  assert.equal(faviconUrl(base, "https://example.com/", 32).endsWith("&size=32"), true);
  assert.equal(faviconUrl(base, "javascript:alert(1)"), null);
  assert.equal(faviconUrl(null, "https://example.com/"), null);
});

test("mergeSites puts pins first and shows each host once", () => {
  const sites = mergeSites({
    shortcuts: [{ id: "a", label: "GitHub", url: "https://github.com/" }],
    topSites: [
      { title: "kelvin/repo", url: "https://github.com/kelvin/repo" },
      { title: "YouTube", url: "https://www.youtube.com/" },
      { title: "YouTube - Watch later", url: "https://www.youtube.com/playlist?list=WL" },
      { title: "Docs", url: "https://docs.google.com/document/u/0/" }
    ]
  });
  assert.deepEqual(sites.map((site) => site.key), ["pin:a", "top:youtube.com", "top:docs.google.com"]);
  assert.deepEqual(sites.map((site) => site.pinned), [true, false, false]);
  // The first (most visited) URL for a host is the one that is kept.
  assert.equal(sites[1].url, "https://www.youtube.com/");
});

test("mergeSites drops hidden hosts and unsafe URLs, and respects the limit", () => {
  const sites = mergeSites({
    shortcuts: [{ id: "bad", label: "Bad", url: "javascript:alert(1)" }],
    topSites: [
      { title: "Settings", url: "chrome://settings/" },
      { title: "One", url: "https://one.example/" },
      { title: "Two", url: "https://two.example/" },
      { title: "Three", url: "https://three.example/" }
    ],
    hiddenHosts: ["two.example"],
    limit: 1
  });
  assert.deepEqual(sites.map((site) => site.host), ["one.example"]);
});

test("mergeSites works with no browsing data at all", () => {
  assert.deepEqual(mergeSites({}), []);
});

test("matchSites ranks name-start matches first and ignores blank queries", () => {
  const sites = mergeSites({
    topSites: [
      { title: "Digital Hub", url: "https://hub.example/" },
      { title: "GitHub", url: "https://github.com/" },
      { title: "Gitea", url: "https://code.example/" },
      { title: "News", url: "https://news.example/" }
    ]
  });
  // "Digital Hub" only contains "git" in the middle of a word, so it ranks last.
  assert.deepEqual(matchSites(sites, "git").map((site) => site.label), ["GitHub", "Gitea", "Digital Hub"]);
  assert.deepEqual(matchSites(sites, "HUB").map((site) => site.label), ["Digital Hub", "GitHub"]);
  assert.deepEqual(matchSites(sites, "   "), []);
  assert.deepEqual(matchSites(sites, "zzz"), []);
  assert.equal(matchSites(sites, "e", 2).length, 2);
});

test("arrow keys move through a 5-column grid of 7 tiles", () => {
  assert.equal(nextTileIndex(0, "ArrowRight", 7, 5), 1);
  assert.equal(nextTileIndex(6, "ArrowRight", 7, 5), 6);
  assert.equal(nextTileIndex(0, "ArrowLeft", 7, 5), 0);
  assert.equal(nextTileIndex(1, "ArrowDown", 7, 5), 6);
  // No tile directly below index 3 (it would be index 8), so focus stays.
  assert.equal(nextTileIndex(3, "ArrowDown", 7, 5), 3);
  assert.equal(nextTileIndex(6, "ArrowUp", 7, 5), 1);
  assert.equal(nextTileIndex(2, "ArrowUp", 7, 5), EXIT_UP);
  assert.equal(nextTileIndex(4, "Home", 7, 5), 0);
  assert.equal(nextTileIndex(0, "End", 7, 5), 6);
});

test("recent pages are newest first, one per site, web pages only", () => {
  const rows = recentPages([
    { url: "https://mail.google.com/mail/u/0/#inbox", title: "Inbox", lastVisitTime: 300 },
    { url: "chrome://extensions", title: "Extensions", lastVisitTime: 500 },
    { url: "https://github.com/", title: "GitHub", lastVisitTime: 400 },
    { url: "https://mail.google.com/mail/u/0/#sent", title: "Sent", lastVisitTime: 350 },
    { url: "https://drive.google.com/", title: "", lastVisitTime: 100 },
    { url: "https://example.com/", title: "Example", lastVisitTime: 50 }
  ]);
  assert.deepEqual(rows.map((row) => row.host), ["github.com", "mail.google.com", "drive.google.com"]);
  assert.equal(rows[1].title, "Sent");
  assert.equal(rows[2].title, "drive.google.com");
});
