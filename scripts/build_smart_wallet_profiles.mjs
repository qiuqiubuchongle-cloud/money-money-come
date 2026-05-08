import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  loadJson,
  saveJson,
  finite,
  toMs,
  pct,
  median,
  mean,
  pickFirst,
  normalizeOkxOverview,
  normalizeOkxRecentPnl,
  normalizeOkxHistory,
  classifyWallet,
  profileLabel,
  describeWallet,
  walletValueScore,
  walletTier,
  walletStyleLabel,
} from "./lib_smart_wallets.mjs";
const walletScreenPath = process.env.BSC_WALLET_SCREEN_PATH || "data/bsc_wallet_screen.json";
const trackerActivityPath = process.env.OKX_TRACKER_ACTIVITY_PATH || "data/okx_tracker_activity.json";
const recentBuysPath = process.env.SMART_WALLET_RECENT_BUYS_PATH || "data/smart_wallet_recent_buys_bsc.json";
const outPath = process.env.SMART_WALLET_PROFILES_PATH || "data/smart_wallet_profiles_bsc.json";
const metaPath = process.env.SMART_WALLET_META_PATH || "data/smart_wallet_meta.json";
const okxChain = process.env.OKX_PROFILE_CHAIN || "bsc";
const okxTimeFrameDays = String(process.env.OKX_PROFILE_TIME_FRAME_DAYS || "3");
const okxEnabled = process.env.OKX_PROFILE_ENABLED !== "0";
const okxHistoryEnabled = process.env.OKX_PROFILE_HISTORY_ENABLED !== "0";
const okxRecentPnlEnabled = process.env.OKX_PROFILE_RECENT_PNL_ENABLED !== "0";
const okxTimeoutMs = Number(process.env.OKX_PROFILE_TIMEOUT_MS || 18_000);
const okxHistoryLimit = Number(process.env.OKX_PROFILE_HISTORY_LIMIT || 120);
const okxCachePath = process.env.OKX_PROFILE_CACHE_PATH || "data/okx_wallet_profile_cache.json";
const okxCacheTtlMs = Number(process.env.OKX_PROFILE_CACHE_TTL_MS || 30 * 60_000);
const walletSelectionMode = process.env.SMART_WALLET_SELECTION_MODE || "meta_if_present";

fs.mkdirSync("data", { recursive: true });

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

function runJson(args, timeout = okxTimeoutMs) {
  const run = spawnSync("onchainos", args, { encoding: "utf8", timeout });
  if (run.status !== 0) return { ok: false, error: (run.stderr || run.stdout || "").trim() };
  try {
    return JSON.parse(run.stdout || "{}");
  } catch (error) {
    return { ok: false, error: `parse error: ${error.message}` };
  }
}

function runOkxData(args, timeout = okxTimeoutMs) {
  if (!okxEnabled) return { ok: false, error: "OKX profile disabled" };
  const result = runJson(args, timeout);
  if (!result.ok && result.code === undefined) return result;
  if (String(result.code || "0") !== "0") {
    return { ok: false, error: result.msg || `OKX code ${result.code}` };
  }
  return { ok: true, data: result.data ?? result };
}

function buildOkxSnapshot(wallet) {
  const cache = loadJson(okxCachePath, {});
  const cached = cache[wallet];
  if (cached && now - finite(cached.cachedAt) <= okxCacheTtlMs) {
    return cached.snapshot;
  }

  const snapshot = {
    source: "fallback",
    walletAddress: wallet,
    okxAvailable: false,
    okxError: "",
    overview: null,
    recentPnl: [],
    dexHistory: [],
  };
  if (!okxEnabled) return snapshot;

  const overview = runOkxData([
    "market", "portfolio-overview",
    "--address", wallet,
    "--chain", okxChain,
    "--time-frame", okxTimeFrameDays,
  ]);
  if (!overview.ok) {
    snapshot.okxError = overview.error || "portfolio-overview failed";
    return snapshot;
  }

  snapshot.okxAvailable = true;
  snapshot.source = "okx";
  snapshot.overview = overview.data || null;

  if (okxRecentPnlEnabled) {
    const recent = runOkxData([
      "market", "portfolio-recent-pnl",
      "--address", wallet,
      "--chain", okxChain,
    ]);
    if (recent.ok) snapshot.recentPnl = recent.data;
    else if (!snapshot.okxError && recent.error) snapshot.okxError = recent.error;
  }

  if (okxHistoryEnabled) {
    const end = Date.now();
    const begin = end - Number(okxTimeFrameDays) * dayMs;
    const history = runOkxData([
      "market", "portfolio-dex-history",
      "--address", wallet,
      "--chain", okxChain,
      "--begin", String(begin),
      "--end", String(end),
    ], Math.max(okxTimeoutMs, 25_000));
    if (history.ok) {
      snapshot.dexHistory = history.data;
    } else if (!snapshot.okxError && history.error) {
      snapshot.okxError = history.error;
    }
  }

  cache[wallet] = {
    cachedAt: now,
    snapshot,
  };
  saveJson(okxCachePath, cache);

  return snapshot;
}

function buildProfiles() {
  const walletScreen = loadJson(walletScreenPath, {});
  const trackerActivity = loadJson(trackerActivityPath, {});
  const recentBuys = loadJson(recentBuysPath, []);
  const walletMeta = loadJson(metaPath, {});

  const balances = new Map((walletScreen.keep || []).map((row) => [String(row.address || "").toLowerCase(), row]));
  const tracker = new Map((trackerActivity.active || []).map((row) => [String(row.walletAddress || "").toLowerCase(), row]));
  const metaWalletRows = Array.isArray(walletMeta.wallets) ? walletMeta.wallets : [];
  const metaByWallet = new Map(
    metaWalletRows.map((row) => [String(row.address || "").toLowerCase(), row]).filter(([wallet]) => wallet)
  );
  const buyRows = Array.isArray(recentBuys) ? recentBuys : [];
  const buysByWallet = new Map();
  for (const row of buyRows) {
    const wallet = String(row.walletAddress || "").toLowerCase();
    if (!wallet) continue;
    const list = buysByWallet.get(wallet) || [];
    list.push(row);
    buysByWallet.set(wallet, list);
  }

  const metaWallets = new Set(metaByWallet.keys());
  const inferredWallets = new Set([
    ...balances.keys(),
    ...tracker.keys(),
    ...buysByWallet.keys(),
  ]);
  const allWallets = (
    walletSelectionMode === "meta_only" ? metaWallets
      : walletSelectionMode === "all" ? inferredWallets
      : metaWallets.size ? metaWallets : inferredWallets
  );

  const profiles = [];
  for (const wallet of allWallets) {
    const balance = balances.get(wallet) || {};
    const active = tracker.get(wallet) || {};
    const buys = buysByWallet.get(wallet) || [];
    const meta = metaByWallet.get(wallet) || {};
    const okx = buildOkxSnapshot(wallet);
    const okxOverview = normalizeOkxOverview(okx.overview);
    const okxRecentPnl = normalizeOkxRecentPnl(okx.recentPnl);
    const okxHistory = normalizeOkxHistory(okx.dexHistory);
    const tokenCounts = new Map();
    let realizedPnlRows = 0;
    let realizedPnlUsd = 0;
    let realizedWins = 0;
    for (const row of buys) {
      const token = String(row.tokenContractAddress || "").toLowerCase();
      if (!token) continue;
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      const pnl = finite(row.realizedPnlUsd);
      if (pnl !== 0) {
        realizedPnlRows += 1;
        realizedPnlUsd += pnl;
        if (pnl > 0) realizedWins += 1;
      }
    }
    const entryMcs = [
      ...buys.map((row) => finite(row.marketCap)),
      ...okxHistory.map((row) => finite(row.marketCapUsd)),
      pickFirst(okxOverview?.preferredMarketCap),
    ].filter((v) => v > 0);
    const combinedTradeTimes = [
      toMs(active.latestTradeTime),
      ...buys.map((row) => toMs(row.tradeTime)),
      ...okxHistory.map((row) => toMs(row.tradeTime)),
    ].filter(Boolean);
    const latestTradeTime = Math.max(
      ...combinedTradeTimes,
      0,
    );
    const localTradeCount = Math.max(finite(active.tradeCount), buys.length, okxHistory.length);
    const localBuyCount = Math.max(finite(active.buyCount), buys.length);
    const okxTradeCount = pickFirst(okxOverview?.txCount);
    const okxBuyCount = pickFirst(okxOverview?.buyTxCount);
    const okxSellCount = pickFirst(okxOverview?.sellTxCount);
    const tradeCount = Math.max(localTradeCount, okxTradeCount);
    const buyCount = Math.max(localBuyCount, okxBuyCount);
    const sellCount = Math.max(finite(active.sellCount), okxSellCount, Math.max(0, tradeCount - buyCount));
    const uniqueTokens = Math.max(finite(active.tokens?.length), tokenCounts.size, new Set(okxRecentPnl.map((row) => row.token)).size);
    const repeatBuyTokens = [...tokenCounts.values()].filter((count) => count >= 2).length;
    const totalRealizedPnlUsd = okx.okxAvailable
      ? pickFirst(okxOverview?.realizedPnlUsd, realizedPnlUsd)
      : realizedPnlUsd;
    const profitableTokenCount = okxRecentPnl.filter((row) => row.pnlUsd > 0).length || realizedWins;
    const losingTokenCount = okxRecentPnl.filter((row) => row.pnlUsd < 0).length;
    const recentTokenPnls = okxRecentPnl.map((row) => row.pnlUsd).filter((v) => v !== 0);
    const lowMcBuys = pickFirst(okxOverview?.lowMcBuys);
    const midMcBuys = pickFirst(okxOverview?.midMcBuys);
    const highMcBuys = pickFirst(okxOverview?.highMcBuys);
    const totalMcBuys = lowMcBuys + midMcBuys + highMcBuys;
    const activeDays = Math.max(
      pickFirst(okxOverview?.activeDays),
      new Set(buys.map((row) => new Date(toMs(row.tradeTime)).toISOString().slice(0, 10))).size,
    );

    const metrics = {
      walletAddress: wallet,
      walletName: String(meta.name || ""),
      walletEmoji: String(meta.emoji || ""),
      balanceBnb: finite(balance.balanceBnb),
      nonce: finite(balance.nonce),
      tradeCount,
      buyCount,
      sellCount,
      buyRatioPct: pct(buyCount, Math.max(1, buyCount + sellCount)),
      uniqueTokens,
      repeatBuyTokens,
      avgBuysPerToken: uniqueTokens ? buys.length / uniqueTokens : 0,
      totalRealizedPnlUsd,
      avgRealizedPnlUsd: recentTokenPnls.length
        ? mean(recentTokenPnls)
        : (realizedPnlRows ? realizedPnlUsd / realizedPnlRows : 0),
      winRatePct: okx.okxAvailable
        ? pickFirst(okxOverview?.winRatePct, pct(profitableTokenCount, Math.max(1, profitableTokenCount + losingTokenCount)))
        : (realizedPnlRows ? pct(realizedWins, realizedPnlRows) : 0),
      medianEntryMarketCapUsd: median(entryMcs),
      averageEntryMarketCapUsd: mean(entryMcs),
      latestTradeTime,
      latestTradeAgeHours: latestTradeTime ? (now - latestTradeTime) / 3600000 : 9999,
      activeDays7d: buys.filter((row) => now - toMs(row.tradeTime) <= 7 * dayMs).length,
      activeDays3d: buys.filter((row) => now - toMs(row.tradeTime) <= 3 * dayMs).length,
      recentBuyCount24h: buys.filter((row) => now - toMs(row.tradeTime) <= dayMs).length,
      recentActiveDays: activeDays,
      avgTradesPerDay: activeDays ? tradeCount / activeDays : tradeCount,
      profitableTokenCount,
      losingTokenCount,
      lowMcBuyPct: totalMcBuys ? pct(lowMcBuys, totalMcBuys) : 0,
      okxDataSource: okx.source,
      okxAvailable: okx.okxAvailable,
      okxError: okx.okxError,
      inputSource: metaByWallet.has(wallet) ? "user_import" : "historical_dataset",
      watchedTokens: [...new Set([
        ...(active.tokens || []).map((v) => String(v).toLowerCase()),
        ...[...tokenCounts.keys()],
        ...okxRecentPnl.map((row) => row.token),
      ])].slice(0, 20),
    };
    const cls = classifyWallet(metrics);
    const walletValue = walletValueScore(metrics);
    const tier = walletTier({ ...metrics, walletValueScore: walletValue });
    const styleLabel = walletStyleLabel(metrics);
    profiles.push({
      ...metrics,
      profile: cls.primary,
      labels: cls.labels,
      reliabilityScore: cls.reliabilityScore,
      walletValueScore: walletValue,
      walletTier: tier,
      walletStyleLabel: styleLabel,
      emotionWeight: cls.emotionWeight,
      factorScore: cls.score,
      severeNegative: Boolean(cls.severeNegative),
      analysisSummary: describeWallet({ ...metrics, profile: cls.primary, walletValueScore: walletValue, walletTier: tier, walletStyleLabel: styleLabel, severeNegative: cls.severeNegative }),
      profileLabel: profileLabel(cls.primary),
      latestTradeIso: latestTradeTime ? new Date(latestTradeTime).toISOString() : "",
      okxOverview,
      okxRecentPnl: okxRecentPnl.slice(0, 20),
      okxDexHistorySample: okxHistory.slice(0, 20),
    });
  }

  profiles.sort((a, b) => (
    b.walletValueScore - a.walletValueScore
    || b.reliabilityScore - a.reliabilityScore
    || a.latestTradeAgeHours - b.latestTradeAgeHours
    || b.tradeCount - a.tradeCount
  ));

  const groups = profiles.reduce((acc, row) => {
    acc[row.profile] = (acc[row.profile] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date(now).toISOString(),
    total: profiles.length,
    groups,
    profiles,
  };
}

const output = buildProfiles();
saveJson(outPath, output);
console.log(JSON.stringify({
  outPath,
  total: output.total,
  groups: output.groups,
}, null, 2));
