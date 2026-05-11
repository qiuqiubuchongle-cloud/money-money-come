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

export function walletPersona(row) {
  const profile = String(row.profile || "watch_only");
  const labels = new Set(Array.isArray(row.labels) ? row.labels : []);
  const tradeCount = finite(row.tradeCount);
  const buyCount = finite(row.buyCount);
  const sellCount = finite(row.sellCount);
  const uniqueTokens = finite(row.uniqueTokens);
  const repeatBuyTokens = finite(row.repeatBuyTokens);
  const avgTradesPerDay = finite(row.avgTradesPerDay);
  const avgBuysPerToken = finite(row.avgBuysPerToken);
  const latestAgeHours = finite(row.latestTradeAgeHours, 9999);
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const lowMcBuyPct = finite(row.lowMcBuyPct);
  const medianMc = finite(row.medianEntryMarketCapUsd);
  const profitableTokenCount = finite(row.profitableTokenCount);
  const losingTokenCount = finite(row.losingTokenCount);
  const valueScore = finite(row.walletValueScore ?? walletValueScore(row));
  const reliability = finite(row.reliabilityScore);
  const tier = row.walletTier || walletTier({ ...row, walletValueScore: valueScore });

  const ability = {
    discovery: clampScore(35 + scoreIf(lowMcBuyPct >= 70, 25) + scoreIf(medianMc > 0 && medianMc <= 100_000, 20) + scoreIf(profitableTokenCount >= 3, 10) + scoreIf(profile === "hundred_x_hunter", 10)),
    execution: clampScore(35 + scoreIf(latestAgeHours <= 24, 15) + scoreIf(reliability >= 80, 20) + scoreIf(tradeCount >= 30, 10) + scoreIf(avgTradesPerDay > 0 && avgTradesPerDay <= 8, 5)),
    exitDiscipline: clampScore(40 + scoreIf(winRate >= 55, 20) + scoreIf(pnl > 0, 15) - scoreIf(losingTokenCount > profitableTokenCount * 2 && losingTokenCount >= 4, 20) - scoreIf(labels.has("high_frequency_rookie"), 15)),
    consistency: clampScore(30 + scoreIf(winRate >= 50, 25) + scoreIf(profitableTokenCount >= 5, 15) + scoreIf(valueScore >= 75, 15) - scoreIf(tradeCount < 12, 20)),
    earlyMemeFit: clampScore(25 + scoreIf(lowMcBuyPct >= 70, 30) + scoreIf(medianMc > 0 && medianMc <= 180_000, 20) + scoreIf(profile === "hundred_x_hunter", 15)),
    noiseResistance: clampScore(50 + scoreIf(winRate >= 50, 15) + scoreIf(avgTradesPerDay <= 5, 10) - scoreIf(labels.has("high_frequency_rookie"), 30) - scoreIf(avgTradesPerDay >= 8, 15)),
    copyability: clampScore(45 + scoreIf(tier === "核心", 20) + scoreIf(pnl >= 0, 10) + scoreIf(avgTradesPerDay <= 6, 10) - scoreIf(profile === "high_frequency_rookie", 25) - scoreIf(latestAgeHours > 24 * 14, 25)),
  };

  const botScore = clampScore(
    scoreIf(avgTradesPerDay >= 8, 35)
    + scoreIf(tradeCount >= 80 && uniqueTokens >= 25, 20)
    + scoreIf(buyCount > 0 && sellCount > buyCount * 1.8, 15)
    + scoreIf(labels.has("high_frequency_rookie"), 25)
    - scoreIf(pnl >= 10_000, 10)
  );
  const humanScore = clampScore(
    45
    + scoreIf(avgTradesPerDay > 0 && avgTradesPerDay <= 5, 15)
    + scoreIf(repeatBuyTokens >= 1, 10)
    + scoreIf(uniqueTokens >= 5 && uniqueTokens <= 30, 10)
    + scoreIf(pnl > 0, 10)
    - scoreIf(botScore >= 60, 25)
  );

  let identity = "聪明钱候选";
  let personaName = "均衡观察员";
  let personaCode = "balanced_observer";
  let confidence = 55;
  if (latestAgeHours > 24 * 14) {
    identity = "休眠地址";
    personaName = "沉睡旧钱包";
    personaCode = "sleeping_wallet";
    confidence = 70;
  } else if (botScore >= 70) {
    identity = "疑似机器人/高频噪音";
    personaName = "链上打点机";
    personaCode = "route_bot";
    confidence = 65;
  } else if (profile === "hundred_x_hunter" || (ability.discovery >= 75 && ability.earlyMemeFit >= 75)) {
    identity = "早期发现型聪明钱";
    personaName = "早期叙事猎人";
    personaCode = "early_narrative_hunter";
    confidence = 72;
  } else if (profile === "ten_k_profit_champion" || (pnl >= 10_000 && winRate >= 45)) {
    identity = "稳定盈利型聪明钱";
    personaName = "稳健盈利派";
    personaCode = "steady_profit_operator";
    confidence = 74;
  } else if (profile === "conviction_reloader" || repeatBuyTokens >= 2 || avgBuysPerToken >= 1.8) {
    identity = "信仰加仓型交易者";
    personaName = "信仰加仓派";
    personaCode = "conviction_reloader";
    confidence = 68;
  } else if (profile === "hot_meme_sniper" || (avgTradesPerDay >= 4 && lowMcBuyPct >= 45)) {
    identity = "热点轮动型交易者";
    personaName = "热点切换手";
    personaCode = "hot_rotation_trader";
    confidence = 66;
  } else if (pnl < 0 && winRate > 0 && winRate < 35) {
    identity = "高噪音亏损地址";
    personaName = "后排冲锋号";
    personaCode = "late_fomo_chaser";
    confidence = 62;
  }

  confidence = clampScore(confidence + scoreIf(tradeCount >= 30, 10) + scoreIf(uniqueTokens >= 8, 6) - scoreIf(tradeCount < 8, 18));

  const traits = personaTraits(personaCode, row);
  const evidence = personaEvidence({
    ...row,
    tradeCount,
    buyCount,
    sellCount,
    uniqueTokens,
    repeatBuyTokens,
    avgTradesPerDay,
    avgBuysPerToken,
    latestAgeHours,
    pnl,
    winRate,
    lowMcBuyPct,
    medianMc,
    valueScore,
    reliability,
    botScore,
    humanScore,
  });
  const tracking = trackingAdvice({ personaCode, tier, valueScore, pnl, winRate, latestAgeHours, botScore });
  const decision = walletDecision({
    ...row,
    tradeCount,
    buyCount,
    sellCount,
    uniqueTokens,
    repeatBuyTokens,
    avgTradesPerDay,
    avgBuysPerToken,
    latestAgeHours,
    totalRealizedPnlUsd: pnl,
    winRatePct: winRate,
    lowMcBuyPct,
    medianEntryMarketCapUsd: medianMc,
    profitableTokenCount,
    losingTokenCount,
    profile,
    labels: [...labels],
    reliabilityScore: reliability,
    walletValueScore: valueScore,
    walletTier: tier,
  }, {
    personaCode,
    personaName,
    identity,
    confidence,
    humanScore,
    botScore,
    ability,
    tracking,
  });

  return {
    version: "wallet-persona-v2",
    identity,
    personaCode,
    personaName,
    confidence,
    humanScore,
    botScore,
    ability,
    traits,
    evidence,
    tracking,
    decision,
    oneLiner: `${personaName}｜${identity}｜${tracking.pool}｜${decision.verdict}`,
    summary: personaSummary({ personaName, identity, traits, tracking, decision }),
  };
}

export function walletDecision(row, persona = row.walletPersona || {}) {
  const personaCode = String(persona.personaCode || row.personaCode || "balanced_observer");
  const valueScore = finite(row.walletValueScore ?? walletValueScore(row));
  const reliability = finite(row.reliabilityScore);
  const tier = row.walletTier || walletTier({ ...row, walletValueScore: valueScore });
  const ability = persona.ability || row.ability || {};
  const pnl = finite(row.totalRealizedPnlUsd);
  const winRate = finite(row.winRatePct);
  const latestAgeHours = finite(row.latestAgeHours ?? row.latestTradeAgeHours, 9999);
  const tradeCount = finite(row.tradeCount);
  const uniqueTokens = finite(row.uniqueTokens);
  const lowMcBuyPct = finite(row.lowMcBuyPct);
  const medianMc = finite(row.medianEntryMarketCapUsd);
  const avgTradesPerDay = finite(row.avgTradesPerDay);
  const losingTokenCount = finite(row.losingTokenCount);
  const profitableTokenCount = finite(row.profitableTokenCount);
  const confidence = finite(persona.confidence ?? row.personaConfidence, 50);
  const humanScore = finite(persona.humanScore ?? row.humanScore, 50);
  const botScore = finite(persona.botScore ?? row.botScore);
  const discovery = finite(ability.discovery, 45);
  const exitDiscipline = finite(ability.exitDiscipline, 45);
  const consistency = finite(ability.consistency, 45);
  const copyability = finite(ability.copyability, 45);
  const earlyMemeFit = finite(ability.earlyMemeFit, 45);

  const samplePenalty = tradeCount < 8 ? 18 : tradeCount < 15 ? 8 : 0;
  const stalePenalty = latestAgeHours > 24 * 14 ? 35 : latestAgeHours > 24 * 3 ? 10 : 0;
  const trustScore = clampScore(
    valueScore * 0.30
    + reliability * 0.16
    + confidence * 0.13
    + copyability * 0.13
    + exitDiscipline * 0.11
    + consistency * 0.09
    + humanScore * 0.08
    - botScore * 0.18
    - samplePenalty
    - stalePenalty
  );

  const reasons = decisionReasons({
    valueScore,
    reliability,
    confidence,
    pnl,
    winRate,
    latestAgeHours,
    tradeCount,
    uniqueTokens,
    lowMcBuyPct,
    medianMc,
    discovery,
    copyability,
    exitDiscipline,
  });
  const risks = decisionRisks({
    botScore,
    tradeCount,
    uniqueTokens,
    pnl,
    winRate,
    latestAgeHours,
    avgTradesPerDay,
    losingTokenCount,
    profitableTokenCount,
    confidence,
    copyability,
    medianMc,
  });

  const forcedExclude = (
    personaCode === "route_bot"
    || personaCode === "sleeping_wallet"
    || botScore >= 75
    || latestAgeHours > 24 * 21
  );

  let grade = "D";
  if (forcedExclude) grade = "D";
  else if (tier === "核心" && trustScore >= 78 && risks.length <= 2) grade = "A";
  else if ((tier === "核心" || tier === "观察") && trustScore >= 62) grade = "B";
  else if (trustScore >= 45) grade = "C";

  const verdict = {
    A: "重点跟踪",
    B: "观察验证",
    C: "只看题材",
    D: "排除留档",
  }[grade];

  const watchMode = decisionWatchMode(personaCode, grade);
  const triggerRule = decisionTriggerRule({ personaCode, grade, trustScore, lowMcBuyPct, discovery });
  const action = decisionAction({ grade, watchMode, triggerRule });
  const invalidators = decisionInvalidators({ personaCode, grade, risks });

  return {
    version: "wallet-decision-v1",
    grade,
    verdict,
    trustScore,
    watchMode,
    watchModeLabel: watchModeLabel(watchMode),
    triggerRule,
    action,
    reasons,
    risks,
    invalidators,
    nextReview: grade === "A" ? "每日复盘"
      : grade === "B" ? "每 2-3 天复盘"
      : grade === "C" ? "样本增加后复盘"
      : "除非重新活跃，否则不复盘",
  };
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
  if (row.walletPersona?.summary) return row.walletPersona.summary;
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

function scoreIf(condition, value) {
  return condition ? value : 0;
}

function clampScore(value) {
  const n = finite(value);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function personaTraits(code, row) {
  const base = {
    early_narrative_hunter: ["叙事敏感", "低市值偏好", "出手靠前", "波动容忍高"],
    steady_profit_operator: ["收益稳定", "样本较厚", "不盲目追早", "适合做确认源"],
    conviction_reloader: ["重复加仓", "持仓信念强", "容易重仓", "需要观察退出"],
    hot_rotation_trader: ["热点轮动", "切换快", "题材嗅觉强", "噪音中等"],
    route_bot: ["交易密集", "节奏机械", "可跟随性低", "适合排除噪音"],
    late_fomo_chaser: ["后排参与", "胜率偏低", "情绪化买入", "不适合作确认"],
    sleeping_wallet: ["长期休眠", "样本陈旧", "暂不触发", "仅留档"],
    balanced_observer: ["行为均衡", "样本待验证", "信号权重较低", "适合观察"],
  }[code] || ["样本待验证"];
  const extra = [];
  if (finite(row.lowMcBuyPct) >= 70) extra.push("早期池偏好强");
  if (finite(row.winRatePct) >= 60) extra.push("胜率亮眼");
  if (finite(row.avgTradesPerDay) >= 8) extra.push("高频噪音风险");
  return [...new Set([...base, ...extra])].slice(0, 6);
}

function personaEvidence(row) {
  const evidence = [
    `交易样本 ${finite(row.tradeCount)} 笔，覆盖 ${finite(row.uniqueTokens)} 个 token`,
    `已实现收益 ${Math.round(finite(row.pnl)).toLocaleString()}U，胜率 ${finite(row.winRate).toFixed(1)}%`,
    `低市值买入占比 ${finite(row.lowMcBuyPct).toFixed(1)}%，入场市值中位数 ${formatUsd(row.medianMc)}`,
    `最近活跃 ${formatAge(row.latestAgeHours)}，平均每日交易 ${finite(row.avgTradesPerDay).toFixed(1)} 笔`,
  ];
  if (finite(row.repeatBuyTokens) > 0) evidence.push(`有 ${finite(row.repeatBuyTokens)} 个 token 出现重复买入，存在加仓行为`);
  if (finite(row.botScore) >= 60) evidence.push(`机器人感 ${finite(row.botScore)}，需要防止把脚本流水误判成聪明钱`);
  return evidence;
}

function trackingAdvice({ personaCode, tier, valueScore, pnl, winRate, latestAgeHours, botScore }) {
  if (personaCode === "route_bot" || botScore >= 75) {
    return {
      pool: "排除池",
      action: "不作为买入确认，只用于识别热度噪音。",
      triggerRule: "默认不触发；除非多源确认且风险分极低。",
    };
  }
  if (personaCode === "sleeping_wallet" || latestAgeHours > 24 * 14) {
    return {
      pool: "休眠池",
      action: "先留档，重新活跃前不参与信号。",
      triggerRule: "重新出现连续交易后再恢复观察。",
    };
  }
  if (tier === "核心" && valueScore >= 75 && pnl >= 0 && winRate >= 35) {
    return {
      pool: "核心观察池",
      action: "适合作为同组共振确认源，不建议单地址盲跟。",
      triggerRule: "同人设/同组 >=2 个地址同币买入时提醒；>=3 个可升为强提醒。",
    };
  }
  if (tier === "观察" || valueScore >= 55) {
    return {
      pool: "观察池",
      action: "适合发现题材，不适合作为最终买入依据。",
      triggerRule: "单独买入只记录；叠加 OKX/Hot/Gas 或同组共振再提醒。",
    };
  }
  return {
    pool: "降权池",
    action: "暂时只做背景参考。",
    triggerRule: "默认不推送，除非后续样本改善。",
  };
}

function personaSummary({ personaName, identity, traits, tracking, decision }) {
  const verdict = decision?.verdict ? `${decision.verdict}，` : "";
  const mode = decision?.watchModeLabel ? `${decision.watchModeLabel}。` : "";
  return `${personaName}，${identity}。${traits.slice(0, 3).join("、")}；${verdict}${mode}${tracking.action}`;
}

function decisionReasons(row) {
  const reasons = [];
  if (row.valueScore >= 75) reasons.push(`钱包价值分 ${row.valueScore}/100，已达核心观察线`);
  else if (row.valueScore >= 60) reasons.push(`钱包价值分 ${row.valueScore}/100，有观察价值`);
  if (row.reliability >= 85) reasons.push(`行为可靠度 ${row.reliability}/100，样本结构较扎实`);
  if (row.pnl > 0) reasons.push(`已实现收益为正：${Math.round(row.pnl).toLocaleString()}U`);
  if (row.winRate >= 50) reasons.push(`胜率 ${row.winRate.toFixed(1)}%，不是单纯靠一笔暴击`);
  if (row.discovery >= 75 || row.lowMcBuyPct >= 70) reasons.push(`低市值发现能力强，早期 meme 适配度高`);
  if (row.tradeCount >= 30 && row.uniqueTokens >= 8) reasons.push(`交易样本 ${row.tradeCount} 笔 / ${row.uniqueTokens} 个 token，足够做初步判断`);
  if (row.latestAgeHours <= 24) reasons.push(`最近 ${formatAge(row.latestAgeHours)} 活跃，仍在当前市场里`);
  if (row.copyability >= 70) reasons.push(`可跟随性 ${row.copyability}/100，节奏相对不难复核`);
  if (row.exitDiscipline >= 70) reasons.push(`退出纪律 ${row.exitDiscipline}/100，风险管理表现较好`);
  if (!reasons.length) reasons.push("当前证据不足，只能作为轻量观察样本");
  return reasons.slice(0, 4);
}

function decisionRisks(row) {
  const risks = [];
  if (row.botScore >= 70) risks.push(`机器人感 ${row.botScore}/100，疑似脚本或高频路由流水`);
  else if (row.botScore >= 55) risks.push(`机器人感偏高，需要防止噪音误判`);
  if (row.tradeCount < 8) risks.push(`交易样本只有 ${row.tradeCount} 笔，样本太薄`);
  if (row.uniqueTokens < 4 && row.tradeCount < 20) risks.push(`覆盖 token 太少，代表性不足`);
  if (row.pnl < -1000) risks.push(`已实现收益为负：${Math.round(row.pnl).toLocaleString()}U`);
  if (row.winRate > 0 && row.winRate < 35) risks.push(`胜率 ${row.winRate.toFixed(1)}%，历史噪音偏高`);
  if (row.latestAgeHours > 24 * 14) risks.push("超过 14 天无有效活跃，信号可能过期");
  if (row.avgTradesPerDay >= 8) risks.push(`每日交易约 ${row.avgTradesPerDay.toFixed(1)} 笔，节奏过密不适合盲跟`);
  if (row.losingTokenCount > row.profitableTokenCount * 2 && row.losingTokenCount >= 4) risks.push("亏损 token 明显多于盈利 token");
  if (row.confidence < 55) risks.push(`画像置信度 ${row.confidence}/100，需要更多数据验证`);
  if (row.copyability < 45) risks.push("可跟随性偏低，容易只看到结果追不到过程");
  if (row.medianMc >= 1_000_000) risks.push(`入场市值中位数 ${formatUsd(row.medianMc)}，可能偏后排`);
  return risks.slice(0, 5);
}

function decisionWatchMode(personaCode, grade) {
  if (grade === "D") return "archive";
  if (personaCode === "early_narrative_hunter") return grade === "A" ? "discovery_and_confirm" : "discovery";
  if (personaCode === "steady_profit_operator") return "confirm";
  if (personaCode === "conviction_reloader") return "conviction";
  if (personaCode === "hot_rotation_trader") return "discovery";
  if (personaCode === "late_fomo_chaser") return "background";
  return grade === "A" ? "confirm" : "background";
}

function watchModeLabel(mode) {
  return {
    discovery_and_confirm: "可同时作为发现源和确认源",
    discovery: "适合作为题材发现源",
    confirm: "适合作为买入确认源",
    conviction: "适合观察持续加仓，不适合单点追",
    background: "只做背景参考",
    archive: "排除留档",
  }[mode] || "只做背景参考";
}

function decisionTriggerRule({ personaCode, grade, trustScore, lowMcBuyPct, discovery }) {
  if (grade === "A") {
    if (personaCode === "early_narrative_hunter" || lowMcBuyPct >= 70 || discovery >= 75) {
      return "同人设/同组 2 个钱包 5 分钟内买入可提醒；3 个钱包升强提醒。";
    }
    return "同组 2 个钱包 5 分钟内买入可提醒；叠加外部热度升强提醒。";
  }
  if (grade === "B") {
    if (personaCode === "hot_rotation_trader") return "单独买入只记录；同组 2 个钱包且叠加 Hot/Gas/OKX 任一确认再提醒。";
    return "同组 2 个钱包 5 分钟内买入只发观察提醒；3 个钱包或外部确认再升正式提醒。";
  }
  if (grade === "C" || trustScore >= 45) return "不单独触发；仅在核心地址已触发时作为辅助说明。";
  return "默认不触发。";
}

function decisionAction({ grade, watchMode, triggerRule }) {
  if (grade === "A") return `进核心观察池。${triggerRule}`;
  if (grade === "B") return `进观察池。${triggerRule}`;
  if (watchMode === "background") return `降权观察。${triggerRule}`;
  return `不进入信号池。${triggerRule}`;
}

function decisionInvalidators({ personaCode, grade, risks }) {
  const invalidators = [];
  if (grade === "A" || grade === "B") {
    invalidators.push("连续 3 次同组触发后信号表现不佳，自动降权复盘");
    invalidators.push("超过 7 天无交易或画像置信度下降，移出核心池");
  }
  if (personaCode === "early_narrative_hunter" || personaCode === "hot_rotation_trader") {
    invalidators.push("连续追高或入场市值明显后移时，降为背景参考");
  }
  if (personaCode === "conviction_reloader") {
    invalidators.push("只加仓不退出且收益回撤扩大时，不作为确认源");
  }
  if (risks.some((risk) => risk.includes("机器人感"))) {
    invalidators.push("机器人感继续升高时，直接转排除池");
  }
  if (!invalidators.length) invalidators.push("样本不足时不要单地址下结论");
  return invalidators.slice(0, 4);
}

function formatUsd(value) {
  const n = finite(value);
  if (!n) return "n/a";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatAge(hours) {
  const n = finite(hours, 9999);
  if (n < 1) return `${Math.round(n * 60)} 分钟前`;
  if (n < 24) return `${n.toFixed(1)} 小时前`;
  if (n < 24 * 30) return `${(n / 24).toFixed(1)} 天前`;
  return "超过 30 天前";
}
