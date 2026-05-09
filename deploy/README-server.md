# 服务器部署：Money Money Come 信号监控

这套配置用于把你的核心观察池放到服务器长期运行。默认只做链上监控、Telegram 提醒和模拟观察，不会自动交易。

## 监控通道

当前监控器有两条主要信号通道：

| 通道 | 作用 | 默认状态 |
| --- | --- | --- |
| 私有聪明钱地址池 | 监控你自己筛选出的 `safeSignalPool`，当同组核心地址集中买入时提醒 | 开启 |
| OKX 官方 Signal | 读取 OKX 聚合聪明钱 / KOL / 鲸鱼 Signal，原样转发到 TG，并追加备注 | 开启 |

GMGN、Four.meme、Binance 是可选增强源。首次部署建议先保持关闭，等私有地址池和 OKX 官方 Signal 转发跑稳定后再接入。

## 当前核心观察池

本仓库内置一份服务器观察池：

- `config/server-core-profiles.json`
- `config/server-core-groups.json`
- `config/server-core-addresses.txt`

当前 `safeSignalPool` 共 10 个地址，分成：

- 盈利组：4 个
- 百倍组：3 个
- 热点组：3 个

## 自定义信号规则

复制模板：

```bash
cp config/signal-rules.example.json config/signal-rules.json
```

默认规则：

```json
{
  "private": {
    "minWallets": 3,
    "strongMinWallets": 3,
    "windowMs": 120000,
    "sameGroupRequired": true,
    "crossGroupObserve": true
  },
  "okxOfficial": {
    "enabled": true,
    "forward": true,
    "walletTypes": "",
    "limit": 30,
    "minTriggerWallets": "",
    "maxTriggerWallets": "",
    "minAmountUsd": "",
    "maxAmountUsd": "",
    "minMarketCapUsd": "",
    "maxMarketCapUsd": "",
    "minLiquidityUsd": "",
    "maxLiquidityUsd": "",
    "minHolders": 0,
    "maxTop10HolderPercent": 0,
    "maxSoldRatioPercent": 100,
    "minCompositeScore": 3,
    "applyLocalFilters": false
  }
}
```

常用调参：

- 想更保守：保持 `private.minWallets=3`，或把 `windowMs` 缩短到 120000
- 想更敏感：把 `private.minWallets` 改成 `2`，或把 `windowMs` 放宽到 600000
- 只想要同组信号：保持 `private.sameGroupRequired=true`
- 想让 OKX 官方信号原样转发：保持 `okxOfficial.enabled=true`、`okxOfficial.forward=true`、`applyLocalFilters=false`
- 想减少 OKX 转发噪音：把 `applyLocalFilters` 改成 `true`，再设置 `minTriggerWallets`、`maxMarketCapUsd` 等过滤项

`minTriggerWallets=6` 和 `maxMarketCapUsd=500000` 不是 OKX 官方固定标准。OKX / OnchainOS 提供 Signal 数据和可选过滤参数，实际提醒阈值可以按你的风险偏好调整。

服务器也支持用环境变量覆盖 JSON：

```bash
MIN_PRIVATE_WALLETS=3
PRIVATE_WINDOW_MS=120000
STRONG_PRIVATE_WALLETS=3
OKX_OFFICIAL_SIGNAL_ENABLED=1
OKX_OFFICIAL_FORWARD_ENABLED=1
OKX_OFFICIAL_APPLY_LOCAL_FILTERS=0
OKX_SIGNAL_MIN_WALLETS=
OKX_SIGNAL_MIN_AMOUNT_USD=
OKX_SIGNAL_MIN_LIQUIDITY_USD=
OKX_SIGNAL_MAX_MARKET_CAP_USD=
OKX_SIGNAL_MAX_SOLD_RATIO_PERCENT=100
```

## 1. 拉取仓库

```bash
cd /opt
git clone https://github.com/qiuqiubuchongle-cloud/money-money-come.git
cd money-money-come
```

如果你已经 clone 过：

```bash
cd /opt/money-money-come
git pull
```

## 2. 准备运行环境

建议使用 Node.js 22 或更高版本。

```bash
node -v
npm -v
```

确认 `onchainos` 可以运行：

```bash
onchainos wallet status
```

如果还没登录：

```bash
onchainos wallet login
```

## 3. 配置密钥

```bash
cp deploy/server.env.example deploy/server.env
nano deploy/server.env
```

需要填写：

```bash
OKX_API_KEY=
OKX_SECRET_KEY=
OKX_PASSPHRASE=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

不要把 `deploy/server.env` 提交到 GitHub。它只应该存在于服务器本地。

## 4. 前台试跑

```bash
chmod +x deploy/run-server-monitor.sh
./deploy/run-server-monitor.sh
```

看到类似日志说明监控已启动：

```text
[monitor] BSC signal + paper monitor started. safeAddresses=10, poll=60000ms, privateMin=3, privateWindow=120000ms, okxOfficial=on(forward=on, localFilters=off)
```

第一次启动会先记录当前状态，后续新出现的匹配信号才会推送，避免把历史旧交易误当成新信号。

## 5. 用 systemd 常驻运行

```bash
sudo cp deploy/money-money-come.service /etc/systemd/system/money-money-come.service
sudo systemctl daemon-reload
sudo systemctl enable money-money-come
sudo systemctl restart money-money-come
```

查看状态：

```bash
sudo systemctl status money-money-come
```

看日志：

```bash
tail -f logs/server-monitor.log
tail -f logs/server-monitor.err.log
```

停止：

```bash
sudo systemctl stop money-money-come
```

## Telegram 信号格式

私有地址池触发后会发送类似这种 HTML 消息：

```text
🚨 BSC 分组信号

🪙 TOKEN ｜ Token Name
📌 等级：强信号 ｜ 热点组 ｜ 情绪分 5.8
🔗 合约：0x...
📡 来源：private

📊 市场数据
• 市值：$320.0K
• 流动性：$18.5K
• 持有人：142

🧠 聪明钱触发
• 触发地址：3 个
• 触发模式：热点组同组共振
```

OKX 官方 Signal 是单独的转发卡：

```text
📡 OKX 官方 Signal

🪙 TOKEN ｜ Token Name
🔗 合约：0x...
🏷 钱包类型：Smart Money

📊 OKX Signal 原始字段
• 触发钱包：15
• 买入金额：$12.3K
• 市值：$420.0K

📝 备注：OKX 官方 Signal 原样转发；这条不代表你的私有聪明钱地址池已经同组共振。
```

## 为什么没有 Telegram 信号

没有信号通常不是 TG 坏了，而是没有满足触发条件：

- 私有地址池没有同组核心钱包集中买入
- 同一 token 的买入超过了时间窗口
- OKX 官方 Signal 没有新返回，或你开启了本地过滤但未达到阈值
- 代币市值、流动性、持有人或风险过滤未通过
- 首次启动处于 seeded 状态，只记录当前状态，不推历史信号

想提高私有池信号密度，优先扩大高质量地址池；其次再调整 `private.minWallets` 或 `windowMs`。想减少 OKX 转发噪音，再开启 `OKX_OFFICIAL_APPLY_LOCAL_FILTERS=1`。

## 安全边界

- 不保存你的私钥
- 不执行买卖
- 不把 Telegram token 或 OKX key 放进公开仓库
- `.env`、`deploy/server.env`、`config/signal-rules.json`、`data/`、`logs/` 默认都不会被提交
- 实盘前仍需人工复核合约风险、流动性、持有人集中度和仓位管理
