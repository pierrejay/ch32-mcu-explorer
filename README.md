# WCH RISC-V MCU Explorer

Per-part-number specifications of WCH RISC-V microcontrollers (CH32V/L/X/H/M, CH56x, CH57x/58x/59x, CH64x):
look up one part, filter candidates against requirements, compare several side by side.

- Static site: HTML + CSS + two plain scripts. No npm, no build, no framework, no network calls.
- Works by **double-clicking `index.html`** (file://) or on any static host (GitHub Pages).
- Data sourced from WCH datasheets and openwch repositories; every part lists its sources.

## Use

| Task | How |
| --- | --- |
| Specs of one part | Type the part number in the top search (`/` focuses it). Arrow keys + Enter. |
| Find candidates | **Browse**: filters on the left; feature pills cycle *any → required → excluded*. Sort by clicking a column header. |
| Compare | Tick rows (or “Add to compare” on a part page), then **Compare**. “Only differences” hides identical rows; best value per row is highlighted. |
| Alternatives | On a part page, **Find alternatives** opens Browse with that part's capabilities as minimums. |
| Share / export | Filters and comparisons live in the URL (**Link** button). **CSV** exports the current list or comparison. |

Unknown values are shown as **?** and are never treated as “absent”. A filter removes a part only when a vendor
document contradicts the criterion; parts that could not be checked stay listed with a **?** badge unless you
untick “Keep parts whose value is unconfirmed”.

## Run locally

Open `index.html` in a browser. That's it.

(Optional) any static server also works: `python3 -m http.server -d . 8000`.

## Publish on GitHub Pages

1. Push this folder to a GitHub repository.
2. *Settings → Pages → Build and deployment → Deploy from a branch*, branch `main`, folder `/ (root)`.

`.nojekyll` is included so files are served as-is.

## Layout

```
index.html            entry point
css/style.css         all styles (light/dark)
js/logic.js           filtering, sorting, formatting, URL state — no DOM, also loadable from Node
js/app.js             UI: browse, part page, compare, data page
js/data.js            generated bundle of data/parts/*.json (committed)
data/parts/*.json     source records, one file per product group
data/SCHEMA.md        record schema and conventions
tools/build_data.py   validates data/parts and regenerates js/data.js (Python 3 stdlib)
tests/logic.test.js   node --test tests/  (Node 18+, optional)
```

## Updating data

1. Edit or add records in `data/parts/*.json` following `data/SCHEMA.md` (one record per orderable part number;
   `null` for anything not established from a vendor document; always add a source).
2. `python3 tools/build_data.py` — validates and rewrites `js/data.js`. Fails with a list of problems if any.
3. Optional: `node --test tests/`.

## Scope and limits

- No prices, stock or lifecycle forecasts.
- Pin multiplexing conflicts, clock trees, electrical characteristics beyond supply/temperature range are out of
  scope: check the datasheet before committing a design.
- Independent project, not affiliated with WCH (Nanjing Qinheng Microelectronics). Product names belong to their owners.
