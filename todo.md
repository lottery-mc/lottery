# Number Lab — TODO

## Before deploy
- [ ] Replace placeholder domain `https://your-domain.example/` in `index.html`
      (`<link rel="canonical">`, `og:url`, and the JSON-LD `url`) with the real
      domain.
- [ ] Add a favicon and an `og:image` / `twitter:image` (1200×630) so social
      shares render a card. (Logo prompt is ready — generate the logo first.)
- [x] Add `robots.txt` and `sitemap.xml` (domain placeholder — update on deploy).

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
