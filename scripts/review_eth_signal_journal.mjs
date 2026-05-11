import fs from "node:fs";

const journalPath = process.env.ETH_SIGNAL_JOURNAL_PATH || "data/eth_meme_signal_journal.ndjson";
const outPath = process.env.ETH_SIGNAL_REVIEW_OUT || "data/eth_meme_signal_review.json";

function loadRows(path) {
  try {
    return fs.readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function groupCount(rows, keyFn) {
  const groups = {};
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    groups[key] = groups[key] || { count: 0, tokens: new Set() };
    groups[key].count += 1;
    if (row.token) groups[key].tokens.add(row.token);
  }
  return Object.fromEntries(Object.entries(groups)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([key, value]) => [key, { count: value.count, uniqueTokens: value.tokens.size }]));
}

function sourceKey(row) {
  return Array.isArray(row.sources) && row.sources.length ? row.sources.sort().join("+") : "unknown";
}

function topRows(rows, field, limit = 10) {
  return [...rows]
    .sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))
    .slice(0, limit)
    .map((row) => ({
      at: row.at,
      token: row.token,
      symbol: row.symbol,
      signalGrade: row.signalGrade,
      lifecycleStage: row.lifecycleStage,
      sources: row.sources,
      [field]: row[field],
      marketCapUsd: row.marketCapUsd,
      riskScore: row.riskScore,
    }));
}

const rows = loadRows(journalPath);
const report = {
  generatedAt: new Date().toISOString(),
  journalPath,
  totalAlerts: rows.length,
  uniqueTokens: new Set(rows.map((row) => row.token).filter(Boolean)).size,
  byGrade: groupCount(rows, (row) => row.signalGrade),
  byLifecycle: groupCount(rows, (row) => row.lifecycleStage),
  bySourceCombo: groupCount(rows, sourceKey),
  topCompositeScore: topRows(rows, "compositeScore"),
  topRiskScore: topRows(rows, "riskScore"),
  notes: [
    "This review is based on emitted alerts only.",
    "Future replay can enrich rows with later price/market-cap changes to estimate hit rate by grade, lifecycle, and source combo.",
  ],
};

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
