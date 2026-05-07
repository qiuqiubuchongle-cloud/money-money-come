import fs from "node:fs";
import { spawnSync } from "node:child_process";

export const dayMs = 24 * 60 * 60 * 1000;

export function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

export function saveJson(path, value) {
  fs.writeFileSync(path, JSON.stringify(value, null, 2));
}

export function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toMs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 10_000_000_000 ? n * 1000 : n;
}

export function pct(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

export function mean(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((sum, v) => sum + v, 0) / clean.length : 0;
}

export function median(values) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

export function pickFirst(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function runJson(args, timeout = 18_000) {
  const run = spawnSync("onchainos", args, { encoding: "utf8", timeout });
  if (run.status !== 0) return { ok: false, error: (run.stderr || run.stdout || "").trim() };
  try {
    return JSON.parse(run.stdout || "{}");
  } catch (error) {
    return { ok: false, error: `parse error: ${error.message}` };
  }
}

export function runOkxData(args, timeout = 18_000) {
  const result = runJson(args, timeout);
  if (!result.ok && result.code === undefined) return result;
  if (String(result.code || "0") !== "0") {
    return { ok: false, error: result.msg || `OKX code ${result.code}` };
  }
  return { ok: true, data: result.data ?? result };
}

export function normalizeOkxOverview(raw) {
  if (!raw || typeof raw !== "object") return null;
  const grouped = Array.isArray(raw.buysByMarketCap) ? raw.buysByMarketCap : [];
  const buyRangeCount = (code) => pickFirst(
    grouped.find((item) => String(item.marketCapRange) === String(code))?.buyCount,
  );
  return {
    realizedPnlUsd: pickFirst(raw.realizedPnlUsd, raw.realizedPnl, raw.totalRealizedPnlUsd),
    unrealizedPnlUsd: pickFirst(raw.unrealizedPnlUsd, raw.unrealizedPnl),
    winRatePct: pickFirst(raw.winRate, raw.winRatePct),
    buyTxCount: pickFirst(raw.buyTxCount, raw.buyCount),
    sellTxCount: pickFirst(raw.sellTxCount, raw.sellCount),
    txCount: pickFirst(raw.txCount, raw.tradeCount, raw.totalTxCount),
    avgBuyValueUsd: pickFirst(raw.avgBuyValueUsd, raw.averageBuyValueUsd),
    preferredMarketCap: pickFirst(raw.preferredMarketCap, raw.preferredMarketCapUsd),
    lowMcBuys: buyRangeCount(1) + buyRangeCount(2),
    midMcBuys: buyRangeCount(3),
    highMcBuys: buyRangeCount(4) + buyRangeCount(5),
    activeDays: pickFirst(raw.activeDays, raw.activeTradeDays),
    topPnlTokenList: Array.isArray(raw.topPnlTokenList) ? raw.topPnlTokenList : [],
    rawBuysByMarketCap: grouped,
    tokenCountByPnlPercent: raw.tokenCountByPnlPercent || {},
  };
}

export function normalizeOkxRecentPnl(rows) {
  const list = Array.isArray(rows) ? rows : Array.isArray(rows?.pnlList) ? rows.pnlList : [];
  return list.map((row) => ({
    token: String(row.tokenContractAddress || row.contractAddress || row.tokenAddress || "").toLowerCase(),
    tokenSymbol: String(row.tokenSymbol || ""),
    pnlUsd: pickFirst(row.totalPnlUsd, row.pnlUsd, row.realizedPnlUsd, row.recentPnlUsd),
    realizedPnlUsd: pickFirst(row.realizedPnlUsd),
    unrealizedPnlUsd: pickFirst(row.unrealizedPnlUsd === "SELL_ALL" ? 0 : row.unrealizedPnlUsd),
    tradeCount: pickFirst(row.buyTxCount, 0) + pickFirst(row.sellTxCount, 0) || pickFirst(row.txCount, row.tradeCount),
    buyTxCount: pickFirst(row.buyTxCount),
    sellTxCount: pickFirst(row.sellTxCount),
    marketCapUsd: pickFirst(row.marketCap, row.marketCapUsd),
    lastActiveTimestamp: toMs(row.lastActiveTimestamp),
    totalPnlPercent: pickFirst(row.totalPnlPercent),
  })).filter((row) => row.token);
}

export function normalizeOkxHistory(rows) {
  const list = Array.isArray(rows) ? rows : Array.isArray(rows?.transactionList) ? rows.transactionList : [];
  return list.map((row) => ({
    token: String(row.tokenContractAddress || row.contractAddress || row.tokenAddress || "").toLowerCase(),
    tokenSymbol: String(row.tokenSymbol || ""),
    side: String(row.side || row.txType || row.type || "").toLowerCase(),
    marketCapUsd: pickFirst(row.marketCap, row.marketCapUsd, row.buyMarketCapUsd),
    pnlUsd: pickFirst(row.pnlUsd, row.realizedPnlUsd),
    valueUsd: pickFirst(row.txValueUsd, row.valueUsd, row.amountUsd),
    tradeTime: toMs(row.tradeTime || row.transactionTime || row.time || row.ts),
  }));
}

export function profileLabel(key) {
  return {
    hot_meme_sniper: "热门土狗命中选手",
    hundred_x_hunter: "百倍金狗选手",
    ten_k_profit_champion: "10K盈利冠军",
    conviction_reloader: "信仰加仓选手",
    high_frequency_rookie: "高频交易菜鸡",
    balanced_scout: "均衡侦察选手",
    sleeping_zombie: "休眠地址",
    watch_only: "观察样本",
  }[key] || key;
}

export function classifyWallet(metrics) {
  const labels = [];
  const score = { activity: 0, conviction: 0, rotation: 0, timing: 0, pnl: 0 };
  const tradeCount = finite(metrics.tradeCount);
  const buyCount = finite(metrics.buyCount);
  const sellCount = finite(metrics.sellCount);
  const buyRatio = finite(metrics.buyRatioPct);
  const uniqueTokens = finite(metrics.uniqueTokens);
  const repeatBuyTokens = finite(metrics.repeatBuyTokens);
  const medianEntryMc = finite(metrics.medianEntryMarketCapUsd);
  const latestAgeHours = finite(metrics.latestTradeAgeHours, 9999);
  const avgBuysPerToken = finite(metrics.avgBuysPerToken);
  const avgRealizedPnlUsd = finite(metrics.avgRealizedPnlUsd);
  const totalRealizedPnlUsd = finite(metrics.totalRealizedPnlUsd);
  const winRatePct = finite(metrics.winRatePct);
  const avgTradesPerDay = finite(metrics.avgTradesPerDay);
  const profitableTokenCount = finite(metrics.profitableTokenCount);
  const lowMcBuyPct = finite(metrics.lowMcBuyPct);
  const recentActiveDays = finite(metrics.recentActiveDays);

  if (latestAgeHours <= 24) score.activity += 3;
  else if (latestAgeHours <= 72) score.activity += 2;
  else if (latestAgeHours <= 168) score.activity += 1;
  if (recentActiveDays >= 3) score.activity += 1;

  if (tradeCount >= 30) score.rotation += 3;
  else if (tradeCount >= 12) score.rotation += 2;
  else if (tradeCount >= 5) score.rotation += 1;
  if (avgTradesPerDay >= 8) score.rotation += 1;

  if (buyRatio >= 70) score.conviction += 3;
  else if (buyRatio >= 58) score.conviction += 2;
  else if (buyRatio >= 45) score.conviction += 1;

  if (medianEntryMc > 0 && medianEntryMc <= 60_000) score.timing += 3;
  else if (medianEntryMc <= 180_000) score.timing += 2;
  else if (medianEntryMc <= 800_000) score.timing += 1;

  if (repeatBuyTokens >= 2 || avgBuysPerToken >= 1.8) score.conviction += 1;
  if (sellCount > buyCount && tradeCount >= 10) score.rotation += 1;
  if (uniqueTokens >= 15) score.rotation += 1;

  if (totalRealizedPnlUsd >= 10_000 || avgRealizedPnlUsd >= 2_000) score.pnl += 3;
  else if (totalRealizedPnlUsd >= 3_000 || avgRealizedPnlUsd >= 500) score.pnl += 2;
  else if (totalRealizedPnlUsd > 0 || avgRealizedPnlUsd > 100) score.pnl += 1;
  if (winRatePct >= 60) score.pnl += 1;
  if (profitableTokenCount >= 3) score.pnl += 1;
  if (lowMcBuyPct >= 45) score.timing += 1;

  const severeNegative = (
    (avgTradesPerDay >= 6 && totalRealizedPnlUsd < -1_000 && winRatePct > 0 && winRatePct < 35)
    || (totalRealizedPnlUsd < -10_000 && winRatePct > 0 && winRatePct < 30)
  );

  if (tradeCount <= 3 && latestAgeHours > 168) labels.push("sleeping_zombie");
  if (avgTradesPerDay >= 6 && totalRealizedPnlUsd <= 500 && winRatePct < 45) labels.push("high_frequency_rookie");
  else if (buyRatio <= 40 && sellCount >= 6 && totalRealizedPnlUsd < 1_000) labels.push("high_frequency_rookie");
  if (score.timing >= 3 && score.conviction >= 2 && (medianEntryMc <= 80_000 || lowMcBuyPct >= 50)) labels.push("hundred_x_hunter");
  if (score.rotation >= 3 && score.activity >= 1 && (score.timing >= 2 || profitableTokenCount >= 2)) labels.push("hot_meme_sniper");
  if (score.pnl >= 3 && totalRealizedPnlUsd >= 10_000) labels.push("ten_k_profit_champion");
  if (score.conviction >= 3 && repeatBuyTokens >= 1 && avgBuysPerToken >= 1.5) labels.push("conviction_reloader");
  if (!labels.length && tradeCount >= 8 && buyRatio >= 45 && buyRatio <= 65 && uniqueTokens >= 5) labels.push("balanced_scout");

  let primary = "watch_only";
  if (severeNegative && labels.includes("high_frequency_rookie")) primary = "high_frequency_rookie";
  else if (labels.includes("hundred_x_hunter")) primary = "hundred_x_hunter";
  else if (labels.includes("ten_k_profit_champion")) primary = "ten_k_profit_champion";
  else if (labels.includes("hot_meme_sniper")) primary = "hot_meme_sniper";
  else if (labels.includes("conviction_reloader")) primary = "conviction_reloader";
  else if (labels.includes("high_frequency_rookie")) primary = "high_frequency_rookie";
  else if (labels.includes("balanced_scout")) primary = "balanced_scout";
  else if (labels.includes("sleeping_zombie")) primary = "sleeping_zombie";

  const reliabilityScore = Math.max(0, Math.min(100,
    score.activity * 12
    + score.conviction * 10
    + score.timing * 10
    + score.pnl * 8
    + Math.min(20, tradeCount)
  ));

  const emotionWeight = {
    hundred_x_hunter: 1.45,
    ten_k_profit_champion: 1.3,
    hot_meme_sniper: 1.2,
    conviction_reloader: 1.15,
    balanced_scout: 0.95,
    high_frequency_rookie: 0.65,
    sleeping_zombie: 0.45,
    watch_only: 0.6,
  }[primary] || 1;

  return { primary, labels, reliabilityScore, emotionWeight, score, severeNegative };
}

export function describeWallet(row) {
  const notes = [];
  if (row.profile === "ten_k_profit_champion") notes.push(`近周期已实现盈利 ${Math.round(finite(row.totalRealizedPnlUsd)).toLocaleString()}U`);
  if (row.profile === "hundred_x_hunter") notes.push(`低市值偏好强，低市值买入占比 ${finite(row.lowMcBuyPct).toFixed(1)}%`);
  if (row.profile === "hot_meme_sniper") notes.push(`交易活跃，偏好热点轮动，日均交易 ${finite(row.avgTradesPerDay).toFixed(1)} 次`);
  if (row.profile === "conviction_reloader") notes.push(`重复买入同币明显，重复 token 数 ${finite(row.repeatBuyTokens)}`);
  if (row.profile === "high_frequency_rookie") notes.push(`交易很勤，但胜率/盈利表现弱`);
  if (row.profile === "sleeping_zombie") notes.push(`近期缺少有效交易，适合先移出主监控池`);
  if (row.severeNegative) notes.push(`存在明显回撤和低胜率风险，建议降权或排除`);
  if (finite(row.winRatePct) > 0) notes.push(`胜率 ${finite(row.winRatePct).toFixed(1)}%`);
  return notes.join("；");
}

export function signalGroupLabel(profile) {
  return {
    hundred_x_hunter: "百倍组",
    ten_k_profit_champion: "盈利组",
    hot_meme_sniper: "热点组",
    conviction_reloader: "加仓组",
    balanced_scout: "观察组",
    high_frequency_rookie: "排除组",
    sleeping_zombie: "休眠组",
    watch_only: "观察组",
  }[profile] || "观察组";
}

export function isPositiveSignalProfile(profile) {
  return ["hundred_x_hunter", "ten_k_profit_champion", "hot_meme_sniper", "conviction_reloader"].includes(profile);
}

export function isSafeSignalCandidate(row) {
  const profile = String(row.profile || "");
  const labels = new Set(Array.isArray(row.labels) ? row.labels : []);
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);

  if (!isPositiveSignalProfile(profile)) return false;
  if (profile === "hot_meme_sniper" && labels.has("high_frequency_rookie")) return false;
  if (pnl < -1000) return false;
  if (winRate > 0 && winRate < 30) return false;
  if (latestAgeHours > 24 * 14) return false;
  return true;
}
