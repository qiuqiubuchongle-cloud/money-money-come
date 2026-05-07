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

## 4. Build Profiles and Groups

```bash
npm run profiles
npm run wallet-groups
npm run export-curated
```

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
