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
    hot_meme_sniper: "热点雷达手",
    hundred_x_hunter: "早期金狗手",
    ten_k_profit_champion: "稳定盈利手",
    conviction_reloader: "加仓信仰手",
    high_frequency_rookie: "高频噪音号",
    balanced_scout: "均衡观察员",
    sleeping_zombie: "休眠钱包",
    watch_only: "待验证样本",
  }[key] || key;
}

export function walletValueScore(row) {
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);
  const lowMcBuyPct = finite(row.lowMcBuyPct);
  const medianMc = finite(row.medianEntryMarketCapUsd);
  const buyCount = finite(row.buyCount);
  const sellCount = finite(row.sellCount);
  const uniqueTokens = finite(row.uniqueTokens);
  const profitableTokenCount = finite(row.profitableTokenCount);
  const losingTokenCount = finite(row.losingTokenCount);
  const avgBuyValueUsd = finite(row.avgBuyValueUsd);
  const totalTrades = buyCount + sellCount;

  let profitability = 0;
  if (pnl >= 50_000) profitability += 25;
  else if (pnl >= 10_000) profitability += 20;
  else if (pnl >= 3_000) profitability += 14;
  else if (pnl > 0) profitability += 8;
  else if (pnl < -1_000) profitability -= 8;

  let consistency = 0;
  if (winRate >= 65) consistency += 16;
  else if (winRate >= 50) consistency += 12;
  else if (winRate >= 38) consistency += 8;
  else if (winRate > 0) consistency += 3;
  if (profitableTokenCount >= 8) consistency += 4;
  else if (profitableTokenCount >= 4) consistency += 2;
  if (losingTokenCount > profitableTokenCount * 2 && winRate < 45) consistency -= 4;

  let activity = 0;
  if (latestAgeHours <= 6) activity += 15;
  else if (latestAgeHours <= 24) activity += 12;
  else if (latestAgeHours <= 72) activity += 8;
  else if (latestAgeHours <= 168) activity += 4;
  else activity -= 6;

  let memeFit = 0;
  if (lowMcBuyPct >= 90) memeFit += 15;
  else if (lowMcBuyPct >= 60) memeFit += 11;
  else if (lowMcBuyPct >= 30) memeFit += 6;
  if (medianMc > 0 && medianMc <= 80_000) memeFit += 5;
  else if (medianMc > 800_000) memeFit -= 5;

  let sample = 0;
  if (totalTrades >= 100 && uniqueTokens >= 15) sample += 15;
  else if (totalTrades >= 40 && uniqueTokens >= 8) sample += 10;
  else if (totalTrades >= 12) sample += 5;
  else sample -= 8;

  let copyability = 10;
  if (avgBuyValueUsd > 0 && avgBuyValueUsd <= 1_000) copyability += 5;
  else if (avgBuyValueUsd > 5_000) copyability -= 5;
  if (sellCount > buyCount * 2 && winRate < 45) copyability -= 5;

  return Math.max(0, Math.min(100, Math.round(
    profitability + consistency + activity + memeFit + sample + copyability
  )));
}

export function walletTier(row) {
  const score = finite(row.walletValueScore ?? walletValueScore(row));
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const sample = finite(row.buyCount) + finite(row.sellCount);
  if (latestAgeHours > 24 * 14) return "剔除";
  if (score >= 75 && pnl > 0 && winRate >= 35 && sample >= 20) return "核心";
  if (score >= 60 && pnl >= 0 && sample >= 12) return "观察";
  if (score >= 45) return "降权";
  return "剔除";
}

export function walletStyleLabel(row) {
  const lowMcBuyPct = finite(row.lowMcBuyPct);
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const medianMc = finite(row.medianEntryMarketCapUsd);
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);
  const sample = finite(row.buyCount) + finite(row.sellCount);
  if (latestAgeHours > 24 * 14) return "休眠样本";
  if (sample < 12) return "样本太薄";
  if (pnl >= 10_000 && lowMcBuyPct >= 70) return "早期盈利雷达";
  if (pnl >= 10_000 && winRate >= 50) return "稳健盈利选手";
  if (lowMcBuyPct >= 85 && medianMc <= 100_000) return "低市值猎手";
  if (medianMc >= 800_000 && pnl > 0) return "高市值波段手";
  if (winRate < 35 && pnl <= 0) return "高噪音钱包";
  return "观察样本";
}

export function walletOneLiner(row) {
  const tier = row.walletTier || walletTier(row);
  const style = row.walletStyleLabel || walletStyleLabel(row);
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);
  const lowMcBuyPct = finite(row.lowMcBuyPct);
  const activeText = latestAgeHours <= 1 ? "刚动过" : latestAgeHours <= 24 ? `${latestAgeHours.toFixed(1)}h前活跃` : `${(latestAgeHours / 24).toFixed(1)}天前活跃`;
  if (tier === "核心") return `${style}，${Math.round(pnl).toLocaleString()}U已实现，胜率${winRate.toFixed(1)}%，${activeText}`;
  if (tier === "观察") return `${style}，低市值偏好${lowMcBuyPct.toFixed(0)}%，等同组确认`;
  if (tier === "降权") return `${style}，有亮点但稳定性不够，先降权看`;
  return `${style}，暂不进主信号池`;
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
  return walletOneLiner(row);
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
  const valueScore = finite(row.walletValueScore ?? walletValueScore(row));
  const tier = row.walletTier || walletTier({ ...row, walletValueScore: valueScore });

  if (!isPositiveSignalProfile(profile)) return false;
  if (profile === "hot_meme_sniper" && labels.has("high_frequency_rookie")) return false;
  if (pnl < -1000) return false;
  if (winRate > 0 && winRate < 30) return false;
  if (latestAgeHours > 24 * 14) return false;
  if (tier !== "核心") return false;
  if (valueScore < 75) return false;
  return true;
}
