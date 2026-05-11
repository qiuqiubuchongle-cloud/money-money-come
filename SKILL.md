---
name: money-money-come
description: Use this skill when the user wants to analyze BSC or Solana smart-money addresses, generate Wallet Persona chain-behavior profiles, classify wallets by identity/persona/PnL/trading style, build safe signal pools, or run ETH meme signal monitoring that merges OKX Signal, hot-token volume, private watch-wallet buys, signal grading, lifecycle awareness, risk scoring, wallet clusters, and Telegram alerts. Default to analysis and alerts only; do not enable trading execution unless the user explicitly asks and separate safety checks are in place.
---

# Money Money Come

This skill is for building and operating a BSC / Solana smart-money address intelligence workflow around user-supplied wallet lists. ETH meme signal monitoring is auxiliary; the core product value is wallet analysis, screening, and reusable address judgment.

Its strongest product direction is address understanding: turn a raw wallet into a Wallet Persona with identity, behavior style, evidence, ability radar, and a Wallet Decision with tracking grade, trust score, watch mode, trigger rule, risks, and invalidation conditions. It should behave like a wallet judgment layer, not a raw signal relay.

## Use This Skill For

- Importing user-supplied smart-money wallet JSON batches
- Screening inactive wallets and keeping active ones
- Generating Wallet Persona profiles with persona name, identity, confidence, evidence, human/bot score, ability radar, and tracking advice
- Generating Wallet Decision outputs with A/B/C/D grade, trust score, watch mode, trigger rule, risks, and invalidation conditions
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
- Running a useful baseline workflow with OKX data only, while keeping third-party market feeds as optional enhancers
- Running Solana address analysis with `SMART_WALLET_CHAIN=solana` or the `sol:*` npm scripts
- Configuring private grouped buy rules and OKX official Signal alerts for Telegram
- Turning raw wallet activity into a small set of explainable, high-signal alerts
- Turning raw wallet notes into a practical address book: discovery sources, confirmation sources, background references, and excluded noise
- Running ETH meme radar with OKX Signal + hot-token volume + private watch-wallet first buys
- Reviewing emitted ETH signal journal rows to learn which source combos and stages are noisy
- Generating a Daily Alpha Brief from emitted ETH journal rows

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

- Wallet importer: `scripts/import_smart_wallets.mjs`
- Wallet profile builder: `scripts/build_smart_wallet_profiles.mjs`
- Single wallet report: `scripts/report_smart_wallet.mjs`
- Group report and safe signal pool: `scripts/report_smart_wallet_groups.mjs`
- Shared helpers and rules: `scripts/lib_smart_wallets.mjs`
- Existing monitor pipeline: `scripts/monitor_bsc_signals.mjs`
- ETH meme radar: `scripts/monitor_eth_meme_radar.mjs`
- ETH signal journal review: `scripts/review_eth_signal_journal.mjs`
- Daily Alpha Brief: `scripts/daily_alpha_brief.mjs`
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

The best version of this skill is not "more alerts"; it is:

- fewer false positives
- clearer stage labels
- cleaner wallet-group reasoning
- a short explanation of why the signal matters
- a memory of what kinds of grouped buys actually worked before

Custom signal rules:

```bash
cp config/signal-rules.example.json config/signal-rules.json
```

Key fields:

- `private.minWallets`: how many private safe wallets must buy the same token
- `private.windowMs`: concentration window
- `private.sameGroupRequired`: require same positive group before formal alert
- `private.observe.enabled`: enable softer observation alerts
- `private.observe.minWallets`: how many safe/observe wallets trigger observation
- `private.observe.windowMs`: observation window; observation alerts do not open paper trades by default
- `okxOfficial.enabled`: read the OKX official Signal feed
- `okxOfficial.forward`: forward OKX official Signal rows to Telegram as their own channel
- `okxOfficial.applyLocalFilters`: optionally apply local noise filters before forwarding OKX official Signal rows
- `okxOfficial.minTriggerWallets`, `maxMarketCapUsd`, `minAmountUsd`, `minLiquidityUsd`: optional OnchainOS `signal list` filters
- `okxOfficial.maxSoldRatioPercent`: optional local filter when `applyLocalFilters=true`

Environment variables override JSON:

```bash
MIN_PRIVATE_WALLETS=3
PRIVATE_WINDOW_MS=120000
OBSERVE_SIGNAL_ENABLED=1
OBSERVE_MIN_WALLETS=2
OBSERVE_WINDOW_MS=300000
OKX_OFFICIAL_SIGNAL_ENABLED=1
OKX_OFFICIAL_FORWARD_ENABLED=1
OKX_OFFICIAL_APPLY_LOCAL_FILTERS=0
```

Important: private grouped alerts and OKX official Signal are separate channels. Private alerts use the user's safe wallet pool and same-group concentration rules. Observation alerts can include the observe pool and should be labeled clearly as observation, not a formal entry. OKX official Signal should be forwarded as-is with an added remark, unless the user explicitly enables local filtering. Do not treat OKX official Signal as proof that the user's private smart-wallet group has converged.

## ETH Meme Radar

Use `npm run monitor:eth-meme` when the user asks to monitor ETH meme tokens, private ETH wallet buys, OKX Signal on Ethereum, sudden ETH token volume spikes, or first-buy alerts from a custom ETH address list.

Inputs:

- OKX Signal: `ETH_OKX_SIGNAL_ENABLED=1`
- Hot token / price-info volume spikes: `ETH_HOT_TOKENS_ENABLED=1`
- Private watch wallets: `ETH_PRIVATE_TRACKER_ENABLED=1` and `ETH_PRIVATE_ADDRESSES_PATH=config/eth-watch-addresses.txt`
- ETH Gas Radar: `ETH_RPC_URL=...` and `ETH_GAS_RADAR_ENABLED=1`

Core rules:

- Private watch-wallet alerts are first-buy based: one wallet buying the same token repeatedly should not keep firing.
- Default private threshold is `ETH_PRIVATE_MIN_WALLETS=2` within `ETH_PRIVATE_WINDOW_MS=300000`.
- Gas Radar only scans recent ETH blocks when gas is elevated or spiking, then counts DEX router buys where users receive a non-base ERC20 token.
- Events are merged per token across OKX Signal, volume spike, private watch-wallet buys, and Gas Radar.
- Every merged event gets:
  - `signalGrade`: `setup`, `confirm`, `late`, or `avoid`
  - `lifecycleStage`: early, confirming, late, overheated, thin, or unknown
  - `riskScore` plus short risk reasons
  - wallet cluster stats when private wallets co-buy repeatedly
- `avoid` and most `late` events should not be sent to Telegram by default.
- Telegram cards should stay compact: name, contract, grade/stage, market cap, smart-money amount, price, holders, one-line remark.

Useful environment variables:

```bash
ETH_MEME_MIN_COMPOSITE_SCORE=5
ETH_MEME_MAX_RISK_SCORE=6
ETH_MEME_ALERT_LATE_SIGNALS=0
ETH_TG_INCLUDE_DIAGNOSTICS=0
ETH_MEME_MIN_VOLUME_5M_USD=10000
ETH_MEME_MIN_TXS_5M=20
ETH_MEME_MAX_MARKET_CAP_USD=20000000
ETH_MEME_MIN_LIQUIDITY_USD=10000
ETH_MEME_MIN_HOLDERS=30
ETH_MEME_MAX_TOP10_HOLDER_PERCENT=45
ETH_LIFECYCLE_EARLY_MAX_MARKET_CAP_USD=500000
ETH_LIFECYCLE_LATE_MIN_MARKET_CAP_USD=5000000
ETH_RPC_URL=
ETH_BLOCK_TRACKING_ENABLED=0
ETH_GAS_RADAR_ENABLED=1
ETH_GAS_RADAR_MIN_GWEI=20
ETH_GAS_RADAR_SPIKE_MULTIPLIER=1.6
ETH_GAS_RADAR_BLOCKS=3
ETH_GAS_RADAR_MIN_BUYS=5
ETH_GAS_RADAR_MIN_BUYERS=3
ETH_GAS_RADAR_TX_LIMIT=160
```

If `ETH_RPC_URL` is configured, the radar can attach block-level evidence for private watch-wallet buy transactions and enable Gas Radar. Keep RPC optional; the monitor must still run without RPC.

For replay:

```bash
npm run test:eth-meme
npm run review:eth-signals
```

`npm run test:eth-meme` runs an offline self-test for grading and Telegram formatting. `npm run review:eth-signals` reads `data/eth_meme_signal_journal.ndjson` and summarizes emitted alerts by grade, lifecycle stage, and source combo. Treat this as the first step toward hit-rate feedback; it does not yet calculate future price performance.

For daily brief:

```bash
npm run brief:daily
ALPHA_BRIEF_SEND_TG=1 npm run brief:daily
```

The brief reads emitted ETH journal rows and summarizes:

- ETH Gas Radar top tokens
- private watch-wallet co-buy tokens
- OKX Signal + hot-token overlaps
- previous-window signal structure
- rules that may be too noisy or too strict

It must not claim hit rate unless replay/performance fields exist in journal rows. Without later price replay, describe the section as signal-structure review only.

## Practical Upgrade Direction

The useful upgrade path is not more abstract scoring language; it is earlier discovery of ETH meme tokens that people are actively buying.

Prioritize:

- Gas-aware discovery: when mainnet gas suddenly rises, scan recent DEX router transactions and find repeated non-base ERC20 buys.
- Cross-source confirmation: promote a token when Gas Radar overlaps with OKX Signal, hot-token volume, or the user's private ETH watch list.
- Cleaner alerts: keep Telegram to name, contract, market cap, smart-money amount, price, holders, and one practical remark.
- Feedback loop: keep writing emitted alerts to `data/eth_meme_signal_journal.ndjson`, then use later price replay to learn which sources actually worked.
- Safer defaults: do not alert `avoid` signals, avoid late/overheated tokens by default, and keep execution out of scope unless the user separately requests it.

The baseline workflow should still be useful with:

- wallet import
- OKX profile generation
- group generation
- Telegram alerts from the safe pool
- OKX official Signal forwarding when enabled
- ETH Gas Radar when an ETH RPC endpoint is configured

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

- Lead with the wallet’s persona name, identity, tracking pool, and whether it belongs in the safe signal pool
- Include the Wallet Decision verdict, grade, trust score, and watch mode when available
- Keep the explanation concise, lively, and decision-oriented
- Mention:
  - persona confidence
  - human score / bot score when useful
  - ability radar summary
  - evidence supporting the persona
  - wallet value score / tier
  - realized PnL
  - win rate
  - activity / trade cadence
  - low market cap preference
  - whether it should be monitored, down-ranked, or removed
- Do not foreground loss lists in Telegram wallet cards; keep loss/risk details for local JSON or deeper review

## Wallet Persona Rules

Wallet Persona is not a vibe label. Every persona should be backed by evidence from metrics such as:

- trade sample size and unique token count
- realized PnL and win rate
- low-market-cap buy ratio and median entry market cap
- recent activity and average trades per day
- repeated buys / conviction behavior
- high-frequency or bot-like behavior

Supported persona examples:

- `early_narrative_hunter`: 早期叙事猎人
- `steady_profit_operator`: 稳健盈利派
- `conviction_reloader`: 信仰加仓派
- `hot_rotation_trader`: 热点切换手
- `route_bot`: 链上打点机
- `late_fomo_chaser`: 后排冲锋号
- `sleeping_wallet`: 沉睡旧钱包
- `balanced_observer`: 均衡观察员

Strong claims like project party, insider, entity cluster, or bot should be phrased as candidate/suspected unless the evidence is explicit. Prefer "疑似机器人/高频噪音" over declaring certainty.

## Wallet Decision Rules

Wallet Decision is the practical layer on top of Wallet Persona. It answers: should this address be tracked, and how?

Decision grades:

- `A / 重点跟踪`: core watch candidate. Can act as discovery or confirmation source depending on persona.
- `B / 观察验证`: useful but needs same-group or external confirmation before a formal alert.
- `C / 只看题材`: keep as context only; do not let it trigger alerts alone.
- `D / 排除留档`: exclude from signal pool unless the wallet materially changes behavior later.

Watch modes:

- `discovery_and_confirm`: can be used for both early discovery and grouped confirmation.
- `discovery`: good at surfacing themes, but should wait for another wallet/source before alerting.
- `confirm`: slower but more reliable; useful for confirmation rather than first touch.
- `conviction`: watch repeated buys and exits; do not blindly chase the first buy.
- `background`: context only.
- `archive`: excluded from signal logic.

The decision should include:

- `trustScore`: combined score from value score, reliability, persona confidence, copyability, exit discipline, human score, bot score, sample size, and recency.
- `reasons`: short evidence-backed reasons for the decision.
- `risks`: current reasons to distrust or down-rank the address.
- `triggerRule`: how this wallet should participate in signal rules.
- `invalidators`: what future behavior should lower its weight.

When explaining to the user, make the decision actionable:

- Say whether it should enter the core pool, observe pool, background pool, or exclusion pool.
- Say whether it is a discovery source or confirmation source.
- Avoid saying a single wallet buy is enough unless the user explicitly configures that.
- If the address looks bot-like, say it is useful for noise detection rather than copy-trading.

## Telegram Alert Intent

For future monitoring, grouped alerts should only trigger when:

- multiple wallets from the same **safe** positive group
- buy the same token
- inside the configured time window
- default formal signal threshold is configurable; recommended baseline is `>= 3` core wallets from the same positive group within 2 minutes
- strong signal threshold is configurable; recommended baseline is `>= 3` same-group core wallets, optionally with separate market/risk confirmations
- OKX official Signal should be sent in a separate `OKX 官方 Signal` Telegram card, with a remark that it is not a private-pool grouped signal

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
