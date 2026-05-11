# Money Money Come

> 多链聪明钱画像与分组信号引擎。把你收藏的聪明钱地址，整理成可评分、可分组、可监控、可推送的个人链上研究系统。

`Money Money Come` 是一个面向 meme 扫链用户、链上研究员和 Agent 工作流的公开 Skill。它基于 **OnchainOS / OKX 链上数据能力**，支持 BSC 与 Solana 聪明钱地址画像、质量分层、分组管理、观察池导出，也支持 ETH meme 雷达监控：OKX 官方 Signal、hot-token 放量、私有观察地址池首买共振可以合并成一张更克制的 Telegram 卡片。

它现在更像一层 **信号解释器**，不是另一个原始信号搬运工。

GMGN 已经把原始信号、钱包跟踪和快速交易这件事做得很强，所以 `Money Money Come` 最该补的不是“更多提醒”，而是：

- 把多条原始信号收束成更清楚的判断
- 把钱包从“单地址”变成“可解释的群体”
- 把提醒从“有人买了”变成“为什么这条值得看”
- 把热闹和真价值拆开
- 把信号按 `setup / confirm / late / avoid` 分级，而不是全都推成“冲”

它默认只做 **分析、整理、提醒和模拟观察**，不会自动交易，不托管私钥，不承诺收益。

![Money Money Come Flow](./assets/money-money-come-flow.svg)

## 它解决什么问题

很多扫链用户并不是没有地址，而是地址越来越多，真正能用的越来越少。

- 收藏夹很大，但不知道哪些地址还值得盯
- 地址备注靠记忆，过几天就忘了为什么收藏
- 休眠地址、亏损地址、噪音地址混在一起
- 单个钱包买入容易误报，同类钱包共振才更值得看
- BSC 和 Solana 地址分开维护，整理成本高
- Telegram 如果只推成交流水，很快就会变成噪音

`Money Money Come` 的核心思路是：**先判断地址质量，再生成分组，再用可配置规则决定是否推送信号。**

## 它和 GMGN 的分工

| GMGN 更擅长 | Money Money Come 更擅长 |
| --- | --- |
| 原始钱包动态、AI Signal、Pump 监控、快速交易 | 私有地址池分层、同组共振、跨源确认、信号解释 |
| 快 | 稳、清楚、少废话 |
| 数据量大 | 规则更清晰 |
| 适合广撒网 | 适合做个人判断层 |

## 产品工作流

```text
导入聪明钱地址
  -> 读取 OnchainOS / OKX 链上数据
  -> 生成单地址画像
  -> 计算钱包价值分
  -> 自动分组与筛选
  -> 生成 safeSignalPool
  -> 按你的规则监控同组集中买入
  -> ETH 雷达合并 OKX Signal / 放量 / 私有地址首买
  -> 计算信号分级、生命周期、风险分和钱包集群关系
  -> 推送 Telegram 可读信号卡
```

一句话理解：它不是帮你“看到更多买入”，而是帮你“少看无效买入”。

## 核心功能

### 1. 导入聪明钱地址

你可以导入自己收集的钱包列表，每个地址可以附带名称和 emoji：

```json
[
  {
    "address": "0x...",
    "name": "早期买入观察",
    "emoji": ""
  }
]
```

BSC：

```bash
npm run import-wallets -- examples/smart_wallets_input.example.json
```

Solana：

```bash
npm run sol:import-wallets -- examples/solana_wallets_input.example.json
```

仓库里的示例文件只用于展示输入格式，不是精选地址池。

### 2. 单地址画像

输入一个 BSC 或 Solana 钱包地址，Skill 会生成一份简洁画像：

- 已实现收益
- 胜率
- 最近活跃时间
- 交易节奏
- 低市值 meme 偏好
- 代表盈利
- 地址风格标签
- 是否适合进入核心观察池

示例风格：

```text
链上小旋风｜热点组｜观察
擅长捕捉叙事，低市值偏好强，代表盈利亮眼；但胜率还不算稳，适合放进 SOL 热点观察池，等同组共振再提高权重。
```

命令：

```bash
npm run wallet-report -- 0x...
npm run sol:wallet-report -- <solana-wallet-address>
```

### 3. 批量画像与价值评分

批量导入后，Skill 会为地址生成 `walletValueScore`，满分 100。它不是只看收益，而是综合评估这个地址是否值得长期跟踪。

| 维度 | 看什么 | 作用 |
| --- | --- | --- |
| 盈利能力 | 已实现 PnL、平均盈利、代表盈利 | 判断是否真的赚到钱 |
| 稳定性 | 胜率、盈利 token 数、亏损分布 | 防止一次暴赚掩盖长期乱冲 |
| 活跃度 | 最近交易时间、近期活跃天数 | 剔除长期休眠地址 |
| Meme 适配度 | 低市值买入占比、入场市值中位数 | 判断是否适合 meme 扫链 |
| 样本质量 | 交易数、参与 token 数 | 避免样本太薄就高估 |
| 可跟随性 | 平均买入金额、交易节奏 | 过滤过大资金或高频噪音 |

输出层级：

| 层级 | 含义 |
| --- | --- |
| 核心 | 分数高、近期活跃、收益为正、样本较足，可进入正式信号池 |
| 观察 | 有亮点，但还需要更多样本或同组确认 |
| 降权 | 有一定价值，但稳定性不足或噪音偏高 |
| 剔除 | 休眠、亏损明显、样本太薄或不适合作为信号来源 |

命令：

```bash
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run profiles
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run sol:profiles
```

### 4. 自动分组与安全观察池

Skill 会把地址归入不同风格组，让你知道这个地址为什么值得看：

| 分组 | 典型特征 | 默认用途 |
| --- | --- | --- |
| 热点组 | 擅长捕捉热点轮动，叙事敏感 | 观察热点共振 |
| 百倍组 | 偏早期、偏低市值，弹性更高 | 观察早期机会 |
| 盈利组 | 历史收益更稳 | 核心确认来源 |
| 加仓组 | 同一标的反复加仓 | 观察信仰型行为 |
| 观察组 | 有亮点但还不稳定 | 暂不作为强信号 |
| 噪音组 / 休眠组 | 高频乱冲、长期不活跃 | 默认排除 |

重点看三个池子：

- `signalPool`：正向地址池
- `safeSignalPool`：更严格的核心安全观察池
- `excludedSignalPool`：被降权或排除的地址

命令：

```bash
npm run wallet-groups
npm run export-curated
```

### 5. 分组集中买入信号

正式提醒不是“某个地址买了”，而是“你认可的一组地址在同一个时间窗口里集中买入同一个 token”。

默认逻辑：

- 同一正向分组内 `3` 个核心钱包，在 `2` 分钟内买入同一 token，触发正式信号
- 同一正向分组内 `3` 个核心钱包，标记为强信号
- 同一正向分组内 `2` 个核心/观察钱包，在 `5` 分钟内买入同一 token，触发观察信号
- 多个分组同时达标，标记为多组强信号
- 观察信号只提醒，不进入模拟盘；不同组各 1 个地址买入，只作为跨组观察

更高级的判断不是只看“买没买”，而是看：

- 这些钱包是不是你真的信得过
- 这个 token 现在是刚起步，还是已经过热
- 流动性、持有人、风险标签是不是还能看
- 这条信号是不是已经被 GMGN 或市场行情提前提示过

也就是说，这个 skill 的目标不是重复 GMGN，而是把 GMGN 的强信号再压一层，只留下更值得你看的那小撮。

你可以把这个规则改成自己的版本，例如：

- 热点组：3 个钱包 / 2 分钟内买入就提醒
- 盈利组：3 个钱包 / 20 分钟内买入才提醒
- 百倍组：2 个钱包 / 5 分钟内买入，并且市值低于 30 万才提醒
- OKX 官方 Signal：按 OnchainOS / OKX 返回内容原样转发，只额外加一行备注

### 6. ETH Meme 雷达

ETH 雷达用于更轻、更快地盯 ETH 链上的 meme 机会。它不要求你先跑完整 BSC/SOL 画像流程，可以直接读取三类输入：

| 来源 | 说明 | 触发价值 |
| --- | --- | --- |
| OKX Signal | OnchainOS 聚合的 Smart Money / KOL / Whale 信号 | 判断是否有外部聪明钱热度 |
| Hot Tokens / price-info | ETH 热门 token 与价格、成交、持有人数据 | 判断是否突然放量 |
| 私有观察地址池 | 你给定的 ETH 钱包首次买入同一 token | 判断是否有自己的地址池共振 |

雷达不会把所有 raw signal 原样扔给你，而是先做四层解释：

| 层 | 输出 | 用途 |
| --- | --- | --- |
| 信号分级 | `setup` / `confirm` / `late` / `avoid` | 区分观察、确认、后排和避开 |
| 生命周期 | 早期起量、确认放量、过热、偏后排、流动性薄 | 防止用同一规则打所有阶段 |
| 风险分 | 流动性、持有人、Top10 集中、卖出比例、过热拉升 | 降低被噪音和操纵信号误导 |
| 钱包集群 | 记录观察地址两两同买次数 | 判断这次是不是熟悉的钱包组合又一起动 |

默认 Telegram 只保留关键字段：

```text
🚨 ETH Meme 雷达

🪙 名称：TOKEN ｜ Token Name
🔗 合约：0x...
📌 判断：确认 ｜ 早期起量
📊 市值：$320.0K
🧠 聪明钱买入金额：$12.3K
💵 价格：0.00000123
👥 持有人：142
📝 备注：私有地址池与 OKX Signal 同时出现，优先复核。

⚠️ 仅供观察，不构成买入建议。
```

运行：

```bash
npm run test:eth-meme
npm run monitor:eth-meme
```

复盘：

```bash
npm run review:eth-signals
```

如果配置 `ETH_RPC_URL`，雷达会额外记录私有观察地址首买所在区块，方便把 Telegram 信号和区块浏览器证据对上。

## 自定义配置：你决定什么叫信号

复制规则模板：

```bash
cp config/signal-rules.example.json config/signal-rules.json
```

核心配置在 `private`：

```json
{
  "private": {
    "minWallets": 3,
    "strongMinWallets": 3,
    "windowMs": 120000,
    "sameGroupRequired": true,
    "crossGroupObserve": true,
    "observe": {
      "enabled": true,
      "minWallets": 2,
      "windowMs": 300000,
      "sameGroupRequired": true,
      "requireExternalConfirm": false
    }
  }
}
```

这段配置的意思是：

- `minWallets=3`：同一组内至少 3 个核心钱包买入，才触发正式提醒
- `strongMinWallets=3`：同一组内 3 个核心钱包买入，标记为强信号
- `windowMs=120000`：统计窗口是 2 分钟
- `sameGroupRequired=true`：必须是同一正向分组内的钱包集中买入
- `crossGroupObserve=true`：不同组同时出现买入时，记录为跨组观察
- `observe.minWallets=2`：观察池同组 2 个钱包即可提示
- `observe.windowMs=300000`：观察窗口是 5 分钟
- `observe.requireExternalConfirm=false`：观察信号不强制要求 OKX / Four.meme 等外部源确认

你也可以先生成一版分层观察池：

```bash
npm run build-signal-pool
```

它会从已分析画像里生成：

- `safeSignalPool`：强提醒池，默认只收核心正向钱包
- `observeSignalPool`：观察池，参与早发现，但不进入模拟盘
- `excludedSignalPool`：有正向标签但不适合直接提醒的钱包

如果你想更保守：

```json
{
  "private": {
    "minWallets": 3,
    "strongMinWallets": 4,
    "windowMs": 1200000,
    "sameGroupRequired": true
  }
}
```

含义：同一组内 3 个钱包在 20 分钟内买入同一 token，才推送给你。

如果你想更敏感：

```json
{
  "private": {
    "minWallets": 2,
    "strongMinWallets": 3,
    "windowMs": 300000,
    "sameGroupRequired": true
  }
}
```

含义：同一组内 2 个钱包在 5 分钟内买入同一 token，就推送给你。

你也可以用环境变量覆盖：

```bash
MIN_PRIVATE_WALLETS=3
STRONG_PRIVATE_WALLETS=3
PRIVATE_WINDOW_MS=120000
PRIVATE_SAME_GROUP_REQUIRED=1
```

## 这次升级后的判断框架

这次迭代参考了 5 类材料的产品思路：Nansen 的 Smart Money 标签观、GMGN 的钱包跟踪、OKX OnchainOS Signal、以太坊区块浏览器证据，以及 meme 市场里常见的操纵/噪音模式。落到代码里是五个方向：

1. **Signal grading**
   - `setup`：刚出现，适合观察
   - `confirm`：私有地址池、OKX Signal、成交量里至少有强确认
   - `late`：市值或涨幅偏后排，只适合复盘
   - `avoid`：风险分过高，默认不推

2. **Wallet cluster graph**
   - 私有地址池同一 token 同窗口买入时，会记录两两钱包关系
   - 以后同一组钱包再次共振，权重更高

3. **Token lifecycle awareness**
   - 低市值起量、确认放量、过热拉升、后排市值、薄流动性使用不同判断
   - 不再把“2 个钱包买了”当成永远同等价值

4. **Manipulation / risk score**
   - 流动性薄、持有人少、Top10 集中、触发钱包卖出比例高、急拉但成交笔数不足都会加风险分
   - 风险分超过阈值默认不推

5. **Replay feedback**
   - ETH 雷达会把每条已发送信号写入 `data/eth_meme_signal_journal.ndjson`
   - `npm run review:eth-signals` 可以按来源组合、分级、生命周期做复盘

## 接下来还值得升级的方向

- 给 journal 追加 15m / 1h / 6h 后续价格回放，真正统计命中率
- 接入更强的地址标签和地址关联度，识别同一实体或同一资金团
- 把 token holder 变化、DEX 路由、MEV 痕迹纳入风险分
- 做每日简版 alpha brief，而不是只靠实时 TG
- 允许用户按钱包组配置不同生命周期阈值

## OKX 官方 Signal 原样转发

OnchainOS / OKX 提供 Smart Money / KOL / Whale 的聚合 Signal 数据，Skill 会把它作为第二条信号通道转发到 Telegram。

这一通道和你的私有聪明钱地址池是分开的：

- 私有地址池：按你设置的“几分钟内、同组几个钱包买入”触发
- OKX 官方 Signal：按 `onchainos signal list` 返回的 Signal 转发
- TG 文案会额外备注：这条不代表你的私有地址池已经同组共振

需要说明：`6 个触发钱包 / 50 万市值` 不是 OKX 官方固定标准。OKX 提供 Signal 数据和过滤参数，是否加本地降噪由你决定。

默认配置：

```json
{
  "okxOfficial": {
    "enabled": true,
    "forward": true,
    "walletTypes": "",
    "limit": 30,
    "applyLocalFilters": false
  }
}
```

含义：默认不在本地二次筛选 OKX 官方 Signal，只做轻格式化和备注。

如果你想减少 OKX 转发噪音，可以打开本地过滤：

```json
{
  "okxOfficial": {
    "applyLocalFilters": true,
    "minTriggerWallets": 8,
    "minAmountUsd": 1000,
    "maxMarketCapUsd": 300000,
    "minLiquidityUsd": 5000,
    "maxSoldRatioPercent": 40
  }
}
```

含义：只有 OKX Signal 中至少 8 个钱包触发、交易额过线、市值和流动性符合要求、触发钱包没有明显大量卖出时，才转发。

官方文档入口：

- [OnchainOS 是什么](https://web3.okx.com/zh-hans/onchainos/dev-docs/home/what-is-onchainos)
- `onchainos signal list --help` 可查看当前 CLI 支持的 Signal 过滤参数

## Telegram 提醒效果

![Telegram Wallet Card Demo](./assets/tg-wallet-card-demo.svg)

私有地址池信号卡会尽量少堆数据，把核心判断讲清楚：

```text
🚨 BSC 分组信号

🪙 TOKEN ｜ Token Name
📌 阶段：confirm ｜ 热点组 ｜ 情绪分 5.8
🔗 合约：0x...
📡 来源：private

📊 市场数据
• 市值：$320.0K
• 流动性：$18.5K
• 持有人：142

🧠 聪明钱触发
• 触发地址：3 个
• 触发模式：热点组同组共振
• 结论：这条不是单点买入，更像组内跟随

⚠️ 默认仅分析和提醒，不代表实盘建议。
```

OKX 官方 Signal 会是另一张卡：

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
⚠️ 仅供观察，不构成买入建议。
```

## 安装

```bash
npx skills add https://github.com/qiuqiubuchongle-cloud/money-money-come
```

安装后重启 Codex / Agent，让 Skill 生效。

## 快速开始

BSC：

```bash
npm run import-wallets -- examples/smart_wallets_input.example.json
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run profiles
npm run wallet-groups
npm run export-curated
npm run wallet-report -- 0x...
```

Solana：

```bash
npm run sol:import-wallets -- examples/solana_wallets_input.example.json
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run sol:profiles
npm run sol:wallet-groups
npm run sol:export-curated
npm run sol:wallet-report -- <solana-wallet-address>
```

服务器监控：

```bash
cp config/signal-rules.example.json config/signal-rules.json
cp deploy/server.env.example deploy/server.env
./deploy/run-server-monitor.sh
```

ETH 雷达：

```bash
npm run monitor:eth-meme
npm run review:eth-signals
```

详细部署见 [`deploy/README-server.md`](./deploy/README-server.md)。

## Agentic Wallet 与数据源边界

- Agentic Wallet 更适合做登录、签名、转账、合约调用等执行层能力
- 本 Skill 的画像、交易、行情、Signal 数据主要来自 OnchainOS / OKX market、tracker、portfolio、signal 接口
- 未来如果接入自动买卖，必须单独增加交易前风控、仓位、滑点、止盈止损和二次确认

## 安全边界

- 不保存私钥
- 不自动买卖
- 不承诺收益
- 示例地址只用于格式演示，不是精选地址池
- Telegram token、OKX key、服务器 `.env` 不会进入公开仓库
- 可选外部增强源不是跑通主流程的必要依赖

## 适合谁

- 已经积累大量聪明钱地址，但缺少整理方法的人
- 想把 BSC / Solana 地址统一做画像的人
- 想自己定义“几个钱包、多久时间、什么组别”才推送的人
- 想减少 Telegram 噪音，只看更高质量共振提醒的人
- 想用 Agent 搭建个人链上研究工作流的人

## 风险提示

本 Skill 仅用于链上分析、信号整理与提醒，不构成投资建议。

任何实盘动作都建议额外复核：

- 合约风险
- 流动性
- 持有人集中度
- Dev / insider / bundler 风险
- 代币叙事真实性
- 仓位管理和止盈止损
