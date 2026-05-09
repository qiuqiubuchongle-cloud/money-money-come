export function chainConfig() {
  const raw = String(process.env.SMART_WALLET_CHAIN || process.env.OKX_PROFILE_CHAIN || "bsc").toLowerCase();
  const key = ["sol", "solana", "501"].includes(raw) ? "solana" : "bsc";
  if (key === "solana") {
    return {
      key,
      okxChain: "solana",
      chainLabel: "Solana",
      shortLabel: "SOL",
      nativeSymbol: "SOL",
      addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      defaultAddressesPath: "data/smart_wallet_addresses_solana.txt",
      defaultMetaPath: "data/smart_wallet_meta_solana.json",
      defaultProfilesPath: "data/smart_wallet_profiles_solana.json",
      defaultGroupsPath: "data/smart_wallet_groups_solana.json",
      defaultCuratedJsonPath: "data/curated_smart_wallets_solana.json",
      defaultCuratedTxtPath: "data/curated_smart_wallets_solana.txt",
      defaultRecentBuysPath: "data/smart_wallet_recent_buys_solana.json",
      defaultWalletScreenPath: "data/solana_wallet_screen.json",
      defaultTrackerActivityPath: "data/solana_tracker_activity.json",
      defaultCachePath: "data/okx_wallet_profile_cache_solana.json",
    };
  }
  return {
    key: "bsc",
    okxChain: "bsc",
    chainLabel: "BNB Chain",
    shortLabel: "BSC",
    nativeSymbol: "BNB",
    addressPattern: /^0x[a-f0-9]{40}$/,
    defaultAddressesPath: "data/smart_wallet_addresses.txt",
    defaultMetaPath: "data/smart_wallet_meta.json",
    defaultProfilesPath: "data/smart_wallet_profiles_bsc.json",
    defaultGroupsPath: "data/smart_wallet_groups_bsc.json",
    defaultCuratedJsonPath: "data/curated_smart_wallets_bsc.json",
    defaultCuratedTxtPath: "data/curated_smart_wallets_bsc.txt",
    defaultRecentBuysPath: "data/smart_wallet_recent_buys_bsc.json",
    defaultWalletScreenPath: "data/bsc_wallet_screen.json",
    defaultTrackerActivityPath: "data/okx_tracker_activity.json",
    defaultCachePath: "data/okx_wallet_profile_cache.json",
  };
}

export function normalizeWalletAddress(address, cfg = chainConfig()) {
  const value = String(address || "").trim();
  if (cfg.key === "bsc") return value.toLowerCase();
  return value;
}
