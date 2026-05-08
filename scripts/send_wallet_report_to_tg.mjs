import fs from "node:fs";
import { spawnSync } from "node:child_process";

const configPath = process.env.TELEGRAM_ENV || `${process.env.HOME}/.config/bsc-signal-monitor/.env`;
loadEnvFile(configPath);

const walletArg = process.argv[2]?.toLowerCase();
if (!walletArg) {
  console.error("Usage: node scripts/send_wallet_report_to_tg.mjs <wallet-address>");
  process.exit(1);
}

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";
const telegramProxy = process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY || "";

if (!botToken || !chatId) {
  console.error(`Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Configure ${configPath}`);
  process.exit(1);
}

function loadEnvFile(path) {
  try {
    const text = fs.readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Environment variables can be provided directly.
  }
}

function fmtUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : "-"}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}U`;
}

function fmtPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  if (n < 1) return `${(n * 60).toFixed(0)} 分钟前`;
  if (n < 24) return `${n.toFixed(1)} 小时前`;
  return `${(n / 24).toFixed(1)} 天前`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shortAddress(address) {
  const text = String(address || "");
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function recommendation(report) {
  const m = report.metrics || {};
  const pnl = Number(m.totalRealizedPnlUsd || 0);
  const winRate = Number(m.winRatePct || 0);
  const reliability = Number(report.reliabilityScore || 0);
  const activeHours = Number(m.latestTradeAgeHours || 9999);
  if (reliability >= 80 && pnl > 5000 && activeHours <= 24) {
    return "建议放入重点观察池；适合同组共振后触发提醒，不建议孤立盲跟。";
  }
  if (pnl > 0 && winRate >= 35 && activeHours <= 72) {
    return "可以进入观察池；等待更多同组地址确认后再提高信号权重。";
  }
  if (activeHours > 336) {
    return "近期活跃度偏低；建议暂时降权或放入休眠观察。";
  }
  return "建议先观察，不直接作为核心买入依据。";
}

function formatTokenRows(rows, positive) {
  if (!rows.length) return "暂无";
  const icon = positive ? "✅" : "⚠️";
  return rows.map((row) => {
    const symbol = escapeHtml(row.tokenSymbol || "UNKNOWN");
    return `${icon} <b>${symbol}</b>  ${escapeHtml(fmtUsd(row.pnlUsd))}  (${escapeHtml(fmtPct(row.totalPnlPercent))})`;
  }).join("\n");
}

function tgPayload(text) {
  return JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

async function tgSend(text) {
  const input = tgPayload(text);
  if (telegramProxy) {
    const args = [
      "-sS",
      "--max-time", "20",
      "-x", telegramProxy,
      "-X", "POST",
      "-H", "content-type: application/json",
      "--data-binary", "@-",
      `https://api.telegram.org/bot${botToken}/sendMessage`,
    ];
    const run = spawnSync("curl", args, { input, encoding: "utf8" });
    if (run.status !== 0) {
      throw new Error(`Telegram send failed: ${(run.stderr || run.stdout || "").replaceAll(botToken, "<hidden>")}`);
    }
    return JSON.parse(run.stdout || "{}");
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: input,
  });
  if (!res.ok) throw new Error(`Telegram send HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildText(report) {
  const name = report.walletName || "未命名地址";
  const m = report.metrics || {};
  const wins = Array.isArray(report.topWins) ? report.topWins.slice(0, 2) : [];
  const losses = Array.isArray(report.topLosses) ? report.topLosses.slice(0, 2) : [];
  const address = report.walletAddress || "";
  const profile = report.profileLabel || report.profile || "n/a";
  const group = report.signalGroup || "n/a";
  const score = report.reliabilityScore ?? "n/a";

  return [
    "🧠 <b>聪明钱地址分析</b>",
    "",
    `🏷️ <b>${escapeHtml(name)}</b>`,
    `🔗 <code>${escapeHtml(shortAddress(address))}</code>`,
    `<code>${escapeHtml(address)}</code>`,
    "",
    `📌 <b>画像</b>：${escapeHtml(profile)} ｜ ${escapeHtml(group)}`,
    `⭐ <b>可靠度</b>：${escapeHtml(score)}/100`,
    `📝 <b>结论</b>：${escapeHtml(report.summary || "暂无摘要")}`,
    "",
    "📊 <b>核心数据</b>",
    `• 已实现收益：<b>${escapeHtml(fmtUsd(m.totalRealizedPnlUsd))}</b>`,
    `• 胜率：<b>${escapeHtml(fmtPct(m.winRatePct))}</b>`,
    `• 买入 / 卖出：${escapeHtml(m.buyCount ?? "n/a")} / ${escapeHtml(m.sellCount ?? "n/a")}`,
    `• 最近活跃：${escapeHtml(fmtHours(m.latestTradeAgeHours))}`,
    `• 低市值偏好：${escapeHtml(fmtPct(m.lowMcBuyPct))}`,
    `• 中位买入市值：${escapeHtml(fmtUsd(m.medianEntryMarketCapUsd))}`,
    "",
    "💰 <b>代表盈利</b>",
    formatTokenRows(wins, true),
    "",
    "📉 <b>代表亏损</b>",
    formatTokenRows(losses, false),
    "",
    `🎯 <b>跟踪建议</b>：${escapeHtml(recommendation(report))}`,
  ].join("\n");
}

const run = spawnSync("node", ["scripts/report_smart_wallet.mjs", walletArg], {
  cwd: process.cwd(),
  encoding: "utf8",
  timeout: 30_000,
});

if (run.status !== 0) {
  console.error(run.stderr || run.stdout || `report_smart_wallet failed with ${run.status}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(run.stdout || "{}");
} catch (error) {
  console.error(`Failed to parse report JSON: ${error.message}`);
  process.exit(1);
}

const text = buildText(report);
await tgSend(text);
console.log(JSON.stringify({ ok: true, wallet: walletArg, sent: true, preview: text }, null, 2));
