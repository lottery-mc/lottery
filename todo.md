# Number Lab — TODO

## Before deploy
- [x] Real domain wired everywhere: `https://lottery.artivicolab.com/`
      (canonical, og:url, JSON-LD, sitemap.xml, robots.txt).
- [x] SVG favicon (`favicon.svg`, clover-coin) linked.
- [ ] **Create `og-image.png` (1200×630)** and drop it at the site root — the
      tags already point to `/og-image.png`. Until it exists, social cards have
      no image. (Use the logo prompt in the chat / generate from `favicon.svg`.)
- [ ] Optional: add `favicon.ico` + `apple-touch-icon.png` (PNG fallbacks for
      older clients; SVG covers modern ones).
- [x] Add `robots.txt` and `sitemap.xml`.

## Analytics (open question)
- [ ] User said "we are just doing ga for now." Interpreted as **Georgia**
      (SEO). If they meant **Google Analytics**, add the GA4 snippet — need the
      Measurement ID (`G-XXXXXXXXXX`).

## Data
- [ ] Load real **Powerball** history (need official/public draw data, e.g. GA
      Lottery PDFs). Same for **Cash4Life** and **Lucky for Life**.
- [ ] Consider a "data last updated" stamp source / refresh process so draws
      don't silently go stale. (Header already shows "through <newest date>".)

## Possible enhancements
- [ ] Let the user choose how many of Number Lab's predictions to reveal, or
      change `OUR_STRATEGY` (currently `due`) to a hot/overdue blend.
- [ ] Optional sound/haptic on the lever pull (with a mute toggle).
- [ ] `package.json` with `"test": "node --test"` for `npm test`.
- [ ] Dark/alt theme variants.

## Done (recent)
- [x] Casino felt + gold theme; tumbling ball machine + lever.
- [x] Build-your-own frequency ranking; full probability/stats panel.
- [x] localStorage persistence + Account tab + saved sets.
- [x] Animated star revealing Number Lab's 15 predictions after the user draws.
- [x] Collapsible header with bottom-center pull handle.
- [x] Animated rays background; full-width wide-screen layout.
- [x] Accessibility pass (ARIA, focus, contrast, tap targets).
- [x] SEO (meta, OG/Twitter, JSON-LD, geo=US-GA, sr-only intro).
- [x] Footer (responsible gaming, affiliation disclaimer, 1-800-GAMBLER,
      Contact mailto, "Built by artivicolab.com").
- [x] Test suite (`node --test`, 9 tests).
