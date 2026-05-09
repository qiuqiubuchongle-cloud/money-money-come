import fs from "node:fs";
import { spawnSync } from "node:child_process";

const activeAddressesPath = process.env.SMART_WALLET_ADDRESSES_PATH || "data/smart_wallets_active_recent_bsc_dex.txt";
const statePath = "data/bsc_signal_monitor_state.json";
const tradeLogPath = "data/paper_trades.json";
const okxWsEventsPath = process.env.OKX_WS_EVENTS_PATH || "data/okx_ws_events.ndjson";
const smartWalletProfilesPath = process.env.SMART_WALLET_PROFILES_PATH || "data/smart_wallet_profiles_bsc.json";
const smartWalletGroupsPath = process.env.SMART_WALLET_GROUPS_PATH || "data/smart_wallet_groups_bsc.json";
const signalRulesPath = process.env.SIGNAL_RULES_PATH || "config/signal-rules.json";
const signalRules = loadSignalRules(signalRulesPath);
const privateRules = signalRules.private || {};
const okxOfficialRules = signalRules.okxOfficial || {};

const pollMs = envNumber("POLL_MS", 60_000);
const paperSizeUsd = Number(process.env.PAPER_SIZE_USD || 10);
const privateWindowMs = envNumber("PRIVATE_WINDOW_MS", privateRules.windowMs ?? 10 * 60_000);
const minPrivateWallets = envNumber("MIN_PRIVATE_WALLETS", privateRules.minWallets ?? 2);
const strongPrivateWallets = envNumber("STRONG_PRIVATE_WALLETS", privateRules.strongMinWallets ?? Math.max(3, minPrivateWallets + 1));
const sameGroupRequired = envBool("PRIVATE_SAME_GROUP_REQUIRED", privateRules.sameGroupRequired !== false);
const crossGroupObserveEnabled = envBool("CROSS_GROUP_OBSERVE_ENABLED", privateRules.crossGroupObserve !== false);
const okxOfficialSignalEnabled = envBool("OKX_OFFICIAL_SIGNAL_ENABLED", okxOfficialRules.enabled !== false);
const okxOfficialForwardDefault = okxOfficialRules.forward ?? okxOfficialRules.soloAlert ?? true;
const okxOfficialForwardEnabled = process.env.OKX_OFFICIAL_FORWARD_ENABLED !== undefined
  ? envBool("OKX_OFFICIAL_FORWARD_ENABLED", true)
  : envBool("OKX_OFFICIAL_SOLO_ALERT", okxOfficialForwardDefault);
const okxOfficialSoloAlert = false;
const allowOfficialSoloSignal = false;
const okxOfficialApplyLocalFilters = envBool("OKX_OFFICIAL_APPLY_LOCAL_FILTERS", okxOfficialRules.applyLocalFilters === true);
const okxSignalWalletTypes = process.env.OKX_SIGNAL_WALLET_TYPES ?? String(okxOfficialRules.walletTypes ?? "");
const okxSignalLimit = envNumber("OKX_SIGNAL_LIMIT", okxOfficialRules.limit ?? 30);
const okxSignalMinWallets = envNumberOrEmpty("OKX_SIGNAL_MIN_WALLETS", okxOfficialRules.minTriggerWallets ?? "");
const okxSignalMaxWallets = envNumberOrEmpty("OKX_SIGNAL_MAX_WALLETS", okxOfficialRules.maxTriggerWallets ?? "");
const okxSignalMinAmountUsd = envNumberOrEmpty("OKX_SIGNAL_MIN_AMOUNT_USD", okxOfficialRules.minAmountUsd ?? "");
const okxSignalMaxAmountUsd = envNumberOrEmpty("OKX_SIGNAL_MAX_AMOUNT_USD", okxOfficialRules.maxAmountUsd ?? "");
const okxSignalMinMarketCapUsd = envNumberOrEmpty("OKX_SIGNAL_MIN_MARKET_CAP_USD", okxOfficialRules.minMarketCapUsd ?? "");
const okxSignalMaxMarketCapUsd = envNumberOrEmpty("OKX_SIGNAL_MAX_MARKET_CAP_USD", okxOfficialRules.maxMarketCapUsd ?? "");
const okxSignalMinLiquidityUsd = envNumberOrEmpty("OKX_SIGNAL_MIN_LIQUIDITY_USD", okxOfficialRules.minLiquidityUsd ?? "");
const okxSignalMaxLiquidityUsd = envNumberOrEmpty("OKX_SIGNAL_MAX_LIQUIDITY_USD", okxOfficialRules.maxLiquidityUsd ?? "");
const okxSignalMinHolders = envNumber("OKX_SIGNAL_MIN_HOLDERS", okxOfficialRules.minHolders ?? 0);
const okxSignalMaxTop10HolderPercent = envNumber("OKX_SIGNAL_MAX_TOP10_HOLDER_PERCENT", okxOfficialRules.maxTop10HolderPercent ?? 0);
const okxSignalMaxSoldRatioPercent = envNumber("OKX_SIGNAL_MAX_SOLD_RATIO_PERCENT", okxOfficialRules.maxSoldRatioPercent ?? 100);
const okxSignalMinCompositeScore = envNumber("OKX_SIGNAL_MIN_COMPOSITE_SCORE", okxOfficialRules.minCompositeScore ?? 3);
const stopLossPct = Number(process.env.STOP_LOSS_PCT || -25);
const takeProfit1Pct = Number(process.env.TAKE_PROFIT_1_PCT || 50);
const takeProfit2Pct = Number(process.env.TAKE_PROFIT_2_PCT || 100);
const trailDrawdownPct = Number(process.env.TRAIL_DRAWDOWN_PCT || 35);
const timeStopMs = Number(process.env.TIME_STOP_MS || 2 * 60 * 60_000);
const timeStopMinBestPct = Number(process.env.TIME_STOP_MIN_BEST_PCT || 20);
const staleExitMinAgeMs = Number(process.env.STALE_EXIT_MIN_AGE_MS || 20 * 60_000);
const staleExitMaxVolume5mUsd = Number(process.env.STALE_EXIT_MAX_VOLUME_5M_USD || 200);
const staleExitMaxTxs5m = Number(process.env.STALE_EXIT_MAX_TXS_5M || 3);
const reentryCooldownMs = Number(process.env.REENTRY_COOLDOWN_MS || 30 * 60_000);
const minExitLiquidityUsd = Number(process.env.MIN_EXIT_LIQUIDITY_USD || 500);
const minExitHolders = Number(process.env.MIN_EXIT_HOLDERS || 5);
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.TELEGRAM_CHAT_ID || "";
const okxWsPrivateId = process.env.OKX_WS_PRIVATE_ID || "";
const okxWsSignalId = process.env.OKX_WS_SIGNAL_ID || "";
const okxWsMemeNewId = process.env.OKX_WS_MEME_NEW_ID || "";
const okxWsMemeMetricsId = process.env.OKX_WS_MEME_METRICS_ID || "";
const gmgnEnabled = process.env.GMGN_ENABLED === "1";
const gmgnCooldownMs = Number(process.env.GMGN_ERROR_COOLDOWN_MS || 5 * 60_000);
const gmgnProxy = process.env.GMGN_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY || "http://127.0.0.1:26001";
const binanceEnabled = process.env.BINANCE_MEME_RUSH_ENABLED === "1";
const binanceProxy = process.env.BINANCE_PROXY || gmgnProxy;
const binanceCooldownMs = Number(process.env.BINANCE_ERROR_COOLDOWN_MS || 5 * 60_000);
const binanceTokenInfoEnabled = process.env.BINANCE_TOKEN_INFO_ENABLED === "1";
const minCompositeScore = Number(process.env.MIN_COMPOSITE_SCORE || 4);
const allowStrongGmgnSolo = process.env.ALLOW_STRONG_GMGN_SOLO === "1";
const strongGmgnWallets = Number(process.env.STRONG_GMGN_WALLETS || 3);
const strongGmgnAmountUsd = Number(process.env.STRONG_GMGN_AMOUNT_USD || 3_000);
const maxEntryMarketCapUsd = Number(process.env.MAX_ENTRY_MARKET_CAP_USD || 500_000);
const minEntryLiquidityUsd = Number(process.env.MIN_ENTRY_LIQUIDITY_USD || 2_000);
const minEntryHolders = Number(process.env.MIN_ENTRY_HOLDERS || 10);
const requireEntryLiquidity = process.env.REQUIRE_ENTRY_LIQUIDITY !== "0";
const requireEntryHolders = process.env.REQUIRE_ENTRY_HOLDERS !== "0";
const minFourMemeBondingPct = Number(process.env.MIN_FOURMEME_BONDING_PCT || 5);
const maxFourMemeBondingPct = Number(process.env.MAX_FOURMEME_BONDING_PCT || 95);
const maxTop10HolderPct = Number(process.env.MAX_TOP10_HOLDER_PCT || 45);
const maxSellTaxPct = Number(process.env.MAX_SELL_TAX_PCT || 5);
const maxRugRatio = Number(process.env.MAX_RUG_RATIO || 0.30);
const maxBundlerRate = Number(process.env.MAX_BUNDLER_RATE || 0.30);
const maxRatTraderRate = Number(process.env.MAX_RAT_TRADER_RATE || 0.30);
const maxDevTeamHoldRate = Number(process.env.MAX_DEV_TEAM_HOLD_RATE || 0.05);
const maxDevRugPullCount = Number(process.env.MAX_DEV_RUG_PULL_COUNT || 0);
const maxDevHoldingPct = Number(process.env.MAX_DEV_HOLDING_PCT || 5);
const maxBundlerAthPct = Number(process.env.MAX_BUNDLER_ATH_PCT || 25);
const memepumpRiskCacheMs = Number(process.env.MEMEPUMP_RISK_CACHE_MS || 5 * 60_000);
const buySlippagePct = Number(process.env.BUY_SLIPPAGE_PCT || 3);
const sellSlippagePct = Number(process.env.SELL_SLIPPAGE_PCT || 5);
const gasUsdPerTx = Number(process.env.GAS_USD_PER_TX || 0.15);
const gmgnMarketSignalEnabled = process.env.GMGN_MARKET_SIGNAL_ENABLED === "1";
const entryObserveEnabled = process.env.ENTRY_OBSERVE_ENABLED !== "0";
const entryObserveMinAgeMs = Number(process.env.ENTRY_OBSERVE_MIN_AGE_MS || 60_000);
const entryObserveMaxAgeMs = Number(process.env.ENTRY_OBSERVE_MAX_AGE_MS || 3 * 60_000);
const minEntryVolume5mUsd = Number(process.env.MIN_ENTRY_VOLUME_5M_USD || 1_000);
const minEntryTxs5m = Number(process.env.MIN_ENTRY_TXS_5M || 20);
const maxObserveDrawdownPct = Number(process.env.MAX_OBSERVE_DRAWDOWN_PCT || 18);
const maxObserveRunupPct = Number(process.env.MAX_OBSERVE_RUNUP_PCT || 80);
const minObserveHolderGrowth = Number(process.env.MIN_OBSERVE_HOLDER_GROWTH || 0);
const allowStrongFourMemeSolo = process.env.ALLOW_STRONG_FOURMEME_SOLO === "1";
const strongFourMemeMinTx1h = Number(process.env.STRONG_FOURMEME_MIN_TX_1H || 120);
const strongFourMemeMinVolume1hUsd = Number(process.env.STRONG_FOURMEME_MIN_VOLUME_1H_USD || 5_000);
const strongFourMemeMinHolders = Number(process.env.STRONG_FOURMEME_MIN_HOLDERS || 50);
const strongFourMemeMaxTop10Pct = Number(process.env.STRONG_FOURMEME_MAX_TOP10_PCT || 45);
const strongFourMemeMaxBondingPct = Number(process.env.STRONG_FOURMEME_MAX_BONDING_PCT || 98);
const strongFourMemeMaxSellBuyRatio = Number(process.env.STRONG_FOURMEME_MAX_SELL_BUY_RATIO || 0.75);
const strongFourMemeAllowMissingLiquidity = process.env.STRONG_FOURMEME_ALLOW_MISSING_LIQUIDITY !== "0";

let state = loadJson(statePath, {
  seeded: false,
  seenPrivateTradeKeys: [],
  seenOkxSignalKeys: [],
  seenMemeKeys: [],
  seenGmgnKeys: [],
  okxOfficialForwardSeeded: false,
  okxWsOffset: 0,
  memepumpRiskCache: {},
  alertKeys: [],
  gmgnErrorUntil: 0,
  gmgnLastError: "",
  binanceErrorUntil: 0,
  binanceLastError: "",
  pendingEntries: {},
});
let paper = loadJson(tradeLogPath, { open: [], closed: [], events: [] });
let currentOkxWsFrames = [];
let smartWalletProfiles = loadSmartWalletProfiles();
let safeTrackedWallets = loadSafeTrackedWallets();

function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function deepMerge(base, override) {
  const merged = { ...base };
  if (!override || typeof override !== "object" || Array.isArray(override)) return merged;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && merged[key] && typeof merged[key] === "object") {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function loadSignalRules(path) {
  const defaults = {
    private: {
      minWallets: 3,
      strongMinWallets: 3,
      windowMs: 2 * 60_000,
      sameGroupRequired: true,
      crossGroupObserve: true,
    },
    okxOfficial: {
      enabled: true,
      forward: true,
      soloAlert: true,
      walletTypes: "",
      limit: 30,
      minTriggerWallets: "",
      maxTriggerWallets: "",
      minAmountUsd: "",
      maxAmountUsd: "",
      minMarketCapUsd: "",
      maxMarketCapUsd: "",
      minLiquidityUsd: "",
      maxLiquidityUsd: "",
      minHolders: 0,
      maxTop10HolderPercent: 0,
      maxSoldRatioPercent: 100,
      minCompositeScore: 3,
      applyLocalFilters: false,
    },
  };
  if (!path || !fs.existsSync(path)) return defaults;
  const loaded = loadJson(path, null);
  if (!loaded || typeof loaded !== "object") return defaults;
  return deepMerge(defaults, loaded);
}

function envNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return Number(fallback);
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback);
}

function envNumberOrEmpty(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return Boolean(fallback);
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function addCliFilter(args, flag, value) {
  if (value === undefined || value === null || value === "") return;
  args.push(flag, String(value));
}

function saveAll() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(tradeLogPath, JSON.stringify(paper, null, 2));
}

function loadSmartWalletProfiles() {
  const json = loadJson(smartWalletProfilesPath, { profiles: [] });
  const byWallet = new Map();
  for (const row of Array.isArray(json.profiles) ? json.profiles : []) {
    const wallet = String(row.walletAddress || "").toLowerCase();
    if (wallet) byWallet.set(wallet, row);
  }
  return { meta: json, byWallet };
}

function loadSafeTrackedWallets() {
  const groupJson = loadJson(smartWalletGroupsPath, {});
  const pool = Array.isArray(groupJson.safeSignalPool) ? groupJson.safeSignalPool : [];
  if (pool.length) return pool.map((row) => String(row.walletAddress || "").toLowerCase()).filter(Boolean);
  return fs.readFileSync(activeAddressesPath, "utf8").split(/\s+/).filter(Boolean);
}

function runJson(args, timeout = 25_000) {
  const run = spawnSync("onchainos", args, { encoding: "utf8", timeout });
  if (run.status !== 0) {
    const error = (run.error?.message || run.stderr || run.stdout || "").trim();
    return { ok: false, error };
  }
  try {
    return JSON.parse(run.stdout || "{}");
  } catch (error) {
    return { ok: false, error: `parse error: ${error.message}` };
  }
}

function runOnchainJson(args, timeout = 18_000) {
  const j = runJson(args, timeout);
  if (!j.ok) return null;
  return j.data ?? j;
}

async function fetchJson(url, options = {}, timeout = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    try {
      return { ok: true, data: JSON.parse(text || "{}") };
    } catch (error) {
      return { ok: false, error: `parse error: ${error.message}` };
    }
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function pollWs(id, timeout = 8_000) {
  if (!id) return null;
  const j = runJson(["ws", "poll", "--id", id], timeout);
  if (!j.ok) {
    if (j.error) console.error(`[okx-ws] ${id} ${j.error}`);
    return null;
  }
  return j.data || j;
}

function consumeOkxWsFrames() {
  try {
    const stat = fs.statSync(okxWsEventsPath);
    let offset = Number(state.okxWsOffset || 0);
    if (offset > stat.size) offset = 0;
    if (offset === stat.size) return [];
    const fd = fs.openSync(okxWsEventsPath, "r");
    const buf = Buffer.alloc(stat.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    state.okxWsOffset = stat.size;
    return buf.toString("utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function okxWsRows(channel) {
  return currentOkxWsFrames
    .filter((frame) => frame.type === "data" && frame.channel === channel)
    .flatMap((frame) => Array.isArray(frame.data) ? frame.data : [])
    .flatMap((row) => Array.isArray(row) ? row : [row]);
}

function runGmgnJson(args, timeout = 20_000) {
  if (!gmgnEnabled) return { ok: false, disabled: true, error: "GMGN disabled" };
  if (Date.now() < Number(state.gmgnErrorUntil || 0)) {
    return { ok: false, cooledDown: true, error: state.gmgnLastError || "GMGN cooldown" };
  }
  const env = gmgnProxy ? {
    ...process.env,
    HTTPS_PROXY: process.env.HTTPS_PROXY || gmgnProxy,
    HTTP_PROXY: process.env.HTTP_PROXY || gmgnProxy,
    ALL_PROXY: process.env.ALL_PROXY || gmgnProxy,
  } : process.env;
  const run = spawnSync("gmgn-cli", [...args, "--raw"], { encoding: "utf8", timeout, env });
  if (run.status !== 0) {
    const error = (run.stderr || run.stdout || "").trim() || `gmgn-cli exited ${run.status}`;
    if (!/unknown command/i.test(error)) {
      state.gmgnLastError = error.slice(0, 300);
      state.gmgnErrorUntil = Date.now() + gmgnCooldownMs;
    }
    return { ok: false, error };
  }
  try {
    return { ok: true, data: JSON.parse(run.stdout || "{}") };
  } catch (error) {
    return { ok: false, error: `GMGN parse error: ${error.message}` };
  }
}

async function sendTelegram(text) {
  if (!telegramBotToken || !telegramChatId) return;
  try {
    const payload = JSON.stringify({
      chat_id: telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (process.env.TELEGRAM_PROXY) {
      const run = spawnSync("curl", [
        "-sS",
        "--max-time", "20",
        "-x", process.env.TELEGRAM_PROXY,
        "-X", "POST",
        "-H", "content-type: application/json",
        "--data-binary", "@-",
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      ], { input: payload, encoding: "utf8" });
      if (run.status !== 0) console.error(`[telegram] ${(run.stderr || run.stdout || "").replaceAll(telegramBotToken, "<hidden>")}`);
      return;
    }
    const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    if (!res.ok) console.error(`[telegram] HTTP ${res.status}: ${await res.text()}`);
  } catch (error) {
    console.error(`[telegram] ${error.message || error}`);
  }
}

function uniqPush(obj, listName, key, max = 5000) {
  const list = obj[listName] || [];
  if (list.includes(key)) return false;
  list.push(key);
  if (list.length > max) list.splice(0, list.length - max);
  obj[listName] = list;
  return true;
}

function fmtUsd(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtTokenPrice(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  if (n === 0) return "0";
  if (Math.abs(n) >= 1) return n.toFixed(6).replace(/\.?0+$/, "");
  if (Math.abs(n) >= 0.000001) return n.toFixed(10).replace(/\.?0+$/, "");
  const decimal = n.toFixed(18).replace(/\.?0+$/, "");
  return decimal.length <= 20 ? decimal : n.toExponential(6);
}

function fmtPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtTime(ms) {
  return new Date(Number(ms)).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasMetric(value) {
  return Number.isFinite(Number(value));
}

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return 0;
}

function optionalNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function percentToRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function percentValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 && n > 0 ? n * 100 : n;
}

function pickObject(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return value.find((item) => item && typeof item === "object") || null;
  if (Array.isArray(value.data)) return pickObject(value.data);
  if (Array.isArray(value.list)) return pickObject(value.list);
  if (Array.isArray(value.rows)) return pickObject(value.rows);
  if (value.data && typeof value.data === "object") return pickObject(value.data);
  return value;
}

function toMs(value) {
  const n = Number(value || Date.now());
  if (!Number.isFinite(n)) return Date.now();
  return n < 10_000_000_000 ? n * 1000 : n;
}

function narrativeSummary(event) {
  const name = event.name && event.name !== event.symbol ? `${event.name} / ${event.symbol}` : (event.symbol || event.name || "UNKNOWN");
  const parts = [];
  if ((event.sources || []).includes("private")) parts.push("你的私有聪明钱地址池出现集中买入");
  if ((event.sources || []).includes("okx")) parts.push("OKX 聚合聪明钱/鲸鱼信号确认");
  if ((event.sources || []).includes("gmgn_smartmoney")) parts.push("GMGN Smart Money 正在买入");
  if ((event.sources || []).includes("fourmeme")) parts.push("Four.meme 新盘/曲线阶段出现异动");
  if ((event.sources || []).includes("binance_meme")) parts.push("Binance Meme Rush 榜单辅助确认");
  if ((event.sources || []).includes("binance_topic")) parts.push("Binance Topic Rush 叙事/净流入辅助确认");
  if ((event.sources || []).includes("gmgn_trending")) parts.push("进入 GMGN FourMeme 热榜");
  if ((event.sources || []).includes("gmgn_market")) parts.push("GMGN 市场信号辅助确认");
  const signal = parts.length ? parts.join("，") : event.reason;
  const size = event.currentMarketCapUsd || event.marketCapUsd
    ? `当前市值约 ${fmtUsd(event.currentMarketCapUsd || event.marketCapUsd)}`
    : "市值暂缺";
  const liq = event.currentLiquidityUsd ? `流动性约 ${fmtUsd(event.currentLiquidityUsd)}` : "流动性暂缺";
  const holders = event.currentHolders ? `持有人 ${event.currentHolders}` : "持有人暂缺";
  const risk = event.qualitySummary ? `；${event.qualitySummary}` : "";
  const binance = event.binanceNarrative ? `；Binance叙事：${event.binanceNarrative}` : "";
  const emotion = event.sentimentGroup ? `；情绪组 ${event.sentimentGroup.label}` : "";
  return `${name}：${signal}；${size}，${liq}，${holders}${risk}${binance}${emotion}。这是一个低市值 BSC meme 候选，当前逻辑只做模拟盘观察，不代表实盘建议。`;
}

function walletProfileWeight(walletAddress) {
  const wallet = String(walletAddress || "").toLowerCase();
  const profile = smartWalletProfiles.byWallet.get(wallet);
  return profile ? Number(profile.emotionWeight || 1) : 1;
}

function profileCn(profile) {
  return {
    hundred_x_hunter: "百倍组",
    ten_k_profit_champion: "盈利组",
    hot_meme_sniper: "热点组",
    conviction_reloader: "加仓组",
    balanced_scout: "观察组",
    high_frequency_rookie: "噪音组",
    sleeping_zombie: "休眠组",
    watch_only: "待验证",
  }[profile] || profile || "未知组";
}

function walletTypeLabel(value) {
  const text = String(value ?? "");
  return {
    "1": "Smart Money",
    "2": "KOL / Influencer",
    "3": "Whale",
  }[text] || text || "n/a";
}

function walletProfileMeta(walletAddress) {
  const wallet = String(walletAddress || "").toLowerCase();
  return smartWalletProfiles.byWallet.get(wallet) || null;
}

function getPrivateBuys() {
  const all = [];
  for (let i = 0; i < safeTrackedWallets.length; i += 20) {
    const chunk = safeTrackedWallets.slice(i, i + 20);
    const j = runJson([
      "tracker", "activities",
      "--tracker-type", "multi_address",
      "--wallet-address", chunk.join(","),
      "--chain", "bsc",
      "--trade-type", "1",
    ]);
    if (!j.ok) {
      console.error(`[private-tracker] ${j.error || "unknown onchainos error"}`);
      continue;
    }
    const trades = Array.isArray(j.data?.trades) ? j.data.trades : Array.isArray(j.data) ? j.data : [];
    all.push(...trades);
  }
  return all;
}

function normalizeWsPrivateTrades(data) {
  const rows = [
    ...(Array.isArray(data?.trades) ? data.trades : []),
    ...(Array.isArray(data?.events) ? data.events : []),
    ...(Array.isArray(data?.data) ? data.data : []),
  ];
  return rows.map((row) => {
    const chainIndex = String(row.chainIndex || row.chainId || row.chain?.chainIndex || row.chain?.id || row.network || "");
    const token = row.tokenContractAddress || row.tokenAddress || row.token?.tokenAddress || row.baseAddress || row.base_address || row.address;
    const wallet = row.walletAddress || row.trader || row.maker || row.address || row.wallet;
    const tradeType = row.tradeType || row.side || row.type;
    return {
      ...row,
      chainIndex,
      txHash: row.txHash || row.hash || row.transactionHash || row.transaction_hash,
      walletAddress: wallet,
      tokenContractAddress: token,
      tokenSymbol: row.tokenSymbol || row.symbol || row.token?.symbol || row.base_token?.symbol,
      tokenPrice: row.tokenPrice || row.price || row.priceUsd || row.price_usd,
      marketCap: row.marketCap || row.marketCapUsd || row.token?.marketCapUsd || row.market_cap,
      tradeTime: toMs(row.tradeTime || row.timestamp || row.time || Date.now()),
      tradeType: String(tradeType).toLowerCase() === "buy" ? "1" : String(tradeType),
      source: "okx_ws_private",
    };
  }).filter((row) => row.tokenContractAddress && String(row.tradeType) === "1" && (!row.chainIndex || row.chainIndex === "56" || String(row.chainIndex).toLowerCase() === "bsc"));
}

function getWsPrivateBuys() {
  const data = pollWs(okxWsPrivateId);
  return [
    ...normalizeWsPrivateTrades(data),
    ...normalizeWsPrivateTrades({ data: okxWsRows("address-tracker-activity") }),
  ];
}

function privateSignalEvents() {
  const now = Date.now();
  const trades = [...getPrivateBuys(), ...getWsPrivateBuys()];
  for (const trade of trades) {
    const key = `${trade.txHash}:${trade.walletAddress}:${trade.tokenContractAddress}:${trade.tradeType}`;
    uniqPush(state, "seenPrivateTradeKeys", key);
  }
  if (!state.seeded) return [];

  const recent = trades.filter((t) => now - Number(t.tradeTime || 0) <= privateWindowMs);
  const byToken = new Map();
  for (const t of recent) {
    const chainIndex = String(t.chainIndex || t.chainId || "");
    if (chainIndex && chainIndex !== "56" && chainIndex.toLowerCase() !== "bsc") continue;
    const token = String(t.tokenContractAddress || "").toLowerCase();
    if (!token) continue;
    const item = byToken.get(token) || {
      source: "private",
      token,
      symbol: t.tokenSymbol,
      name: t.tokenSymbol,
      signalTime: Number(t.tradeTime || now),
      triggerWallets: new Set(),
      tradeCount: 0,
      marketCapUsd: Number(t.marketCap || 0),
      entryPrice: Number(t.tokenPrice || 0),
      launchpad: t.launchpad || "",
      reason: "私有地址池集中买入",
      details: [],
    };
    item.triggerWallets.add(String(t.walletAddress || "").toLowerCase());
    item.tradeCount += 1;
    item.signalTime = Math.max(item.signalTime, Number(t.tradeTime || 0));
    if (Number(t.marketCap || 0)) item.marketCapUsd = Number(t.marketCap);
    if (Number(t.tokenPrice || 0)) item.entryPrice = Number(t.tokenPrice);
    item.details.push(t);
    byToken.set(token, item);
  }

  const events = [];
  for (const item of byToken.values()) {
    if (item.triggerWallets.size < minPrivateWallets) continue;
    const alertKey = `private:${item.token}:${[...item.triggerWallets].sort().join(",")}:${Math.floor(item.signalTime / privateWindowMs)}`;
    if (!uniqPush(state, "alertKeys", alertKey)) continue;
    events.push({ ...item, triggerWalletCount: item.triggerWallets.size, triggerWallets: [...item.triggerWallets] });
  }
  return events;
}

function normalizeOkxSignalRows(rows) {
  return rows.map((row) => {
    const token = row.token || {};
    const tokenAddress = token.tokenAddress || row.tokenAddress || row.tokenContractAddress || row.address;
    return {
      source: "okx",
      token: String(tokenAddress || "").toLowerCase(),
      symbol: token.symbol || row.symbol || token.name || "UNKNOWN",
      name: token.name || row.name || token.symbol || "UNKNOWN",
      signalTime: toMs(row.timestamp || row.signalTime || row.time || Date.now()),
      triggerWalletCount: Number(row.triggerWalletCount || row.addressCount || row.walletCount || 0),
      walletType: row.walletType,
      walletTypeLabel: walletTypeLabel(row.walletType),
      amountUsd: Number(row.amountUsd || row.volumeUsd || row.amount || 0),
      soldRatioPercent: Number(row.soldRatioPercent || 0),
      holders: optionalNumber(token.holders, row.holders),
      top10HolderPercent: optionalNumber(token.top10HolderPercent, row.top10HolderPercent),
      marketCapUsd: optionalNumber(token.marketCapUsd, row.marketCapUsd, row.marketCap),
      currentLiquidityUsd: optionalNumber(token.liquidityUsd, row.liquidityUsd, row.liquidity),
      entryPrice: optionalNumber(row.price, token.price, token.priceUsd),
      okxOfficialSignal: true,
      raw: row,
      reason: "OKX 官方 Signal",
    };
  }).filter((event) => event.token);
}

function okxSignalEvents() {
  if (!okxOfficialSignalEnabled) return [];
  const args = ["signal", "list", "--chain", "bsc", "--limit", String(okxSignalLimit)];
  if (okxOfficialApplyLocalFilters) {
    addCliFilter(args, "--wallet-type", okxSignalWalletTypes);
    addCliFilter(args, "--min-address-count", okxSignalMinWallets);
    addCliFilter(args, "--max-address-count", okxSignalMaxWallets);
    addCliFilter(args, "--min-amount-usd", okxSignalMinAmountUsd);
    addCliFilter(args, "--max-amount-usd", okxSignalMaxAmountUsd);
    addCliFilter(args, "--min-market-cap-usd", okxSignalMinMarketCapUsd);
    addCliFilter(args, "--max-market-cap-usd", okxSignalMaxMarketCapUsd);
    addCliFilter(args, "--min-liquidity-usd", okxSignalMinLiquidityUsd);
    addCliFilter(args, "--max-liquidity-usd", okxSignalMaxLiquidityUsd);
  }
  const j = runJson(args);
  const ws = pollWs(okxWsSignalId);
  const wsRows = Array.isArray(ws?.events) ? ws.events : Array.isArray(ws?.data) ? ws.data : [];
  const directWsRows = okxWsRows("dex-market-new-signal-openapi");
  const rows = [...(Array.isArray(j.data) ? j.data : []), ...wsRows, ...directWsRows];

  const events = [];
  const seedOkxForwardState = !state.seeded || !state.okxOfficialForwardSeeded;
  for (const event of normalizeOkxSignalRows(rows)) {
    const raw = event.raw || {};
    const stableId = raw.cursor || raw.id || raw.signalId || raw.eventId || raw.timestamp || raw.signalTime || raw.time
      || `${event.token}:${event.walletType ?? ""}:${event.triggerWalletCount || ""}:${event.amountUsd || ""}:${event.entryPrice || ""}:${event.marketCapUsd || ""}`;
    const seenKey = `${stableId}:${raw.walletType ?? event.walletType}:${raw.token?.tokenAddress || event.token}`;
    if (seedOkxForwardState) {
      uniqPush(state, "seenOkxSignalKeys", seenKey);
      continue;
    }
    if (!uniqPush(state, "seenOkxSignalKeys", seenKey)) continue;
    const count = Number(event.triggerWalletCount || 0);
    const mc = Number(event.marketCapUsd || 0);
    const holders = Number(event.holders || 0);
    const top10 = Number(event.top10HolderPercent || 0);
    const soldRatio = Number(event.soldRatioPercent || 0);
    if (okxOfficialApplyLocalFilters && okxSignalMinWallets !== "" && count < Number(okxSignalMinWallets)) continue;
    if (okxOfficialApplyLocalFilters && okxSignalMaxMarketCapUsd !== "" && mc && mc > Number(okxSignalMaxMarketCapUsd)) continue;
    if (okxOfficialApplyLocalFilters && okxSignalMinHolders && holders && holders < okxSignalMinHolders) continue;
    if (okxOfficialApplyLocalFilters && okxSignalMaxTop10HolderPercent && top10 && top10 > okxSignalMaxTop10HolderPercent) continue;
    if (okxOfficialApplyLocalFilters && Number.isFinite(soldRatio) && soldRatio > okxSignalMaxSoldRatioPercent) continue;
    const key = `okx:${seenKey}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    events.push(event);
  }
  if (seedOkxForwardState && (rows.length > 0 || j.ok !== false)) {
    state.okxOfficialForwardSeeded = true;
  }
  return events;
}

function memeSignalEvents() {
  const j = runJson(["memepump", "tokens", "--chain", "bsc", "--stage", "NEW", "--protocol-id-list", "135086"]);
  const wsNew = pollWs(okxWsMemeNewId);
  const wsMetrics = pollWs(okxWsMemeMetricsId);
  const wsRows = [
    ...(Array.isArray(wsNew?.events) ? wsNew.events : []),
    ...(Array.isArray(wsNew?.data) ? wsNew.data : []),
    ...(Array.isArray(wsMetrics?.events) ? wsMetrics.events : []),
    ...(Array.isArray(wsMetrics?.data) ? wsMetrics.data : []),
    ...okxWsRows("dex-market-memepump-new-token-openapi"),
    ...okxWsRows("dex-market-memepump-update-metrics-openapi"),
  ];
  const rows = [...(Array.isArray(j.data) ? j.data : []), ...wsRows];
  for (const row of rows) {
    uniqPush(state, "seenMemeKeys", `${row.createdTimestamp}:${row.tokenAddress}`);
  }
  if (!state.seeded) return [];

  const events = [];
  for (const row of rows) {
    const tx1h = Number(row.market?.txCount1h || row.txCount1h || row.txs1H || row.txs1h || 0);
    const vol1h = Number(row.market?.volumeUsd1h || row.volumeUsd1h || row.volume1H || row.volume1h || row.volume || 0);
    const bonding = Number(row.bondingPercent || 0);
    const aped = String(row.aped) === "1";
    if (!aped && !(tx1h >= 50 && vol1h >= 3_000 && bonding >= 5)) continue;
    const tokenAddress = row.tokenAddress || row.tokenContractAddress || row.token?.tokenAddress || row.address;
    const key = `meme:${row.createdTimestamp || row.timestamp || row.time}:${tokenAddress}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    events.push({
      source: "fourmeme",
      token: String(tokenAddress || "").toLowerCase(),
      symbol: row.symbol || row.token?.symbol || row.name || "UNKNOWN",
      name: row.name || row.token?.name || row.symbol || "UNKNOWN",
      signalTime: toMs(row.createdTimestamp || row.timestamp || row.time || Date.now()),
      marketCapUsd: Number(row.market?.marketCapUsd || row.marketCapUsd || row.marketCap || row.market_cap || 0),
      volumeUsd1h: vol1h,
      txCount1h: tx1h,
      buyTxCount1h: Number(row.market?.buyTxCount1h || row.buyTxCount1h || 0),
      sellTxCount1h: Number(row.market?.sellTxCount1h || row.sellTxCount1h || 0),
      bondingPercent: bonding,
      holders: Number(row.tags?.totalHolders || row.holders || row.holderCount || 0),
      top10HolderPercent: percentValue(row.tags?.top10HoldingsPercent || row.top10HolderPercent || row.top10HolderRate || 0),
      bundlerRate: percentToRate(row.tags?.bundlersPercent || row.bundlersPercent || row.bundlerRate || 0),
      sniperRate: percentToRate(row.tags?.snipersPercent || row.snipersPercent || 0),
      insiderRate: percentToRate(row.tags?.insidersPercent || row.insidersPercent || 0),
      freshWalletRate: percentToRate(row.tags?.freshWalletsPercent || row.freshWalletsPercent || 0),
      suspectedPhishingWalletRate: percentToRate(row.tags?.suspectedPhishingWalletPercent || row.suspectedPhishingWalletPercent || 0),
      devTeamHoldRate: percentToRate(row.tags?.devHoldingsPercent || row.tags?.devTeamHoldRate || row.tags?.devHoldPercent || 0),
      launchpad: "fourmeme",
      launchpadStatus: String(row.launchpadStatus || row.status || ""),
      aped,
      entryPrice: 0,
      reason: "Four.meme 新盘异动",
    });
  }
  return events;
}

function normalizeGmgnList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.list)) return data.data.list;
  if (Array.isArray(data?.rank)) return data.rank;
  return [];
}

function peekTokenInfo(token) {
  const info = currentTokenInfo(token);
  return info || { price: 0, marketCapUsd: 0, liquidityUsd: 0, holders: 0 };
}

function gmgnSmartMoneyEvents() {
  const j = runGmgnJson(["track", "smartmoney", "--chain", "bsc", "--side", "buy", "--limit", "50"]);
  if (!j.ok) return [];
  const rows = normalizeGmgnList(j.data);
  for (const row of rows) {
    uniqPush(state, "seenGmgnKeys", `gmgn-smart:${row.transaction_hash || row.tx_hash}:${row.maker}:${row.base_address}:${row.timestamp}`);
  }
  if (!state.seeded) return [];

  const nowSec = Math.floor(Date.now() / 1000);
  const byToken = new Map();
  for (const row of rows) {
    const ts = Number(row.timestamp || row.block_timestamp || 0);
    if (ts && nowSec - ts > 15 * 60) continue;
    const token = String(row.base_address || row.token_address || "").toLowerCase();
    if (!token || row.side !== "buy") continue;
    const item = byToken.get(token) || {
      source: "gmgn_smartmoney",
      token,
      symbol: row.base_token?.symbol || row.symbol || "UNKNOWN",
      name: row.base_token?.name || row.base_token?.symbol || row.symbol || "UNKNOWN",
      signalTime: ts ? ts * 1000 : Date.now(),
      triggerWallets: new Set(),
      tradeCount: 0,
      amountUsd: 0,
      entryPrice: Number(row.price_usd || row.price || 0),
      marketCapUsd: Number(row.base_token?.market_cap || row.market_cap || 0),
      launchpad: row.base_token?.launchpad || row.launchpad || "",
      reason: "GMGN Smart Money 买入",
      details: [],
    };
    item.triggerWallets.add(String(row.maker || "").toLowerCase());
    item.tradeCount += 1;
    item.amountUsd += Number(row.amount_usd || row.cost_usd || 0);
    item.signalTime = Math.max(item.signalTime, ts ? ts * 1000 : 0);
    if (Number(row.price_usd || row.price || 0)) item.entryPrice = Number(row.price_usd || row.price);
    item.details.push(row);
    byToken.set(token, item);
  }

  const events = [];
  for (const item of byToken.values()) {
    if (item.triggerWallets.size < 2 && item.amountUsd < 1_000) continue;
    const key = `gmgn-smart:${item.token}:${Math.floor(item.signalTime / privateWindowMs)}:${[...item.triggerWallets].sort().join(",")}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    events.push({ ...item, triggerWalletCount: item.triggerWallets.size, triggerWallets: [...item.triggerWallets] });
  }
  return events;
}

function gmgnMarketSignalEvents() {
  if (!gmgnMarketSignalEnabled) return [];
  const j = runGmgnJson(["market", "signal", "--chain", "bsc", "--limit", "30"]);
  if (!j.ok) return [];
  const rows = normalizeGmgnList(j.data);
  for (const row of rows) {
    const token = String(row.address || row.token_address || row.base_address || "").toLowerCase();
    uniqPush(state, "seenGmgnKeys", `gmgn-market:${row.trigger_at || row.timestamp}:${row.signal_type || row.type}:${token}`);
  }
  if (!state.seeded) return [];

  const events = [];
  for (const row of rows) {
    const token = String(row.address || row.token_address || row.base_address || "").toLowerCase();
    if (!token) continue;
    const mc = Number(row.market_cap || row.marketcap || row.market_cap_usd || row.marketCapUsd || 0);
    if (mc && mc > 800_000) continue;
    const key = `gmgn-market:${row.trigger_at || row.timestamp}:${row.signal_type || row.type}:${token}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    events.push({
      source: "gmgn_market",
      token,
      symbol: row.symbol || row.base_token?.symbol || "UNKNOWN",
      name: row.name || row.base_token?.name || row.symbol || "UNKNOWN",
      signalTime: Number(row.trigger_at || row.timestamp || Math.floor(Date.now() / 1000)) * 1000,
      marketCapUsd: mc,
      amountUsd: Number(row.amount_usd || row.volume || row.volume_usd || 0),
      entryPrice: Number(row.price || row.price_usd || 0),
      reason: `GMGN 市场信号${row.signal_type || row.type ? `: ${row.signal_type || row.type}` : ""}`,
      event: row,
    });
  }
  return events;
}

function gmgnTrendingFourMemeEvents() {
  const j = runGmgnJson([
    "market", "trending",
    "--chain", "bsc",
    "--interval", "1m",
    "--platform", "fourmeme",
    "--order-by", "volume",
    "--limit", "20",
  ]);
  if (!j.ok) return [];
  const rows = normalizeGmgnList(j.data);
  for (const row of rows) {
    const token = String(row.address || row.token_address || row.base_address || "").toLowerCase();
    uniqPush(state, "seenGmgnKeys", `gmgn-trending:${token}:${row.creation_timestamp || row.open_timestamp || row.symbol}`);
  }
  if (!state.seeded) return [];

  const events = [];
  for (const row of rows) {
    const token = String(row.address || row.token_address || row.base_address || "").toLowerCase();
    if (!token) continue;
    const mc = Number(row.market_cap || row.marketcap || row.market_cap_usd || row.marketCapUsd || 0);
    const smart = Number(row.smart_degen_count || row.wallet_tags_stat?.smart_degen_count || 0);
    const volume = Number(row.volume || row.volume_usd || row.volume_1m || 0);
    if ((mc && mc > 800_000) || (smart < 1 && volume < 3_000)) continue;
    const key = `gmgn-trending:${token}:${Math.floor(Date.now() / privateWindowMs)}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    events.push({
      source: "gmgn_trending",
      token,
      symbol: row.symbol || "UNKNOWN",
      name: row.name || row.symbol || "UNKNOWN",
      signalTime: Date.now(),
      marketCapUsd: mc,
      amountUsd: volume,
      holders: Number(row.holder_count || row.holders || 0),
      currentLiquidityUsd: Number(row.liquidity || row.liquidity_usd || 0),
      top10HolderPercent: percentValue(row.top_10_holder_rate || row.top10HolderPercent || 0),
      rugRatio: Number(row.rug_ratio || 0),
      bundlerRate: percentToRate(row.bundler_rate || row.bundlers_percent || 0),
      ratTraderRate: Number(row.rat_trader_amount_rate || 0),
      devTeamHoldRate: percentToRate(row.dev_team_hold_rate || row.dev_holdings_percent || 0),
      botDegenRate: Number(row.bot_degen_rate || 0),
      sellTaxPct: Number(row.sell_tax || 0),
      buyTaxPct: Number(row.buy_tax || 0),
      isHoneypot: Number(row.is_honeypot || 0),
      isRenounced: Number(row.is_renounced || 0),
      isOpenSource: Number(row.is_open_source || 0),
      creatorClose: row.creator_close === true || row.creator_token_status === "creator_close",
      creatorTokenStatus: row.creator_token_status || "",
      launchpad: row.launchpad_platform || row.launchpad || "fourmeme",
      launchpadStatus: String(row.launchpad_status || ""),
      priceChange1mPct: Number(row.price_change_percent1m || 0),
      priceChange5mPct: Number(row.price_change_percent5m || 0),
      priceChange1hPct: Number(row.price_change_percent1h || 0),
      smartDegenCount: smart,
      entryPrice: Number(row.price || row.price_usd || 0),
      reason: "GMGN FourMeme 1m 热榜",
      event: row,
    });
  }
  return events;
}

function gmgnSignalEvents() {
  return [
    ...gmgnSmartMoneyEvents(),
    ...gmgnMarketSignalEvents(),
    ...gmgnTrendingFourMemeEvents(),
  ];
}

function binancePercent(value) {
  return percentValue(value);
}

async function binanceMemeRushEvents() {
  if (!binanceEnabled) return [];
  if (Date.now() < Number(state.binanceErrorUntil || 0)) return [];
  const url = "https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/rank/list/ai";
  const common = {
    chainId: "56",
    limit: 50,
    protocol: [2001],
    holdersMin: minEntryHolders,
    marketCapMax: String(maxEntryMarketCapUsd),
    holdersTop10PercentMax: String(maxTop10HolderPct),
    excludeDevWashTrading: 1,
    excludeInsiderWashTrading: 1,
  };
  const envProxy = binanceProxy || "";
  const oldProxy = {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
    ALL_PROXY: process.env.ALL_PROXY,
  };
  if (envProxy) {
    process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || envProxy;
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || envProxy;
    process.env.ALL_PROXY = process.env.ALL_PROXY || envProxy;
  }
  try {
    const responses = await Promise.all([10, 20, 30].map((rankType) => fetchJson(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept-encoding": "identity",
        "user-agent": "binance-web3/1.1 (Skill)",
      },
      body: JSON.stringify({ ...common, rankType }),
    })));
    const rows = [];
    for (const res of responses) {
      if (!res.ok) {
        state.binanceLastError = res.error.slice(0, 300);
        state.binanceErrorUntil = Date.now() + binanceCooldownMs;
        continue;
      }
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      rows.push(...data);
    }
    for (const row of rows) {
      const token = String(row.contractAddress || "").toLowerCase();
      uniqPush(state, "seenGmgnKeys", `binance-meme:${token}:${row.createTime}:${row.progress}`);
    }
    if (!state.seeded) return [];

    const events = [];
    for (const row of rows) {
      const token = String(row.contractAddress || "").toLowerCase();
      if (!token) continue;
      const mc = Number(row.marketCap || 0);
      const liq = Number(row.liquidity || 0);
      const holders = Number(row.holders || 0);
      if ((mc && mc > maxEntryMarketCapUsd) || (liq && liq < 500) || holders < minEntryHolders) continue;
      const key = `binance-meme:${token}:${Math.floor(Date.now() / privateWindowMs)}`;
      if (!uniqPush(state, "alertKeys", key)) continue;
      events.push({
        source: "binance_meme",
        token,
        symbol: row.symbol || "UNKNOWN",
        name: row.name || row.symbol || "UNKNOWN",
        signalTime: Number(row.createTime || Date.now()),
        marketCapUsd: mc,
        currentMarketCapUsd: mc,
        currentLiquidityUsd: liq,
        currentHolders: holders,
        amountUsd: Number(row.volume || 0),
        entryPrice: Number(row.price || 0),
        bondingPercent: Number(row.progress || 0),
        top10HolderPercent: binancePercent(row.holdersTop10Percent || 0),
        devTeamHoldRate: percentToRate(row.holdersDevPercent || 0),
        bundlerRate: percentToRate(row.bundlerHoldingPercent || 0),
        sniperRate: percentToRate(row.holdersSniperPercent || 0),
        insiderRate: percentToRate(row.holdersInsiderPercent || 0),
        freshWalletRate: percentToRate(row.newWalletHoldingPercent || 0),
        kolHolders: Number(row.kolHolders || 0),
        proHolders: Number(row.proHolders || 0),
        binanceHolders: Number(row.bnHolders || 0),
        priceChange1hPct: Number(row.priceChange || 0),
        binanceNarrative: row.narrativeText?.cn || row.narrativeText?.en || "",
        launchpad: row.protocol === 2001 ? "fourmeme" : "binance_meme",
        launchpadStatus: row.migrateStatus === 1 ? "migrated" : "bonding",
        reason: "Binance Meme Rush 辅助确认",
        event: row,
      });
    }
    return events;
  } finally {
    if (oldProxy.HTTPS_PROXY === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = oldProxy.HTTPS_PROXY;
    if (oldProxy.HTTP_PROXY === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = oldProxy.HTTP_PROXY;
    if (oldProxy.ALL_PROXY === undefined) delete process.env.ALL_PROXY; else process.env.ALL_PROXY = oldProxy.ALL_PROXY;
  }
}

async function binanceTopicRushEvents() {
  if (!binanceEnabled) return [];
  if (Date.now() < Number(state.binanceErrorUntil || 0)) return [];
  const url = "https://web3.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/social-rush/rank/list/ai?chainId=56&rankType=10&sort=10&asc=false";
  const oldProxy = {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
    ALL_PROXY: process.env.ALL_PROXY,
  };
  if (binanceProxy) {
    process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || binanceProxy;
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || binanceProxy;
    process.env.ALL_PROXY = process.env.ALL_PROXY || binanceProxy;
  }
  try {
    const res = await fetchJson(url, {
      headers: {
        "accept-encoding": "identity",
        "user-agent": "binance-web3/1.1 (Skill)",
      },
    });
    if (!res.ok) {
      state.binanceLastError = res.error.slice(0, 300);
      state.binanceErrorUntil = Date.now() + binanceCooldownMs;
      return [];
    }
    const topics = Array.isArray(res.data?.data) ? res.data.data : [];
    const rows = topics.flatMap((topic) => (topic.tokenList || []).map((token) => ({ topic, token })));
    for (const row of rows) {
      const token = String(row.token.contractAddress || "").toLowerCase();
      uniqPush(state, "seenGmgnKeys", `binance-topic:${row.topic.topicId}:${token}`);
    }
    if (!state.seeded) return [];

    const events = [];
    for (const { topic, token: row } of rows) {
      const token = String(row.contractAddress || "").toLowerCase();
      if (!token) continue;
      const mc = Number(row.marketCap || 0);
      const liq = Number(row.liquidity || 0);
      const holders = Number(row.holders || 0);
      const inflow = Number(row.netInflow1h || row.netInflow || 0);
      if ((mc && mc > maxEntryMarketCapUsd) || liq < 500 || holders < minEntryHolders || inflow < 500) continue;
      const key = `binance-topic:${topic.topicId}:${token}:${Math.floor(Date.now() / privateWindowMs)}`;
      if (!uniqPush(state, "alertKeys", key)) continue;
      events.push({
        source: "binance_topic",
        token,
        symbol: row.symbol || "UNKNOWN",
        name: row.symbol || "UNKNOWN",
        signalTime: Number(topic.createTime || Date.now()),
        marketCapUsd: mc,
        currentMarketCapUsd: mc,
        currentLiquidityUsd: liq,
        currentHolders: holders,
        amountUsd: inflow,
        top10HolderPercent: 0,
        devTeamHoldRate: percentToRate(row.devHoldingPercent || 0),
        sniperRate: percentToRate(row.sniperHoldingPercent || 0),
        insiderRate: percentToRate(row.insiderHoldingPercent || 0),
        binanceNarrative: topic.aiSummary?.aiSummaryCn || topic.aiSummary?.aiSummaryEn || topic.name?.topicNameCn || topic.name?.topicNameEn || "",
        launchpad: Number(row.protocol) === 2001 ? "fourmeme" : "binance_topic",
        launchpadStatus: row.migrateStatus === 1 ? "migrated" : "bonding",
        reason: "Binance Topic Rush 叙事/净流入辅助确认",
        event: { topic, token: row },
      });
    }
    return events;
  } finally {
    if (oldProxy.HTTPS_PROXY === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = oldProxy.HTTPS_PROXY;
    if (oldProxy.HTTP_PROXY === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = oldProxy.HTTP_PROXY;
    if (oldProxy.ALL_PROXY === undefined) delete process.env.ALL_PROXY; else process.env.ALL_PROXY = oldProxy.ALL_PROXY;
  }
}

async function binanceTokenDynamicInfo(token) {
  if (!binanceEnabled || !binanceTokenInfoEnabled || !token) return null;
  if (Date.now() < Number(state.binanceErrorUntil || 0)) return null;
  const oldProxy = {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    HTTP_PROXY: process.env.HTTP_PROXY,
    ALL_PROXY: process.env.ALL_PROXY,
  };
  if (binanceProxy) {
    process.env.HTTPS_PROXY = binanceProxy;
    process.env.HTTP_PROXY = binanceProxy;
    process.env.ALL_PROXY = binanceProxy;
  }
  try {
    const url = `https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/dynamic-data?chainId=56&tokenAddress=${encodeURIComponent(token)}`;
    const res = await fetchJson(url, { headers: { accept: "application/json" } }, 12_000);
    if (!res.ok) {
      state.binanceErrorUntil = Date.now() + binanceCooldownMs;
      state.binanceLastError = res.error || "Binance token-info failed";
      return null;
    }
    const row = pickObject(res.data);
    if (!row) return null;
    return {
      price: Number(row.price || row.priceUsd || row.priceUSD || 0),
      marketCapUsd: Number(row.marketCap || row.marketCapUsd || row.marketCapUSD || 0),
      liquidityUsd: Number(row.liquidity || row.liquidityUsd || row.liquidityUSD || 0),
      holders: Number(row.holders || row.holderCount || row.totalHolders || 0),
      volume5mUsd: Number(row.volume5m || row.volume5M || row.volumeUsd5m || row.volumeUsd5M || 0),
      txs5m: Number(row.txs5m || row.txs5M || row.txCount5m || row.txCount5M || 0),
      volume1hUsd: Number(row.volume1h || row.volume1H || row.volumeUsd1h || row.volumeUsd1H || 0),
      txs1h: Number(row.txs1h || row.txs1H || row.txCount1h || row.txCount1H || 0),
      top10HolderPercent: percentValue(row.holdersTop10Percent || row.top10HolderPercent || row.top10HoldingsPercent || 0),
      links: row.links || row.socialLinks || {},
      raw: row,
    };
  } catch (error) {
    state.binanceErrorUntil = Date.now() + binanceCooldownMs;
    state.binanceLastError = error.message || String(error);
    return null;
  } finally {
    if (oldProxy.HTTPS_PROXY === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = oldProxy.HTTPS_PROXY;
    if (oldProxy.HTTP_PROXY === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = oldProxy.HTTP_PROXY;
    if (oldProxy.ALL_PROXY === undefined) delete process.env.ALL_PROXY; else process.env.ALL_PROXY = oldProxy.ALL_PROXY;
  }
}

function eventSourceWeight(event) {
  switch (event.source) {
    case "private": return 4;
    case "okx": return 3;
    case "fourmeme": return 2;
    case "gmgn_smartmoney": return 2;
    case "gmgn_market": return 1;
    case "gmgn_trending": return 1;
    case "binance_meme": return 1;
    case "binance_topic": return 1;
    default: return 1;
  }
}

function mergeMetric(item, event, field, mode = "first") {
  if (!hasMetric(event[field])) return;
  const value = Number(event[field]);
  if (!hasMetric(item[field]) || Number(item[field]) === 0) {
    item[field] = value;
    return;
  }
  if (mode === "max") item[field] = Math.max(Number(item[field]), value);
  else if (mode === "min") item[field] = Math.min(Number(item[field]), value);
}

function mergeTokenQuality(item, event) {
  for (const field of ["holders", "currentHolders", "triggerWalletCount", "smartDegenCount", "kolHolders", "proHolders", "binanceHolders"]) mergeMetric(item, event, field, "max");
  for (const field of ["marketCapUsd", "currentMarketCapUsd", "currentLiquidityUsd", "entryPrice"]) mergeMetric(item, event, field, "first");
  for (const field of ["top10HolderPercent", "bondingPercent", "sellTaxPct", "buyTaxPct", "rugRatio", "bundlerRate", "ratTraderRate", "devTeamHoldRate", "botDegenRate", "priceChange1mPct", "priceChange5mPct", "priceChange1hPct", "sniperRate", "insiderRate", "freshWalletRate"]) mergeMetric(item, event, field, "max");
  for (const field of ["isHoneypot", "isRenounced", "isOpenSource"]) mergeMetric(item, event, field, "max");
  if (event.creatorClose === true) item.creatorClose = true;
  if (event.binanceNarrative && !item.binanceNarrative) item.binanceNarrative = event.binanceNarrative;
  if (event.creatorTokenStatus && !item.creatorTokenStatus) item.creatorTokenStatus = event.creatorTokenStatus;
  if (event.launchpad && !item.launchpad) item.launchpad = event.launchpad;
  if (event.launchpadStatus && !item.launchpadStatus) item.launchpadStatus = event.launchpadStatus;
}

function combineEvents(events) {
  const byToken = new Map();
  for (const event of events) {
    if (!event?.token) continue;
    const token = String(event.token).toLowerCase();
    const item = byToken.get(token) || {
      ...event,
      token,
      sources: new Set(),
      sourceEvents: [],
      compositeScore: 0,
      sentimentScore: 0,
      amountUsd: 0,
      triggerWalletCount: 0,
      smartWalletProfiles: [],
    };
    item.sources.add(event.source);
    item.sourceEvents.push(event);
    item.compositeScore += eventSourceWeight(event);
    item.amountUsd += Number(event.amountUsd || event.volumeUsd1h || 0);
    item.triggerWalletCount = Math.max(Number(item.triggerWalletCount || 0), Number(event.triggerWalletCount || 0));
    mergeTokenQuality(item, event);
    item.signalTime = Math.max(Number(item.signalTime || 0), Number(event.signalTime || 0));
    if (!item.symbol || item.symbol === "UNKNOWN") item.symbol = event.symbol;
    if (!item.name || item.name === "UNKNOWN") item.name = event.name;
    const details = Array.isArray(event.details) ? event.details : [];
    for (const row of details) {
      const wallet = String(row.walletAddress || row.maker || "").toLowerCase();
      if (!wallet) continue;
      const profile = walletProfileMeta(wallet);
      if (!profile) continue;
      if (!safeTrackedWallets.includes(wallet)) continue;
      item.smartWalletProfiles.push({
        walletAddress: wallet,
        profile: profile.profile,
        profileLabel: profile.profileLabel || profileCn(profile.profile),
        walletTier: profile.walletTier || "",
        walletStyleLabel: profile.walletStyleLabel || "",
        walletValueScore: profile.walletValueScore || 0,
        labels: profile.labels || [],
        reliabilityScore: profile.reliabilityScore || 0,
      });
      item.sentimentScore += walletProfileWeight(wallet);
    }
    if (Number(event.triggerWalletCount || 0) > 0 && !details.length && event.source === "okx") {
      item.sentimentScore += Number(event.triggerWalletCount || 0) * 0.9;
    }
    byToken.set(token, item);
  }
  return [...byToken.values()].map((event) => {
    const sources = [...event.sources].sort();
    event.smartWalletProfiles = dedupeProfiles(event.smartWalletProfiles);
    event.sentimentGroup = buildSentimentGroup(event);
    return {
      ...event,
      sources,
      reason: `组合信号: ${sources.join(" + ")}`,
    };
  });
}

function dedupeProfiles(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const wallet = String(row.walletAddress || "").toLowerCase();
    if (!wallet) continue;
    const prev = map.get(wallet);
    if (!prev || Number(row.reliabilityScore || 0) > Number(prev.reliabilityScore || 0)) map.set(wallet, row);
  }
  return [...map.values()];
}

function groupedProfileStats(event) {
  const profiles = event.smartWalletProfiles || [];
  const positive = new Set(["hundred_x_hunter", "ten_k_profit_champion", "hot_meme_sniper", "conviction_reloader"]);
  const counts = {};
  const walletsByProfile = {};
  for (const row of profiles) {
    const profile = String(row.profile || "");
    if (!positive.has(profile)) continue;
    if (row.walletTier && row.walletTier !== "核心") continue;
    counts[profile] = (counts[profile] || 0) + 1;
    walletsByProfile[profile] = walletsByProfile[profile] || [];
    walletsByProfile[profile].push(String(row.walletAddress || "").toLowerCase());
  }

  let topProfile = "";
  let topCount = 0;
  for (const [profile, count] of Object.entries(counts)) {
    if (count > topCount) {
      topProfile = profile;
      topCount = count;
    }
  }
  const activeGroups = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([profile, count]) => ({
      profile,
      label: profileCn(profile),
      count,
      wallets: walletsByProfile[profile] || [],
    }))
    .sort((a, b) => b.count - a.count);
  const qualifiedGroups = activeGroups.filter((row) => row.count >= minPrivateWallets);
  const activeGroupCount = activeGroups.length;
  const qualifiedGroupCount = qualifiedGroups.length;
  const crossGroupCount = activeGroups.reduce((sum, row) => sum + row.count, 0);
  const sources = new Set(event.sources || [event.source]);
  const externalConfirm = ["okx", "gmgn_smartmoney", "gmgn_market", "gmgn_trending", "fourmeme", "binance_meme", "binance_topic"]
    .some((source) => sources.has(source));
  const triggerCount = profiles.length;
  const signalLevel = qualifiedGroupCount >= 2 ? "多组强信号"
    : activeGroupCount >= 2 && topCount >= minPrivateWallets ? "多组共振"
    : topCount >= strongPrivateWallets || (topCount >= minPrivateWallets && externalConfirm) ? "强信号"
    : topCount >= minPrivateWallets ? "正式信号"
      : crossGroupObserveEnabled && activeGroupCount >= 2 && crossGroupCount >= minPrivateWallets ? "跨组观察"
        : triggerCount >= 1 ? "观察信号"
        : "无信号";
  const triggerMode = qualifiedGroupCount >= 2 ? "multi_group"
    : topCount >= minPrivateWallets ? "same_group"
      : crossGroupObserveEnabled && activeGroupCount >= 2 ? "cross_group_observe"
        : "observe";

  return {
    counts,
    walletsByProfile,
    activeGroups,
    qualifiedGroups,
    activeGroupCount,
    qualifiedGroupCount,
    crossGroupCount,
    topProfile,
    topCount,
    triggerCount,
    externalConfirm,
    signalLevel,
    triggerMode,
    qualifies: sameGroupRequired ? topCount >= minPrivateWallets : crossGroupCount >= minPrivateWallets,
  };
}

function buildSentimentGroup(event) {
  const profiles = event.smartWalletProfiles || [];
  const counts = profiles.reduce((acc, row) => {
    acc[row.profile] = (acc[row.profile] || 0) + 1;
    return acc;
  }, {});
  const score = Number(event.sentimentScore || 0)
    + (counts.hundred_x_hunter || 0) * 1.8
    + (counts.ten_k_profit_champion || 0) * 1.5
    + (counts.hot_meme_sniper || 0) * 1.3
    + (counts.conviction_reloader || 0) * 1.1
    - (counts.high_frequency_rookie || 0) * 1.1
    - (counts.sleeping_zombie || 0) * 0.5;

  let key = "neutral_watch";
  let label = "中性观察";
  if (score >= 8) {
    key = "aggressive_accumulation";
    label = "强进攻堆仓";
  } else if (score >= 5) {
    key = "smart_accumulation";
    label = "聪明钱堆仓";
  } else if (score >= 2.5) {
    key = "early_probe";
    label = "早期试单";
  } else if ((counts.fast_exit_distributor || 0) >= 2) {
    key = "distribution_risk";
    label = "快进快出风险";
  }

  return {
    key,
    label,
    score: Number(score.toFixed(2)),
    counts,
  };
}

function sentimentBonus(event) {
  const group = event.sentimentGroup || {};
  const score = Number(group.score || 0);
  if (group.key === "aggressive_accumulation") return 2;
  if (group.key === "smart_accumulation") return 1.5;
  if (group.key === "early_probe") return 0.5;
  if (group.key === "distribution_risk") return -1.5;
  if (score >= 1.5) return 0.5;
  return 0;
}

function sentimentNarrative(event) {
  const group = event.sentimentGroup;
  if (!group) return "情绪信号暂缺";
  const c = group.counts || {};
  const parts = [];
  if (c.hundred_x_hunter) parts.push(`百倍组 ${c.hundred_x_hunter}`);
  if (c.ten_k_profit_champion) parts.push(`盈利组 ${c.ten_k_profit_champion}`);
  if (c.hot_meme_sniper) parts.push(`热点组 ${c.hot_meme_sniper}`);
  if (c.conviction_reloader) parts.push(`加仓组 ${c.conviction_reloader}`);
  if (c.high_frequency_rookie) parts.push(`噪音组 ${c.high_frequency_rookie}`);
  if (c.balanced_scout) parts.push(`观察组 ${c.balanced_scout}`);
  if (c.sleeping_zombie) parts.push(`休眠组 ${c.sleeping_zombie}`);
  return `${group.label}｜${parts.join(" / ") || "无画像样本"}｜情绪分 ${group.score}`;
}

function groupedStatsNarrative(stats) {
  if (!stats) return "暂无分组统计";
  const groups = stats.activeGroups || [];
  const text = groups.map((row) => `${row.label} ${row.count}`).join(" / ") || "暂无正向核心组";
  if (stats.triggerMode === "multi_group") return `多组强共振｜${text}`;
  if (stats.triggerMode === "same_group") return `${profileCn(stats.topProfile)} 同组共振 ${stats.topCount} 个｜${text}`;
  if (stats.triggerMode === "cross_group_observe") return `跨组观察，未达同组阈值｜${text}`;
  return `观察中｜${text}`;
}

function walletShortName(wallet, profileMap = new Map()) {
  const row = profileMap.get(String(wallet || "").toLowerCase());
  if (row?.walletName) return row.walletName;
  return `${String(wallet || "").slice(0, 6)}...${String(wallet || "").slice(-4)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function groupedSignalSummary(event) {
  const profiles = [...(event.smartWalletProfiles || [])].sort((a, b) => Number(b.reliabilityScore || 0) - Number(a.reliabilityScore || 0));
  const uniqueProfiles = new Set(profiles.map((row) => row.profile));
  const names = profiles.slice(0, 5).map((row) => walletShortName(row.walletAddress, smartWalletProfiles.byWallet));
  const groupStats = event.groupedProfileStats || groupedProfileStats(event);
  return {
    uniqueGroupCount: uniqueProfiles.size,
    triggerCount: profiles.length,
    names,
    topProfile: groupStats.topProfile,
    topCount: groupStats.topCount,
    groupStats,
  };
}

function telegramSignalMessage(event, trade) {
  const grouped = groupedSignalSummary(event);
  const groupStats = grouped.groupStats || event.groupedProfileStats || groupedProfileStats(event);
  const groupLabel = grouped.topProfile ? profileCn(grouped.topProfile) : (event.sentimentGroup?.label || "中性观察");
  const sourceText = event.sources?.join(" + ") || event.source || "unknown";
  const namesText = grouped.names.join("、") || "n/a";
  const okxOfficialLine = (event.sources || []).includes("okx")
    ? `• OKX Signal：官方聚合触发钱包 <b>${escapeHtml(event.triggerWalletCount || "n/a")}</b> 个，阈值 ${escapeHtml(okxSignalMinWallets)} 个`
    : "";
  const lines = [
    `🚨 <b>BSC 分组信号</b>`,
    "",
    `🪙 <b>${escapeHtml(event.symbol || "UNKNOWN")}</b> ｜ ${escapeHtml(event.name || event.symbol || "UNKNOWN")}`,
    `📌 <b>等级</b>：${escapeHtml(groupStats.signalLevel || "正式信号")} ｜ ${escapeHtml(groupLabel)} ｜ 情绪分 ${escapeHtml(event.sentimentGroup?.score ?? "n/a")}`,
    `🔗 <b>合约</b>：<code>${escapeHtml(event.token)}</code>`,
    `📡 <b>来源</b>：${escapeHtml(sourceText)}`,
    "",
    `📊 <b>市场数据</b>`,
    `• 市值：<b>${escapeHtml(fmtUsd(event.currentMarketCapUsd || event.marketCapUsd))}</b>`,
    `• 流动性：${escapeHtml(fmtUsd(event.currentLiquidityUsd))}`,
    `• 持有人：${escapeHtml(event.currentHolders || event.holders || "n/a")}`,
    "",
    `🧠 <b>聪明钱触发</b>`,
    `• 触发地址：<b>${escapeHtml(grouped.triggerCount)}</b> 个`,
    `• 触发模式：<b>${escapeHtml(groupedStatsNarrative(groupStats))}</b>`,
    `• 核心同组：<b>${escapeHtml(grouped.topCount || 0)}</b> 个`,
    `• 多组参与：${escapeHtml(groupStats.activeGroupCount || 0)} 组，达标组 ${escapeHtml(groupStats.qualifiedGroupCount || 0)} 组`,
    `• 外部确认：${escapeHtml(groupStats.externalConfirm ? "有" : "无")}`,
    `• 名单：${escapeHtml(namesText)}`,
  ];

  if (okxOfficialLine) lines.push(okxOfficialLine);

  if (event.smartWalletProfiles?.length) {
    const buckets = event.smartWalletProfiles.reduce((acc, row) => {
      const key = profileCn(row.profile);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const bucketText = Object.entries(buckets).map(([k, v]) => `${k}:${v}`).join(" / ");
    lines.push(`• 画像：${escapeHtml(bucketText)}`);
  }

  lines.push("");
  lines.push(`📝 <b>叙事摘要</b>`);
  lines.push(escapeHtml(narrativeSummary(event)));

  if (trade) {
    lines.push("");
    lines.push(`🧪 <b>模拟盘</b>：已按 ${escapeHtml(fmtUsd(paperSizeUsd))} 建仓，成本后入场价 <code>${escapeHtml(trade.entryPrice)}</code>`);
  } else {
    lines.push("");
    lines.push(`🔔 <b>动作</b>：仅提醒，未建仓`);
  }

  lines.push(`⚠️ <b>风险</b>：默认仅分析和提醒，不代表实盘建议。`);
  return lines.join("\n");
}

function telegramOkxSignalMessage(event) {
  const lines = [
    `📡 <b>OKX 官方 Signal</b>`,
    "",
    `🪙 <b>${escapeHtml(event.symbol || "UNKNOWN")}</b> ｜ ${escapeHtml(event.name || event.symbol || "UNKNOWN")}`,
    `🔗 <b>合约</b>：<code>${escapeHtml(event.token)}</code>`,
    `🏷 <b>钱包类型</b>：${escapeHtml(event.walletTypeLabel || walletTypeLabel(event.walletType))}`,
    `⏱ <b>时间</b>：${escapeHtml(fmtTime(event.signalTime || Date.now()))}`,
    "",
    `📊 <b>OKX Signal 原始字段</b>`,
    `• 触发钱包：<b>${escapeHtml(event.triggerWalletCount || "n/a")}</b>`,
    `• 买入金额：${escapeHtml(fmtUsd(event.amountUsd))}`,
    `• 信号触发价：<code>${escapeHtml(fmtTokenPrice(event.entryPrice))}</code>`,
    `• 市值：${escapeHtml(fmtUsd(event.marketCapUsd))}`,
    `• 流动性：${escapeHtml(event.currentLiquidityUsd === undefined ? "Signal 未返回" : fmtUsd(event.currentLiquidityUsd))}`,
    `• 持有人：${escapeHtml(event.holders || "n/a")}`,
    `• 已卖比例：${escapeHtml(Number.isFinite(Number(event.soldRatioPercent)) ? `${Number(event.soldRatioPercent).toFixed(1)}%` : "n/a")}`,
    "",
    `📝 <b>备注</b>：OKX 官方 Signal 原样转发；这条不代表你的私有聪明钱地址池已经同组共振。`,
    `⚠️ <b>提醒</b>：仅供观察，不构成买入建议。`,
  ];
  return lines.join("\n");
}

function duePendingEvents(events) {
  if (!entryObserveEnabled || !state.pendingEntries) return events;
  const seen = new Set(events.map((event) => String(event.token || "").toLowerCase()).filter(Boolean));
  const now = Date.now();
  const due = [];
  for (const [token, pending] of Object.entries(state.pendingEntries)) {
    const ageMs = now - Number(pending.at || now);
    if (ageMs > entryObserveMaxAgeMs) {
      delete state.pendingEntries[token];
      continue;
    }
    if (seen.has(token) || ageMs < entryObserveMinAgeMs) continue;
    const event = pending.lastEvent || pending.event;
    if (event?.token) due.push({ ...event, token, reason: `${event.reason || "组合信号"} + 观察到期复查` });
  }
  return [...events, ...due];
}

function isFourMemeLike(event) {
  const sources = new Set(event.sources || [event.source]);
  const launchpad = String(event.launchpad || "").toLowerCase();
  return sources.has("fourmeme")
    || sources.has("gmgn_trending")
    || launchpad.includes("fourmeme")
    || String(event.token || "").endsWith("4444");
}

function fourMemeQuality(event) {
  const penalties = [];
  const bonuses = [];
  const bonding = finiteNumber(event.bondingPercent, 0);
  const top10 = finiteNumber(event.top10HolderPercent, 0);
  const sellTax = finiteNumber(event.sellTaxPct, 0);
  const rug = finiteNumber(event.rugRatio, 0);
  const bundler = finiteNumber(event.bundlerRate, 0);
  const rat = finiteNumber(event.ratTraderRate, 0);
  const devHold = finiteNumber(event.devTeamHoldRate, 0);
  const holders = finiteNumber(event.currentHolders || event.holders, 0);

  if (hasMetric(event.bondingPercent) && bonding > 0 && bonding < minFourMemeBondingPct) penalties.push(`bonding ${bonding.toFixed(1)}% < ${minFourMemeBondingPct}%`);
  if (hasMetric(event.bondingPercent) && bonding >= maxFourMemeBondingPct) penalties.push(`bonding ${bonding.toFixed(1)}% >= ${maxFourMemeBondingPct}%`);
  if (hasMetric(event.top10HolderPercent) && top10 > maxTop10HolderPct) penalties.push(`top10 ${top10.toFixed(1)}% > ${maxTop10HolderPct}%`);
  if (hasMetric(event.sellTaxPct) && sellTax > maxSellTaxPct) penalties.push(`sell tax ${sellTax.toFixed(1)}% > ${maxSellTaxPct}%`);
  if (hasMetric(event.rugRatio) && rug > maxRugRatio) penalties.push(`rug ratio ${rug.toFixed(2)} > ${maxRugRatio}`);
  if (hasMetric(event.bundlerRate) && bundler > maxBundlerRate) penalties.push(`bundler ${bundler.toFixed(2)} > ${maxBundlerRate}`);
  if (hasMetric(event.ratTraderRate) && rat > maxRatTraderRate) penalties.push(`rat trader ${rat.toFixed(2)} > ${maxRatTraderRate}`);
  if (hasMetric(event.devTeamHoldRate) && devHold > maxDevTeamHoldRate) penalties.push(`dev hold ${(devHold * 100).toFixed(1)}% > ${(maxDevTeamHoldRate * 100).toFixed(1)}%`);
  if (Number(event.isHoneypot || 0) === 1) penalties.push("honeypot flagged");

  if (event.creatorClose === true) bonuses.push("creator_close");
  if (hasMetric(event.rugRatio) && rug >= 0 && rug <= 0.10) bonuses.push("low_rug");
  if (hasMetric(event.bundlerRate) && bundler >= 0 && bundler <= 0.05) bonuses.push("low_bundler");
  if (holders >= 100) bonuses.push("holders_100+");
  if (hasMetric(event.top10HolderPercent) && top10 > 0 && top10 <= 30) bonuses.push("top10_healthy");
  if (hasMetric(event.bondingPercent) && bonding >= 10 && bonding <= 70) bonuses.push("bonding_mid");

  const bonusScore = Math.min(1, bonuses.length >= 3 ? 1 : 0);
  const summary = [
    hasMetric(event.bondingPercent) ? `bonding ${bonding.toFixed(1)}%` : "",
    hasMetric(event.top10HolderPercent) ? `top10 ${top10.toFixed(1)}%` : "",
    hasMetric(event.sellTaxPct) ? `sell tax ${sellTax.toFixed(1)}%` : "",
    hasMetric(event.rugRatio) ? `rug ${rug.toFixed(2)}` : "",
    hasMetric(event.bundlerRate) ? `bundler ${bundler.toFixed(2)}` : "",
    event.creatorClose === true ? "creator closed" : "",
  ].filter(Boolean).join("，");
  return { ok: penalties.length === 0, penalties, bonuses, bonusScore, summary };
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

function memepumpTokenDetails(token) {
  const data = runOnchainJson(["memepump", "token-details", "--address", token, "--chain", "bsc"]);
  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function memepumpDevInfo(token) {
  const data = runOnchainJson(["memepump", "token-dev-info", "--address", token, "--chain", "bsc"]);
  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function memepumpBundleInfo(token) {
  const data = runOnchainJson(["memepump", "token-bundle-info", "--address", token, "--chain", "bsc"]);
  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function memepumpApedWallets(token) {
  return asArray(runOnchainJson(["memepump", "aped-wallet", "--address", token, "--chain", "bsc"]));
}

function applyMemepumpDetails(event, details) {
  if (!details) return;
  event.protocolId = event.protocolId || details.protocolId;
  event.creatorAddress = event.creatorAddress || details.creatorAddress;
  event.createdTimestamp = event.createdTimestamp || details.createdTimestamp;
  event.migratedBeginTimestamp = event.migratedBeginTimestamp || details.migratedBeginTimestamp;
  event.migratedEndTimestamp = event.migratedEndTimestamp || details.migratedEndTimestamp;
  if (!event.symbol || event.symbol === "UNKNOWN") event.symbol = details.symbol;
  if (!event.name || event.name === "UNKNOWN") event.name = details.name;
  mergeTokenQuality(event, {
    currentMarketCapUsd: Number(details.market?.marketCapUsd || 0),
    currentHolders: Number(details.tags?.totalHolders || 0),
    bondingPercent: Number(details.bondingPercent || 0),
    top10HolderPercent: percentValue(details.tags?.top10HoldingsPercent || 0),
    bundlerRate: percentToRate(details.tags?.bundlersPercent || 0),
    sniperRate: percentToRate(details.tags?.snipersPercent || 0),
    insiderRate: percentToRate(details.tags?.insidersPercent || 0),
    freshWalletRate: percentToRate(details.tags?.freshWalletsPercent || 0),
    suspectedPhishingWalletRate: percentToRate(details.tags?.suspectedPhishingWalletPercent || 0),
    devTeamHoldRate: percentToRate(details.tags?.devHoldingsPercent || 0),
  });
  if (details.market?.volumeUsd1h) event.volumeUsd1h = Number(details.market.volumeUsd1h);
  if (details.market?.txCount1h) event.txCount1h = Number(details.market.txCount1h);
  event.social = details.social || event.social || {};
  event.apedCount = Number(details.aped || event.apedCount || 0);
}

function memepumpDeepRisk(event) {
  if (!isFourMemeLike(event)) return { ok: true, penalties: [], bonuses: [], bonusScore: 0, summary: "" };
  const token = String(event.token || "").toLowerCase();
  const cached = state.memepumpRiskCache?.[token];
  if (cached && Date.now() - Number(cached.at || 0) < memepumpRiskCacheMs) {
    if (cached.details) applyMemepumpDetails(event, cached.details);
    event.memepumpRisk = cached.result;
    return cached.result;
  }

  const details = memepumpTokenDetails(token);
  const dev = memepumpDevInfo(token);
  const bundle = memepumpBundleInfo(token);
  const aped = memepumpApedWallets(token);
  applyMemepumpDetails(event, details);

  const penalties = [];
  const bonuses = [];
  const devLaunched = dev?.devLaunchedInfo || {};
  const devHolding = dev?.devHoldingInfo || {};
  const rugPullCount = Number(devLaunched.rugPullCount || 0);
  const totalTokens = Number(devLaunched.totalTokens || 0);
  const migratedCount = Number(devLaunched.migratedCount || 0);
  const goldenGemCount = Number(devLaunched.goldenGemCount || 0);
  const devHoldingPct = Number(devHolding.devHoldingPercent || 0);
  const bundlerAthPct = Number(bundle?.bundlerAthPercent || 0);
  const totalBundlers = Number(bundle?.totalBundlers || 0);

  if (rugPullCount > maxDevRugPullCount) penalties.push(`dev rugs ${rugPullCount} > ${maxDevRugPullCount}`);
  if (devHoldingPct > maxDevHoldingPct) penalties.push(`dev holding ${devHoldingPct.toFixed(1)}% > ${maxDevHoldingPct}%`);
  if (bundlerAthPct > maxBundlerAthPct) penalties.push(`bundler ATH ${bundlerAthPct.toFixed(1)}% > ${maxBundlerAthPct}%`);

  if (totalTokens > 0 && rugPullCount === 0) bonuses.push("dev_no_rug");
  if (migratedCount > 0) bonuses.push("dev_migrated");
  if (goldenGemCount > 0) bonuses.push("dev_gem_history");
  if (devHoldingPct > 0 && devHoldingPct <= maxDevHoldingPct) bonuses.push("dev_still_low_hold");
  if (bundlerAthPct > 0 && bundlerAthPct <= 10) bonuses.push("low_bundle_ath");

  const apedSmart = aped.filter((wallet) => /smart|kol|influencer|whale/i.test(String(wallet.walletType || "")));
  const apedPositive = apedSmart.filter((wallet) => Number(wallet.totalPnl || 0) > 0 || Number(wallet.pnlPercent || 0) > 0);
  const apedHoldingUsd = apedSmart.reduce((sum, wallet) => sum + Number(wallet.holdingUsd || 0), 0);
  if (apedSmart.length > 0) bonuses.push("smart_aped");
  if (apedPositive.length > 0) bonuses.push("smart_aped_profit");

  const summary = [
    totalTokens ? `dev发币 ${totalTokens}` : "",
    `rug ${rugPullCount}`,
    migratedCount ? `迁移 ${migratedCount}` : "",
    goldenGemCount ? `金狗 ${goldenGemCount}` : "",
    Number.isFinite(devHoldingPct) ? `dev持仓 ${devHoldingPct.toFixed(1)}%` : "",
    bundlerAthPct ? `bundleATH ${bundlerAthPct.toFixed(1)}%` : "",
    totalBundlers ? `bundlers ${totalBundlers}` : "",
    apedSmart.length ? `聪明同车 ${apedSmart.length}` : "",
    apedHoldingUsd ? `聪明同车持仓 ${fmtUsd(apedHoldingUsd)}` : "",
  ].filter(Boolean).join("，");

  const result = {
    ok: penalties.length === 0,
    penalties,
    bonuses,
    bonusScore: Math.min(2, bonuses.length >= 4 ? 2 : bonuses.length >= 2 ? 1 : 0),
    summary,
    dev: { rugPullCount, totalTokens, migratedCount, goldenGemCount, devHoldingPct },
    bundle: { bundlerAthPct, totalBundlers },
    aped: { smartCount: apedSmart.length, positiveSmartCount: apedPositive.length, smartHoldingUsd: apedHoldingUsd },
  };
  state.memepumpRiskCache = state.memepumpRiskCache || {};
  state.memepumpRiskCache[token] = { at: Date.now(), details, result };
  event.memepumpRisk = result;
  return result;
}

async function enrichEventWithBinanceTokenInfo(event, info) {
  const binance = await binanceTokenDynamicInfo(event.token);
  if (!binance) return info;
  event.binanceTokenInfo = {
    top10HolderPercent: binance.top10HolderPercent,
    links: binance.links,
  };
  const enriched = {
    ...info,
    price: info.price || binance.price,
    marketCapUsd: info.marketCapUsd || binance.marketCapUsd,
    liquidityUsd: info.liquidityUsd || binance.liquidityUsd,
    holders: info.holders || binance.holders,
    volume5mUsd: info.volume5mUsd || binance.volume5mUsd,
    txs5m: info.txs5m || binance.txs5m,
    volume1hUsd: info.volume1hUsd || binance.volume1hUsd,
    txs1h: info.txs1h || binance.txs1h,
  };
  if (!hasMetric(event.top10HolderPercent) || Number(event.top10HolderPercent || 0) === 0) {
    event.top10HolderPercent = binance.top10HolderPercent || event.top10HolderPercent;
  }
  return enriched;
}

async function shouldOpenCompositeTrade(event) {
  const sources = new Set(event.sources || [event.source]);
  const hasOkxOrPrivate = sources.has("okx") || sources.has("private");
  const hasLaunchpadConfirm = sources.has("fourmeme") || sources.has("gmgn_trending") || sources.has("gmgn_market");
  const hasGmgnSmart = sources.has("gmgn_smartmoney");
  const isOkxOfficial = sources.has("okx") && Number(event.triggerWalletCount || 0) >= okxSignalMinWallets;
  const isOkxOfficialSolo = okxOfficialSoloAlert && isOkxOfficial;
  const isConfirmed = hasOkxOrPrivate || (hasGmgnSmart && hasLaunchpadConfirm);
  const isStrongGmgnSolo = allowStrongGmgnSolo
    && sources.size === 1
    && hasGmgnSmart
    && Number(event.triggerWalletCount || 0) >= strongGmgnWallets
    && Number(event.amountUsd || 0) >= strongGmgnAmountUsd;

  let info = peekTokenInfo(event.token);
  info = await enrichEventWithBinanceTokenInfo(event, info);
  event.currentMarketCapUsd = info.marketCapUsd || Number(event.marketCapUsd || 0);
  event.currentLiquidityUsd = info.liquidityUsd || Number(event.currentLiquidityUsd || 0);
  event.currentHolders = info.holders || Number(event.currentHolders || event.holders || 0);
  if (!event.entryPrice && info.price) event.entryPrice = info.price;
  const quality = isFourMemeLike(event) ? fourMemeQuality(event) : { ok: true, penalties: [], bonuses: [], bonusScore: 0, summary: "" };
  event.qualitySummary = quality.summary;
  event.qualityBonuses = quality.bonuses;
  event.qualityPenalties = quality.penalties;

  const mc = Number(event.currentMarketCapUsd || event.marketCapUsd || 0);
  const liq = Number(event.currentLiquidityUsd || 0);
  const holders = Number(event.currentHolders || 0);
  const buy1h = Number(event.buyTxCount1h || 0);
  const sell1h = Number(event.sellTxCount1h || 0);
  const tx1h = Number(event.txCount1h || 0);
  const vol1h = Number(event.volumeUsd1h || 0);
  const top10 = Number(event.top10HolderPercent || 0);
  const bonding = Number(event.bondingPercent || 0);
  const mcOk = !mc || mc <= maxEntryMarketCapUsd;
  const liqOk = (!liq && !requireEntryLiquidity) || liq >= minEntryLiquidityUsd;
  const holdersOk = (!holders && !requireEntryHolders) || holders >= minEntryHolders;
  const effectiveScore = Number(event.compositeScore || 0) + Number(quality.bonusScore || 0);
  event.effectiveCompositeScore = effectiveScore + sentimentBonus(event);
  const groupedStats = groupedProfileStats(event);
  event.groupedProfileStats = groupedStats;
  const scoreOk = effectiveScore >= minCompositeScore || (isOkxOfficialSolo && effectiveScore >= okxSignalMinCompositeScore);
  const groupedOk = groupedStats.qualifies || (allowOfficialSoloSignal && isOkxOfficial);
  const strongFourMemeSolo = allowStrongFourMemeSolo
    && sources.size === 1
    && sources.has("fourmeme")
    && tx1h >= strongFourMemeMinTx1h
    && vol1h >= strongFourMemeMinVolume1hUsd
    && holders >= strongFourMemeMinHolders
    && (!top10 || top10 <= strongFourMemeMaxTop10Pct)
    && (!bonding || bonding < strongFourMemeMaxBondingPct)
    && (!buy1h || sell1h / Math.max(1, buy1h) <= strongFourMemeMaxSellBuyRatio);
  if (strongFourMemeSolo) {
    event.reason = `${event.reason || "Four.meme 新盘异动"} + 探索盘强势确认`;
    event.exploration = true;
  }
  const strongFourMemeLiqOk = liqOk || (strongFourMemeSolo && strongFourMemeAllowMissingLiquidity && !liq);
  const strongFourMemeQualityOk = quality.ok || (strongFourMemeSolo && quality.penalties.every((penalty) => (
    penalty.startsWith("bonding ") && bonding > 0 && bonding < strongFourMemeMaxBondingPct
  )));

  const baseOk = (isConfirmed && groupedOk && scoreOk && mcOk && liqOk && holdersOk && quality.ok)
    || (isStrongGmgnSolo && mcOk && liqOk && holdersOk && quality.ok)
    || (strongFourMemeSolo && mcOk && strongFourMemeLiqOk && holdersOk && strongFourMemeQualityOk);
  if (baseOk) {
    const deep = memepumpDeepRisk(event);
    event.memepumpRiskSummary = deep.summary;
    event.memepumpRiskBonuses = deep.bonuses;
    event.memepumpRiskPenalties = deep.penalties;
    event.effectiveCompositeScore = Number(event.effectiveCompositeScore || 0) + Number(deep.bonusScore || 0);
    if (!deep.ok) {
      return { ok: false, reason: deep.penalties.join(", ") || "memepump deep risk rejected", info };
    }
    return { ok: true, info };
  }
  return {
    ok: false,
    reason: [
      !isConfirmed && !isStrongGmgnSolo && !strongFourMemeSolo ? "missing OKX/private/FourMeme confirmation" : "",
      !groupedOk && !isStrongGmgnSolo && !strongFourMemeSolo ? `no configured concentration (need ${sameGroupRequired ? `>=${minPrivateWallets} safe wallets in one positive group` : `>=${minPrivateWallets} safe wallets`}${okxOfficialSoloAlert ? `, or OKX official >=${okxSignalMinWallets}` : ""})` : "",
      sources.size === 1 && sources.has("fourmeme") && allowStrongFourMemeSolo && !strongFourMemeSolo ? "fourmeme solo not strong enough" : "",
      !scoreOk && !isStrongGmgnSolo && !strongFourMemeSolo ? `score ${effectiveScore} < ${isOkxOfficialSolo ? okxSignalMinCompositeScore : minCompositeScore}` : "",
      !mcOk ? `market cap ${fmtUsd(mc)} > ${fmtUsd(maxEntryMarketCapUsd)}` : "",
      !liqOk ? `liquidity ${liq ? fmtUsd(liq) : "missing"} < ${fmtUsd(minEntryLiquidityUsd)}` : "",
      !holdersOk ? `holders ${holders || "missing"} < ${minEntryHolders}` : "",
      !quality.ok ? quality.penalties.join(", ") : "",
    ].filter(Boolean).join("; ") || "filtered",
    info,
  };
}

function pendingEntryKey(event) {
  return String(event.token || "").toLowerCase();
}

function pendingEventSnapshot(event) {
  return JSON.parse(JSON.stringify({
    ...event,
    sourceEvents: undefined,
    event: undefined,
  }));
}

function observeEntry(event, info, decision) {
  if (!entryObserveEnabled) return { ready: true, reason: "" };
  const token = pendingEntryKey(event);
  if (!token) return { ready: false, reason: "missing token" };
  state.pendingEntries = state.pendingEntries || {};
  const now = Date.now();
  let pending = state.pendingEntries[token];
  const price = Number(info.price || event.entryPrice || 0);
  const holders = Number(info.holders || event.currentHolders || 0);
  const marketCapUsd = Number(info.marketCapUsd || event.currentMarketCapUsd || event.marketCapUsd || 0);

  if (!pending) {
    pending = {
      at: now,
      firstSignalTime: Number(event.signalTime || now),
      token,
      firstPrice: price,
      firstHolders: holders,
      firstMarketCapUsd: marketCapUsd,
      firstLiquidityUsd: Number(info.liquidityUsd || event.currentLiquidityUsd || 0),
      sources: event.sources || [event.source],
      score: event.effectiveCompositeScore || event.compositeScore || 0,
      event: pendingEventSnapshot(event),
    };
    state.pendingEntries[token] = pending;
    return { ready: false, reason: `observing ${Math.round(entryObserveMinAgeMs / 1000)}s for follow-through` };
  }

  pending.lastSeenAt = now;
  pending.lastEvent = pendingEventSnapshot(event);
  pending.sources = [...new Set([...(pending.sources || []), ...(event.sources || [event.source])])];
  pending.score = Math.max(Number(pending.score || 0), Number(event.effectiveCompositeScore || event.compositeScore || 0));

  const ageMs = now - Number(pending.at || now);
  if (ageMs > entryObserveMaxAgeMs) {
    delete state.pendingEntries[token];
    return { ready: false, reason: "observe window expired" };
  }
  if (ageMs < entryObserveMinAgeMs) {
    return { ready: false, reason: `observing ${Math.ceil((entryObserveMinAgeMs - ageMs) / 1000)}s more` };
  }

  const firstPrice = Number(pending.firstPrice || 0);
  const priceChangePct = firstPrice > 0 && price > 0 ? ((price / firstPrice) - 1) * 100 : 0;
  const holderGrowth = holders && pending.firstHolders ? holders - Number(pending.firstHolders || 0) : 0;
  const volume5mUsd = Number(info.volume5mUsd || 0);
  const txs5m = Number(info.txs5m || 0);
  const reasons = [];
  if (firstPrice > 0 && priceChangePct <= -maxObserveDrawdownPct) reasons.push(`observe drawdown ${priceChangePct.toFixed(1)}% <= -${maxObserveDrawdownPct}%`);
  if (firstPrice > 0 && priceChangePct >= maxObserveRunupPct) reasons.push(`observe runup ${priceChangePct.toFixed(1)}% >= ${maxObserveRunupPct}%`);
  if (volume5mUsd > 0 && volume5mUsd < minEntryVolume5mUsd) reasons.push(`5m volume ${fmtUsd(volume5mUsd)} < ${fmtUsd(minEntryVolume5mUsd)}`);
  if (txs5m > 0 && txs5m < minEntryTxs5m) reasons.push(`5m txs ${txs5m} < ${minEntryTxs5m}`);
  if (holderGrowth < minObserveHolderGrowth) reasons.push(`holder growth ${holderGrowth} < ${minObserveHolderGrowth}`);
  if (reasons.length) {
    delete state.pendingEntries[token];
    return { ready: false, reason: reasons.join("; ") };
  }

  event.entryPrice = price || event.entryPrice;
  event.currentMarketCapUsd = marketCapUsd || event.currentMarketCapUsd;
  event.currentLiquidityUsd = Number(info.liquidityUsd || event.currentLiquidityUsd || 0);
  event.currentHolders = holders || event.currentHolders;
  event.observeSummary = `观察 ${Math.round(ageMs / 1000)}s 后确认：价格 ${fmtPct(priceChangePct)}，5m成交 ${fmtUsd(volume5mUsd)} / ${txs5m || "n/a"}笔，持有人变化 ${holderGrowth >= 0 ? "+" : ""}${holderGrowth}`;
  delete state.pendingEntries[token];
  return { ready: true, reason: "confirmed follow-through" };
}

function currentTokenInfo(token) {
  const j = runJson(["token", "price-info", "--address", token, "--chain", "bsc"], 18_000);
  const data = Array.isArray(j.data) ? j.data[0] : j.data;
  if (!data || typeof data !== "object") return null;
  const price = Number(data.price || data.tokenPrice || 0);
  return {
    price,
    marketCapUsd: Number(data.marketCap || data.marketCapUsd || 0),
    liquidityUsd: Number(data.liquidity || 0),
    holders: Number(data.holders || 0),
    volume5mUsd: Number(data.volume5M || data.volume5m || 0),
    txs5m: Number(data.txs5M || data.txs5m || 0),
    volume1hUsd: Number(data.volume1H || data.volume1h || 0),
    txs1h: Number(data.txs1H || data.txs1h || 0),
    time: Number(data.time || Date.now()),
    raw: data,
  };
}

function fallbackEntryPrice(event) {
  if (Number(event.entryPrice) > 0) return Number(event.entryPrice);
  const info = currentTokenInfo(event.token);
  if (info?.price > 0) return info.price;
  return 0;
}

function openPaperTrade(event) {
  if (!event.token || paper.open.some((t) => t.token === event.token)) return null;
  const recentlyClosed = paper.closed.some((t) => t.token === event.token && Date.now() - Number(t.closedAt || 0) < reentryCooldownMs);
  if (recentlyClosed) {
    paper.events.push({ type: "paper_skip", token: event.token, reason: "reentry cooldown", at: Date.now(), event });
    return null;
  }
  const rawEntryPrice = fallbackEntryPrice(event);
  if (!rawEntryPrice) {
    paper.events.push({ type: "paper_skip", token: event.token, reason: "no entry price", at: Date.now(), event });
    return null;
  }
  const entryPrice = rawEntryPrice * (1 + buySlippagePct / 100);
  const buyGasUsd = gasUsdPerTx;
  const trade = {
    id: `${Date.now()}-${event.token.slice(2, 8)}`,
    status: "open",
    source: event.source,
    token: event.token,
    symbol: event.symbol,
    reason: event.reason,
    openedAt: Date.now(),
    signalTime: event.signalTime,
    rawEntryPrice,
    entryPrice,
    entryMarketCapUsd: event.marketCapUsd || null,
    entryCompositeScore: event.compositeScore || null,
    entryEffectiveScore: event.effectiveCompositeScore || event.compositeScore || null,
    entrySources: event.sources || [event.source],
    entryLiquidityUsd: event.currentLiquidityUsd || null,
    entryHolders: event.currentHolders || null,
    entryQualitySummary: event.qualitySummary || "",
    entryQualityBonuses: event.qualityBonuses || [],
    entryQualityPenalties: event.qualityPenalties || [],
    paperSizeUsd,
    remainingPct: 100,
    realizedUsd: -buyGasUsd,
    costModel: {
      buySlippagePct,
      sellSlippagePct,
      gasUsdPerTx,
      buyGasUsd,
      sellGasUsd: 0,
    },
    highestPrice: entryPrice,
    bestPnlPct: 0,
    tp1Done: false,
    tp2Done: false,
    exits: [],
    event,
  };
  paper.open.push(trade);
  paper.events.push({ type: "paper_open", at: Date.now(), trade });
  return trade;
}

function closePart(trade, pct, price, reason) {
  const closePct = Math.min(pct, trade.remainingPct);
  if (closePct <= 0) return null;
  const rawPrice = price;
  const effectivePrice = rawPrice * (1 - Number(trade.costModel?.sellSlippagePct ?? sellSlippagePct) / 100);
  const pnlPct = ((effectivePrice / trade.entryPrice) - 1) * 100;
  const partUsd = trade.paperSizeUsd * (closePct / 100);
  const pnlUsd = partUsd * (pnlPct / 100);
  const sellGasUsd = Number(trade.costModel?.gasUsdPerTx ?? gasUsdPerTx);
  trade.remainingPct -= closePct;
  trade.realizedUsd += pnlUsd - sellGasUsd;
  if (trade.costModel) trade.costModel.sellGasUsd = Number(trade.costModel.sellGasUsd || 0) + sellGasUsd;
  const exit = { at: Date.now(), reason, closePct, rawPrice, price: effectivePrice, pnlPct, pnlUsd, gasUsd: sellGasUsd };
  trade.exits.push(exit);
  paper.events.push({ type: "paper_exit", tradeId: trade.id, token: trade.token, ...exit });
  if (trade.remainingPct <= 0.0001) {
    trade.status = "closed";
    trade.closedAt = Date.now();
    paper.closed.push(trade);
  }
  return exit;
}

function updatePaperTrades() {
  const messages = [];
  const stillOpen = [];
  for (const trade of paper.open) {
    const info = currentTokenInfo(trade.token);
    if (!info?.price) {
      stillOpen.push(trade);
      continue;
    }
    const price = info.price;
    trade.lastPrice = price;
    trade.lastMarketCapUsd = info.marketCapUsd || trade.lastMarketCapUsd;
    trade.lastLiquidityUsd = info.liquidityUsd || trade.lastLiquidityUsd;
    trade.lastHolders = info.holders || trade.lastHolders;
    trade.lastVolume5mUsd = info.volume5mUsd;
    trade.lastTxs5m = info.txs5m;
    trade.lastVolume1hUsd = info.volume1hUsd;
    trade.lastTxs1h = info.txs1h;
    const rawPnlPct = ((price / trade.entryPrice) - 1) * 100;
    const executablePrice = price * (1 - Number(trade.costModel?.sellSlippagePct ?? sellSlippagePct) / 100);
    const executablePnlPct = ((executablePrice / trade.entryPrice) - 1) * 100;
    trade.lastExecutablePnlPct = executablePnlPct;
    trade.bestPnlPct = Math.max(trade.bestPnlPct || 0, rawPnlPct);
    trade.highestPrice = Math.max(trade.highestPrice || trade.entryPrice, price);

    const exits = [];
    const liquidityRug = Number(info.liquidityUsd || 0) > 0 && Number(info.liquidityUsd || 0) < minExitLiquidityUsd;
    const holderCollapse = Number(trade.entryHolders || 0) >= minEntryHolders && Number(info.holders || 0) > 0 && Number(info.holders || 0) < minExitHolders;
    const ageMs = Date.now() - trade.openedAt;
    const staleVolume = ageMs >= staleExitMinAgeMs
      && Number(info.txs5m || 0) <= staleExitMaxTxs5m
      && Number(info.volume5mUsd || 0) <= staleExitMaxVolume5mUsd
      && executablePnlPct < takeProfit1Pct;
    if (liquidityRug) exits.push(closePart(trade, trade.remainingPct, price, "liquidity_collapse"));
    else if (holderCollapse) exits.push(closePart(trade, trade.remainingPct, price, "holder_collapse"));
    else if (staleVolume) exits.push(closePart(trade, trade.remainingPct, price, "stale_volume"));
    else if (executablePnlPct <= stopLossPct) exits.push(closePart(trade, trade.remainingPct, price, "stop_loss"));
    else {
      if (!trade.tp1Done && executablePnlPct >= takeProfit1Pct) {
        trade.tp1Done = true;
        exits.push(closePart(trade, 50, price, "take_profit_1"));
      }
      if (!trade.tp2Done && executablePnlPct >= takeProfit2Pct) {
        trade.tp2Done = true;
        exits.push(closePart(trade, 30, price, "take_profit_2"));
      }
      const trailFromHighPct = ((price / trade.highestPrice) - 1) * 100;
      if (trade.bestPnlPct >= takeProfit1Pct && trailFromHighPct <= -trailDrawdownPct) {
        exits.push(closePart(trade, trade.remainingPct, price, "trailing_stop"));
      }
      if (ageMs >= timeStopMs && trade.bestPnlPct < timeStopMinBestPct) {
        exits.push(closePart(trade, trade.remainingPct, price, "time_stop"));
      }
    }

    const actualExits = exits.filter(Boolean);
    if (actualExits.length) {
      messages.push([
        `【模拟交易退出】${trade.symbol}`,
        `Token: ${trade.token}`,
        `当前盈亏: ${fmtPct(executablePnlPct)}，原因: ${actualExits.map((e) => e.reason).join(", ")}`,
        `市值: ${fmtUsd(info.marketCapUsd)}，流动性: ${fmtUsd(info.liquidityUsd)}，持有人: ${info.holders || "n/a"}，5m成交: ${fmtUsd(info.volume5mUsd)} / ${info.txs5m || 0}笔`,
        `已实现: ${fmtUsd(trade.realizedUsd)}，剩余仓位: ${trade.remainingPct.toFixed(1)}%，成本: 买滑 ${trade.costModel?.buySlippagePct ?? 0}% / 卖滑 ${trade.costModel?.sellSlippagePct ?? 0}% / gas ${fmtUsd((trade.costModel?.buyGasUsd || 0) + (trade.costModel?.sellGasUsd || 0))}`,
      ].join("\n"));
    }
    if (trade.status === "open") stillOpen.push(trade);
  }
  paper.open = stillOpen;
  return messages;
}

function eventMessage(event, trade) {
  const bits = [
    `【信号 + 模拟买入】${event.symbol || "UNKNOWN"}`,
    `名称: ${event.name || event.symbol || "UNKNOWN"}`,
    `来源: ${event.reason}`,
    `合约: ${event.token}`,
    `市值: ${fmtUsd(event.currentMarketCapUsd || event.marketCapUsd)}，流动性: ${fmtUsd(event.currentLiquidityUsd)}，持有人: ${event.currentHolders || event.holders || "n/a"}`,
    `叙事: ${narrativeSummary(event)}`,
    `模拟仓位: ${fmtUsd(paperSizeUsd)}，原始价: ${trade ? trade.rawEntryPrice : "n/a"}，成本后入场价: ${trade ? trade.entryPrice : "n/a"}`,
  ];
  if (event.source === "private") {
    bits.push(`私有钱包数: ${event.triggerWalletCount}，交易数: ${event.tradeCount}，市值约 ${fmtUsd(event.marketCapUsd)}`);
  } else if (event.source === "okx") {
    bits.push(`触发钱包数: ${event.triggerWalletCount}，买入额约 ${fmtUsd(event.amountUsd)}，市值约 ${fmtUsd(event.marketCapUsd)}，已卖比例 ${fmtPct(-event.soldRatioPercent).replace("-", "")}`);
  } else if (String(event.source || "").startsWith("gmgn")) {
    bits.push(`GMGN: 钱包数 ${event.triggerWalletCount || "n/a"}，金额/成交量约 ${fmtUsd(event.amountUsd)}，市值约 ${fmtUsd(event.marketCapUsd)}，SmartDegen ${event.smartDegenCount ?? "n/a"}`);
  } else {
    bits.push(`市值约 ${fmtUsd(event.marketCapUsd)}，1h成交 ${fmtUsd(event.volumeUsd1h)} / ${event.txCount1h} 笔，bonding ${Number(event.bondingPercent || 0).toFixed(2)}%，top10 ${Number(event.top10HolderPercent || 0).toFixed(2)}%`);
  }
  if (event.sources?.length) {
    bits.push(`组合: ${event.sources.join(" + ")}，分数 ${event.compositeScore}，有效分 ${event.effectiveCompositeScore ?? event.compositeScore}，流动性 ${fmtUsd(event.currentLiquidityUsd)}，持有人 ${event.currentHolders || "n/a"}`);
  }
  if (event.sentimentGroup) {
    bits.push(`聪明钱情绪组: ${sentimentNarrative(event)}`);
  }
  if (event.smartWalletProfiles?.length) {
    const topProfiles = event.smartWalletProfiles
      .sort((a, b) => Number(b.reliabilityScore || 0) - Number(a.reliabilityScore || 0))
      .slice(0, 4)
      .map((row) => `${row.profile}:${row.walletAddress.slice(0, 6)}...(${row.reliabilityScore})`);
    bits.push(`画像样本: ${topProfiles.join("，")}`);
  }
  if (event.qualitySummary || event.qualityBonuses?.length) {
    bits.push(`Four.meme 风险: ${event.qualitySummary || "n/a"}；加分项: ${(event.qualityBonuses || []).join(", ") || "n/a"}`);
  }
  if (event.memepumpRiskSummary || event.memepumpRiskBonuses?.length || event.memepumpRiskPenalties?.length) {
    bits.push(`深度风控: ${event.memepumpRiskSummary || "n/a"}；加分项: ${(event.memepumpRiskBonuses || []).join(", ") || "n/a"}；风险项: ${(event.memepumpRiskPenalties || []).join(", ") || "n/a"}`);
  }
  if (event.observeSummary) bits.push(`入场确认: ${event.observeSummary}`);
  bits.push(`成本模型: 不加延迟，买滑 ${buySlippagePct}%，卖滑 ${sellSlippagePct}%，每笔 gas ${fmtUsd(gasUsdPerTx)}。`);
  bits.push(`模拟规则: -25% 止损，+50% 卖 50%，+100% 再卖 30%，尾仓移动止盈。`);
  return bits.join("\n");
}

async function main() {
  console.log(`[monitor] BSC signal + paper monitor started. safeAddresses=${safeTrackedWallets.length}, poll=${pollMs}ms, privateMin=${minPrivateWallets}, privateWindow=${privateWindowMs}ms, okxOfficial=${okxOfficialSignalEnabled ? `on(forward=${okxOfficialForwardEnabled ? "on" : "off"}, localFilters=${okxOfficialApplyLocalFilters ? "on" : "off"})` : "off"}, paper=${fmtUsd(paperSizeUsd)}`);
  while (true) {
    currentOkxWsFrames = consumeOkxWsFrames();
    const tradeMessages = updatePaperTrades();
    const binanceEvents = [
      ...await binanceMemeRushEvents(),
      ...await binanceTopicRushEvents(),
    ];
    const okxOfficialEvents = okxSignalEvents();
    const rawEvents = [
      ...privateSignalEvents(),
      ...memeSignalEvents(),
      ...gmgnSignalEvents(),
      ...binanceEvents,
    ];
    const events = duePendingEvents(combineEvents(rawEvents));
    const skipReasons = new Map();
    const signalMessages = [];
    if (!state.seeded) {
      state.seeded = true;
      console.log(`[monitor] seeded current state at ${new Date().toISOString()}; future matching signals will open paper trades.`);
    } else {
      for (const event of events) {
        const decision = await shouldOpenCompositeTrade(event);
        if (!decision.ok) {
          skipReasons.set(decision.reason, (skipReasons.get(decision.reason) || 0) + 1);
          const skipKey = `skip:${event.token}:${Math.floor(Date.now() / privateWindowMs)}:${decision.reason}`;
          if (uniqPush(state, "alertKeys", skipKey, 2000)) {
            paper.events.push({ type: "paper_skip", at: Date.now(), token: event.token, reason: decision.reason, event });
          }
          continue;
        }
        const observed = observeEntry(event, decision.info, decision);
        if (!observed.ready) {
          skipReasons.set(observed.reason, (skipReasons.get(observed.reason) || 0) + 1);
          const pendingKey = `pending:${event.token}:${Math.floor(Date.now() / entryObserveMinAgeMs)}:${observed.reason}`;
          if (uniqPush(state, "alertKeys", pendingKey, 2000)) {
            paper.events.push({ type: "paper_pending", at: Date.now(), token: event.token, reason: observed.reason, event });
          }
          continue;
        }
        const trade = openPaperTrade(event);
        if (trade) signalMessages.push(eventMessage(event, trade));
      }
    }

    const okxTelegramMessages = okxOfficialForwardEnabled ? okxOfficialEvents.map(telegramOkxSignalMessage) : [];
    if (signalMessages.length || tradeMessages.length || okxTelegramMessages.length) {
      console.log(`\n===== PAPER SIGNAL ${new Date().toISOString()} =====`);
      const message = [...signalMessages, ...tradeMessages, ...okxTelegramMessages].join("\n\n");
      console.log(message);
      console.log("===== END PAPER SIGNAL =====\n");
      const telegramMessages = [];
      if (okxTelegramMessages.length) telegramMessages.push(...okxTelegramMessages);
      if (signalMessages.length) {
        for (const event of events) {
          const trade = paper.open.find((row) => row.token === event.token && Math.abs(Number(row.signalTime || 0) - Number(event.signalTime || 0)) < privateWindowMs);
          if (trade) telegramMessages.push(telegramSignalMessage(event, trade));
        }
      }
      if (tradeMessages.length) telegramMessages.push(...tradeMessages);
      await sendTelegram(telegramMessages.length ? telegramMessages.join("\n\n----------------\n\n") : `BSC paper signal\n\n${message}`);
    } else {
      const openSummary = paper.open.length ? ` open=${paper.open.length}` : "";
      const sourceCounts = rawEvents.reduce((acc, event) => {
        acc[event.source] = (acc[event.source] || 0) + 1;
        return acc;
      }, okxOfficialEvents.length ? { okx_forward: okxOfficialEvents.length } : {});
      const skipSummary = [...skipReasons.entries()].slice(0, 3).map(([reason, count]) => `${count}x ${reason}`).join(" | ");
      const debugSummary = rawEvents.length
        ? ` raw=${rawEvents.length} composite=${events.length} sources=${JSON.stringify(sourceCounts)}${skipSummary ? ` skipped=${skipSummary}` : ""}`
        : "";
      console.log(`[monitor] ${new Date().toISOString()} no new alert${openSummary}${debugSummary}`);
    }
    saveAll();
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

main().catch((error) => {
  console.error("[monitor] fatal", error);
  process.exit(1);
});
