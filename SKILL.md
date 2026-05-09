---
name: money-money-come
description: Use this skill when the user wants to analyze a batch of BSC or Solana smart-money addresses, classify wallets by PnL and trading style, generate concise wallet reports, build safe signal pools, export curated wallets, and alert when multiple wallets in the same positive group concentrate buys on the same meme token. Default to analysis and alerts only; do not enable trading execution unless the user explicitly asks and separate safety checks are in place.
---

# Money Money Come

This skill is for building and operating a BSC or Solana smart-money analysis workflow around user-supplied wallet lists.

## Use This Skill For

- Importing user-supplied smart-money wallet JSON batches
- Screening inactive wallets and keeping active ones
- Classifying wallets into behavior groups such as:
  - `10K盈利冠军`
  - `百倍金狗选手`
  - `热门土狗命中选手`
  - `信仰加仓选手`
  - `高频交易菜鸡`
  - `休眠地址`
- Producing a concise single-wallet report
- Building a safe signal pool for alerts
- Preparing Telegram alert payloads for grouped concentration buys
- Running a useful baseline workflow with OKX data only, while keeping GMGN / Binance as optional enhancers
- Running Solana address analysis with `SMART_WALLET_CHAIN=solana` or the `sol:*` npm scripts
- Configuring private grouped buy rules and OKX official Signal alerts for Telegram

## Safety Defaults

- Default mode is **analysis only**
- Do **not** place trades by default
- Do **not** treat every active address as positive signal
- Exclude or down-rank:
  - `high_frequency_rookie`
  - large realized loss + low win rate wallets
  - stale wallets with no meaningful recent activity
- Before any future execution workflow, require a separate safety layer:
  - liquidity checks
  - token risk scan
  - position sizing
  - stop-loss / take-profit rules

## Primary Files

- Wallet profile builder: `scripts/build_smart_wallet_profiles.mjs`
- Single wallet report: `scripts/report_smart_wallet.mjs`
- Group report and safe signal pool: `scripts/report_smart_wallet_groups.mjs`
- Shared helpers and rules: `scripts/lib_smart_wallets.mjs`
- Existing monitor pipeline: `scripts/monitor_bsc_signals.mjs`
- Signal rule template: `config/signal-rules.example.json`
- Setup checklist: `references/setup-checklist.md`

## Chain Selection

BSC is the default chain.

Use Solana mode with:

```bash
SMART_WALLET_CHAIN=solana npm run import-wallets -- <json-file>
npm run sol:profiles
npm run sol:wallet-groups
npm run sol:export-curated
```

Solana outputs use `_solana` filenames:

- `data/smart_wallet_profiles_solana.json`
- `data/smart_wallet_groups_solana.json`
- `data/curated_smart_wallets_solana.json`

Agentic Wallet is the wallet execution layer for login, signing, transfers, and contract calls. Wallet profiling data should still be read through OnchainOS / OKX market, tracker, and portfolio data commands.

## Standard Workflow

### 1. Import wallet batch

Use:

```bash
npm run import-wallets -- <json-file>
```

Input format should be a smart-money wallet list:

```json
[
  {
    "address": "0x...",
    "name": "optional",
    "emoji": ""
  }
]
```

Important:

- The bundled example file is only a format example
- It is not a curated profitable wallet pack
- If those example wallets produce `safeSignalPool = 0`, that does not mean the workflow is broken
- The meaningful use case starts after the user imports their own real smart-money list

### 2. Build wallet profiles

Use OKX official wallet market profile data whenever available:

```bash
npm run profiles
```

This writes:

- `data/smart_wallet_profiles_bsc.json`

Default recommendation:

```bash
OKX_PROFILE_TIME_FRAME_DAYS=3
```

This skill should prefer `3` as the default lookback window because some addresses may return OKX `timeFrame param error` on wider windows.

### 3. Generate grouped output

```bash
npm run wallet-groups
```

This writes:

- `data/smart_wallet_groups_bsc.json`

Focus on:

- `signalPool`
- `safeSignalPool`
- `excludedSignalPool`

### 4. Generate single wallet report

```bash
npm run wallet-report -- <wallet-address>
```

Use this when the user asks:

- “分析这个地址”
- “看下这个钱包收益”
- “判断这个地址值不值得跟”

### 5. Export curated wallets

```bash
npm run export-curated
```

This exports:

- `data/curated_smart_wallets_bsc.json`
- `data/curated_smart_wallets_bsc.txt`

Use this when the user wants:

- a cleaned wallet list
- recent active / stable / higher-quality addresses
- low-noise wallets for later monitoring

### 6. Telegram alert preparation

To enable Telegram alerts, the environment should provide:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Optional:

```bash
TELEGRAM_ALLOWED_USER_ID=...
TELEGRAM_PROXY=...
```

The monitor should only send grouped alerts from the **safe signal pool**.

Custom signal rules:

```bash
cp config/signal-rules.example.json config/signal-rules.json
```

Key fields:

- `private.minWallets`: how many private safe wallets must buy the same token
- `private.windowMs`: concentration window
- `private.sameGroupRequired`: require same positive group before formal alert
- `okxOfficial.enabled`: include OKX official Signal feed
- `okxOfficial.soloAlert`: allow OKX official Signal to alert even without private grouped confirmation
- `okxOfficial.minTriggerWallets`: minimum OKX aggregated trigger wallet count
- `okxOfficial.maxMarketCapUsd`, `minAmountUsd`, `minLiquidityUsd`: optional OnchainOS `signal list` pre-filters
- `okxOfficial.maxSoldRatioPercent`: local filter to avoid signals where trigger wallets have mostly exited

Environment variables override JSON:

```bash
MIN_PRIVATE_WALLETS=2
PRIVATE_WINDOW_MS=600000
OKX_OFFICIAL_SIGNAL_ENABLED=1
OKX_OFFICIAL_SOLO_ALERT=1
OKX_SIGNAL_MIN_WALLETS=6
```

Important: `OKX_SIGNAL_MIN_WALLETS=6` and `OKX_SIGNAL_MAX_MARKET_CAP_USD=500000` are this skill's default noise-control settings, not official OKX thresholds. OnchainOS provides the Signal feed and filter parameters; the alert policy remains user-configurable.

GMGN / Binance data sources are optional enhancers. The baseline workflow should still be useful with:

- wallet import
- OKX profile generation
- group generation
- Telegram alerts from the safe pool
- OKX official Signal alerts when enabled

### 7. OKX API setup

To use official OKX wallet profile data, the environment should provide:

```bash
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
```

Then log in:

```bash
onchainos wallet login
```

Validate:

```bash
onchainos wallet status
onchainos market portfolio-supported-chains
```

If login or profile commands fail, the agent should first diagnose:

- missing env vars
- expired login
- invalid API key
- region / network access issues
- unsuitable `OKX_PROFILE_TIME_FRAME_DAYS` value

When walking the user through setup, read `references/setup-checklist.md`.

## Output Style

When reporting results to the user:

- Lead with the wallet’s main label, value tier, and whether it belongs in the safe signal pool
- Keep the explanation concise, lively, and decision-oriented
- Mention:
  - wallet value score / tier
  - realized PnL
  - win rate
  - activity / trade cadence
  - low market cap preference
  - whether it should be monitored, down-ranked, or removed
- Do not foreground loss lists in Telegram wallet cards; keep loss/risk details for local JSON or deeper review

## Telegram Alert Intent

For future monitoring, grouped alerts should only trigger when:

- multiple wallets from the same **safe** positive group
- buy the same token
- inside the configured time window
- default formal signal threshold is configurable; recommended baseline is `>= 2` core wallets from the same positive group
- strong signal threshold is configurable; recommended baseline is `>= 3` same-group core wallets, or `>= 2` with an external OKX/GMGN/Four.meme/Binance confirmation
- OKX official Signal may alert independently when `OKX_OFFICIAL_SOLO_ALERT=1` and the OKX trigger wallet threshold is met

Alert payload should include:

- group name
- token name / contract
- number of triggered wallets
- wallet list
- confidence / sentiment score
- action suggestion
- risk note

Preferred Chinese message structure:

- title: `BSC 分组信号`
- token name + contract
- group label + sentiment score
- number of triggered safe wallets
- wallet names
- market cap / liquidity / holders
- short narrative
- reminder that this is analysis/alert, not guaranteed execution advice

## Notes

- The skill is valuable only if it filters noise, not if it forwards every active wallet
- A “热门” label alone is not enough; low win rate / heavy loss wallets should be filtered out of the safe pool
- Prefer `safeSignalPool` over raw profile groups for any user-facing signal workflow
