import assert from "node:assert/strict";
import { walletPersona, walletValueScore, walletTier, classifyWallet } from "./lib_smart_wallets.mjs";

function personaFor(metrics) {
  const cls = classifyWallet(metrics);
  const value = walletValueScore(metrics);
  const tier = walletTier({ ...metrics, walletValueScore: value });
  return walletPersona({
    ...metrics,
    profile: cls.primary,
    labels: cls.labels,
    reliabilityScore: cls.reliabilityScore,
    walletValueScore: value,
    walletTier: tier,
  });
}

const early = personaFor({
  tradeCount: 46,
  buyCount: 32,
  sellCount: 14,
  buyRatioPct: 69,
  uniqueTokens: 18,
  repeatBuyTokens: 3,
  medianEntryMarketCapUsd: 55_000,
  latestTradeAgeHours: 3,
  avgBuysPerToken: 1.8,
  avgRealizedPnlUsd: 900,
  totalRealizedPnlUsd: 12_000,
  winRatePct: 52,
  avgTradesPerDay: 4,
  profitableTokenCount: 7,
  losingTokenCount: 5,
  lowMcBuyPct: 82,
  recentActiveDays: 3,
});
assert.equal(early.personaCode, "early_narrative_hunter");
assert.ok(early.ability.discovery >= 75);
assert.ok(early.tracking.pool.includes("核心") || early.tracking.pool.includes("观察"));
assert.ok(["A", "B"].includes(early.decision.grade));
assert.ok(early.decision.trustScore >= 55);
assert.ok(early.decision.watchMode === "discovery_and_confirm" || early.decision.watchMode === "discovery");
assert.ok(early.decision.triggerRule.includes("钱包"));

const bot = personaFor({
  tradeCount: 180,
  buyCount: 70,
  sellCount: 110,
  buyRatioPct: 38,
  uniqueTokens: 80,
  repeatBuyTokens: 0,
  medianEntryMarketCapUsd: 600_000,
  latestTradeAgeHours: 1,
  avgBuysPerToken: 0.9,
  avgRealizedPnlUsd: -40,
  totalRealizedPnlUsd: -800,
  winRatePct: 28,
  avgTradesPerDay: 18,
  profitableTokenCount: 4,
  losingTokenCount: 22,
  lowMcBuyPct: 20,
  recentActiveDays: 3,
});
assert.equal(bot.personaCode, "route_bot");
assert.ok(bot.botScore >= 70);
assert.equal(bot.tracking.pool, "排除池");
assert.equal(bot.decision.grade, "D");
assert.equal(bot.decision.watchMode, "archive");
assert.ok(bot.decision.risks.some((risk) => risk.includes("机器人感")));

const steady = personaFor({
  tradeCount: 60,
  buyCount: 34,
  sellCount: 26,
  buyRatioPct: 56,
  uniqueTokens: 16,
  repeatBuyTokens: 1,
  medianEntryMarketCapUsd: 350_000,
  latestTradeAgeHours: 10,
  avgBuysPerToken: 1.2,
  avgRealizedPnlUsd: 1800,
  totalRealizedPnlUsd: 28_000,
  winRatePct: 61,
  avgTradesPerDay: 3,
  profitableTokenCount: 9,
  losingTokenCount: 3,
  lowMcBuyPct: 35,
  recentActiveDays: 3,
});
assert.equal(steady.personaCode, "steady_profit_operator");
assert.ok(steady.ability.consistency >= 70);
assert.ok(steady.ability.exitDiscipline >= 70);
assert.ok(["A", "B"].includes(steady.decision.grade));
assert.equal(steady.decision.watchMode, "confirm");
assert.ok(steady.decision.reasons.length > 0);

const thin = personaFor({
  tradeCount: 4,
  buyCount: 3,
  sellCount: 1,
  buyRatioPct: 75,
  uniqueTokens: 2,
  repeatBuyTokens: 0,
  medianEntryMarketCapUsd: 90_000,
  latestTradeAgeHours: 6,
  avgBuysPerToken: 1.5,
  avgRealizedPnlUsd: 0,
  totalRealizedPnlUsd: 0,
  winRatePct: 0,
  avgTradesPerDay: 2,
  profitableTokenCount: 0,
  losingTokenCount: 0,
  lowMcBuyPct: 80,
  recentActiveDays: 1,
});
assert.ok(["C", "D"].includes(thin.decision.grade));
assert.ok(thin.decision.risks.some((risk) => risk.includes("样本")));

console.log(JSON.stringify({
  ok: true,
  personas: [
    { code: early.personaCode, name: early.personaName, identity: early.identity },
    { code: bot.personaCode, name: bot.personaName, identity: bot.identity },
    { code: steady.personaCode, name: steady.personaName, identity: steady.identity },
    { code: thin.personaCode, name: thin.personaName, identity: thin.identity },
  ],
}, null, 2));
