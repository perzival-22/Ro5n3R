# Ro5n3R design handoff

> Updated 2026-11-17 for version 0.6.0. This document describes the current Night Bloom dashboard.

## Product job

Turn every new tab into a calm launchpad for the next useful action: search, open a pinned site, return to a recent page, or open a bookmark.

## Layout

- At 1440px, use three columns: 320px Today and Recent, a flexible centered launchpad, and 320px Weather and Bookmarks. The outer gutter is 56px.
- The clock sits in a static scalloped bloom above the greeting. Search stays near the visual center, followed by engine chips and a bounded two-row site grid.
- Below 1180px, the launchpad spans the first row and the two side columns sit beneath it. Below 760px, the columns stack launchpad, Weather and Bookmarks, then Today and Recent.
- The Ro5n3R badge lives at the bottom left on desktop and after the content on narrow windows.

## Visual system

- True black dark canvas and Sky `#D3E8FF` light canvas. Google Blue `#0B57D0` remains the product brand.
- An optional user picture replaces the canvas while the light/dark choice continues to color controls and text. JPG, PNG, and WebP uploads are resized to WebP, capped for local storage, and can be removed. A theme tint and translucent center shape protect readability.
- Clock and side-panel colors are independent Settings choices: default blue, Baby Pink, Dark red, Dark green, or Ocean Blue. CSS tokens carry these choices through both themes.
- Side panels use opaque rounded fills with no backdrop blur. The clock and center backdrop are static CSS shapes. Press feedback, visible focus rings, and reduced-motion support remain.

## Content and behavior

- **Today:** up to four current-day schedule items, an empty state, and an Add to schedule action.
- **Recent:** up to six recently visited web sites, read from Chrome after optional history access. All history opens Chrome's manager.
- **Launchpad:** local clock, greeting, search, engine chips, pinned shortcuts, and optional most-visited suggestions. Pins are first; Add site opens a small form.
- **Weather:** optional city entered in Settings. Open-Meteo geocoding and current conditions are fetched once per tab or when the city changes. The empty and error states have clear actions.
- **Bookmarks:** optional Chrome bookmarks access. The card shows folder chips, up to six web bookmark links, and Manage opens Chrome's manager. The bookmark tree stays in memory for the tab.
- Settings retains theme, time format, name, and independent clock and panel colors. The removed Quick Capture, Quick Stats, Shortlist, and Focus timer are absent from the page. Their old saved values are left intact for existing users.
- Settings → Display offers a Minimal preset, Show all, and individual switches. Search and pinned sites are always present. Minimal shows search and one row of pins with the Settings control; hidden widgets keep their saved data. On narrow windows the one-row grid uses five compact columns.

## Resource and privacy rules

- Keep production dependencies at zero. No wallpaper, card blur, embedded media, or background polling.
- Most-visited sites, history, and bookmarks are read from Chrome and never copied to extension storage.
- A user-entered city is saved locally and sent to Open-Meteo only to request weather; location permission is not used.
- Search and local pins remain useful when browser permissions are declined or weather is unavailable.

The main implementation technique is to keep remote and permission-dependent cards useful in their empty state while the local launchpad appears immediately.
