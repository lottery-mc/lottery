/* app.js
 * Strategy engine + UI wiring for the Lottery number picker.
 * Pure browser JS, no build step. Depends on LOTTERIES from data.js.
 */

/* ------------------------------------------------------------------ *
 * Statistics
 * ------------------------------------------------------------------ */

// Build frequency + last-seen stats for either the main pool or the special
// ball, from a game's draw history.
function buildStats(game, pool /* "main" | "special" */) {
  const range = pool === "special" ? game.special : game.main;
  const counts = {}; // number -> times drawn
  const lastSeen = {}; // number -> draws ago it last appeared (0 = most recent)

  for (let n = range.min; n <= range.max; n++) {
    counts[n] = 0;
    lastSeen[n] = Infinity; // never drawn
  }

  game.draws.forEach((draw, drawIndex) => {
    const values = pool === "special" ? [draw.special] : draw.main;
    values.forEach((n) => {
      if (counts[n] === undefined) return; // ignore out-of-range data
      counts[n] += 1;
      if (lastSeen[n] === Infinity) lastSeen[n] = drawIndex; // newest first
    });
  });

  return { range, counts, lastSeen, totalDraws: game.draws.length };
}

/* ------------------------------------------------------------------ *
 * Weighting strategies
 *
 * Each returns a weight map: number -> non-negative weight. A higher weight
 * means the number is more likely to be picked. Weighted sampling without
 * replacement then turns these into a unique set of balls.
 * ------------------------------------------------------------------ */

const STRATEGIES = {
  quickpick: {
    label: "Quick Pick (pure random)",
    desc: "Every number has an equal chance. The classic lottery quick pick.",
    weights(stats) {
      return uniform(stats);
    },
  },

  hot: {
    label: "Hot — most frequently drawn",
    desc: "Favors the numbers that have appeared most often in the loaded history.",
    weights(stats) {
      // weight grows with how often a number has been drawn
      const w = {};
      forEachNumber(stats, (n) => {
        w[n] = 1 + stats.counts[n] * 3;
      });
      return w;
    },
  },

  cold: {
    label: "Cold — least frequently drawn",
    desc: "Favors numbers that have appeared the fewest times.",
    weights(stats) {
      const max = Math.max(0, ...Object.values(stats.counts));
      const w = {};
      forEachNumber(stats, (n) => {
        // invert frequency: rarely drawn -> heavy weight
        w[n] = 1 + (max - stats.counts[n]) * 3;
      });
      return w;
    },
  },

  neverplayed: {
    label: "Never drawn",
    desc: "Only picks from numbers that have never appeared in the loaded history. Falls back to coldest numbers if there aren't enough.",
    weights(stats) {
      const w = {};
      let neverCount = 0;
      forEachNumber(stats, (n) => {
        if (stats.counts[n] === 0) {
          w[n] = 1;
          neverCount += 1;
        } else {
          w[n] = 0;
        }
      });
      // If fewer "never drawn" numbers than we need, let the coldest in too.
      if (neverCount < stats.range.count) {
        const max = Math.max(1, ...Object.values(stats.counts));
        forEachNumber(stats, (n) => {
          if (w[n] === 0) w[n] = (max - stats.counts[n] + 1) * 0.01;
        });
      }
      return w;
    },
  },

  overdue: {
    label: "Overdue — longest since last seen",
    desc: "Favors numbers that haven't been drawn for the longest stretch.",
    weights(stats) {
      const w = {};
      forEachNumber(stats, (n) => {
        const ago = stats.lastSeen[n];
        // never drawn = maximally overdue
        const gap = ago === Infinity ? stats.totalDraws + 1 : ago;
        w[n] = 1 + gap * 2;
      });
      return w;
    },
  },

  due: {
    label: "Due — frequent but recently absent",
    desc: "Numbers that are normally common but have been missing lately — a blend of hot history and overdue timing.",
    weights(stats) {
      const w = {};
      forEachNumber(stats, (n) => {
        const ago = stats.lastSeen[n];
        const gap = ago === Infinity ? stats.totalDraws + 1 : ago;
        w[n] = (1 + stats.counts[n]) * (1 + gap);
      });
      return w;
    },
  },

  balanced: {
    label: "Balanced — weighted by real odds",
    desc: "Samples in proportion to each number's historical frequency, smoothed so nothing is impossible.",
    weights(stats) {
      const w = {};
      forEachNumber(stats, (n) => {
        w[n] = 1 + stats.counts[n]; // smoothed proportional weighting
      });
      return w;
    },
  },
};

function uniform(stats) {
  const w = {};
  forEachNumber(stats, (n) => (w[n] = 1));
  return w;
}

function forEachNumber(stats, fn) {
  for (let n = stats.range.min; n <= stats.range.max; n++) fn(n);
}

/* ------------------------------------------------------------------ *
 * Weighted sampling without replacement
 * ------------------------------------------------------------------ */

function weightedPickUnique(weights, count) {
  const pool = Object.keys(weights)
    .map(Number)
    .filter((n) => weights[n] > 0);

  // If positive weights can't fill the request, top up with any remaining.
  if (pool.length < count) {
    Object.keys(weights)
      .map(Number)
      .forEach((n) => {
        if (!pool.includes(n)) pool.push(n);
      });
  }

  const chosen = [];
  const localWeights = {};
  pool.forEach((n) => (localWeights[n] = Math.max(weights[n], 1e-6)));

  for (let k = 0; k < count && pool.length > 0; k++) {
    const total = pool.reduce((sum, n) => sum + localWeights[n], 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= localWeights[pool[idx]];
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return chosen.sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * Ticket generation
 * ------------------------------------------------------------------ */

function generateTicket(game, strategyKey) {
  const strategy = STRATEGIES[strategyKey];
  const mainStats = buildStats(game, "main");
  const specialStats = buildStats(game, "special");

  const mainWeights = strategy.weights(mainStats);
  const specialWeights = strategy.weights(specialStats);

  const main = weightedPickUnique(mainWeights, game.main.count);
  const special = weightedPickUnique(specialWeights, 1)[0];

  return { main, special };
}

function generateTickets(gameKey, strategyKey, sets) {
  const game = LOTTERIES[gameKey];
  const tickets = [];
  for (let i = 0; i < sets; i++) {
    tickets.push(generateTicket(game, strategyKey));
  }
  return { game, tickets };
}

/* ------------------------------------------------------------------ *
 * Frequency ranking (most -> least -> never drawn)
 * ------------------------------------------------------------------ */

// Return every number in a pool sorted by how often it was drawn:
// most frequent first, ties broken by the number itself, never-drawn last.
function frequencyRanking(game, pool) {
  const stats = buildStats(game, pool);
  const list = [];
  forEachNumber(stats, (n) => {
    const count = stats.counts[n];
    list.push({
      n,
      count,
      pct: stats.totalDraws ? (count / stats.totalDraws) * 100 : 0,
      lastSeen: stats.lastSeen[n],
      never: count === 0,
    });
  });
  list.sort((a, b) => b.count - a.count || a.n - b.n);
  const maxCount = Math.max(0, ...list.map((x) => x.count));
  return { list, maxCount, totalDraws: stats.totalDraws };
}

/* ------------------------------------------------------------------ *
 * Probability math
 * ------------------------------------------------------------------ */

// Binomial coefficient "n choose k" (combinations), computed multiplicatively
// to stay exact for the ranges lotteries use.
function nCr(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

// Parse a "MM/DD/YYYY" draw date into a Date.
function parseDrawDate(s) {
  const [m, d, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
}

// Full statistical profile of a game: theoretical odds + observed-vs-expected
// analysis of the loaded history.
function computeStats(game) {
  const N = game.main.max - game.main.min + 1; // size of main pool
  const k = game.main.count; // numbers drawn
  const M = game.special.max - game.special.min + 1; // special pool size

  const totalMainCombos = nCr(N, k);
  const jackpotOdds = totalMainCombos * M; // 1 in this many

  // Prize tiers: probability of matching exactly m of k main numbers,
  // with or without also matching the special ball.
  const p = k / N; // P(a given number appears in a draw)
  const tiers = [];
  for (let m = k; m >= 0; m--) {
    const ways = nCr(k, m) * nCr(N - k, k - m);
    const pExact = ways / totalMainCombos;
    tiers.push({
      m,
      ways,
      pExact,
      oddsWith: ways ? (totalMainCombos * M) / ways : Infinity,
      oddsWithout: ways ? (totalMainCombos * M) / (ways * (M - 1)) : Infinity,
    });
  }

  // ---- Observed history -------------------------------------------------
  const draws = game.draws;
  const D = draws.length;
  const mainStats = buildStats(game, "main");
  const specialStats = buildStats(game, "special");

  let dateNewest = null;
  let dateOldest = null;
  if (D) {
    dateNewest = parseDrawDate(draws[0].date);
    dateOldest = parseDrawDate(draws[D - 1].date);
  }
  const spanYears =
    D > 1 ? (dateNewest - dateOldest) / (365.25 * 864e5) : 0;

  // Main-number goodness of fit (Pearson chi-square) and z-scores.
  const expectedMain = D * p; // expected appearances per number
  const sdMain = Math.sqrt(D * p * (1 - p)); // binomial std dev
  let chi2 = 0;
  let hot = null;
  let cold = null;
  forEachNumber(mainStats, (n) => {
    const obs = mainStats.counts[n];
    if (expectedMain > 0) chi2 += (obs - expectedMain) ** 2 / expectedMain;
    const z = sdMain > 0 ? (obs - expectedMain) / sdMain : 0;
    if (!hot || z > hot.z) hot = { n, obs, z };
    if (!cold || z < cold.z) cold = { n, obs, z };
  });
  const dfMain = N - 1;

  // Special ball: only count draws whose special is in the current range
  // (the pool size changed historically for some games).
  let specialInRange = 0;
  forEachNumber(specialStats, (n) => (specialInRange += specialStats.counts[n]));
  const expectedSpecial = specialInRange / M;

  // Draw distribution: sum, odd/even, low/high per draw.
  let sumTotal = 0;
  let sumSq = 0;
  let minSum = Infinity;
  let maxSum = -Infinity;
  let oddTotal = 0;
  let lowTotal = 0;
  const mid = (game.main.min + game.main.max) / 2;
  draws.forEach((dr) => {
    const s = dr.main.reduce((a, b) => a + b, 0);
    sumTotal += s;
    sumSq += s * s;
    if (s < minSum) minSum = s;
    if (s > maxSum) maxSum = s;
    oddTotal += dr.main.filter((x) => x % 2 === 1).length;
    lowTotal += dr.main.filter((x) => x <= mid).length;
  });
  const meanSum = D ? sumTotal / D : 0;
  const sdSum = D ? Math.sqrt(sumSq / D - meanSum ** 2) : 0;
  const expectedSum = (k * (game.main.min + game.main.max)) / 2;

  return {
    N, k, M,
    totalMainCombos, jackpotOdds, tiers,
    D, dateNewest, dateOldest, spanYears,
    expectedMain, chi2, dfMain, hot, cold,
    specialInRange, expectedSpecial,
    meanSum, sdSum, minSum, maxSum, expectedSum,
    oddAvg: D ? oddTotal / D : 0,
    lowAvg: D ? lowTotal / D : 0,
  };
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */

const el = (id) => document.getElementById(id);

const fmtInt = (n) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—";
const fmtDate = (d) =>
  d
    ? d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// Current manual selection for the "Build your own" panel.
const pick = { main: new Set(), special: null };

/* ------------------------------------------------------------------ *
 * Persistence (localStorage) + account state
 * ------------------------------------------------------------------ */
const STORE_KEY = "numberlab.v1";
const STORE_DEFAULTS = {
  name: "Guest",
  createdAt: new Date().toISOString(),
  game: null,
  strategy: null,
  sets: 1,
  pickMain: [],
  pickSpecial: null,
  lastResults: null,
  lastStrategyLabel: "",
  lastGame: null,
  saved: [],
  generatedCount: 0,
};

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return { ...STORE_DEFAULTS, ...(raw || {}) };
  } catch (e) {
    return { ...STORE_DEFAULTS };
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch (e) {
    /* storage may be unavailable (private mode) — fail quietly */
  }
}

let S = loadStore();

function gameKey(game) {
  return Object.keys(LOTTERIES).find((k) => LOTTERIES[k] === game);
}

function saveSet(entry, btn) {
  entry.date = new Date().toISOString();
  S.saved.unshift(entry);
  if (S.saved.length > 50) S.saved.length = 50;
  saveStore();
  renderAccount();
  if (btn) {
    btn.classList.add("done");
    btn.title = "Saved";
  }
}

function initUI() {
  const gameSelect = el("game");
  const strategySelect = el("strategy");
  const setsInput = el("sets");

  // Populate games
  Object.entries(LOTTERIES).forEach(([key, game]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = game.name;
    gameSelect.appendChild(opt);
  });

  // Populate strategies
  Object.entries(STRATEGIES).forEach(([key, s]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = s.label;
    strategySelect.appendChild(opt);
  });

  // Restore saved settings + picks from localStorage.
  if (S.game && LOTTERIES[S.game]) gameSelect.value = S.game;
  if (S.strategy && STRATEGIES[S.strategy]) strategySelect.value = S.strategy;
  setsInput.value = S.sets || 1;
  pick.main = new Set(S.pickMain || []);
  pick.special = S.pickSpecial ?? null;

  const renderStrategyDesc = () => {
    el("strategyDesc").textContent = STRATEGIES[strategySelect.value].desc;
  };
  const renderGameInfo = () => {
    const g = LOTTERIES[gameSelect.value];
    const n = g.draws.length;
    let txt = `${n ? n + " draws" : "no history"} · pick ${g.main.count}/${g.main.max} + 1/${g.special.max}`;
    if (n) txt += ` · through ${fmtDate(parseDrawDate(g.draws[0].date))}`;
    el("gameInfo").textContent = txt;
  };

  gameSelect.addEventListener("change", () => {
    renderGameInfo();
    resetPick();
    renderBuilder(gameSelect.value);
    renderStats(gameSelect.value);
    el("results").innerHTML = emptyResultsHTML(LOTTERIES[gameSelect.value]);
    el("resultsMeta").textContent = "";
    hideOurStar();
    S.game = gameSelect.value;
    S.lastResults = null;
    saveStore();
    renderAccount();
  });
  strategySelect.addEventListener("change", () => {
    renderStrategyDesc();
    S.strategy = strategySelect.value;
    saveStore();
    renderAccount();
  });

  // Sets stepper
  const setsValue = el("setsValue");
  const syncSets = () => {
    if (setsValue) setsValue.textContent = setsInput.value;
  };
  document.querySelectorAll("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      let v = parseInt(setsInput.value, 10) || 1;
      v = Math.max(1, Math.min(15, v + parseInt(btn.dataset.step, 10)));
      setsInput.value = v;
      syncSets();
      S.sets = v;
      saveStore();
    });
  });
  syncSets();

  let spinning = false;
  el("generate").addEventListener("click", () => {
    if (spinning) return;
    let sets = parseInt(setsInput.value, 10);
    if (isNaN(sets) || sets < 1) sets = 1;
    if (sets > 15) sets = 15;
    setsInput.value = sets;
    syncSets();

    // Spin the drum, then reveal.
    spinning = true;
    const machine = el("machine");
    const lever = el("generate");
    const leverLabel = lever.querySelector(".lever-label");
    machine.classList.add("spinning");
    lever.classList.add("busy");
    el("machineStatus").textContent = "MIXING…";
    if (leverLabel) leverLabel.textContent = "Mixing…";

    setTimeout(() => {
      const { game, tickets } = generateTickets(
        gameSelect.value,
        strategySelect.value,
        sets
      );
      const label = STRATEGIES[strategySelect.value].label;
      renderTickets(game, tickets, label, true);

      S.lastResults = tickets.map((t) => ({ main: t.main, special: t.special }));
      S.lastStrategyLabel = label;
      S.lastGame = gameSelect.value;
      S.sets = sets;
      S.generatedCount = (S.generatedCount || 0) + tickets.length;
      saveStore();
      renderAccount();

      renderMachine(); // reshuffle the drum for next time
      machine.classList.remove("spinning");
      lever.classList.remove("busy");
      el("machineStatus").textContent = "READY";
      if (leverLabel) leverLabel.textContent = "Draw again";
      spinning = false;

      // They've drawn their own — now offer Number Lab's picks via the star.
      showOurStar();
    }, 1500);
  });

  // Star reveals Number Lab's own 15 predictions.
  el("ourStar").addEventListener("click", () => {
    const panel = el("ourPredictions");
    if (panel.hidden) {
      renderOurPredictions(gameSelect.value);
      panel.hidden = false;
      el("ourStar").setAttribute("aria-expanded", "true");
      el("ourStarLabel").textContent = "Hide Number Lab's predictions";
    } else {
      panel.hidden = true;
      el("ourStar").setAttribute("aria-expanded", "false");
      el("ourStarLabel").textContent = "Reveal Number Lab's 15 predictions";
    }
  });

  el("clear").addEventListener("click", () => {
    el("results").innerHTML = emptyResultsHTML(LOTTERIES[gameSelect.value]);
    el("resultsMeta").textContent = "";
    hideOurStar();
    S.lastResults = null;
    saveStore();
  });

  initTabs();

  // Collapsible header. The handle (shown only when hidden) brings it back;
  // scrolling down tucks it away.
  const app = document.querySelector(".app");
  const topbar = document.querySelector(".topbar");

  // Keep the content's top padding matched to the (fixed) header height.
  const syncTopbarH = () =>
    document.documentElement.style.setProperty(
      "--topbar-h",
      topbar.offsetHeight + "px"
    );
  syncTopbarH();
  if (window.ResizeObserver) new ResizeObserver(syncTopbarH).observe(topbar);
  window.addEventListener("load", syncTopbarH);

  el("navHandle").addEventListener("click", () => {
    app.classList.remove("nav-collapsed");
  });

  const footerYear = el("footerYear");
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const headerScroller = document.querySelector(".scroll");
  let lastY = 0;
  headerScroller.addEventListener(
    "scroll",
    () => {
      const y = headerScroller.scrollTop;
      if (y > lastY + 6 && y > 80) app.classList.add("nav-collapsed");
      else if (y < lastY - 6 || y < 20) app.classList.remove("nav-collapsed");
      lastY = y;
    },
    { passive: true }
  );

  el("builderClear").addEventListener("click", () => {
    resetPick();
    renderBuilder(gameSelect.value);
  });

  el("builderSave").addEventListener("click", () => {
    if (!pick.main.size && pick.special == null) return;
    saveSet({
      game: gameSelect.value,
      main: [...pick.main].sort((a, b) => a - b),
      special: pick.special,
      src: "built",
    });
    const btn = el("builderSave");
    const prev = btn.textContent;
    btn.textContent = "Saved ✓";
    setTimeout(() => (btn.textContent = prev), 1200);
  });

  el("builderCopy").addEventListener("click", () => {
    const game = LOTTERIES[gameSelect.value];
    navigator.clipboard?.writeText(pickToText(game)).then(() => {
      const btn = el("builderCopy");
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = prev), 1200);
    });
  });

  el("editName").addEventListener("click", () => {
    const v = prompt("Your name", S.name || "Guest");
    if (v != null) {
      S.name = v.trim() || "Guest";
      saveStore();
      renderAccount();
    }
  });

  el("resetData").addEventListener("click", () => {
    if (confirm("Reset all saved data, settings and history on this device?")) {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  });

  renderStrategyDesc();
  renderGameInfo();
  renderBuilder(gameSelect.value);
  renderStats(gameSelect.value);
  renderAccount();
  renderMachine();

  // Restore last generated results (without replaying the animation).
  if (S.lastResults && S.lastResults.length) {
    const g = LOTTERIES[S.lastGame] || LOTTERIES[gameSelect.value];
    renderTickets(g, S.lastResults, S.lastStrategyLabel || "Saved set", false);
    const leverLabel = el("generate").querySelector(".lever-label");
    if (leverLabel) leverLabel.textContent = "Draw again";
    showOurStar();
  } else {
    el("results").innerHTML = emptyResultsHTML(LOTTERIES[gameSelect.value]);
  }
}

/* Number Lab's own model picks — a stats-blended strategy. */
const OUR_STRATEGY = "due";

function showOurStar() {
  el("ourReveal").hidden = false;
}

function hideOurStar() {
  el("ourReveal").hidden = true;
  const panel = el("ourPredictions");
  panel.hidden = true;
  panel.innerHTML = "";
  el("ourStar").setAttribute("aria-expanded", "false");
  el("ourStarLabel").textContent = "Reveal Number Lab's 15 predictions";
}

function renderOurPredictions(gameKey) {
  const { game, tickets } = generateTickets(gameKey, OUR_STRATEGY, 15);
  const panel = el("ourPredictions");
  panel.innerHTML = "";

  const head = document.createElement("div");
  head.className = "our-head";
  head.textContent = `Number Lab model · 15 picks · ${STRATEGIES[OUR_STRATEGY].label}`;
  panel.appendChild(head);

  const list = document.createElement("div");
  list.className = "results";
  panel.appendChild(list);
  renderTicketRows(list, game, tickets, true, gameKey, "predicted");
}

// Build the tumbling balls inside the lottery drum.
const MACHINE_TRACKS = [
  "tumbleA",
  "tumbleB",
  "tumbleC",
  "tumbleD",
  "tumbleE",
  "tumbleF",
];
function renderMachine() {
  const wrap = el("globeBalls");
  if (!wrap) return;
  const tones = [
    "main", "main", "main", "mega", "main", "main",
    "mega", "main", "main", "main", "main", "mega",
  ];
  wrap.innerHTML = "";
  tones.forEach((tone, i) => {
    const n =
      tone === "mega"
        ? 1 + Math.floor(Math.random() * 24)
        : 1 + Math.floor(Math.random() * 70);
    const b = document.createElement("div");
    b.className = "mball " + tone;
    b.textContent = String(n).padStart(2, "0");
    b.style.animationName = MACHINE_TRACKS[i % MACHINE_TRACKS.length];
    b.style.animationDuration = (2.4 + (i % 5) * 0.34).toFixed(2) + "s";
    b.style.animationDelay = (-(i * 0.45)).toFixed(2) + "s";
    wrap.appendChild(b);
  });
}

// Placeholder slots shown before any numbers are generated.
function emptyResultsHTML(game) {
  const slots = Array.from(
    { length: game.main.count },
    () => '<span class="ball slot"></span>'
  ).join("");
  return `<div class="empty-state">
    <div class="empty-slots">${slots}<span class="combo-plus">+</span><span class="ball slot special"></span></div>
    <p>Pull <b>the lever</b> for 15 predictions.</p>
  </div>`;
}

/* Bottom tab-bar navigation between the three views. */
function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");
  const scroller = document.querySelector(".scroll");

  const syncSelected = () =>
    tabs.forEach((t) =>
      t.setAttribute("aria-selected", t.classList.contains("active") ? "true" : "false")
    );

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.target;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      views.forEach((v) =>
        v.toggleAttribute("hidden", v.dataset.view !== target)
      );
      syncSelected();
      if (target === "account") renderAccount();
      // Snap instantly to the top and reveal the header — no smooth-scroll lag.
      if (scroller) scroller.scrollTop = 0;
      document.querySelector(".app").classList.remove("nav-collapsed");
    });
  });
  syncSelected();
}

/* ------------------------------------------------------------------ *
 * "Build your own" panel
 * ------------------------------------------------------------------ */

function resetPick() {
  pick.main.clear();
  pick.special = null;
  persistPick();
}

function persistPick() {
  S.pickMain = [...pick.main];
  S.pickSpecial = pick.special;
  saveStore();
}

function pickToText(game) {
  const main = [...pick.main].sort((a, b) => a - b);
  const mainStr = main.map((n) => String(n).padStart(2, "0")).join(" ");
  const sp = pick.special != null ? String(pick.special).padStart(2, "0") : "—";
  return `${game.name}: ${mainStr || "—"}  +${game.special.name} ${sp}`;
}

function renderBuilder(gameKey) {
  const game = LOTTERIES[gameKey];
  el("freqMainTitle").textContent = `Main numbers · ${game.main.min}–${game.main.max}`;
  el("freqSpecialTitle").textContent = `${game.special.name} · ${game.special.min}–${game.special.max}`;

  renderYourCombo(game);

  // No history → numbers can't be ranked; keep the manual tray usable.
  if (!game.draws.length) {
    el("freqMain").innerHTML = `<p class="lede small">No draw history is loaded for ${game.name} yet, so numbers can't be ranked by frequency. You can still build a set manually above — it's a quick pick.</p>`;
    el("freqSpecial").innerHTML = "";
    return;
  }

  renderFreqGrid(el("freqMain"), frequencyRanking(game, "main"), "main", game);
  renderFreqGrid(
    el("freqSpecial"),
    frequencyRanking(game, "special"),
    "special",
    game
  );
}

function renderYourCombo(game) {
  const wrap = el("yourCombo");
  wrap.innerHTML = "";

  const main = [...pick.main].sort((a, b) => a - b);
  for (let i = 0; i < game.main.count; i++) {
    if (main[i] != null) {
      wrap.appendChild(makeBall(main[i], "main"));
    } else {
      wrap.appendChild(makeSlot());
    }
  }

  const plus = document.createElement("span");
  plus.className = "combo-plus";
  plus.textContent = "+";
  wrap.appendChild(plus);

  if (pick.special != null) {
    wrap.appendChild(makeBall(pick.special, "special", game.special.name));
  } else {
    wrap.appendChild(makeSlot(true));
  }

  el("comboCount").textContent =
    `${pick.main.size} / ${game.main.count} MAIN · ` +
    `${pick.special != null ? 1 : 0} / 1 ${game.special.name.toUpperCase()}`;
}

function makeSlot(special) {
  const s = document.createElement("span");
  s.className = `ball slot${special ? " special" : ""}`;
  return s;
}

function renderFreqGrid(container, ranking, pool, game) {
  container.innerHTML = "";
  const limit = pool === "main" ? game.main.count : 1;
  const selected = pool === "main" ? pick.main : null;

  ranking.list.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "num-row" + (item.never ? " never" : "");

    const isSelected =
      pool === "main" ? selected.has(item.n) : pick.special === item.n;
    if (isSelected) row.classList.add("selected");

    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
    row.setAttribute(
      "aria-label",
      `Number ${item.n}, ${
        item.never ? "never drawn" : `drawn ${item.count} times, ${item.pct.toFixed(0)} percent`
      }${isSelected ? ", selected" : ""}`
    );

    const fillW = ranking.maxCount ? (item.count / ranking.maxCount) * 100 : 0;

    row.appendChild(makeBall(item.n, pool));

    const body = document.createElement("div");
    body.className = "num-row-body";

    const meta = document.createElement("div");
    meta.className = "num-row-meta";
    meta.textContent = item.never
      ? "never drawn"
      : `${item.count}× · ${item.pct.toFixed(0)}%`;

    const track = document.createElement("div");
    track.className = "num-row-track";
    const fill = document.createElement("div");
    fill.className = "num-row-fill";
    fill.style.width = `${fillW}%`;
    track.appendChild(fill);

    body.appendChild(meta);
    body.appendChild(track);
    row.appendChild(body);

    const mark = document.createElement("span");
    mark.className = "num-row-mark";
    mark.textContent = isSelected ? "✓" : "+";
    row.appendChild(mark);

    row.addEventListener("click", () => togglePick(pool, item.n, limit, game));
    container.appendChild(row);
  });
}

function togglePick(pool, n, limit, game) {
  if (pool === "special") {
    pick.special = pick.special === n ? null : n;
  } else {
    if (pick.main.has(n)) {
      pick.main.delete(n);
    } else if (pick.main.size < limit) {
      pick.main.add(n);
    } else {
      // At the limit — flash the combo to signal it's full.
      flash(el("yourCombo"));
      return;
    }
  }
  persistPick();
  renderBuilder(gameKey(game));
}

function flash(node) {
  node.classList.remove("flash");
  void node.offsetWidth; // restart animation
  node.classList.add("flash");
}

/* ------------------------------------------------------------------ *
 * Probability & statistics panel
 * ------------------------------------------------------------------ */

function renderStats(gameKey) {
  const game = LOTTERIES[gameKey];
  const s = computeStats(game);
  const sp = game.special.name;

  // Where the data is pooled from.
  el("dataWindow").textContent = s.D
    ? `Pooled from ${s.D.toLocaleString("en-US")} draws, ${fmtDate(
        s.dateOldest
      )} – ${fmtDate(s.dateNewest)}` +
      (s.spanYears >= 0.1
        ? ` — about ${s.spanYears.toFixed(1)} years of history.`
        : ".")
    : "No history loaded — only the theoretical odds below apply.";

  // Hero jackpot card.
  el("statsHero").innerHTML = `
    <div class="hero-glow"></div>
    <div class="hero-eyebrow">JACKPOT ODDS</div>
    <div class="hero-value">1 in ${fmtInt(s.jackpotOdds)}</div>
    <div class="hero-sub">${fmtInt(
      s.totalMainCombos
    )} main combinations × ${s.M} special.</div>`;

  // Headline figures.
  el("statFigures").innerHTML =
    figureHTML(
      `Match all ${s.k} main`,
      `1 in ${fmtAbbr(s.totalMainCombos)}`,
      `C(${s.N}, ${s.k}) distinct combinations.`
    ) +
    figureHTML(
      `Match the ${sp}`,
      `1 in ${s.M}`,
      `${sp}, 1 of ${s.M}.`,
      "claret"
    );

  // Prize-odds grid.
  let grid = `<div class="odds-head"><span>Matched</span><span>+ ${sp}</span><span>No ${sp}</span></div>`;
  s.tiers.forEach((t) => {
    const jackpot = t.m === s.k;
    grid += `<div class="odds-row${jackpot ? " jackpot" : ""}">
      <span class="m">${t.m} of ${s.k}</span>
      <span class="a">${fmtInt(t.oddsWith)}</span>
      <span class="b">${jackpot ? "—" : fmtInt(t.oddsWithout)}</span>
    </div>`;
  });
  el("oddsTable").innerHTML = grid;

  // Goodness of fit.
  if (s.D) {
    const verdict =
      Math.abs(s.chi2 - s.dfMain) <= 2 * Math.sqrt(2 * s.dfMain)
        ? "Consistent with a fair, random draw."
        : "A larger deviation than chance usually gives — likely small-sample noise.";
    el("fitStats").innerHTML =
      figureHTML(
        "Expected appearances / number",
        s.expectedMain.toFixed(1),
        `Over ${s.D} draws, each should appear ~${s.expectedMain.toFixed(
          1
        )} times.`
      ) +
      figureHTML(
        "Pearson χ² · main numbers",
        s.chi2.toFixed(1),
        `df = ${s.dfMain}; a fair game gives χ² ≈ df. ${verdict}`
      ) +
      figureHTML(
        "Most over-represented",
        `#${s.hot.n}`,
        `Drawn ${s.hot.obs}× — ${s.hot.z >= 0 ? "+" : ""}${s.hot.z.toFixed(
          2
        )} std devs above expected.`,
        "gold"
      ) +
      figureHTML(
        "Most under-represented",
        `#${s.cold.n}`,
        `Drawn ${s.cold.obs}× — ${s.cold.z.toFixed(
          2
        )} std devs below expected.`,
        "gold"
      );
  } else {
    el("fitStats").innerHTML = `<p class="lede small">Load draw history to see observed-vs-expected analysis.</p>`;
  }

  // Draw distribution.
  if (s.D) {
    el("distStats").innerHTML =
      figureHTML(
        `Mean sum of ${s.k} main numbers`,
        s.meanSum.toFixed(1),
        `σ = ${s.sdSum.toFixed(1)}; theoretical mean = ${s.expectedSum}; range ${s.minSum}–${s.maxSum}.`
      ) +
      figureHTML(
        "Average odd numbers / draw",
        s.oddAvg.toFixed(2),
        `Out of ${s.k}; balanced ≈ ${(s.k / 2).toFixed(1)}.`
      ) +
      figureHTML(
        "Average low numbers / draw",
        s.lowAvg.toFixed(2),
        `Lower half of ${s.N}; balanced ≈ ${(s.k / 2).toFixed(1)}.`
      );
  } else {
    el("distStats").innerHTML = `<p class="lede small">Load draw history to see distribution stats.</p>`;
  }
}

// One label/sub + big serif value row.
function figureHTML(label, value, sub, accent) {
  return `<div class="figure">
    <div class="figure-text">
      <div class="figure-label">${label}</div>
      ${sub ? `<div class="figure-sub">${sub}</div>` : ""}
    </div>
    <div class="figure-value${accent ? " " + accent : ""}">${value}</div>
  </div>`;
}

// Abbreviate large counts: 12,103,014 -> "12.1M".
function fmtAbbr(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.round(n).toLocaleString("en-US");
}

function renderTickets(game, tickets, strategyLabel, animate = true) {
  el("resultsMeta").textContent = `${tickets.length} SET${
    tickets.length > 1 ? "S" : ""
  } · ${strategyLabel.toUpperCase()}`;
  renderTicketRows(el("results"), game, tickets, animate, gameKey(game), "generated");
}

// Shared renderer for a list of ball rows (user results + our predictions).
function renderTicketRows(container, game, tickets, animate, key, src) {
  container.classList.toggle("no-anim", !animate);
  container.innerHTML = "";

  tickets.forEach((ticket, i) => {
    const row = document.createElement("div");
    row.className = "ticket";

    const idx = document.createElement("span");
    idx.className = "ticket-index";
    idx.textContent = `#${i + 1}`;
    row.appendChild(idx);

    const balls = document.createElement("div");
    balls.className = "balls";

    const seq = [
      ...ticket.main.map((n) => ["main", n]),
      ["special", ticket.special],
    ];
    seq.forEach(([kind, n], bi) => {
      const b = makeBall(n, kind, kind === "special" ? game.special.name : null);
      if (animate) {
        const d = Math.min((i * seq.length + bi) * 0.045, 1.1);
        b.style.animationDelay = `${d}s`;
      } else {
        b.style.animation = "none";
      }
      balls.appendChild(b);
    });
    row.appendChild(balls);

    const save = document.createElement("button");
    save.className = "icon-btn save-set";
    save.title = "Save set";
    save.setAttribute("aria-label", `Save set ${i + 1}`);
    save.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z"/></svg>';
    save.addEventListener("click", () =>
      saveSet(
        { game: key, main: ticket.main.slice(), special: ticket.special, src },
        save
      )
    );
    row.appendChild(save);

    container.appendChild(row);
  });
}

function makeBall(n, kind, title) {
  const b = document.createElement("span");
  b.className = `ball ${kind}`;
  const num = document.createElement("span");
  num.className = "ball-num";
  num.textContent = String(n).padStart(2, "0");
  b.appendChild(num);
  if (title) b.title = title;
  return b;
}

/* ------------------------------------------------------------------ *
 * Account
 * ------------------------------------------------------------------ */

function initials(name) {
  const parts = (name || "Guest").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0].toUpperCase()).join("") || "G";
}

function favoriteNumber() {
  const counts = {};
  S.saved.forEach((e) => (e.main || []).forEach((n) => (counts[n] = (counts[n] || 0) + 1)));
  let best = null;
  Object.entries(counts).forEach(([n, c]) => {
    if (!best || c > best.c) best = { n: Number(n), c };
  });
  return best;
}

function renderAccount() {
  if (!el("profileName")) return;
  const name = S.name || "Guest";
  el("avatar").textContent = initials(name);
  el("profileName").textContent = name;
  el("profileSince").textContent =
    "Member since " + fmtDate(new Date(S.createdAt));

  // Activity
  const fav = favoriteNumber();
  el("accountFigures").innerHTML =
    figureHTML(
      "Sets generated",
      String(S.generatedCount || 0),
      "Across all sessions on this device."
    ) +
    figureHTML(
      "Saved numbers",
      String(S.saved.length),
      "Sets you've bookmarked."
    ) +
    figureHTML(
      "Most-saved number",
      fav ? `#${fav.n}` : "—",
      fav
        ? `Appears in ${fav.c} of your saved sets.`
        : "Save a set to surface this.",
      "gold"
    );

  // Preferences
  const g = LOTTERIES[S.game] || LOTTERIES[Object.keys(LOTTERIES)[0]];
  const strat = STRATEGIES[S.strategy];
  el("accountPrefs").innerHTML =
    figureHTML(
      "Game",
      g.name,
      `pick ${g.main.count}/${g.main.max} + 1/${g.special.max}`
    ) +
    figureHTML("Strategy", strat ? strat.label : "Quick Pick", strat ? strat.desc : "") +
    figureHTML("Default sets", String(S.sets || 1), "Used on the Generate screen.");

  renderSavedList();
}

function renderSavedList() {
  const wrap = el("savedList");
  if (!S.saved.length) {
    wrap.innerHTML =
      '<p class="lede small">No saved numbers yet. Tap the bookmark on a generated set, or “Save set” in Build.</p>';
    return;
  }
  wrap.innerHTML = "";
  S.saved.forEach((entry, idx) => {
    const g = LOTTERIES[entry.game];
    const row = document.createElement("div");
    row.className = "saved-row";

    const balls = document.createElement("div");
    balls.className = "saved-balls";
    (entry.main || []).forEach((n) => balls.appendChild(makeBall(n, "main")));
    if (entry.special != null)
      balls.appendChild(makeBall(entry.special, "special"));
    row.appendChild(balls);

    const meta = document.createElement("div");
    meta.className = "saved-meta";
    meta.innerHTML =
      `<span class="saved-game">${g ? g.name : entry.game}</span>` +
      `<span class="saved-date">${fmtDate(new Date(entry.date))} · ${entry.src}</span>`;
    row.appendChild(meta);

    const del = document.createElement("button");
    del.className = "icon-btn del";
    del.title = "Remove";
    del.setAttribute("aria-label", "Remove this saved set");
    del.textContent = "×";
    del.addEventListener("click", () => {
      S.saved.splice(idx, 1);
      saveStore();
      renderAccount();
    });
    row.appendChild(del);

    wrap.appendChild(row);
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initUI);
}

// Expose pure logic for Node tests (no effect in the browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    nCr,
    buildStats,
    frequencyRanking,
    computeStats,
    generateTicket,
    generateTickets,
    weightedPickUnique,
    STRATEGIES,
  };
}
