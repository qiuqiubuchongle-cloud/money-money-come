---
name: money-money-come
description: Use this skill when the user wants to analyze a batch of BSC smart-money addresses, classify wallets by PnL and trading style, generate concise wallet reports, build safe signal pools, export curated wallets, and alert when multiple wallets in the same positive group concentrate buys on the same meme token. Default to analysis and alerts only; do not enable trading execution unless the user explicitly asks and separate safety checks are in place.
---

# Money Money Come

This skill is for building and operating a BSC smart-money analysis workflow around user-supplied wallet lists.

## Use This Skill For

- Importing GMGN-style wallet JSON batches
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
- Setup checklist: `references/setup-checklist.md`

## Standard Workflow

### 1. Import wallet batch

Use:

```bash
npm run import-wallets -- <json-file>
```

Input format should be GMGN-style:

```json
[
  {
    "address": "0x...",
    "name": "optional",
    "emoji": ""
  }
]
```

### 2. Build wallet profiles

Use OKX official wallet market profile data whenever available:

```bash
npm run profiles
```

This writes:

- `data/smart_wallet_profiles_bsc.json`

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

When walking the user through setup, read `references/setup-checklist.md`.

## Output Style

When reporting results to the user:

- Lead with the wallet’s main label and whether it belongs in the safe signal pool
- Keep the explanation concise
- Mention:
  - realized PnL
  - win rate
  - activity / trade cadence
  - low market cap preference
  - whether it should be monitored, down-ranked, or removed

## Telegram Alert Intent

For future monitoring, grouped alerts should only trigger when:

- multiple wallets from the same **safe** positive group
- buy the same token
- inside the configured time window

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
