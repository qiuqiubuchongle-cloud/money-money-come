import fs from "node:fs";
import {
  loadJson,
  finite,
  signalGroupLabel,
  isPositiveSignalProfile,
  isSafeSignalCandidate,
} from "./lib_smart_wallets.mjs";
import { chainConfig } from "./chain_config.mjs";

const cfg = chainConfig();
const profilesPath = process.env.SMART_WALLET_PROFILES_PATH || cfg.defaultProfilesPath;
const outPath = process.env.SMART_WALLET_GROUPS_PATH || cfg.defaultGroupsPath;

const json = loadJson(profilesPath, { profiles: [] });
const profiles = Array.isArray(json.profiles) ? json.profiles : [];

const groups = {};
for (const row of profiles) {
  const profile = String(row.profile || "watch_only");
  const bucket = signalGroupLabel(profile);
  if (!groups[bucket]) groups[bucket] = [];
  groups[bucket].push({
    walletAddress: row.walletAddress,
    walletName: row.walletName || "",
    walletEmoji: row.walletEmoji || "",
    profile,
    profileLabel: row.profileLabel,
    reliabilityScore: finite(row.reliabilityScore),
    walletValueScore: finite(row.walletValueScore),
    walletTier: row.walletTier || "",
    walletStyleLabel: row.walletStyleLabel || "",
    totalRealizedPnlUsd: finite(row.totalRealizedPnlUsd),
    winRatePct: finite(row.winRatePct),
    analysisSummary: row.analysisSummary || "",
    latestTradeIso: row.latestTradeIso || "",
  });
}

for (const key of Object.keys(groups)) {
  groups[key].sort((a, b) => (
    b.reliabilityScore - a.reliabilityScore
    || b.totalRealizedPnlUsd - a.totalRealizedPnlUsd
  ));
}

const signalPool = profiles
  .filter((row) => isPositiveSignalProfile(String(row.profile || "")))
  .map((row) => ({
    walletAddress: row.walletAddress,
    walletName: row.walletName || "",
    walletEmoji: row.walletEmoji || "",
    profile: row.profile,
    profileLabel: row.profileLabel,
    reliabilityScore: finite(row.reliabilityScore),
    walletValueScore: finite(row.walletValueScore),
    walletTier: row.walletTier || "",
    walletStyleLabel: row.walletStyleLabel || "",
    emotionWeight: finite(row.emotionWeight, 1),
    winRatePct: finite(row.winRatePct),
    totalRealizedPnlUsd: finite(row.totalRealizedPnlUsd),
    analysisSummary: row.analysisSummary || "",
    safeCandidate: isSafeSignalCandidate(row),
  }))
  .sort((a, b) => b.walletValueScore - a.walletValueScore || b.reliabilityScore - a.reliabilityScore);

const safeSignalPool = signalPool.filter((row) => row.safeCandidate);
const excludedSignalPool = signalPool.filter((row) => !row.safeCandidate);

const tgTemplate = {
  title: `${cfg.shortLabel} 聪明钱分组信号`,
  triggerRule: "当同一分组内 >= 2 个安全正向地址在窗口期内集中买入同一 token 时提醒",
  fields: [
    "分组名",
    "代币名/合约",
    "触发地址数量",
    "触发地址名单",
    "综合情绪分",
    "建议动作",
  ],
};

const output = {
  generatedAt: new Date().toISOString(),
  chain: cfg.key,
  chainLabel: cfg.chainLabel,
  totalProfiles: profiles.length,
  groupNames: Object.keys(groups),
  groups,
  signalPool,
  safeSignalPool,
  excludedSignalPool,
  telegramTemplate: tgTemplate,
  safetyRules: [
    "默认仅做地址分析、分组、提醒，不直接执行买卖",
    "热点组若同时命中 high_frequency_rookie，则默认排除出安全信号池",
    "大幅亏损且低胜率地址不进入安全信号池",
    "超过 14 天无有效活跃地址不进入安全信号池",
  ],
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  outPath,
  chain: cfg.key,
  totalProfiles: output.totalProfiles,
  groupNames: output.groupNames,
  signalPoolSize: signalPool.length,
  safeSignalPoolSize: safeSignalPool.length,
}, null, 2));
