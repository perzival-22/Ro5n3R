# Ro5n3R

Ro5n3R is a lightweight Chrome New Tab launchpad: search, pinned shortcuts, today's schedule, recent history, bookmarks, and optional weather. Pins, schedules, and settings stay in `chrome.storage.local`.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project folder.
5. Open a new tab.

No install or build command is required. The extension uses native browser modules and has no production dependencies.

## Checks

```bash
npm run check
```

## What you see

- **A three-column Night Bloom dashboard.** On the left: today's schedule and six recently visited sites. In the centre: clock, greeting, search, engine chips and pinned or most-visited site tiles. On the right: weather and Chrome bookmarks. Narrower windows stack the columns, launchpad first. The weather card and Settings both let you switch between Fahrenheit and Celsius.
- **Light or dark.** Dark by default, with light and system options in Settings. The clock and side panels can each use Baby Pink, Dark red, Dark green, or Ocean Blue.
- **Choose your density.** Settings → Display has a Minimal preset and individual switches for the clock, search engines, Today, Recent, Weather, Bookmarks, most-visited sites, and the second site row. Minimal shows search and one row of pinned sites, plus the Settings control. Show all restores the full dashboard; saved pins and widget data are retained.
- **Use your own background.** Settings → Background lets you choose a JPG, PNG, or WebP picture, preview it, and switch between the picture and the default dark/light canvas. The picture is resized and saved only in this Chrome profile. Remove picture deletes the saved copy.
- **Your own sites with their real icons.** Pinned sites come first; your most-visited sites fill the rest, one tile per site. A site with no icon gets a letter tile in the brand colour.
- **Chrome bookmarks.** Turn on optional access from the Bookmarks panel or Settings. Browse folder chips, open a recent bookmark, or select Manage to use Chrome's bookmark manager.
- **Weather for your city.** Enter a city in Settings and choose Fahrenheit or Celsius there or on the weather card. The extension fetches current conditions when the tab opens or you change the city or units. Weather data comes from Open-Meteo.
- **Jump to a site from search.** Typing shows your matching sites under the bar; press Down then Enter to go straight there. Enter on its own always searches.

## Keyboard

| Key | Does |
| --- | --- |
| `/` | Focus search |
| `Down` in search | Move into suggestions, or to the first tile when there are none |
| Arrow keys, `Home`, `End` on tiles | Move between tiles (`Up` on the first row returns to search) |
| `P` on a tile | Pin or unpin it |
| `Delete` on a tile | Unpin it, or hide a suggestion |

Chrome puts the cursor in the address bar when a new tab opens and extensions cannot change that, so press `/` to type in the page's search bar.

## Permissions

| Permission | Kind | Why |
| --- | --- | --- |
| `storage` | required | Saves pins, schedule items, settings, and an optional resized background picture in this Chrome profile. |
| `favicon` | required | Shows each site's real icon from Chrome's local icon cache. |
| `topSites` | optional | Reads your most-visited sites. Chrome asks only when you choose **Show my sites**, and you can turn it off in Settings. |
| `history` | optional | Shows your six most recent sites in the Recent card. Chrome asks only when you choose **Show recent pages**, and you can turn it off in Settings. |
| `bookmarks` | optional | Shows Chrome bookmarks and folders. Chrome asks only when you choose **Show bookmarks**, and you can turn it off in Settings. |
| Open-Meteo hosts | required network access | Looks up the city you enter and fetches current weather. |

The most-visited list, recent history, and bookmarks are read from Chrome when a tab opens (history and bookmarks also when you return to the tab). They are not written to storage or sent anywhere. The city you enter is sent to Open-Meteo for weather lookup.

Read the [privacy policy](PRIVACY.md) for the complete data-handling disclosure.

## Resource choices

- The default dark canvas, clock bloom, and panels use CSS shapes and solid fills. A user-uploaded picture can replace the canvas; it is resized to fit local storage and shown through translucent widgets with a light tint for legibility. No blur filters are used.
- System fonts, an inline SVG icon sprite, and local favicons instead of downloaded fonts, icon libraries or remote icon services.
- One read of the most-visited list and weather per tab, plus weather refreshes for user changes, with no polling.
- Minute-level clock painting only while the page is visible.
- Bounded lists: nine site tiles in full view or five pinned sites in one-row view, four search suggestions, six history rows, six bookmark rows and four schedule items.
- No content scripts or OAuth. Weather is the only network feature.

See [BUILD_PLAN.md](BUILD_PLAN.md) for later opt-in integrations and [docs/design/ro5n3r-design.md](docs/design/ro5n3r-design.md) for the UI handoff.
