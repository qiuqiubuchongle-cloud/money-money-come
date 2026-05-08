# 服务器部署：Money Money Come 信号监控

这套配置用于把当前核心观察池放到服务器长期运行。默认只做链上监控、Telegram 提醒和模拟观察，不会自动交易。

## 当前核心观察池

本仓库已经内置一份服务器观察池：

- `config/server-core-profiles.json`
- `config/server-core-groups.json`
- `config/server-core-addresses.txt`

当前 `safeSignalPool` 共 10 个地址，分成：

- 盈利组：4 个
- 百倍组：3 个
- 热点组：3 个

默认信号规则：

- 同一正向分组内，至少 2 个核心地址在 10 分钟内买入同一个 BSC meme，才触发正式提醒
- 3 个及以上同组核心地址共振，视为更强信号
- 2 个及以上分组都达到同组阈值，标记为多组强信号
- 不同组各 1 个地址买入，只算跨组观察，不作为正式信号推送
- OKX / GMGN / Binance 只作为辅助确认源，首次部署建议先关闭

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

不要把 `deploy/server.env` 提交到 GitHub。它只应该存在于你的服务器本地。

## 4. 前台试跑

```bash
chmod +x deploy/run-server-monitor.sh
./deploy/run-server-monitor.sh
```

看到类似下面的日志，说明监控已启动：

```text
[monitor] BSC signal + paper monitor started. safeAddresses=10
```

第一次启动会先记录当前状态，后续新出现的匹配信号才会推送，避免把历史旧交易误当成新信号。

## 5. 用 systemd 常驻运行

把服务文件复制到系统目录：

```bash
sudo cp deploy/money-money-come.service /etc/systemd/system/money-money-come.service
sudo systemctl daemon-reload
sudo systemctl enable money-money-come
sudo systemctl start money-money-come
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

重启：

```bash
sudo systemctl restart money-money-come
```

## 6. Telegram 信号格式

触发后会发送类似这种 HTML 格式消息：

```text
🚨 BSC 分组信号

代币: SYMBOL
合约: 0x...
聪明钱情绪组: 热点组 2 个核心地址共振
私有钱包数: 2，交易数: 2
叙事: 你的私有聪明钱地址池出现集中买入

模拟仓位: $10
提示: 仅做链上提醒，不是自动交易或收益保证
```

## 7. 调参建议

保守默认值：

```bash
MIN_PRIVATE_WALLETS=2
PRIVATE_WINDOW_MS=600000
ALLOW_OFFICIAL_SOLO_SIGNAL=0
GMGN_ENABLED=0
BINANCE_MEME_RUSH_ENABLED=0
```

如果信号太少，可以先扩大地址池，不建议直接改成单地址触发。

如果信号太多，可以提高：

```bash
MIN_PRIVATE_WALLETS=3
MAX_ENTRY_MARKET_CAP_USD=300000
MIN_ENTRY_LIQUIDITY_USD=5000
```

## 安全边界

- 不保存你的私钥
- 不执行买卖
- 不把 Telegram token 或 OKX key 放进公开仓库
- `.env`、`deploy/server.env`、`data/`、`logs/` 默认都不会被提交
- 实盘前仍需人工复核合约风险、流动性、持有人集中度和仓位管理
