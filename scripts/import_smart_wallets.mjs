import fs from "node:fs";
import { chainConfig, normalizeWalletAddress } from "./chain_config.mjs";

const inputPath = process.argv[2] || "data/smart_wallets_input.json";
const cfg = chainConfig();
const outTxtPath = process.env.SMART_WALLET_ADDRESSES_PATH || cfg.defaultAddressesPath;
const outMetaPath = process.env.SMART_WALLET_META_PATH || cfg.defaultMetaPath;

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function loadLines(path) {
  try {
    return fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveJson(path, value) {
  fs.writeFileSync(path, JSON.stringify(value, null, 2));
}

function parseRows(value) {
  const rows = Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
  return rows
    .map((row) => ({
      address: normalizeWalletAddress(row?.address, cfg),
      name: String(row?.name || "").trim(),
      emoji: String(row?.emoji || "").trim(),
    }))
    .filter((row) => cfg.addressPattern.test(row.address));
}

const rows = parseRows(loadJson(inputPath));
const existingAddresses = new Set(loadLines(outTxtPath).map((line) => line.toLowerCase()));
const existingMeta = (() => {
  try {
    return loadJson(outMetaPath);
  } catch {
    return { wallets: [] };
  }
})();

const metaByAddress = new Map((existingMeta.wallets || []).map((row) => [String(row.address || "").toLowerCase(), row]));
for (const row of rows) {
  existingAddresses.add(row.address);
  const prev = metaByAddress.get(row.address) || { address: row.address, name: "", emoji: "" };
  metaByAddress.set(row.address, {
    address: row.address,
    name: row.name || prev.name || "",
    emoji: row.emoji || prev.emoji || "",
  });
}

const addresses = [...existingAddresses].sort();
const wallets = [...metaByAddress.values()].sort((a, b) => a.address.localeCompare(b.address));

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(outTxtPath, `${addresses.join("\n")}\n`);
saveJson(outMetaPath, {
  importedAt: new Date().toISOString(),
  total: wallets.length,
  wallets,
});

console.log(JSON.stringify({
  inputPath,
  chain: cfg.key,
  imported: rows.length,
  totalAddresses: addresses.length,
  outTxtPath,
  outMetaPath,
}, null, 2));
