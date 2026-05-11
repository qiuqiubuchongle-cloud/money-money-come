import fs from "node:fs";
import { spawnSync } from "node:child_process";

const pollMs = envNumber("ETH_MEME_POLL_MS", envNumber("POLL_MS", 60_000));
const statePath = process.env.ETH_MEME_STATE_PATH || "data/eth_meme_radar_state.json";
const signalJournalPath = process.env.ETH_SIGNAL_JOURNAL_PATH || "data/eth_meme_signal_journal.ndjson";
const privateAddressesPath = process.env.ETH_PRIVATE_ADDRESSES_PATH
  || process.env.SMART_WALLET_ADDRESSES_PATH
  || "config/server-core-addresses.txt";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.TELEGRAM_CHAT_ID || "";

const okxSignalEnabled = envBool("ETH_OKX_SIGNAL_ENABLED", true);
const okxSignalForwardOnly = envBool("ETH_OKX_SIGNAL_FORWARD_ONLY", false);
const okxSignalWalletTypes = process.env.ETH_OKX_SIGNAL_WALLET_TYPES || "1,2,3";
const okxSignalLimit = envNumber("ETH_OKX_SIGNAL_LIMIT", 50);
const okxSignalMinWallets = envNumber("ETH_OKX_SIGNAL_MIN_WALLETS", 3);
const okxSignalMinAmountUsd = envNumber("ETH_OKX_SIGNAL_MIN_AMOUNT_USD", 1_000);
const okxSignalMaxMarketCapUsd = envNumber("ETH_OKX_SIGNAL_MAX_MARKET_CAP_USD", 5_000_000);
const okxSignalMinLiquidityUsd = envNumber("ETH_OKX_SIGNAL_MIN_LIQUIDITY_USD", 10_000);
const okxSignalMaxSoldRatioPercent = envNumber("ETH_OKX_SIGNAL_MAX_SOLD_RATIO_PERCENT", 70);

const hotTokensEnabled = envBool("ETH_HOT_TOKENS_ENABLED", true);
const hotTokensLimit = envNumber("ETH_HOT_TOKENS_LIMIT", 50);
const hotTokensTimeFrame = String(process.env.ETH_HOT_TOKENS_TIME_FRAME || "1");
const minVolume5mUsd = envNumber("ETH_MEME_MIN_VOLUME_5M_USD", 10_000);
const minTxs5m = envNumber("ETH_MEME_MIN_TXS_5M", 20);
const minVolumeDeltaUsd = envNumber("ETH_MEME_MIN_VOLUME_DELTA_USD", 5_000);
const volumeSpikeMultiplier = envNumber("ETH_MEME_VOLUME_SPIKE_MULTIPLIER", 3);
const maxMemeMarketCapUsd = envNumber("ETH_MEME_MAX_MARKET_CAP_USD", 20_000_000);
const minMemeLiquidityUsd = envNumber("ETH_MEME_MIN_LIQUIDITY_USD", 10_000);
const minMemeHolders = envNumber("ETH_MEME_MIN_HOLDERS", 30);
const maxTop10HolderPercent = envNumber("ETH_MEME_MAX_TOP10_HOLDER_PERCENT", 45);
const lifecycleEarlyMaxMarketCapUsd = envNumber("ETH_LIFECYCLE_EARLY_MAX_MARKET_CAP_USD", 500_000);
const lifecycleLateMinMarketCapUsd = envNumber("ETH_LIFECYCLE_LATE_MIN_MARKET_CAP_USD", 5_000_000);
const lifecycleOverheatPriceChange5mPct = envNumber("ETH_LIFECYCLE_OVERHEAT_PRICE_CHANGE_5M_PCT", 150);
const maxRiskScore = envNumber("ETH_MEME_MAX_RISK_SCORE", 6);
const alertLateSignals = envBool("ETH_MEME_ALERT_LATE_SIGNALS", false);
const tgIncludeDiagnostics = envBool("ETH_TG_INCLUDE_DIAGNOSTICS", false);

const privateTrackerEnabled = envBool("ETH_PRIVATE_TRACKER_ENABLED", false);
const privateWindowMs = envNumber("ETH_PRIVATE_WINDOW_MS", 5 * 60_000);
const privateMinWallets = envNumber("ETH_PRIVATE_MIN_WALLETS", 2);

const confirmWindowMs = envNumber("ETH_MEME_CONFIRM_WINDOW_MS", 15 * 60_000);
const alertCooldownMs = envNumber("ETH_MEME_ALERT_COOLDOWN_MS", 30 * 60_000);
const minCompositeScore = envNumber("ETH_MEME_MIN_COMPOSITE_SCORE", 5);
const tokenInfoCacheMs = envNumber("ETH_TOKEN_INFO_CACHE_MS", 45_000);
const ethRpcUrl = process.env.ETH_RPC_URL || "";
const blockTrackingEnabled = envBool("ETH_BLOCK_TRACKING_ENABLED", Boolean(ethRpcUrl));
const blockCacheMs = envNumber("ETH_BLOCK_CACHE_MS", 12_000);
const ethMemeSelfTest = envBool("ETH_MEME_SELF_TEST", false);
const gasRadarEnabled = envBool("ETH_GAS_RADAR_ENABLED", Boolean(ethRpcUrl));
const gasRadarMinGwei = envNumber("ETH_GAS_RADAR_MIN_GWEI", 20);
const gasRadarSpikeMultiplier = envNumber("ETH_GAS_RADAR_SPIKE_MULTIPLIER", 1.6);
const gasRadarBlocks = envNumber("ETH_GAS_RADAR_BLOCKS", 3);
const gasRadarMinBuys = envNumber("ETH_GAS_RADAR_MIN_BUYS", 5);
const gasRadarMinBuyers = envNumber("ETH_GAS_RADAR_MIN_BUYERS", 3);
const gasRadarCooldownMs = envNumber("ETH_GAS_RADAR_COOLDOWN_MS", 15 * 60_000);
const gasRadarTxLimit = envNumber("ETH_GAS_RADAR_TX_LIMIT", 160);
const gasRadarProtocolAddresses = new Set(String(process.env.ETH_GAS_RADAR_PROTOCOL_ADDRESSES || [
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
  "0xe592427a0aece92de3edee1f18e0157c05861564",
  "0x1111111254eeb25477b68fb85ed929f73a960582",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
  "0x881d40237659c251811cec9c364ef91dc08d300c",
].join(","))
  .split(",")
  .map((row) => row.trim().toLowerCase())
  .filter(Boolean));
const ignoredTokenAddresses = new Set(String(process.env.ETH_GAS_RADAR_IGNORE_TOKENS || [
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "0x6b175474e89094c44da98b954eedeac495271d0f",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  "0x514910771af9ca656af840dff83e8264ecf986ca",
].join(","))
  .split(",")
  .map((row) => row.trim().toLowerCase())
  .filter(Boolean));

let state = loadJson(statePath, {
  seeded: false,
  seenOkxSignalKeys: [],
  seenPrivateTradeKeys: [],
  privateFirstBuyKeys: [],
  privatePendingBuys: {},
  privateSeededAddresses: [],
  seenHotTokenKeys: [],
  alertKeys: [],
  tokenMetrics: {},
  recentSignals: {},
  recentPrivate: {},
  tokenInfoCache: {},
  walletClusters: {},
  blockCache: {},
  txReceiptCache: {},
  gasSamples: [],
  seenGasRadarKeys: [],
});

function envNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return Number(fallback);
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(fallback);
}

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return Boolean(fallback);
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function saveState() {
  fs.mkdirSync("data", { recursive: true });
  state.blockCache = pruneObjectByAge(state.blockCache, 10 * 60_000, 1000);
  state.txReceiptCache = pruneObjectByAge(state.txReceiptCache, 60 * 60_000, 5000);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function appendJournal(events) {
  if (!events.length) return;
  fs.mkdirSync("data", { recursive: true });
  const rows = events.map((event) => JSON.stringify({
    at: new Date().toISOString(),
    token: event.token,
    symbol: event.symbol,
    name: event.name,
    sources: event.sources,
    signalGrade: event.signalGrade,
    lifecycleStage: event.lifecycleStage,
    signalTier: event.signalTier,
    compositeScore: event.compositeScore,
    riskScore: event.riskScore,
    riskReasons: event.riskReasons,
    marketCapUsd: event.marketCapUsd,
    liquidityUsd: event.liquidityUsd,
    holders: event.holders,
    price: event.entryPrice,
    amountUsd: event.amountUsd,
    triggerWalletCount: event.triggerWalletCount,
    triggerWallets: event.triggerWallets,
    routeTxCount: event.routeTxCount,
    gasGwei: event.gasGwei,
    blockNumbers: event.blockNumbers,
    txHashes: event.txHashes,
    buyers: event.buyers,
    cluster: event.cluster,
    blockInfo: event.blockInfo,
    verdict: event.verdict,
  })).join("\n");
  fs.appendFileSync(signalJournalPath, `${rows}\n`);
}

function uniqPush(obj, listName, key, max = 8000) {
  const list = obj[listName] || [];
  if (!key || list.includes(key)) return false;
  list.push(key);
  if (list.length > max) list.splice(0, list.length - max);
  obj[listName] = list;
  return true;
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

function rpc(method, params = [], timeout = 12_000) {
  if (!ethRpcUrl) return { ok: false, error: "missing ETH_RPC_URL" };
  const payload = JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params });
  const run = spawnSync("curl", [
    "-sS",
    "--max-time", String(Math.ceil(timeout / 1000)),
    "-H", "content-type: application/json",
    "--data-binary", payload,
    ethRpcUrl,
  ], { encoding: "utf8", timeout });
  if (run.status !== 0) {
    return { ok: false, error: (run.stderr || run.stdout || run.error?.message || "").trim() };
  }
  try {
    const json = JSON.parse(run.stdout || "{}");
    if (json.error) return { ok: false, error: json.error.message || JSON.stringify(json.error) };
    return { ok: true, data: json.result };
  } catch (error) {
    return { ok: false, error: `rpc parse error: ${error.message}` };
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
      if (run.status !== 0) {
        console.error(`[telegram] ${(run.stderr || run.stdout || "").replaceAll(telegramBotToken, "<hidden>")}`);
      }
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

function addCliFilter(args, flag, value) {
  if (value === undefined || value === null || value === "") return;
  args.push(flag, String(value));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.list)) return value.list;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data?.list)) return value.data.list;
  return [];
}

function toMs(value) {
  const n = Number(value || Date.now());
  if (!Number.isFinite(n)) return Date.now();
  return n < 10_000_000_000 ? n * 1000 : n;
}

function optionalNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function metricNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function hexToNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = String(value);
  const n = text.startsWith("0x") ? Number.parseInt(text, 16) : Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function fmtUsd(value) {
  if (value === undefined || value === null || value === "") return "n/a";
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
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
  return n.toExponential(6);
}

function fmtPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtWindow(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "n/a";
  if (n < 60_000) return `${Math.round(n / 1000)}s`;
  if (n < 3_600_000) return `${Math.round(n / 60_000)}m`;
  return `${(n / 3_600_000).toFixed(1)}h`;
}

function weiHexToGwei(value) {
  const n = hexToNumber(value);
  return n === undefined ? undefined : n / 1e9;
}

function topicAddress(topic) {
  const text = String(topic || "").toLowerCase();
  if (!text.startsWith("0x") || text.length < 66) return "";
  return `0x${text.slice(-40)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function walletTypeLabel(value) {
  const text = String(value ?? "");
  return {
    "1": "Smart Money",
    "2": "KOL / Influencer",
    "3": "Whale",
  }[text] || text || "n/a";
}

function tokenKey(token) {
  return String(token || "").toLowerCase();
}

function firstPrivateBuyKey(trade) {
  return `${String(trade.walletAddress || "").toLowerCase()}:${tokenKey(trade.token)}`;
}

function txBlockInfo(txHash) {
  if (!blockTrackingEnabled || !txHash) return null;
  const hash = String(txHash).toLowerCase();
  const cached = state.txReceiptCache?.[hash];
  if (cached?.info && Date.now() - Number(cached.at || 0) < blockCacheMs) return cached.info;

  let receiptData = cached?.receipt;
  if (!receiptData) {
    const receipt = rpc("eth_getTransactionReceipt", [hash]);
    if (!receipt.ok || !receipt.data) return null;
    receiptData = receipt.data;
  }
  const blockNumber = hexToNumber(receiptData.blockNumber);
  if (!blockNumber) return null;

  state.blockCache = state.blockCache || {};
  const blockKey = String(blockNumber);
  let block = state.blockCache[blockKey];
  if (!block || Date.now() - Number(block.at || 0) > blockCacheMs) {
    const blockResp = rpc("eth_getBlockByNumber", [receiptData.blockNumber, false]);
    if (blockResp.ok && blockResp.data) {
      block = {
        at: Date.now(),
        number: blockNumber,
        timestamp: hexToNumber(blockResp.data.timestamp) * 1000,
        txCount: Array.isArray(blockResp.data.transactions) ? blockResp.data.transactions.length : 0,
      };
      state.blockCache[blockKey] = block;
    }
  }

  const info = {
    blockNumber,
    blockTimestamp: block?.timestamp,
    blockTxCount: block?.txCount,
    txIndex: hexToNumber(receiptData.transactionIndex),
    gasUsed: hexToNumber(receiptData.gasUsed),
  };
  state.txReceiptCache = state.txReceiptCache || {};
  state.txReceiptCache[hash] = { at: Date.now(), receipt: receiptData, info };
  return info;
}

function pruneObjectByAge(obj, maxAgeMs, maxEntries = 1000) {
  const now = Date.now();
  const entries = Object.entries(obj || {})
    .filter(([, value]) => now - Number(value?.at || 0) <= maxAgeMs)
    .slice(-maxEntries);
  return Object.fromEntries(entries);
}

function normalizeOkxSignalRows(rows) {
  return rows.map((row) => {
    const token = row.token || {};
    const tokenAddress = token.tokenAddress || row.tokenAddress || row.tokenContractAddress || row.address;
    const triggerWallets = String(row.triggerWalletAddress || row.walletAddress || "")
      .split(",")
      .map((wallet) => wallet.trim().toLowerCase())
      .filter(Boolean);
    return {
      source: "okx_signal",
      token: tokenKey(tokenAddress),
      symbol: token.symbol || row.symbol || token.name || "UNKNOWN",
      name: token.name || row.name || token.symbol || "UNKNOWN",
      signalTime: toMs(row.timestamp || row.signalTime || row.time || Date.now()),
      triggerWalletCount: Number(row.triggerWalletCount || row.addressCount || row.walletCount || triggerWallets.length || 0),
      triggerWallets,
      walletType: row.walletType,
      walletTypeLabel: walletTypeLabel(row.walletType),
      amountUsd: Number(row.amountUsd || row.volumeUsd || row.amount || 0),
      soldRatioPercent: Number(row.soldRatioPercent || 0),
      holders: optionalNumber(token.holders, row.holders),
      top10HolderPercent: optionalNumber(token.top10HolderPercent, row.top10HolderPercent),
      marketCapUsd: optionalNumber(token.marketCapUsd, row.marketCapUsd, row.marketCap),
      liquidityUsd: optionalNumber(token.liquidityUsd, row.liquidityUsd, row.liquidity),
      entryPrice: optionalNumber(row.price, token.price, token.priceUsd),
      raw: row,
    };
  }).filter((event) => event.token);
}

function okxSignalEvents() {
  if (!okxSignalEnabled) return [];
  const args = ["signal", "list", "--chain", "ethereum", "--limit", String(okxSignalLimit)];
  addCliFilter(args, "--wallet-type", okxSignalWalletTypes);
  addCliFilter(args, "--min-address-count", okxSignalMinWallets);
  addCliFilter(args, "--min-amount-usd", okxSignalMinAmountUsd);
  addCliFilter(args, "--max-market-cap-usd", okxSignalMaxMarketCapUsd);
  addCliFilter(args, "--min-liquidity-usd", okxSignalMinLiquidityUsd);

  const j = runJson(args);
  if (!j.ok) {
    console.error(`[eth-okx-signal] ${j.error || "unknown onchainos error"}`);
    return [];
  }
  const rows = asArray(j.data);
  const events = [];
  for (const event of normalizeOkxSignalRows(rows)) {
    const raw = event.raw || {};
    const stableId = raw.cursor || raw.id || raw.signalId || raw.eventId || raw.timestamp || raw.signalTime || raw.time
      || `${event.token}:${event.walletType}:${event.triggerWalletCount}:${event.amountUsd}:${event.entryPrice}:${event.marketCapUsd}`;
    const seenKey = `${stableId}:${raw.walletType ?? event.walletType}:${raw.token?.tokenAddress || event.token}`;
    if (!state.seeded) {
      uniqPush(state, "seenOkxSignalKeys", seenKey);
      rememberRecent("recentSignals", event);
      continue;
    }
    if (!uniqPush(state, "seenOkxSignalKeys", seenKey)) continue;
    if (Number(event.soldRatioPercent || 0) > okxSignalMaxSoldRatioPercent) continue;
    rememberRecent("recentSignals", event);
    events.push(event);
  }
  return events;
}

function readPrivateAddresses() {
  if (!privateTrackerEnabled) return [];
  try {
    return fs.readFileSync(privateAddressesPath, "utf8")
      .split(/\s+/)
      .map((row) => row.trim().toLowerCase())
      .filter((row) => /^0x[a-f0-9]{40}$/.test(row));
  } catch {
    return [];
  }
}

function normalizePrivateTrades(rows) {
  return rows.map((row) => {
    const token = row.tokenContractAddress || row.tokenAddress || row.token?.tokenAddress || row.baseAddress || row.base_address || row.address;
    const wallet = row.walletAddress || row.trader || row.maker || row.wallet;
    const tradeType = row.tradeType || row.side || row.type;
    return {
      token: tokenKey(token),
      symbol: row.tokenSymbol || row.symbol || row.token?.symbol || "UNKNOWN",
      name: row.tokenName || row.token?.name || row.tokenSymbol || row.symbol || "UNKNOWN",
      walletAddress: String(wallet || "").toLowerCase(),
      txHash: row.txHash || row.hash || row.transactionHash || row.transaction_hash,
      tradeType: String(tradeType).toLowerCase() === "buy" ? "1" : String(tradeType),
      signalTime: toMs(row.tradeTime || row.timestamp || row.time || Date.now()),
      entryPrice: optionalNumber(row.tokenPrice, row.price, row.priceUsd),
      marketCapUsd: optionalNumber(row.marketCap, row.marketCapUsd),
      raw: row,
    };
  }).filter((row) => row.token && row.walletAddress && String(row.tradeType) === "1");
}

function privatePoolEvents() {
  const addresses = readPrivateAddresses();
  if (!addresses.length) return [];
  const now = Date.now();
  const seededAddresses = new Set((state.privateSeededAddresses || []).map((address) => String(address).toLowerCase()));
  const unseededAddresses = new Set(addresses.filter((address) => !seededAddresses.has(address)));
  const knownFirstBuys = new Set(state.privateFirstBuyKeys || []);
  const trades = [];
  for (let i = 0; i < addresses.length; i += 20) {
    const chunk = addresses.slice(i, i + 20);
    const j = runJson([
      "tracker", "activities",
      "--tracker-type", "multi_address",
      "--wallet-address", chunk.join(","),
      "--chain", "ethereum",
      "--trade-type", "1",
    ]);
    if (!j.ok) {
      console.error(`[eth-private-tracker] ${j.error || "unknown onchainos error"}`);
      continue;
    }
    trades.push(...normalizePrivateTrades(asArray(j.data?.trades || j.data)));
  }

  for (const trade of trades) {
    const key = `${trade.txHash}:${trade.walletAddress}:${trade.token}:${trade.tradeType}`;
    uniqPush(state, "seenPrivateTradeKeys", key);
  }
  for (const trade of trades) {
    const firstKey = firstPrivateBuyKey(trade);
    if (!firstKey.includes(":")) continue;
    const isUnseededAddress = unseededAddresses.has(String(trade.walletAddress || "").toLowerCase());
    const isStaleTrade = now - Number(trade.signalTime || 0) > privateWindowMs;
    if (isUnseededAddress || !state.seeded || isStaleTrade) {
      if (!knownFirstBuys.has(firstKey)) {
        uniqPush(state, "privateFirstBuyKeys", firstKey, 50_000);
        knownFirstBuys.add(firstKey);
      }
    }
  }
  if (unseededAddresses.size) {
    state.privateSeededAddresses = [...new Set([
      ...(state.privateSeededAddresses || []).map((address) => String(address).toLowerCase()),
      ...unseededAddresses,
    ])].slice(-5000);
  }
  if (!state.seeded) return [];

  state.privatePendingBuys = state.privatePendingBuys || {};
  const freshFirstBuysByToken = new Map();
  for (const trade of trades) {
    if (now - Number(trade.signalTime || 0) > privateWindowMs) continue;
    if (unseededAddresses.has(String(trade.walletAddress || "").toLowerCase())) continue;
    const firstKey = firstPrivateBuyKey(trade);
    if (knownFirstBuys.has(firstKey)) continue;
    uniqPush(state, "privateFirstBuyKeys", firstKey, 50_000);
    knownFirstBuys.add(firstKey);
    const pending = state.privatePendingBuys[trade.token] || [];
    pending.push({
      walletAddress: trade.walletAddress,
      token: trade.token,
      symbol: trade.symbol,
      name: trade.name,
      signalTime: trade.signalTime,
      entryPrice: trade.entryPrice,
      marketCapUsd: trade.marketCapUsd,
      txHash: trade.txHash,
    });
    state.privatePendingBuys[trade.token] = pending;
    freshFirstBuysByToken.set(trade.token, true);
  }

  const events = [];
  for (const [token, pending] of Object.entries(state.privatePendingBuys || {})) {
    const freshRows = pending
      .filter((row) => now - Number(row.signalTime || 0) <= privateWindowMs)
      .sort((a, b) => Number(a.signalTime || 0) - Number(b.signalTime || 0));
    if (freshRows.length) {
      const latestByWallet = new Map();
      for (const row of freshRows) latestByWallet.set(String(row.walletAddress || "").toLowerCase(), row);
      state.privatePendingBuys[token] = [...latestByWallet.values()];
    } else {
      delete state.privatePendingBuys[token];
      continue;
    }
    if (!freshFirstBuysByToken.has(token)) continue;

    const rows = state.privatePendingBuys[token];
    const triggerWallets = [...new Set(rows.map((row) => String(row.walletAddress || "").toLowerCase()).filter(Boolean))];
    if (triggerWallets.length < privateMinWallets) continue;

    const firstSignalTime = Math.min(...rows.map((row) => Number(row.signalTime || now)));
    const latestSignalTime = Math.max(...rows.map((row) => Number(row.signalTime || now)));
    const sample = rows[rows.length - 1] || {};
    const key = `eth-private:${token}:${Math.floor(firstSignalTime / privateWindowMs)}`;
    if (!uniqPush(state, "alertKeys", key)) continue;
    const event = {
      source: "private_pool",
      token,
      symbol: sample.symbol || "UNKNOWN",
      name: sample.name || sample.symbol || "UNKNOWN",
      signalTime: latestSignalTime,
      firstSignalTime,
      triggerWalletCount: triggerWallets.length,
      triggerWallets,
      tradeCount: rows.length,
      entryPrice: sample.entryPrice,
      marketCapUsd: sample.marketCapUsd,
      privateWindowMs,
      firstTxHash: sample.txHash,
      blockInfo: txBlockInfo(sample.txHash),
    };
    rememberWalletCluster(token, triggerWallets, latestSignalTime);
    rememberRecent("recentPrivate", event);
    events.push(event);
  }
  return events;
}

function clusterKey(a, b) {
  return [String(a).toLowerCase(), String(b).toLowerCase()].sort().join("|");
}

function rememberWalletCluster(token, wallets, signalTime) {
  const clean = [...new Set((wallets || []).map((wallet) => String(wallet).toLowerCase()).filter(Boolean))];
  if (clean.length < 2) return;
  state.walletClusters = state.walletClusters || {};
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      const key = clusterKey(clean[i], clean[j]);
      const row = state.walletClusters[key] || { wallets: [clean[i], clean[j]], coBuyCount: 0, tokens: [], lastSeen: 0 };
      row.coBuyCount += 1;
      row.lastSeen = Math.max(Number(row.lastSeen || 0), Number(signalTime || Date.now()));
      row.tokens = [...new Set([...(row.tokens || []), tokenKey(token)])].slice(-20);
      state.walletClusters[key] = row;
    }
  }
}

function walletClusterStats(wallets) {
  const clean = [...new Set((wallets || []).map((wallet) => String(wallet).toLowerCase()).filter(Boolean))];
  if (clean.length < 2) return { pairCount: 0, knownPairCount: 0, totalCoBuys: 0, clusterScore: 0 };
  let pairCount = 0;
  let knownPairCount = 0;
  let totalCoBuys = 0;
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      pairCount += 1;
      const row = state.walletClusters?.[clusterKey(clean[i], clean[j])];
      if (!row) continue;
      knownPairCount += 1;
      totalCoBuys += Number(row.coBuyCount || 0);
    }
  }
  const density = pairCount ? knownPairCount / pairCount : 0;
  const repeatStrength = Math.min(3, totalCoBuys / Math.max(1, pairCount));
  return {
    pairCount,
    knownPairCount,
    totalCoBuys,
    clusterScore: Number((density * 3 + repeatStrength).toFixed(2)),
  };
}

function tokenPriceInfo(token) {
  const key = tokenKey(token);
  const cached = state.tokenInfoCache?.[key];
  if (cached && Date.now() - Number(cached.at || 0) < tokenInfoCacheMs) return cached.info;
  const j = runJson(["token", "price-info", "--address", key, "--chain", "ethereum"], 18_000);
  if (!j.ok) return null;
  const data = Array.isArray(j.data) ? j.data[0] : j.data;
  if (!data || typeof data !== "object") return null;
  const info = {
    price: Number(data.price || data.tokenPrice || 0),
    marketCapUsd: Number(data.marketCap || data.marketCapUsd || 0),
    liquidityUsd: Number(data.liquidity || 0),
    holders: Number(data.holders || 0),
    volume5mUsd: Number(data.volume5M || data.volume5m || 0),
    txs5m: Number(data.txs5M || data.txs5m || 0),
    volume1hUsd: Number(data.volume1H || data.volume1h || 0),
    txs1h: Number(data.txs1H || data.txs1h || 0),
    priceChange5mPct: Number(data.priceChange5M || data.priceChange5m || 0),
    priceChange1hPct: Number(data.priceChange1H || data.priceChange1h || 0),
    time: Number(data.time || Date.now()),
    raw: data,
  };
  state.tokenInfoCache = state.tokenInfoCache || {};
  state.tokenInfoCache[key] = { at: Date.now(), info };
  return info;
}

function normalizeHotTokenRows(rows) {
  return rows.map((row) => ({
    source: "hot_token",
    token: tokenKey(row.tokenContractAddress || row.tokenAddress || row.address || row.token?.tokenAddress),
    symbol: row.tokenSymbol || row.symbol || row.token?.symbol || "UNKNOWN",
    name: row.tokenName || row.name || row.tokenSymbol || row.symbol || "UNKNOWN",
    signalTime: Date.now(),
    entryPrice: optionalNumber(row.price, row.tokenPrice),
    marketCapUsd: optionalNumber(row.marketCap, row.marketCapUsd),
    liquidityUsd: optionalNumber(row.liquidity, row.liquidityUsd),
    holders: optionalNumber(row.holders, row.holderCount),
    hotVolumeUsd: optionalNumber(row.volume, row.volumeUsd),
    hotTxs: optionalNumber(row.txs, row.tradeNum),
    uniqueTraders: optionalNumber(row.uniqueTraders),
    inflowUsd: optionalNumber(row.inflowUsd),
    priceChangePct: optionalNumber(row.change),
    top10HolderPercent: optionalNumber(row.top10HoldPercent, row.top10HolderPercent),
    riskLevel: row.riskLevelControl || row.riskControlLevel || "",
    raw: row,
  })).filter((event) => event.token);
}

function hotTokenEvents() {
  if (!hotTokensEnabled) return [];
  const args = [
    "token", "hot-tokens",
    "--chain", "ethereum",
    "--ranking-type", "4",
    "--rank-by", "5",
    "--time-frame", hotTokensTimeFrame,
    "--limit", String(hotTokensLimit),
    "--risk-filter", "true",
    "--stable-token-filter", "true",
  ];
  const j = runJson(args);
  if (!j.ok) {
    console.error(`[eth-hot-tokens] ${j.error || "unknown onchainos error"}`);
    return [];
  }

  const events = [];
  for (const row of normalizeHotTokenRows(asArray(j.data))) {
    const info = tokenPriceInfo(row.token) || {};
    const event = {
      ...row,
      entryPrice: info.price || row.entryPrice,
      marketCapUsd: info.marketCapUsd || row.marketCapUsd,
      liquidityUsd: info.liquidityUsd || row.liquidityUsd,
      holders: info.holders || row.holders,
      volume5mUsd: info.volume5mUsd || row.hotVolumeUsd || 0,
      txs5m: info.txs5m || row.hotTxs || 0,
      volume1hUsd: info.volume1hUsd || 0,
      txs1h: info.txs1h || 0,
      priceChange5mPct: info.priceChange5mPct,
      priceChange1hPct: info.priceChange1hPct,
    };
    const previous = state.tokenMetrics?.[event.token];
    const previousVolume = Number(previous?.volume5mUsd || 0);
    const volume5m = Number(event.volume5mUsd || 0);
    const txs5m = Number(event.txs5m || 0);
    const spikeRatio = previousVolume > 0 ? volume5m / previousVolume : 0;
    const volumeDelta = previousVolume > 0 ? volume5m - previousVolume : volume5m;
    state.tokenMetrics = state.tokenMetrics || {};
    state.tokenMetrics[event.token] = {
      at: Date.now(),
      symbol: event.symbol,
      volume5mUsd: volume5m,
      txs5m,
      marketCapUsd: Number(event.marketCapUsd || 0),
      liquidityUsd: Number(event.liquidityUsd || 0),
      holders: Number(event.holders || 0),
    };

    const firstSeen = !previous;
    const enoughMarket = !event.marketCapUsd || Number(event.marketCapUsd) <= maxMemeMarketCapUsd;
    const enoughLiquidity = Number(event.liquidityUsd || 0) >= minMemeLiquidityUsd;
    const enoughHolders = Number(event.holders || 0) >= minMemeHolders;
    const absoluteHot = volume5m >= minVolume5mUsd && txs5m >= minTxs5m;
    const relativeHot = spikeRatio >= volumeSpikeMultiplier && volumeDelta >= minVolumeDeltaUsd;
    if (!state.seeded) {
      const seenKey = `eth-hot:${event.token}:${Math.floor(Date.now() / pollMs)}`;
      uniqPush(state, "seenHotTokenKeys", seenKey);
      continue;
    }
    if (!enoughMarket || !enoughLiquidity || !enoughHolders || !absoluteHot) continue;
    if (!firstSeen && !relativeHot) continue;
    const seenKey = `eth-hot:${event.token}:${Math.floor(Date.now() / confirmWindowMs)}`;
    if (!uniqPush(state, "seenHotTokenKeys", seenKey)) continue;
    events.push({
      ...event,
      source: "volume_spike",
      volumeSpikeRatio: spikeRatio,
      volumeDeltaUsd: volumeDelta,
    });
  }
  return events;
}

function currentGasGwei() {
  const resp = rpc("eth_gasPrice", [], 8_000);
  if (!resp.ok) {
    console.error(`[eth-gas-radar] gasPrice ${resp.error || "unknown rpc error"}`);
    return undefined;
  }
  return weiHexToGwei(resp.data);
}

function gasIsHot(gasGwei) {
  if (!Number.isFinite(gasGwei)) return false;
  state.gasSamples = Array.isArray(state.gasSamples) ? state.gasSamples : [];
  const now = Date.now();
  const recent = state.gasSamples.filter((row) => now - Number(row.at || 0) <= 30 * 60_000).slice(-60);
  const avg = recent.length
    ? recent.reduce((sum, row) => sum + Number(row.gwei || 0), 0) / recent.length
    : gasGwei;
  state.gasSamples = [...recent, { at: now, gwei: gasGwei }].slice(-90);
  return gasGwei >= gasRadarMinGwei || (avg > 0 && gasGwei >= avg * gasRadarSpikeMultiplier);
}

function txReceipt(txHash) {
  if (!txHash) return null;
  const hash = String(txHash).toLowerCase();
  const cached = state.txReceiptCache?.[hash];
  if (cached && Date.now() - Number(cached.at || 0) < 10 * 60_000) return cached.receipt || cached.info || null;
  const receipt = rpc("eth_getTransactionReceipt", [hash], 10_000);
  if (!receipt.ok || !receipt.data) return null;
  state.txReceiptCache = state.txReceiptCache || {};
  state.txReceiptCache[hash] = { at: Date.now(), receipt: receipt.data };
  return receipt.data;
}

function blockWithTransactions(blockNumber) {
  const hex = `0x${Number(blockNumber).toString(16)}`;
  const resp = rpc("eth_getBlockByNumber", [hex, true], 12_000);
  if (!resp.ok || !resp.data) return null;
  return resp.data;
}

function gasRadarEvents() {
  if (!gasRadarEnabled || !ethRpcUrl) return [];
  const gasGwei = currentGasGwei();
  if (!gasIsHot(gasGwei)) return [];

  const blockResp = rpc("eth_blockNumber", [], 8_000);
  const latest = hexToNumber(blockResp.data);
  if (!blockResp.ok || !latest) return [];

  const stats = new Map();
  let scannedTx = 0;
  for (let blockNumber = latest - 1; blockNumber >= Math.max(0, latest - gasRadarBlocks); blockNumber -= 1) {
    const block = blockWithTransactions(blockNumber);
    const txs = Array.isArray(block?.transactions) ? block.transactions : [];
    for (const tx of txs) {
      if (scannedTx >= gasRadarTxLimit) break;
      const to = String(tx.to || "").toLowerCase();
      if (!gasRadarProtocolAddresses.has(to)) continue;
      scannedTx += 1;
      const receipt = txReceipt(tx.hash);
      if (!receipt || String(receipt.status || "0x1") === "0x0") continue;
      const user = String(tx.from || "").toLowerCase();
      for (const log of receipt.logs || []) {
        const topics = Array.isArray(log.topics) ? log.topics : [];
        if (String(topics[0] || "").toLowerCase() !== "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") continue;
        const token = tokenKey(log.address);
        if (!token || ignoredTokenAddresses.has(token)) continue;
        const toAddress = topicAddress(topics[2]);
        if (toAddress && toAddress !== user) continue;
        const row = stats.get(token) || {
          source: "gas_radar",
          token,
          signalTime: Date.now(),
          gasGwei,
          routeTxCount: 0,
          buyers: new Set(),
          txHashes: new Set(),
          blockNumbers: new Set(),
        };
        row.routeTxCount += 1;
        row.buyers.add(user);
        row.txHashes.add(String(tx.hash || "").toLowerCase());
        row.blockNumbers.add(blockNumber);
        stats.set(token, row);
      }
    }
    if (scannedTx >= gasRadarTxLimit) break;
  }

  const events = [];
  for (const row of stats.values()) {
    const buyerCount = row.buyers.size;
    if (row.routeTxCount < gasRadarMinBuys || buyerCount < gasRadarMinBuyers) continue;
    const seenKey = `eth-gas:${row.token}:${Math.floor(Date.now() / gasRadarCooldownMs)}`;
    if (!state.seeded) {
      uniqPush(state, "seenGasRadarKeys", seenKey, 5000);
      continue;
    }
    if (!uniqPush(state, "seenGasRadarKeys", seenKey, 5000)) continue;
    const info = tokenPriceInfo(row.token) || {};
    events.push({
      ...row,
      buyers: [...row.buyers],
      txHashes: [...row.txHashes].slice(0, 5),
      blockNumbers: [...row.blockNumbers],
      triggerWalletCount: buyerCount,
      triggerWallets: [...row.buyers],
      symbol: info.raw?.symbol || "UNKNOWN",
      name: info.raw?.name || info.raw?.symbol || "UNKNOWN",
      entryPrice: info.price,
      marketCapUsd: info.marketCapUsd,
      liquidityUsd: info.liquidityUsd,
      holders: info.holders,
      volume5mUsd: info.volume5mUsd,
      txs5m: info.txs5m,
      priceChange5mPct: info.priceChange5mPct,
      priceChange1hPct: info.priceChange1hPct,
    });
  }
  return events;
}

function rememberRecent(bucket, event) {
  const token = tokenKey(event.token);
  if (!token) return;
  state[bucket] = state[bucket] || {};
  const list = Array.isArray(state[bucket][token]) ? state[bucket][token] : [];
  list.push({
    ...event,
    triggerWallets: Array.isArray(event.triggerWallets) ? event.triggerWallets : [],
    raw: undefined,
  });
  const cutoff = Date.now() - confirmWindowMs;
  state[bucket][token] = list.filter((row) => Number(row.signalTime || 0) >= cutoff).slice(-10);
}

function enrichWithRecent(event) {
  const token = tokenKey(event.token);
  const cutoff = Date.now() - confirmWindowMs;
  const recentSignals = (state.recentSignals?.[token] || []).filter((row) => Number(row.signalTime || 0) >= cutoff);
  const recentPrivate = (state.recentPrivate?.[token] || []).filter((row) => Number(row.signalTime || 0) >= cutoff);
  return { ...event, recentSignals, recentPrivate };
}

function combineEvents(events) {
  const byToken = new Map();
  for (const rawEvent of events.map(enrichWithRecent)) {
    const token = tokenKey(rawEvent.token);
    if (!token) continue;
    const item = byToken.get(token) || {
      token,
      symbol: rawEvent.symbol,
      name: rawEvent.name,
      signalTime: Number(rawEvent.signalTime || Date.now()),
      sources: new Set(),
      sourceEvents: [],
      triggerWallets: new Set(),
      triggerWalletCount: 0,
      amountUsd: 0,
    };
    item.sources.add(rawEvent.source);
    item.sourceEvents.push(rawEvent);
    item.symbol = item.symbol || rawEvent.symbol;
    item.name = item.name || rawEvent.name;
    item.signalTime = Math.max(item.signalTime, Number(rawEvent.signalTime || 0));
    item.entryPrice = rawEvent.entryPrice || item.entryPrice;
    item.marketCapUsd = rawEvent.marketCapUsd || item.marketCapUsd;
    item.liquidityUsd = rawEvent.liquidityUsd || item.liquidityUsd;
    item.holders = rawEvent.holders || item.holders;
    item.top10HolderPercent = rawEvent.top10HolderPercent || item.top10HolderPercent;
    item.blockInfo = rawEvent.blockInfo || item.blockInfo;
    item.volume5mUsd = Math.max(Number(item.volume5mUsd || 0), Number(rawEvent.volume5mUsd || 0));
    item.txs5m = Math.max(Number(item.txs5m || 0), Number(rawEvent.txs5m || 0));
    item.volume1hUsd = Math.max(Number(item.volume1hUsd || 0), Number(rawEvent.volume1hUsd || 0));
    item.txs1h = Math.max(Number(item.txs1h || 0), Number(rawEvent.txs1h || 0));
    item.volumeSpikeRatio = Math.max(Number(item.volumeSpikeRatio || 0), Number(rawEvent.volumeSpikeRatio || 0));
    item.volumeDeltaUsd = Math.max(Number(item.volumeDeltaUsd || 0), Number(rawEvent.volumeDeltaUsd || 0));
    item.routeTxCount = Math.max(Number(item.routeTxCount || 0), Number(rawEvent.routeTxCount || 0));
    item.gasGwei = Math.max(Number(item.gasGwei || 0), Number(rawEvent.gasGwei || 0));
    item.blockNumbers = [...new Set([...(item.blockNumbers || []), ...(rawEvent.blockNumbers || [])])];
    item.txHashes = [...new Set([...(item.txHashes || []), ...(rawEvent.txHashes || [])])].slice(0, 10);
    item.buyers = [...new Set([...(item.buyers || []), ...(rawEvent.buyers || [])])].slice(0, 50);
    item.amountUsd += Number(rawEvent.amountUsd || 0);
    item.soldRatioPercent = rawEvent.soldRatioPercent ?? item.soldRatioPercent;
    item.walletTypeLabel = rawEvent.walletTypeLabel || item.walletTypeLabel;
    item.triggerWalletCount = Math.max(Number(item.triggerWalletCount || 0), Number(rawEvent.triggerWalletCount || 0));
    for (const wallet of rawEvent.triggerWallets || []) item.triggerWallets.add(wallet);
    for (const signal of rawEvent.recentSignals || []) {
      item.sources.add("okx_signal");
      item.sourceEvents.push(signal);
      item.triggerWalletCount = Math.max(Number(item.triggerWalletCount || 0), Number(signal.triggerWalletCount || 0));
      item.amountUsd += Number(signal.amountUsd || 0);
      item.walletTypeLabel = signal.walletTypeLabel || item.walletTypeLabel;
      for (const wallet of signal.triggerWallets || []) item.triggerWallets.add(wallet);
    }
    for (const privateEvent of rawEvent.recentPrivate || []) {
      item.sources.add("private_pool");
      item.sourceEvents.push(privateEvent);
      item.triggerWalletCount = Math.max(Number(item.triggerWalletCount || 0), Number(privateEvent.triggerWalletCount || 0));
      for (const wallet of privateEvent.triggerWallets || []) item.triggerWallets.add(wallet);
    }
    byToken.set(token, item);
  }

  return [...byToken.values()].map((item) => {
    const sources = [...item.sources];
    const info = tokenPriceInfo(item.token);
    if (info) {
      item.entryPrice = info.price || item.entryPrice;
      item.marketCapUsd = info.marketCapUsd || item.marketCapUsd;
      item.liquidityUsd = info.liquidityUsd || item.liquidityUsd;
      item.holders = info.holders || item.holders;
      item.volume5mUsd = Math.max(Number(item.volume5mUsd || 0), Number(info.volume5mUsd || 0));
      item.txs5m = Math.max(Number(item.txs5m || 0), Number(info.txs5m || 0));
      item.volume1hUsd = Math.max(Number(item.volume1hUsd || 0), Number(info.volume1hUsd || 0));
      item.txs1h = Math.max(Number(item.txs1h || 0), Number(info.txs1h || 0));
      item.priceChange5mPct = info.priceChange5mPct;
      item.priceChange1hPct = info.priceChange1hPct;
    }
    const triggerWallets = [...item.triggerWallets];
    const cluster = walletClusterStats(triggerWallets);
    const staged = {
      ...item,
      sources,
      triggerWallets,
      cluster,
    };
    staged.lifecycleStage = lifecycleStage(staged);
    const risk = riskScore(staged);
    staged.riskScore = risk.score;
    staged.riskReasons = risk.reasons;
    staged.compositeScore = compositeScore(staged, sources);
    staged.signalTier = staged.compositeScore >= minCompositeScore + 2 ? "strong" : "observe";
    staged.signalGrade = signalGrade(staged);
    staged.verdict = verdict(staged);
    return {
      ...staged,
    };
  });
}

function compositeScore(event, sources) {
  let score = 0;
  const triggerCount = Number(event.triggerWalletCount || 0);
  const amountUsd = Number(event.amountUsd || 0);
  const volume5m = Number(event.volume5mUsd || 0);
  const txs5m = Number(event.txs5m || 0);
  const liquidity = Number(event.liquidityUsd || 0);
  const holders = Number(event.holders || 0);
  const mc = Number(event.marketCapUsd || 0);
  if (sources.includes("okx_signal")) score += 2;
  if (sources.includes("volume_spike")) score += 2;
  if (sources.includes("private_pool")) score += 2;
  if (sources.includes("gas_radar")) score += 3;
  if (event.lifecycleStage === "early") score += 1;
  if (event.lifecycleStage === "confirming") score += 1;
  if (event.lifecycleStage === "late") score -= 2;
  if (event.lifecycleStage === "overheated") score -= 2;
  if (Number(event.cluster?.clusterScore || 0) >= 2) score += 1;
  if (triggerCount >= okxSignalMinWallets) score += 2;
  if (triggerCount >= okxSignalMinWallets + 3) score += 1;
  if (amountUsd >= okxSignalMinAmountUsd) score += 1;
  if (amountUsd >= okxSignalMinAmountUsd * 5) score += 1;
  if (volume5m >= minVolume5mUsd) score += 1;
  if (volume5m >= minVolume5mUsd * 3) score += 1;
  if (txs5m >= minTxs5m) score += 1;
  if (Number(event.routeTxCount || 0) >= gasRadarMinBuys) score += 1;
  if (Number(event.triggerWalletCount || 0) >= gasRadarMinBuyers) score += 1;
  if (liquidity >= minMemeLiquidityUsd) score += 1;
  if (holders >= minMemeHolders) score += 1;
  if (mc && mc > maxMemeMarketCapUsd) score -= 2;
  if (liquidity && liquidity < minMemeLiquidityUsd) score -= 2;
  if (Number(event.riskScore || 0) >= 4) score -= 2;
  if (Number(event.soldRatioPercent || 0) > okxSignalMaxSoldRatioPercent) score -= 2;
  return score;
}

function lifecycleStage(event) {
  const mc = metricNumber(event.marketCapUsd);
  const holders = metricNumber(event.holders);
  const liquidity = metricNumber(event.liquidityUsd);
  const volume5m = metricNumber(event.volume5mUsd);
  const txs5m = metricNumber(event.txs5m);
  const priceChange5m = metricNumber(event.priceChange5mPct) || 0;
  const priceChange1h = metricNumber(event.priceChange1hPct) || 0;

  if (priceChange5m >= lifecycleOverheatPriceChange5mPct || priceChange1h >= lifecycleOverheatPriceChange5mPct * 2) {
    return "overheated";
  }
  if (mc && mc >= lifecycleLateMinMarketCapUsd) return "late";
  if (
    (!mc || mc <= lifecycleEarlyMaxMarketCapUsd)
    && (holders === undefined || holders >= minMemeHolders)
    && (liquidity === undefined || liquidity >= minMemeLiquidityUsd)
    && ((volume5m !== undefined && volume5m >= minVolume5mUsd) || (txs5m !== undefined && txs5m >= minTxs5m))
  ) return "early";
  if ((volume5m !== undefined && volume5m >= minVolume5mUsd) && (txs5m === undefined || txs5m >= minTxs5m)) return "confirming";
  if ((holders !== undefined && holders < minMemeHolders) || (liquidity !== undefined && liquidity < minMemeLiquidityUsd)) return "thin";
  return "unknown";
}

function stageLabel(stage) {
  return {
    early: "早期起量",
    confirming: "确认放量",
    late: "偏后排",
    overheated: "过热",
    thin: "流动性薄",
    unknown: "待确认",
  }[stage] || "待确认";
}

function riskScore(event) {
  let score = 0;
  const reasons = [];
  const liquidity = metricNumber(event.liquidityUsd);
  const holders = metricNumber(event.holders);
  const mc = metricNumber(event.marketCapUsd);
  const top10 = metricNumber(event.top10HolderPercent);
  const soldRatio = metricNumber(event.soldRatioPercent) || 0;
  const volume5m = metricNumber(event.volume5mUsd) || 0;
  const txs5m = metricNumber(event.txs5m) || 0;
  const priceChange5m = metricNumber(event.priceChange5mPct) || 0;
  const spikeRatio = metricNumber(event.volumeSpikeRatio) || 0;

  if (liquidity !== undefined && liquidity < minMemeLiquidityUsd) {
    score += 2;
    reasons.push("流动性薄");
  }
  if (holders !== undefined && holders < minMemeHolders) {
    score += 1;
    reasons.push("持有人少");
  }
  if (top10 !== undefined && top10 > maxTop10HolderPercent) {
    score += 2;
    reasons.push("Top10集中");
  }
  if (soldRatio > okxSignalMaxSoldRatioPercent) {
    score += 2;
    reasons.push("触发钱包卖出比例高");
  }
  if (mc && mc > maxMemeMarketCapUsd) {
    score += 2;
    reasons.push("市值超阈值");
  }
  if (priceChange5m >= lifecycleOverheatPriceChange5mPct && volume5m > 0 && txs5m < minTxs5m) {
    score += 2;
    reasons.push("拉升但成交笔数不足");
  }
  if (spikeRatio >= volumeSpikeMultiplier * 4 && holders < minMemeHolders * 2) {
    score += 1;
    reasons.push("爆量但持有人基础弱");
  }
  return { score, reasons };
}

function signalGrade(event) {
  if (Number(event.riskScore || 0) > maxRiskScore) return "avoid";
  if (["overheated", "late", "thin"].includes(event.lifecycleStage)) {
    return alertLateSignals && Number(event.compositeScore || 0) >= minCompositeScore + 3 ? "late" : "avoid";
  }
  if (
    event.sources.includes("private_pool")
    && event.sources.includes("okx_signal")
    && Number(event.compositeScore || 0) >= minCompositeScore
  ) return "confirm";
  if (
    event.sources.includes("gas_radar")
    && (event.sources.includes("okx_signal") || event.sources.includes("volume_spike") || event.sources.includes("private_pool"))
    && Number(event.compositeScore || 0) >= minCompositeScore
  ) return "confirm";
  if (
    event.sources.includes("private_pool")
    && Number(event.cluster?.clusterScore || 0) >= 2
    && Number(event.compositeScore || 0) >= minCompositeScore
  ) return "confirm";
  if (event.sources.includes("private_pool")) return "setup";
  if (event.sources.includes("gas_radar")) return "setup";
  if (event.sources.includes("okx_signal") && event.sources.includes("volume_spike")) return "confirm";
  if (event.sources.includes("okx_signal") || event.sources.includes("volume_spike")) return "setup";
  return "setup";
}

function gradeLabel(grade) {
  return {
    setup: "观察",
    confirm: "确认",
    late: "后排",
    avoid: "避开",
  }[grade] || "观察";
}

function verdict(event) {
  if (event.signalGrade === "confirm") {
    if (event.sources.includes("private_pool") && event.sources.includes("okx_signal")) return "私有地址池与 OKX Signal 同时出现，优先复核。";
    if (event.sources.includes("gas_radar")) return "Gas 升高时 DEX 路由集中买入，优先复核。";
    if (event.sources.includes("private_pool")) return "观察地址同币共振，属于可复盘信号。";
    return "官方信号与成交量同步，值得看一眼。";
  }
  if (event.signalGrade === "setup") {
    if (event.sources.includes("private_pool")) return "观察地址出现首买共振，但还需要市场确认。";
    if (event.sources.includes("gas_radar")) return "Gas 升高时被多笔路由交易买入，先观察后续承接。";
    return "信号刚出现，先观察流动性和后续买盘。";
  }
  if (event.signalGrade === "late") return "信号偏后排，只适合复盘，不适合追急。";
  return `风险项偏多：${(event.riskReasons || []).slice(0, 2).join("、") || "暂不达标"}。`;
}

function shouldAlert(event) {
  if (event.signalGrade === "avoid") return false;
  if (event.signalGrade === "late" && !alertLateSignals) return false;
  if (Number(event.riskScore || 0) > maxRiskScore) return false;
  if (event.sources.includes("private_pool")) return true;
  if (event.sources.includes("gas_radar")) return event.compositeScore >= Math.max(3, minCompositeScore - 1);
  if (event.sources.includes("okx_signal")) return okxSignalForwardOnly || event.compositeScore >= 3;
  if (event.sources.includes("volume_spike") && event.compositeScore < minCompositeScore) return false;
  const mc = Number(event.marketCapUsd || 0);
  const liquidity = Number(event.liquidityUsd || 0);
  const holders = Number(event.holders || 0);
  if (mc && mc > maxMemeMarketCapUsd) return false;
  if (liquidity && liquidity < minMemeLiquidityUsd) return false;
  if (holders && holders < minMemeHolders) return false;
  return true;
}

function alertKey(event) {
  if (event.sources?.includes("private_pool") && event.triggerWallets?.length) {
    return `eth-private-first:${event.token}:${event.triggerWallets.map((wallet) => String(wallet).toLowerCase()).sort().join(",")}`;
  }
  return `eth-meme:${event.token}:${Math.floor(Date.now() / alertCooldownMs)}`;
}

function sourceLabel(sources) {
  const labels = {
    okx_signal: "OKX Signal 聪明钱聚合",
    volume_spike: "成交量突增",
    private_pool: "ETH 观察地址买入",
    gas_radar: "Gas 异动路由买入",
  };
  return sources.map((source) => labels[source] || source).join(" + ");
}

function shortWallet(wallet) {
  const text = String(wallet || "");
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function telegramMessage(event) {
  const lines = [
    `🚨 <b>ETH Meme 雷达</b>`,
    "",
    `🪙 <b>名称</b>：${escapeHtml(event.symbol || "UNKNOWN")} ｜ ${escapeHtml(event.name || event.symbol || "UNKNOWN")}`,
    `🔗 <b>合约</b>：<code>${escapeHtml(event.token)}</code>`,
    `📌 <b>判断</b>：${gradeLabel(event.signalGrade)} ｜ ${stageLabel(event.lifecycleStage)}`,
    `📊 <b>市值</b>：${fmtUsd(event.marketCapUsd)}`,
    `🧠 <b>聪明钱买入金额</b>：${Number(event.amountUsd || 0) > 0 ? fmtUsd(event.amountUsd) : "n/a"}`,
    `💵 <b>价格</b>：${fmtTokenPrice(event.entryPrice)}`,
    `👥 <b>持有人</b>：${event.holders || "n/a"}`,
    `📝 <b>备注</b>：${escapeHtml(event.verdict || "")}`,
    ...(tgIncludeDiagnostics ? [
      "",
      `来源：${escapeHtml(sourceLabel(event.sources || []))}`,
      `窗口：${fmtWindow(event.privateWindowMs || confirmWindowMs)} ｜ 钱包：${event.triggerWalletCount || 0} ｜ 分数：${event.compositeScore}`,
      `风险：${event.riskScore || 0}${event.riskReasons?.length ? `（${escapeHtml(event.riskReasons.slice(0, 3).join("、"))}）` : ""}`,
      event.cluster?.knownPairCount ? `集群：${event.cluster.knownPairCount}/${event.cluster.pairCount} 已知同买关系` : "",
      event.blockInfo?.blockNumber ? `区块：${event.blockInfo.blockNumber}` : "",
      event.gasGwei ? `Gas：${Number(event.gasGwei).toFixed(2)} gwei ｜ 路由买入：${event.routeTxCount || 0}` : "",
    ] : []),
    "",
    `⚠️ 仅供观察，不构成买入建议。`,
  ];
  return lines.filter((line) => line !== "").join("\n");
}

async function main() {
  if (ethMemeSelfTest) {
    const sample = combineEvents([
      {
        source: "private_pool",
        token: "0x1111111111111111111111111111111111111111",
        symbol: "TEST",
        name: "Test Token",
        signalTime: Date.now(),
        triggerWalletCount: 2,
        triggerWallets: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        entryPrice: 0.000001,
        marketCapUsd: 300_000,
        liquidityUsd: 30_000,
        holders: 120,
        volume5mUsd: 20_000,
        txs5m: 35,
      },
      {
        source: "okx_signal",
        token: "0x1111111111111111111111111111111111111111",
        symbol: "TEST",
        name: "Test Token",
        signalTime: Date.now(),
        triggerWalletCount: 4,
        triggerWallets: [],
        amountUsd: 2_000,
        marketCapUsd: 300_000,
        liquidityUsd: 30_000,
        holders: 120,
      },
    ])[0];
    const result = {
      signalGrade: sample.signalGrade,
      lifecycleStage: sample.lifecycleStage,
      riskScore: sample.riskScore,
      shouldAlert: shouldAlert(sample),
      message: telegramMessage(sample),
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`[eth-meme] radar started. poll=${pollMs}ms, okxSignal=${okxSignalEnabled ? `on(minWallets=${okxSignalMinWallets}, minAmount=${fmtUsd(okxSignalMinAmountUsd)})` : "off"}, hotTokens=${hotTokensEnabled ? `on(volume5m>=${fmtUsd(minVolume5mUsd)}, txs5m>=${minTxs5m}, spike>=${volumeSpikeMultiplier}x)` : "off"}, private=${privateTrackerEnabled ? `on(minWallets=${privateMinWallets}, window=${privateWindowMs}ms)` : "off"}, gasRadar=${gasRadarEnabled && ethRpcUrl ? `on(minGwei=${gasRadarMinGwei}, spike>=${gasRadarSpikeMultiplier}x, blocks=${gasRadarBlocks}, buys>=${gasRadarMinBuys}, buyers>=${gasRadarMinBuyers})` : "off"}`);
  while (true) {
    const rawEvents = [
      ...okxSignalEvents(),
      ...privatePoolEvents(),
      ...hotTokenEvents(),
      ...gasRadarEvents(),
    ];
    if (!state.seeded) {
      state.seeded = true;
      saveState();
      console.log(`[eth-meme] seeded current state at ${new Date().toISOString()}; future ETH meme matches will alert.`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      continue;
    }

    const alerts = [];
    for (const event of combineEvents(rawEvents)) {
      if (!shouldAlert(event)) continue;
      if (!uniqPush(state, "alertKeys", alertKey(event), 5000)) continue;
      alerts.push(event);
    }

    if (alerts.length) {
      const message = alerts.map(telegramMessage).join("\n\n----------------\n\n");
      console.log(`\n===== ETH MEME ALERT ${new Date().toISOString()} =====`);
      console.log(message.replace(/<[^>]+>/g, ""));
      console.log("===== END ETH MEME ALERT =====\n");
      appendJournal(alerts);
      await sendTelegram(message);
    } else {
      const sourceCounts = rawEvents.reduce((acc, event) => {
        acc[event.source] = (acc[event.source] || 0) + 1;
        return acc;
      }, {});
      console.log(`[eth-meme] ${new Date().toISOString()} no new alert raw=${rawEvents.length} sources=${JSON.stringify(sourceCounts)}`);
    }
    saveState();
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

main().catch((error) => {
  console.error("[eth-meme] fatal", error);
  process.exit(1);
});
