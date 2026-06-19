# Number Lab — project guide for AI assistants

A **Georgia Lottery number generator + Mega Millions statistics** web app.
Theme: a green-felt casino with gold foil and neon accents (Fraunces serif +
system sans + SF Mono). Mobile-first, but uses the full width with a
multi-column layout on wide screens.

## Stack
- **Vanilla HTML/CSS/JS. No build step, no dependencies, no framework.**
- Just open `index.html` in a browser. Fonts (Fraunces) load from Google Fonts.

## Multi-page (not an SPA)
Each tab is its own HTML page with its own SEO `<head>`:
- `index.html` = Draw (home, `/`), `build.html`, `stats.html`, `account.html`
  (account is `noindex`).
- The **header, footer, nav handle, and bottom tab-bar are duplicated** in every
  page (the tab-bar items are `<a>` links; the current page's link has
  `.active` + `aria-current="page"`). If you change the chrome, change it in all
  four pages. `app.js` is shared and **initializes each section only if its root
  element exists** (`initDrawPage`/`initBuildPage`/`initAccountPage` + `renderStats`).
- Each page's main heading is the `<h1 class="title">`; the brand wordmark is a
  `<span>` (not an h1) so every page has one unique H1.

## Files
- `index.html` / `build.html` / `stats.html` / `account.html` — the four pages.
  Shared `<head>`: SEO meta, Open Graph, Twitter, geo=US-GA, full favicon set +
  `manifest.json`. Home has WebApplication JSON-LD; subpages have BreadcrumbList.
- `styles.css` — all styling + animations. CSS variables at `:root` define the
  palette (`--felt`, `--gold`, `--neon`, `--cream`, etc.) and `--gold-foil`.
- `app.js` — everything dynamic: stats/probability math, the strategy engine,
  UI wiring, localStorage persistence, the account tab, the ball machine, and
  Number Lab's predictions.
- `data.js` — `LOTTERIES` config + historical draws (newest first). Only
  Mega Millions has real history (320 draws, 05/26/2023 → 06/16/2026).
- `test.js` — math/engine tests. Run with `node --test` (9 tests).

## App structure (4 tabs, single page)
1. **Draw** — user generates *their own* sets (1–15 via the stepper). A ball
   machine spins (~1.5s) then results pop in. **After** the user draws, an
   animated **star** appears that reveals **Number Lab's own 15 predictions**
   (generated with the `due` strategy = `OUR_STRATEGY` in app.js).
2. **Build** — every number ranked by draw frequency (most → least → never);
   tap to assemble a manual set. No history → ranking is hidden, manual only.
3. **Stats** — real combinatorics: jackpot odds `C(70,5)·24`, prize-tier table,
   Pearson χ², z-scores, draw distribution. Recomputed per game.
4. **Account** — profile (editable name), activity, preferences, saved sets.
   All state persists in `localStorage` under key **`numberlab.v1`** (`S`).

## Key conventions / behaviors
- Balls: `.ball.main` = green, `.ball.special` = gold. Number in `.ball-num`.
- Header is a **fixed overlay** that hides on scroll-down; when fully gone a
  centered **`#navHandle`** pill appears to pull it back. Transform-based (no
  layout thrash). `--topbar-h` is kept in sync by a ResizeObserver.
- Tab switch = instant (`scrollTop = 0`), never smooth-scroll (felt laggy).
- Persistence helpers: `loadStore`/`saveStore`, global `S`. `saveSet` adds
  bookmarks; `renderAccount` re-renders the account tab.
- Tests require `data.js`/`app.js` to export under Node — both files end with a
  guarded `module.exports`. Don't remove those guards.

## Important decisions (do not undo without asking)
- **Never fabricate real winning numbers.** Games without real history
  (Powerball, Cash4Life, Lucky for Life) stay no-history and fall back to
  quick-pick, clearly labeled. Add real data only from official/public sources
  (e.g. the GA Lottery PDFs the user provides).
- Mega Ball was **1–25 before April 2025**; 11 older draws have `special: 25`.
  Config `max` is 24 (current rules), so those 25s are intentionally ignored by
  the stats engine. This is correct — leave it.
- SEO targets **Georgia** ("ga"). Canonical/`og:url` use a placeholder domain
  (`https://your-domain.example/`) — replace on deploy.
- Contact is **artivicolab@gmail.com** (footer shows the word "Contact" only,
  via `mailto:`). Built by **artivicolab.com**. Do not expose personal emails.
- Responsible gaming is front-and-center: a fairness note on Draw + a full
  footer (affiliation disclaimer, 1-800-GAMBLER, legal age). Keep it honest —
  no strategy/prediction changes the odds.

## Dates / SEO freshness
- `.githooks/pre-commit` runs `.githooks/stamp-dates.js` on every commit to set
  today's date in `sitemap.xml` `<lastmod>` and the JSON-LD `dateModified`.
  Enabled via `git config core.hooksPath .githooks` (already set in this clone;
  re-run it after a fresh clone). The stamper does safe full read/writes — never
  use `perl -pi` here (it deleted index.html once).

## Running
- App: open `index.html` (serve from root so `/build.html`, `/favicon.ico`,
  `/manifest.json` resolve).
- Tests: `node --test` (from the project root).

See `todo.md` for outstanding work.
