import fs from "node:fs";

const sourcePath = process.env.RECOMMENDED_POOL_SOURCE || "data/user_batch_full_partial_analysis.json";
const profilesOutPath = process.env.RECOMMENDED_PROFILES_OUT || "config/server-core-profiles.json";
const groupsOutPath = process.env.RECOMMENDED_GROUPS_OUT || "config/server-core-groups.json";
const addressesOutPath = process.env.RECOMMENDED_ADDRESSES_OUT || "config/server-core-addresses.txt";
const reviewOutPath = process.env.RECOMMENDED_REVIEW_OUT || "data/recommended_signal_pool_review.json";
const manualProfilesPath = process.env.RECOMMENDED_MANUAL_PROFILES_PATH || "config/server-core-profiles.manual.json";

const positiveProfiles = new Set([
  "hundred_x_hunter",
  "ten_k_profit_champion",
  "hot_meme_sniper",
  "conviction_reloader",
]);

function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function signalGroupLabel(profile) {
  return {
    hundred_x_hunter: "百倍组",
    ten_k_profit_champion: "盈利组",
    hot_meme_sniper: "热点组",
    conviction_reloader: "加仓组",
  }[profile] || "观察组";
}

function normalizeProfile(row) {
  const profile = String(row.profile || "watch_only");
  return {
    walletAddress: String(row.walletAddress || "").toLowerCase(),
    walletName: row.walletName || "",
    walletEmoji: row.walletEmoji || "",
    profile,
    profileLabel: row.profileLabel || "",
    labels: Array.isArray(row.labels) ? row.labels : [],
    reliabilityScore: finite(row.reliabilityScore),
    walletValueScore: finite(row.walletValueScore),
    walletTier: row.walletTier || "",
    walletStyleLabel: row.walletStyleLabel || "",
    walletPersona: row.walletPersona || null,
    personaName: row.personaName || row.walletPersona?.personaName || "",
    personaCode: row.personaCode || row.walletPersona?.personaCode || "",
    personaIdentity: row.personaIdentity || row.walletPersona?.identity || "",
    personaConfidence: finite(row.personaConfidence ?? row.walletPersona?.confidence),
    humanScore: finite(row.humanScore ?? row.walletPersona?.humanScore),
    botScore: finite(row.botScore ?? row.walletPersona?.botScore),
    trackingPool: row.trackingPool || row.walletPersona?.tracking?.pool || "",
    walletDecision: row.walletDecision || row.walletPersona?.decision || null,
    decisionGrade: row.decisionGrade || row.walletDecision?.grade || row.walletPersona?.decision?.grade || "",
    decisionVerdict: row.decisionVerdict || row.walletDecision?.verdict || row.walletPersona?.decision?.verdict || "",
    trustScore: finite(row.trustScore ?? row.walletDecision?.trustScore ?? row.walletPersona?.decision?.trustScore),
    watchMode: row.watchMode || row.walletDecision?.watchMode || row.walletPersona?.decision?.watchMode || "",
    watchModeLabel: row.watchModeLabel || row.walletDecision?.watchModeLabel || row.walletPersona?.decision?.watchModeLabel || "",
    signalGroup: row.signalGroup || signalGroupLabel(profile),
    emotionWeight: finite(row.emotionWeight, 1),
    totalRealizedPnlUsd: finite(row.totalRealizedPnlUsd),
    winRatePct: finite(row.winRatePct),
    lowMcBuyPct: finite(row.lowMcBuyPct),
    analysisSummary: row.analysisSummary || "",
    latestTradeIso: row.latestTradeIso || "",
    latestTradeAgeHours: finite(row.latestTradeAgeHours, 9999),
    safeCandidate: Boolean(row.safeCandidate),
  };
}

function poolGrade(row) {
  if (!row.walletAddress || !positiveProfiles.has(row.profile)) return "excluded";
  if (row.labels.includes("high_frequency_rookie")) return "excluded";
  if (row.totalRealizedPnlUsd < -1000) return "excluded";
  if (row.winRatePct > 0 && row.winRatePct < 30) return "excluded";
  if (row.latestTradeAgeHours > 72) return "excluded";

  if (
    row.walletTier === "核心"
    && row.walletValueScore >= 75
    && row.reliabilityScore >= 90
    && row.totalRealizedPnlUsd >= 0
  ) return "safe";

  if (
    row.walletValueScore >= 60
    && row.reliabilityScore >= 85
    && row.totalRealizedPnlUsd >= 0
  ) return "observe";

  return "excluded";
}

function sortProfiles(a, b) {
  return b.walletValueScore - a.walletValueScore
    || b.reliabilityScore - a.reliabilityScore
    || b.totalRealizedPnlUsd - a.totalRealizedPnlUsd
    || a.latestTradeAgeHours - b.latestTradeAgeHours;
}

function groupRows(rows) {
  const groups = {};
  for (const row of rows) {
    const group = row.signalGroup || signalGroupLabel(row.profile);
    groups[group] = groups[group] || [];
    groups[group].push(row);
  }
  for (const rows of Object.values(groups)) rows.sort(sortProfiles);
  return groups;
}

const input = loadJson(sourcePath, null);
if (!input) {
  console.error(`Cannot read ${sourcePath}`);
  process.exit(1);
}

const sourceProfiles = Array.isArray(input.profiles) ? input.profiles : [];
const normalized = sourceProfiles.map(normalizeProfile).filter((row) => row.walletAddress);
const manual = loadJson(manualProfilesPath, { profiles: [] });
const manualProfiles = (Array.isArray(manual.profiles) ? manual.profiles : []).map(normalizeProfile).filter((row) => row.walletAddress);
const safeSignalPool = [];
const observeSignalPool = [];
const excludedSignalPool = [];

for (const row of normalized) {
  const grade = poolGrade(row);
  if (grade === "safe") safeSignalPool.push({ ...row, safeCandidate: true, poolRole: "safe" });
  else if (grade === "observe") observeSignalPool.push({ ...row, safeCandidate: false, poolRole: "observe", walletTier: row.walletTier || "观察" });
  else if (positiveProfiles.has(row.profile)) excludedSignalPool.push({ ...row, safeCandidate: false, poolRole: "excluded" });
}

const seenSafe = new Set(safeSignalPool.map((row) => row.walletAddress));
const seenObserve = new Set(observeSignalPool.map((row) => row.walletAddress));
for (const row of manualProfiles) {
  if (seenSafe.has(row.walletAddress)) continue;
  const manualRow = { ...row, safeCandidate: true, poolRole: "safe", manualCurated: true };
  if (seenObserve.has(row.walletAddress)) {
    const index = observeSignalPool.findIndex((item) => item.walletAddress === row.walletAddress);
    if (index >= 0) observeSignalPool.splice(index, 1);
    seenObserve.delete(row.walletAddress);
  }
  safeSignalPool.push(manualRow);
  seenSafe.add(row.walletAddress);
}

safeSignalPool.sort(sortProfiles);
observeSignalPool.sort(sortProfiles);
excludedSignalPool.sort(sortProfiles);

const profiles = [...safeSignalPool, ...observeSignalPool];
const groups = groupRows(profiles);
const outputGroups = {
  generatedAt: new Date().toISOString(),
  totalProfiles: profiles.length,
  groupNames: Object.keys(groups),
  groups,
  signalPool: profiles,
  safeSignalPool,
  observeSignalPool,
  excludedSignalPool,
  telegramTemplate: {
    title: "BSC 聪明钱分层信号",
    triggerRule: "强提醒池按核心同组共振触发；观察池按更宽窗口提示，不进入模拟盘",
  },
  safetyRules: [
    "强提醒池只收核心、正收益、近期活跃且评分较高的钱包",
    "观察池只用于早发现，默认不进入模拟盘",
    "高频亏损、低胜率、休眠和负 PnL 明显的钱包不参与提醒",
  ],
};

const outputProfiles = {
  generatedAt: outputGroups.generatedAt,
  total: profiles.length,
  profiles,
};

fs.mkdirSync("config", { recursive: true });
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(profilesOutPath, JSON.stringify(outputProfiles, null, 2));
fs.writeFileSync(groupsOutPath, JSON.stringify(outputGroups, null, 2));
fs.writeFileSync(addressesOutPath, `${profiles.map((row) => row.walletAddress).join("\n")}\n`);
fs.writeFileSync(reviewOutPath, JSON.stringify({
  generatedAt: outputGroups.generatedAt,
  sourcePath,
  manualProfilesPath: fs.existsSync(manualProfilesPath) ? manualProfilesPath : "",
  analyzed: normalized.length,
  manualCount: manualProfiles.length,
  safeCount: safeSignalPool.length,
  observeCount: observeSignalPool.length,
  excludedPositiveCount: excludedSignalPool.length,
  safe: safeSignalPool,
  observe: observeSignalPool,
}, null, 2));

console.log(JSON.stringify({
  profilesOutPath,
  groupsOutPath,
  addressesOutPath,
  reviewOutPath,
  sourcePath,
  manualProfilesPath: fs.existsSync(manualProfilesPath) ? manualProfilesPath : "",
  analyzed: normalized.length,
  manualCount: manualProfiles.length,
  safeCount: safeSignalPool.length,
  observeCount: observeSignalPool.length,
  excludedPositiveCount: excludedSignalPool.length,
  groups: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.length])),
}, null, 2));
