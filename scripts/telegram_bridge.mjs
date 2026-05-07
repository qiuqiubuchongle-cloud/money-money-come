import fs from "node:fs";
import { spawnSync } from "node:child_process";

const configPath = process.env.TELEGRAM_ENV || `${process.env.HOME}/.config/bsc-signal-monitor/.env`;
loadEnvFile(configPath);

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";
const allowedUserId = process.env.TELEGRAM_ALLOWED_USER_ID || "";
const telegramProxy = process.env.TELEGRAM_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY || "";
const pollMs = Number(process.env.TELEGRAM_POLL_MS || 2500);
const statePath = "data/telegram_bridge_state.json";
const paperPath = "data/paper_trades.json";
const monitorLogPath = "logs/bsc_signal_monitor.log";
const monitorScreenName = process.env.MONITOR_SCREEN_NAME || "bsc_signal_monitor";

let state = loadJson(statePath, { offset: 0, lastLogSize: 0 });

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

function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function tg(method, payload) {
  const input = JSON.stringify(payload);
  if (telegramProxy) {
    const args = [
      "-sS",
      "--max-time", method === "getUpdates" ? "55" : "15",
      "-x", telegramProxy,
      "-X", "POST",
      "-H", "content-type: application/json",
      "--data-binary", "@-",
      `https://api.telegram.org/bot${botToken}/${method}`,
    ];
    const run = spawnSync("curl", args, { input, encoding: "utf8" });
    if (run.status !== 0) {
      throw new Error(`Telegram ${method} curl failed: ${(run.stderr || run.stdout || "").replaceAll(botToken, "<hidden>")}`);
    }
    return JSON.parse(run.stdout || "{}");
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: input,
  });
  if (!res.ok) throw new Error(`Telegram ${method} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const mainKeyboard = {
  keyboard: [
    [{ text: "收益" }, { text: "持仓" }],
    [{ text: "状态" }, { text: "日志" }],
    [{ text: "帮助" }, { text: "测试" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

async function send(text, options = {}) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (options.keyboard) payload.reply_markup = mainKeyboard;
  await tg("sendMessage", payload);
}

async function sendMenu(text) {
  await send(text, { keyboard: true });
}

function fmtUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

function fmtPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function sourceKey(trade) {
  return (trade.entrySources || [trade.source]).join("+");
}

function performanceText() {
  const paper = loadJson(paperPath, { open: [], closed: [] });
  const closed = paper.closed || [];
  const open = paper.open || [];
  const wins = closed.filter((t) => Number(t.realizedUsd || 0) > 0).length;
  const net = closed.reduce((sum, t) => sum + Number(t.realizedUsd || 0), 0);
  const grossProfit = closed.filter((t) => Number(t.realizedUsd || 0) > 0).reduce((sum, t) => sum + Number(t.realizedUsd || 0), 0);
  const grossLoss = closed.filter((t) => Number(t.realizedUsd || 0) < 0).reduce((sum, t) => sum + Number(t.realizedUsd || 0), 0);
  const pf = grossLoss ? (grossProfit / Math.abs(grossLoss)).toFixed(2) : "n/a";
  return [
    "BSC 模拟盘收益",
    `已平仓: ${closed.length}，持仓中: ${open.length}`,
    `胜率: ${closed.length ? fmtPct((wins / closed.length) * 100) : "n/a"}`,
    `净收益: ${fmtUsd(net)}，盈亏因子: ${pf}`,
  ].join("\n");
}

function positionsText() {
  const paper = loadJson(paperPath, { open: [] });
  const open = paper.open || [];
  if (!open.length) return "当前没有模拟持仓。";
  return [
    `当前模拟持仓：${open.length} 笔`,
    "",
    ...open.map((t, index) => {
      const pnl = t.lastPrice && t.entryPrice ? ((Number(t.lastPrice) / Number(t.entryPrice)) - 1) * 100 : NaN;
      return [
        `${index + 1}. ${t.symbol || "UNKNOWN"}`,
        `来源：${sourceKey(t)}`,
        `盈亏：${fmtPct(pnl)}，剩余：${Number(t.remainingPct || 0).toFixed(1)}%`,
        `已实现：${fmtUsd(t.realizedUsd || 0)}`,
        t.entryQualitySummary ? `风险摘要：${t.entryQualitySummary}` : "",
        `合约：${t.token}`,
      ].filter(Boolean).join("\n");
    }),
  ].join("\n\n");
}

function monitorStatusText() {
  const ps = spawnSync("pgrep", ["-af", "monitor_bsc_signals.mjs"], { encoding: "utf8" });
  const screen = spawnSync("screen", ["-ls"], { encoding: "utf8" });
  const running = ps.status === 0 && ps.stdout.trim();
  return [
    "监控状态",
    running ? "BSC 监控: 运行中" : "BSC 监控: 未运行",
    (screen.stdout || screen.stderr || "").includes(monitorScreenName) ? `后台会话: ${monitorScreenName}` : "后台会话: 未找到",
  ].join("\n");
}

function tailLogText(lines = 20) {
  const run = spawnSync("tail", ["-n", String(lines), monitorLogPath], { encoding: "utf8" });
  const text = (run.stdout || run.stderr || "").trim();
  return text ? text.slice(-3500) : "暂无日志输出。";
}

async function handleCommand(message) {
  const fromId = String(message.from?.id || "");
  if (allowedUserId && fromId !== allowedUserId) {
    await send("Unauthorized Telegram user.");
    return;
  }
  const text = String(message.text || "").trim();
  if (!text) return;
  if (["/start", "/help", "/帮助", "帮助"].includes(text)) {
    await sendMenu([
      "BSC 模拟盘手机控制台",
      "点下面按钮即可操作，也可以手动发送：",
      "状态 - 查看监控是否运行",
      "收益 - 查看模拟盘收益",
      "持仓 - 查看当前模拟持仓",
      "日志 - 查看最新监控日志",
      "测试 - 测试机器人是否在线",
      "",
      "安全说明：这里只做模拟盘提醒和查询，不会执行真钱交易。",
    ].join("\n"));
  } else if (["/状态", "状态", "/status"].includes(text)) {
    await send(monitorStatusText());
  } else if (["/收益", "收益", "/pnl"].includes(text)) {
    await send(performanceText());
  } else if (["/持仓", "持仓", "/positions"].includes(text)) {
    await send(positionsText());
  } else if (["/日志", "日志", "/log"].includes(text)) {
    await send(tailLogText(25));
  } else if (["/测试", "测试", "/ping"].includes(text)) {
    await send(`在线 ${new Date().toISOString()}`);
  } else {
    await sendMenu("暂时只支持下面这些按钮命令。");
  }
}

async function pollCommands() {
  const data = await tg("getUpdates", {
    offset: state.offset || 0,
    timeout: 20,
    allowed_updates: ["message"],
  });
  for (const update of data.result || []) {
    state.offset = Math.max(Number(state.offset || 0), Number(update.update_id || 0) + 1);
    if (update.message) await handleCommand(update.message);
  }
  saveState();
}

async function mirrorPaperSignals() {
  let stat;
  try {
    stat = fs.statSync(monitorLogPath);
  } catch {
    return;
  }
  if (!state.lastLogSize) {
    state.lastLogSize = stat.size;
    saveState();
    return;
  }
  if (stat.size < state.lastLogSize) state.lastLogSize = 0;
  if (stat.size === state.lastLogSize) return;
  const fd = fs.openSync(monitorLogPath, "r");
  const len = stat.size - state.lastLogSize;
  const buf = Buffer.alloc(Math.min(len, 100_000));
  fs.readSync(fd, buf, 0, buf.length, state.lastLogSize);
  fs.closeSync(fd);
  state.lastLogSize = stat.size;
  const chunk = buf.toString("utf8");
  const matches = chunk.match(/===== PAPER SIGNAL[\s\S]*?===== END PAPER SIGNAL =====/g) || [];
  for (const message of matches) {
    await send(message.slice(0, 3900));
  }
  saveState();
}

async function main() {
  await sendMenu("TG 控制台已上线。点下面按钮即可操作。");
  while (true) {
    try {
      await mirrorPaperSignals();
      await pollCommands();
    } catch (error) {
      console.error(`[telegram_bridge] ${error.message || error}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

main();
