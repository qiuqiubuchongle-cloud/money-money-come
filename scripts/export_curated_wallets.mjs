import fs from "node:fs";
import { loadJson, finite, isSafeSignalCandidate } from "./lib_smart_wallets.mjs";

const profilesPath = process.env.SMART_WALLET_PROFILES_PATH || "data/smart_wallet_profiles_bsc.json";
const outJsonPath = process.env.CURATED_WALLETS_JSON_PATH || "data/curated_smart_wallets_bsc.json";
const outTxtPath = process.env.CURATED_WALLETS_TXT_PATH || "data/curated_smart_wallets_bsc.txt";

const json = loadJson(profilesPath, { profiles: [] });
const profiles = Array.isArray(json.profiles) ? json.profiles : [];

const curated = profiles
  .filter((row) => isSafeSignalCandidate(row))
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
    totalRealizedPnlUsd: finite(row.totalRealizedPnlUsd),
    winRatePct: finite(row.winRatePct),
    avgTradesPerDay: finite(row.avgTradesPerDay),
    lowMcBuyPct: finite(row.lowMcBuyPct),
    latestTradeIso: row.latestTradeIso || "",
    analysisSummary: row.analysisSummary || "",
  }))
  .sort((a, b) => (
    b.walletValueScore - a.walletValueScore
    || b.reliabilityScore - a.reliabilityScore
    || b.totalRealizedPnlUsd - a.totalRealizedPnlUsd
    || b.winRatePct - a.winRatePct
  ));

fs.writeFileSync(outJsonPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  total: curated.length,
  wallets: curated,
}, null, 2));
fs.writeFileSync(outTxtPath, `${curated.map((row) => row.walletAddress).join("\n")}\n`);

console.log(JSON.stringify({
  outJsonPath,
  outTxtPath,
  total: curated.length,
}, null, 2));
