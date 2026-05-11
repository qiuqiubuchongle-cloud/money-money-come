import fs from "node:fs";
import { loadJson, finite, isSafeSignalCandidate } from "./lib_smart_wallets.mjs";
import { chainConfig } from "./chain_config.mjs";

const cfg = chainConfig();
const profilesPath = process.env.SMART_WALLET_PROFILES_PATH || cfg.defaultProfilesPath;
const outJsonPath = process.env.CURATED_WALLETS_JSON_PATH || cfg.defaultCuratedJsonPath;
const outTxtPath = process.env.CURATED_WALLETS_TXT_PATH || cfg.defaultCuratedTxtPath;

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
    personaName: row.personaName || row.walletPersona?.personaName || "",
    personaIdentity: row.personaIdentity || row.walletPersona?.identity || "",
    personaConfidence: finite(row.personaConfidence ?? row.walletPersona?.confidence),
    trackingPool: row.trackingPool || row.walletPersona?.tracking?.pool || "",
    decisionGrade: row.decisionGrade || row.walletDecision?.grade || row.walletPersona?.decision?.grade || "",
    decisionVerdict: row.decisionVerdict || row.walletDecision?.verdict || row.walletPersona?.decision?.verdict || "",
    trustScore: finite(row.trustScore ?? row.walletDecision?.trustScore ?? row.walletPersona?.decision?.trustScore),
    watchModeLabel: row.watchModeLabel || row.walletDecision?.watchModeLabel || row.walletPersona?.decision?.watchModeLabel || "",
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
  chain: cfg.key,
  chainLabel: cfg.chainLabel,
  total: curated.length,
  wallets: curated,
}, null, 2));
fs.writeFileSync(outTxtPath, `${curated.map((row) => row.walletAddress).join("\n")}\n`);

console.log(JSON.stringify({
  outJsonPath,
  outTxtPath,
  chain: cfg.key,
  total: curated.length,
}, null, 2));
