import fs from "node:fs";
import path from "node:path";

const journalPath = process.env.ETH_SIGNAL_JOURNAL_PATH || "data/eth_meme_signal_journal.ndjson";
const outPath = process.env.ALPHA_BRIEF_OUT || "data/daily_alpha_brief.md";
const lookbackHours = envNumber("ALPHA_BRIEF_LOOKBACK_HOURS", 24);
const previousHours = envNumber("ALPHA_BRIEF_PREVIOUS_HOURS", 24);
const topLimit = envNumber("ALPHA_BRIEF_TOP_LIMIT", 5);
const sendTg = envBool("ALPHA_BRIEF_SEND_TG", false);
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.TELEGRAM_CHAT_ID || "";

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

function loadRows(path) {
  try {
    return fs.readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((row) => row?.token && Number.isFinite(Date.parse(row.at)));
  } catch {
    return [];
  }
}

function fmtUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "n/a";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

function shortToken(token) {
  const text = String(token || "");
  if (text.length <= 14) return text || "n/a";
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function sourceKey(row) {
  return Array.isArray(row.sources) && row.sources.length ? [...row.sources].sort().join("+") : "unknown";
}

function sourceLabel(key) {
  return String(key)
    .replaceAll("gas_radar", "Gas")
    .replaceAll("okx_signal", "OKX")
    .replaceAll("volume_spike", "Hot")
    .replaceAll("private_pool", "Private")
    .replaceAll("+", " + ");
}

function tokenLabel(row) {
  const symbol = row.symbol && row.symbol !== "UNKNOWN" ? row.symbol : "UNKNOWN";
  const name = row.name && row.name !== symbol ? row.name : "";
  return name ? `${symbol} ｜ ${name}` : symbol;
}

function aggregateByToken(rows) {
  const map = new Map();
  for (const row of rows) {
    const token = String(row.token || "").toLowerCase();
    const item = map.get(token) || {
      token,
      symbol: row.symbol,
      name: row.name,
      count: 0,
      sources: new Set(),
      sourceCombos: new Set(),
      firstAt: row.at,
      lastAt: row.at,
      maxCompositeScore: 0,
      maxRiskScore: 0,
      maxRouteTxCount: 0,
      maxGasGwei: 0,
      maxAmountUsd: 0,
      maxTriggerWalletCount: 0,
      marketCapUsd: undefined,
      holders: undefined,
      verdicts: new Set(),
    };
    item.count += 1;
    item.symbol = item.symbol || row.symbol;
    item.name = item.name || row.name;
    item.firstAt = Date.parse(row.at) < Date.parse(item.firstAt) ? row.at : item.firstAt;
    item.lastAt = Date.parse(row.at) > Date.parse(item.lastAt) ? row.at : item.lastAt;
    item.maxCompositeScore = Math.max(item.maxCompositeScore, Number(row.compositeScore || 0));
    item.maxRiskScore = Math.max(item.maxRiskScore, Number(row.riskScore || 0));
    item.maxRouteTxCount = Math.max(item.maxRouteTxCount, Number(row.routeTxCount || 0));
    item.maxGasGwei = Math.max(item.maxGasGwei, Number(row.gasGwei || 0));
    item.maxAmountUsd = Math.max(item.maxAmountUsd, Number(row.amountUsd || 0));
    item.maxTriggerWalletCount = Math.max(item.maxTriggerWalletCount, Number(row.triggerWalletCount || 0));
    item.marketCapUsd = row.marketCapUsd || item.marketCapUsd;
    item.holders = row.holders || item.holders;
    if (row.verdict) item.verdicts.add(row.verdict);
    if (Array.isArray(row.sources)) {
      for (const source of row.sources) item.sources.add(source);
      item.sourceCombos.add(sourceKey(row));
    }
    map.set(token, item);
  }
  return [...map.values()].map((item) => ({
    ...item,
    sources: [...item.sources],
    sourceCombos: [...item.sourceCombos],
    verdicts: [...item.verdicts],
  }));
}

function topBy(rows, scoreFn, limit = topLimit) {
  return [...rows]
    .sort((a, b) => scoreFn(b) - scoreFn(a))
    .slice(0, limit);
}

function rowsWithSource(rows, source) {
  return rows.filter((row) => Array.isArray(row.sources) && row.sources.includes(source));
}

function comboRows(rows, requiredSources) {
  return rows.filter((row) => {
    const sources = new Set(row.sources || []);
    return requiredSources.every((source) => sources.has(source));
  });
}

function groupedCounts(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    const item = counts.get(key) || { key, count: 0, tokens: new Set() };
    item.count += 1;
    item.tokens.add(row.token);
    counts.set(key, item);
  }
  return [...counts.values()]
    .map((row) => ({ key: row.key, count: row.count, uniqueTokens: row.tokens.size }))
    .sort((a, b) => b.count - a.count);
}

function likelyStaleRules(rows) {
  if (!rows.length) return ["暂无有效样本，先不判断规则失效"];
  const result = [];
  const combos = groupedCounts(rows, sourceKey);
  for (const combo of combos) {
    const comboSignals = rows.filter((row) => sourceKey(row) === combo.key);
    const avoidOrLate = comboSignals.filter((row) => ["avoid", "late"].includes(row.signalGrade)).length;
    const highRisk = comboSignals.filter((row) => Number(row.riskScore || 0) >= 4).length;
    if (combo.count >= 3 && avoidOrLate / combo.count >= 0.6) {
      result.push(`${sourceLabel(combo.key)} 最近多为后排/避开，建议收紧阈值`);
    } else if (combo.count >= 3 && highRisk / combo.count >= 0.5) {
      result.push(`${sourceLabel(combo.key)} 高风险占比偏高，建议提高流动性/持有人要求`);
    }
  }
  const gasOnly = rows.filter((row) => sourceKey(row) === "gas_radar");
  if (gasOnly.length >= 3) result.push("Gas 单源信号偏多，建议优先等待 OKX / Hot / Private 任一确认");
  const privateRows = rowsWithSource(rows, "private_pool");
  if (!privateRows.length) result.push("私有地址池今日没有共振，可继续观察地址池活跃度和阈值是否匹配");
  return [...new Set(result)].slice(0, 5);
}

function renderTokenList(items, options = {}) {
  if (!items.length) return "- 暂无";
  return items.map((item, index) => {
    const parts = [
      `${index + 1}. ${tokenLabel(item)} (${shortToken(item.token)})`,
      `来源 ${item.sources.map(sourceLabel).join("/") || "n/a"}`,
      `市值 ${fmtUsd(item.marketCapUsd)}`,
    ];
    if (options.gas) parts.push(`Gas ${fmtNumber(item.maxGasGwei)} gwei`, `路由买入 ${item.maxRouteTxCount}`);
    if (options.private) parts.push(`触发钱包 ${item.maxTriggerWalletCount}`);
    if (options.amount) parts.push(`买入金额 ${fmtUsd(item.maxAmountUsd)}`);
    parts.push(`风险 ${item.maxRiskScore}`);
    return `- ${parts.join(" ｜ ")}`;
  }).join("\n");
}

function renderBrief({ now, currentRows, previousRows }) {
  const currentTokens = aggregateByToken(currentRows);
  const gasTop = topBy(aggregateByToken(rowsWithSource(currentRows, "gas_radar")), (row) => row.maxRouteTxCount * 10 + row.maxGasGwei);
  const privateTop = topBy(aggregateByToken(rowsWithSource(currentRows, "private_pool")), (row) => row.maxTriggerWalletCount * 10 + row.maxCompositeScore);
  const okxHotTop = topBy(aggregateByToken(comboRows(currentRows, ["okx_signal", "volume_spike"])), (row) => row.maxCompositeScore + row.maxAmountUsd / 1000);
  const previousTokens = aggregateByToken(previousRows);
  const staleRules = likelyStaleRules(currentRows);
  const sourceCounts = groupedCounts(currentRows, sourceKey).slice(0, 6);
  const gradeCounts = groupedCounts(currentRows, (row) => row.signalGrade).slice(0, 6);
  const performanceRows = previousRows.filter((row) => row.performance || row.replay);

  const lines = [
    `# Daily Alpha Brief`,
    "",
    `生成时间：${now.toISOString()}`,
    `统计窗口：最近 ${lookbackHours}h；昨日窗口：再往前 ${previousHours}h`,
    "",
    `## 今日概览`,
    "",
    `- 信号数：${currentRows.length}`,
    `- Token 数：${new Set(currentRows.map((row) => row.token)).size}`,
    `- 来源组合：${sourceCounts.length ? sourceCounts.map((row) => `${sourceLabel(row.key)} ${row.count}`).join(" / ") : "暂无"}`,
    `- 分级：${gradeCounts.length ? gradeCounts.map((row) => `${row.key} ${row.count}`).join(" / ") : "暂无"}`,
    "",
    `## 今日 ETH Gas 异动买入 Top Token`,
    "",
    renderTokenList(gasTop, { gas: true }),
    "",
    `## 私有地址池共振 Token`,
    "",
    renderTokenList(privateTop, { private: true, amount: true }),
    "",
    `## OKX Signal 与 Hot Token 重叠`,
    "",
    renderTokenList(okxHotTop, { amount: true }),
    "",
    `## 昨日信号表现`,
    "",
    performanceRows.length
      ? "- 已发现后验表现字段，后续可按 15m / 1h / 6h 统计命中率。"
      : `- 暂无价格回放数据。昨日窗口内记录 ${previousTokens.length} 个 token、${previousRows.length} 条信号；当前只能统计信号结构，不能判断命中率。`,
    "",
    `## 哪些规则最近可能失效`,
    "",
    staleRules.length ? staleRules.map((row) => `- ${row}`).join("\n") : "- 暂无明显失效规则。样本不足时不要过度调参。",
    "",
    `## 明日建议`,
    "",
    currentRows.length
      ? "- 优先看多源重叠信号；Gas 单源只做观察，等成交量或私有地址池确认。"
      : "- 今日没有有效样本，先确认监控进程、OKX 登录、ETH_RPC_URL 和 Telegram 配置是否正常。",
    "- 下一步最该补的是 15m / 1h / 6h 价格回放，否则日报只能做结构复盘，不能做真实胜率评估。",
  ];
  return `${lines.join("\n")}\n`;
}

function htmlFromMarkdown(text) {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<b>${escapeHtml(line.slice(2))}</b>`;
      if (line.startsWith("## ")) return `\n<b>${escapeHtml(line.slice(3))}</b>`;
      return escapeHtml(line);
    })
    .join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendTelegram(text) {
  if (!sendTg || !telegramBotToken || !telegramChatId) return;
  const payload = JSON.stringify({
    chat_id: telegramChatId,
    text: htmlFromMarkdown(text).slice(0, 3900),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (process.env.TELEGRAM_PROXY) {
    const { spawnSync } = await import("node:child_process");
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
}

const now = new Date();
const rows = loadRows(journalPath);
const currentCutoff = now.getTime() - lookbackHours * 60 * 60_000;
const previousCutoff = currentCutoff - previousHours * 60 * 60_000;
const currentRows = rows.filter((row) => Date.parse(row.at) >= currentCutoff);
const previousRows = rows.filter((row) => {
  const at = Date.parse(row.at);
  return at >= previousCutoff && at < currentCutoff;
});

const brief = renderBrief({ now, currentRows, previousRows });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, brief);
console.log(brief);
await sendTelegram(brief);
