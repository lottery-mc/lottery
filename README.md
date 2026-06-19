# Number Lab — Lottery

A **Georgia Lottery number generator + Mega Millions statistics** web app.
Green-felt casino theme with a tumbling ball machine, real probability math,
and a build-your-own number tool. Vanilla HTML/CSS/JS — no build step.

## Features
- **Draw** — pull the lever to spin the drum and generate your own sets; an
  animated star then reveals Number Lab's 15 model predictions.
- **Build** — every number ranked by draw frequency (hot → cold → never); tap
  to assemble a set.
- **Stats** — real combinatorics: jackpot odds, prize-tier table, Pearson χ²,
  z-scores, and draw distribution from 320 real Mega Millions draws.
- **Account** — saved sets, preferences, and activity, persisted in
  `localStorage`.

## Run
Open `index.html` in a browser. No dependencies.

## Test
```sh
node --test
```

## Project layout
- `index.html` — markup, SEO head, four tab views, footer
- `styles.css` — casino theme + animations
- `app.js` — stats engine, strategies, UI, persistence, predictions
- `data.js` — game config + historical draws
- `test.js` — math/engine tests
- `CLAUDE.md` / `todo.md` — contributor notes and roadmap

## Disclaimer
For entertainment only. Past results never influence future draws — no strategy
or prediction changes the odds. Not affiliated with the Georgia Lottery or
Mega Millions. Play responsibly (1-800-GAMBLER).

Built by [artivicolab.com](https://artivicolab.com)
