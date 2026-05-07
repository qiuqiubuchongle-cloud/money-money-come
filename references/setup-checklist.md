# Setup Checklist

Use this checklist when the user wants to connect the skill to OKX and Telegram.

## 1. OKX API

Required env vars:

```bash
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
```

Login:

```bash
onchainos wallet login
```

Verify:

```bash
onchainos wallet status
onchainos market portfolio-supported-chains
```

Expected:

- `loggedIn: true`
- `loginType: "ak"`

## 2. Telegram Bot

Required env vars:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Optional:

```bash
TELEGRAM_ALLOWED_USER_ID=...
TELEGRAM_PROXY=...
```

## 3. Import Wallets

```bash
npm run import-wallets -- <json-file>
```

Important:

- The bundled example file is only for showing the JSON format
- It is not a curated smart-money list
- If the example wallets end up in `排除组` or `休眠组`, that is expected
- For meaningful output, import your real smart-money wallet set

## 4. Build Profiles and Groups

```bash
npm run profiles
npm run wallet-groups
npm run export-curated
```

Recommended default:

```bash
OKX_PROFILE_TIME_FRAME_DAYS=3
```

Some addresses may fail with broader time windows on OKX. `3` is the safer default for this skill package.

## 5. Safety Defaults

- analysis only by default
- grouped alerts only from `safeSignalPool`
- no automatic trade execution
- exclude low-win-rate / high-loss hot wallets

## 6. Monitoring Intent

The preferred production alert rule is:

- same positive group
- at least 2 safe wallets
- concentrated buy on same token
- then push Telegram alert

By default, monitoring should be able to run with:

- OKX wallet login
- generated profile/group files
- Telegram config if notifications are needed

GMGN and Binance should be treated as optional enhancer sources, not required dependencies.
