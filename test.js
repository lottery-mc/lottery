/* test.js — math + engine tests.
 * Run with:  node --test
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { LOTTERIES } = require("./data.js");
// generateTickets() looks up games on the global, like the browser does.
global.LOTTERIES = LOTTERIES;

const {
  nCr,
  buildStats,
  frequencyRanking,
  computeStats,
  generateTickets,
  weightedPickUnique,
  STRATEGIES,
} = require("./app.js");

const MM = LOTTERIES.megamillions;

test("nCr matches known lottery combination counts", () => {
  assert.equal(nCr(70, 5), 12103014); // Mega Millions main pool
  assert.equal(nCr(69, 5), 11238513); // Powerball main pool
  assert.equal(nCr(5, 0), 1);
  assert.equal(nCr(5, 5), 1);
  assert.equal(nCr(5, 6), 0);
});

test("Mega Millions jackpot odds are exactly 1 in 290,472,336", () => {
  const s = computeStats(MM);
  assert.equal(s.totalMainCombos, 12103014);
  assert.equal(s.jackpotOdds, 290472336);
});

test("prize tiers: top tier is the jackpot, probabilities are ordered", () => {
  const s = computeStats(MM);
  const top = s.tiers[0];
  assert.equal(top.m, 5);
  assert.equal(Math.round(top.oddsWith), 290472336);
  // matching fewer numbers is always more likely (smaller "1 in N")
  for (let i = 1; i < s.tiers.length; i++) {
    assert.ok(s.tiers[i].pExact >= s.tiers[i - 1].pExact);
  }
});

test("buildStats: every draw contributes exactly `count` main picks", () => {
  const stats = buildStats(MM, "main");
  const total = Object.values(stats.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, MM.draws.length * MM.main.count);
  assert.equal(stats.totalDraws, MM.draws.length);
});

test("frequencyRanking is sorted most → least drawn", () => {
  const { list } = frequencyRanking(MM, "main");
  assert.equal(list.length, MM.main.max - MM.main.min + 1);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].count >= list[i].count);
  }
});

test("computeStats reports the correct data window", () => {
  const s = computeStats(MM);
  assert.equal(s.D, MM.draws.length);
  assert.equal(s.dateNewest.getFullYear(), 2026);
  assert.equal(s.dateOldest.getFullYear(), 2023);
  assert.ok(s.dateNewest > s.dateOldest);
  assert.ok(Number.isFinite(s.chi2) && s.chi2 > 0);
});

test("every generated ticket is valid across all strategies", () => {
  Object.keys(STRATEGIES).forEach((strat) => {
    const { game, tickets } = generateTickets("megamillions", strat, 50);
    tickets.forEach((t) => {
      assert.equal(t.main.length, game.main.count);
      assert.equal(new Set(t.main).size, game.main.count, "main numbers unique");
      t.main.forEach((n) => {
        assert.ok(n >= game.main.min && n <= game.main.max, "main in range");
      });
      assert.ok(
        t.special >= game.special.min && t.special <= game.special.max,
        "special in range"
      );
      // sorted ascending
      const sorted = [...t.main].sort((a, b) => a - b);
      assert.deepEqual(t.main, sorted);
    });
  });
});

test("a game with no history still produces valid quick-pick tickets", () => {
  const { game, tickets } = generateTickets("powerball", "hot", 30);
  assert.equal(game.draws.length, 0);
  tickets.forEach((t) => {
    assert.equal(new Set(t.main).size, 5);
    t.main.forEach((n) => assert.ok(n >= 1 && n <= 69));
    assert.ok(t.special >= 1 && t.special <= 26);
  });
});

test("weightedPickUnique returns the requested count of unique values", () => {
  const weights = {};
  for (let n = 1; n <= 10; n++) weights[n] = n;
  const pick = weightedPickUnique(weights, 4);
  assert.equal(pick.length, 4);
  assert.equal(new Set(pick).size, 4);
});
