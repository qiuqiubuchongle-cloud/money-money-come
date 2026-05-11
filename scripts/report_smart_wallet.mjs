import fs from "node:fs";
import {
  dayMs,
  loadJson,
  finite,
  toMs,
  pct,
  mean,
  median,
  runOkxData,
  normalizeOkxOverview,
  normalizeOkxRecentPnl,
  normalizeOkxHistory,
  classifyWallet,
  profileLabel,
  describeWallet,
  signalGroupLabel,
  walletValueScore,
  walletTier,
  walletStyleLabel,
  walletPersona,
} from "./lib_smart_wallets.mjs";
import { chainConfig, normalizeWalletAddress } from "./chain_config.mjs";

const cfg = chainConfig();
const metaPath = process.env.SMART_WALLET_META_PATH || cfg.defaultMetaPath;
const walletScreenPath = process.env.WALLET_SCREEN_PATH || process.env.BSC_WALLET_SCREEN_PATH || cfg.defaultWalletScreenPath;
const okxChain = process.env.OKX_PROFILE_CHAIN || cfg.okxChain;
const timeFrame = String(process.env.OKX_PROFILE_TIME_FRAME_DAYS || "3");

const walletArg = normalizeWalletAddress(process.argv[2], cfg);
if (!walletArg) {
  console.error("Usage: node scripts/report_smart_wallet.mjs <wallet-address>");
  process.exit(1);
}

const metaJson = loadJson(metaPath, { wallets: [] });
const walletScreen = loadJson(walletScreenPath, {});
const meta = (metaJson.wallets || []).find((row) => normalizeWalletAddress(row.address, cfg) === walletArg) || {};
const balance = (walletScreen.keep || []).find((row) => normalizeWalletAddress(row.address, cfg) === walletArg) || {};

const overviewRes = runOkxData([
  "market", "portfolio-overview",
  "--address", walletArg,
  "--chain", okxChain,
  "--time-frame", timeFrame,
]);
if (!overviewRes.ok) {
  console.error(JSON.stringify({ ok: false, error: overviewRes.error }, null, 2));
  process.exit(1);
}

const recentRes = runOkxData([
  "market", "portfolio-recent-pnl",
  "--address", walletArg,
  "--chain", okxChain,
]);
const historyRes = runOkxData([
  "market", "portfolio-dex-history",
  "--address", walletArg,
  "--chain", okxChain,
  "--begin", String(Date.now() - Number(timeFrame) * dayMs),
  "--end", String(Date.now()),
], 25_000);

const overview = normalizeOkxOverview(overviewRes.data);
const recentPnl = normalizeOkxRecentPnl(recentRes.ok ? recentRes.data : []);
const history = normalizeOkxHistory(historyRes.ok ? historyRes.data : []);

const tradeCount = Math.max(finite(overview?.txCount), history.length);
const buyCount = finite(overview?.buyTxCount);
const sellCount = finite(overview?.sellTxCount);
const uniqueTokens = new Set([
  ...recentPnl.map((row) => row.token),
  ...history.map((row) => row.token),
]).size;
const repeatTokenMap = new Map();
for (const row of history.filter((row) => row.side === "1" || row.side.includes("buy"))) {
  repeatTokenMap.set(row.token, (repeatTokenMap.get(row.token) || 0) + 1);
}
const repeatBuyTokens = [...repeatTokenMap.values()].filter((count) => count >= 2).length;
const profitableTokenCount = recentPnl.filter((row) => finite(row.pnlUsd) > 0).length;
const losingTokenCount = recentPnl.filter((row) => finite(row.pnlUsd) < 0).length;
const entryMcs = history.map((row) => finite(row.marketCapUsd)).filter((v) => v > 0);
const latestTradeTime = Math.max(
  ...history.map((row) => toMs(row.tradeTime)),
  ...recentPnl.map((row) => toMs(row.lastActiveTimestamp)),
  0,
);
const activeDaySet = new Set(
  history.map((row) => row.tradeTime ? new Date(toMs(row.tradeTime)).toISOString().slice(0, 10) : "").filter(Boolean)
);

const metrics = {
  walletAddress: walletArg,
  chain: cfg.key,
  chainLabel: cfg.chainLabel,
  walletName: String(meta.name || ""),
  walletEmoji: String(meta.emoji || ""),
  balanceNative: finite(balance.balanceNative ?? balance.balanceBnb ?? balance.balanceSol),
  balanceBnb: finite(balance.balanceBnb),
  balanceSol: finite(balance.balanceSol),
  nonce: finite(balance.nonce),
  tradeCount,
  buyCount,
  sellCount,
  buyRatioPct: pct(buyCount, Math.max(1, buyCount + sellCount)),
  uniqueTokens,
  repeatBuyTokens,
  avgBuysPerToken: uniqueTokens ? buyCount / uniqueTokens : 0,
  totalRealizedPnlUsd: finite(overview?.realizedPnlUsd),
  avgRealizedPnlUsd: mean(recentPnl.map((row) => finite(row.realizedPnlUsd)).filter((v) => v !== 0)),
  winRatePct: finite(overview?.winRatePct),
  medianEntryMarketCapUsd: median(entryMcs),
  averageEntryMarketCapUsd: mean(entryMcs),
  latestTradeTime,
  latestTradeAgeHours: latestTradeTime ? (Date.now() - latestTradeTime) / 3600000 : 9999,
  recentActiveDays: activeDaySet.size,
  avgTradesPerDay: activeDaySet.size ? tradeCount / activeDaySet.size : tradeCount,
  profitableTokenCount,
  losingTokenCount,
  lowMcBuyPct: pct(finite(overview?.lowMcBuys), Math.max(1, finite(overview?.lowMcBuys) + finite(overview?.midMcBuys) + finite(overview?.highMcBuys))),
};

const cls = classifyWallet(metrics);
const valueScore = walletValueScore(metrics);
const tier = walletTier({ ...metrics, walletValueScore: valueScore });
const styleLabel = walletStyleLabel(metrics);
const persona = walletPersona({
  ...metrics,
  profile: cls.primary,
  labels: cls.labels,
  reliabilityScore: cls.reliabilityScore,
  walletValueScore: valueScore,
  walletTier: tier,
  walletStyleLabel: styleLabel,
});
const overviewWins = Array.isArray(overview?.topPnlTokenList) ? overview.topPnlTokenList.map((row) => ({
  token: String(row.tokenContractAddress || row.token || "").toLowerCase(),
  tokenSymbol: String(row.tokenSymbol || row.symbol || "UNKNOWN"),
  pnlUsd: finite(row.tokenPnLUsd || row.pnlUsd),
  totalPnlPercent: finite(row.tokenPnLPercent || row.totalPnlPercent),
})) : [];
const recentWins = [...recentPnl]
  .filter((row) => finite(row.pnlUsd) > 0)
  .sort((a, b) => finite(b.pnlUsd) - finite(a.pnlUsd))
  .map((row) => ({
    token: row.token,
    tokenSymbol: row.tokenSymbol,
    pnlUsd: finite(row.pnlUsd),
    totalPnlPercent: finite(row.totalPnlPercent),
  }));
const topWins = (overviewWins.length ? overviewWins : recentWins).slice(0, 3);

const report = {
  generatedAt: new Date().toISOString(),
  chain: cfg.key,
  chainLabel: cfg.chainLabel,
  walletAddress: walletArg,
  walletName: metrics.walletName,
  walletEmoji: metrics.walletEmoji,
  profile: cls.primary,
  profileLabel: profileLabel(cls.primary),
  signalGroup: signalGroupLabel(cls.primary),
  reliabilityScore: cls.reliabilityScore,
  walletValueScore: valueScore,
  walletTier: tier,
  walletStyleLabel: styleLabel,
  walletPersona: persona,
  personaName: persona.personaName,
  personaCode: persona.personaCode,
  personaIdentity: persona.identity,
  personaConfidence: persona.confidence,
  humanScore: persona.humanScore,
  botScore: persona.botScore,
  trackingPool: persona.tracking.pool,
  walletDecision: persona.decision,
  decisionGrade: persona.decision.grade,
  decisionVerdict: persona.decision.verdict,
  trustScore: persona.decision.trustScore,
  watchMode: persona.decision.watchMode,
  watchModeLabel: persona.decision.watchModeLabel,
  summary: describeWallet({ ...metrics, profile: cls.primary, walletValueScore: valueScore, walletTier: tier, walletStyleLabel: styleLabel, walletPersona: persona }),
  metrics,
  topWins,
  overview,
};

console.log(JSON.stringify(report, null, 2));
