# Money Money Come

> 多链聪明钱画像与分组信号引擎。把你收藏的一堆钱包地址，升级成可评分、可分组、可复盘、可推送的链上研究系统。

`Money Money Come` 是一个面向 meme 扫链用户、链上研究员和 Agent 工作流的公开 Skill。它基于 **OnchainOS / OKX 链上数据能力**，帮助 Agent 自动完成 BSC 与 Solana 聪明钱地址画像、质量分层、分组管理、观察池导出和 Telegram 信号提醒。

它的默认边界很清楚：**只做分析、整理、提醒和模拟观察，不自动交易，不托管私钥，不承诺收益。**

![Money Money Come Flow](./assets/money-money-come-flow.svg)

## 一句话定位

如果你已经积累了很多“看起来很聪明”的钱包地址，但不知道哪些还活跃、哪些真的能赚、哪些只是噪音，`Money Money Come` 会把这些地址整理成一套可持续迭代的个人链上雷达。

它不是把所有买入都推给你，而是回答三个更重要的问题：

| 问题 | Skill 做什么 |
| --- | --- |
| 这个地址值不值得盯？ | 生成 PnL、胜率、交易节奏、低市值偏好、代表盈利和风格标签 |
| 我的地址池怎么分组？ | 按盈利型、百倍型、热点型、加仓型、观察型、噪音型、休眠型自动归类 |
| 什么时候值得提醒？ | 当同组核心钱包集中买入，或 OKX 官方 Signal 达到阈值时推送 TG |

## 为什么需要它

很多扫链用户的问题不是“没有地址”，而是“地址太多”。

常见痛点包括：

- 收藏夹越来越大，真正值得跟踪的地址越来越少
- 当时随手标记的钱包，过几天就忘了为什么收藏
- 长期休眠地址、亏损地址、噪音地址混在一起，手动清理很累
- 单个钱包偶尔买入不一定有意义，但同类钱包一起买入往往更值得看
- Telegram 如果只推原始成交流水，很快就会变成噪音
- BSC 和 Solana 地址分开维护，人工切换成本高

`Money Money Come` 的核心思路是：先把钱包质量判断清楚，再谈信号。只有经过筛选、分组和规则确认的地址，才进入正式提醒逻辑。

## 核心能力

### 1. BSC / Solana 双链地址画像

输入单个钱包地址，或导入一批 GMGN 风格地址列表，Skill 会为每个地址生成一份画像：

- 已实现收益与代表盈利
- 胜率、盈利 token 数、交易样本
- 最近活跃时间和交易节奏
- 低市值 meme 偏好
- 地址风格标签
- 价值分与层级
- 是否适合进入核心观察池

示例输出风格：

```text
链上小旋风｜热点组｜观察
擅长捕捉叙事，低市值偏好强，代表盈利亮眼；但胜率还不算稳，适合放进 SOL 热点观察池，等同组共振再提高权重。
```

### 2. 地址质量评分

Skill 会生成 `walletValueScore`，满分 100。它不是简单按收益排序，而是综合判断地址是否适合被跟踪。

| 维度 | 观察重点 | 目的 |
| --- | --- | --- |
| 盈利能力 | 已实现 PnL、平均盈利、代表盈利 | 判断是否真的赚到钱 |
| 稳定性 | 胜率、盈利 token 数、亏损分布 | 防止一次暴赚掩盖长期乱冲 |
| 活跃度 | 最近交易时间、近期活跃天数 | 剔除长期休眠地址 |
| Meme 适配度 | 低市值买入占比、入场市值中位数 | 判断是否适合 meme 扫链 |
| 样本质量 | 交易数、参与 token 数 | 避免样本太薄就高估 |
| 可跟随性 | 平均买入金额、交易节奏 | 过滤过大资金或高频噪音 |

默认层级：

| 层级 | 含义 |
| --- | --- |
| 核心 | 分数高、近期活跃、收益为正、样本较足，允许进入正式信号池 |
| 观察 | 有亮点，但还需要更多样本或同组确认 |
| 降权 | 有一定价值，但稳定性不足或噪音偏高 |
| 剔除 | 休眠、亏损明显、样本太薄或不适合作为信号来源 |

### 3. 聪明钱风格分组

钱包会被归入更容易理解的行为组：

| 分组 | 典型特征 |
| --- | --- |
| 热点组 | 擅长捕捉热点轮动，出手更偏叙事和情绪 |
| 百倍组 | 偏早期、偏低市值，弹性更高但波动也更大 |
| 盈利组 | 历史收益更稳，适合作为核心确认来源 |
| 加仓组 | 同一标的反复加仓，有信仰型行为 |
| 观察组 | 有亮点但还不够稳定，需要继续跟踪 |
| 噪音组 / 休眠组 | 默认不进入正式提醒池 |

### 4. 私有地址池分组信号

正式信号不是“某个钱包买了”，而是“符合你规则的钱包共振了”。

默认规则：

- 同一正向分组内 `>= 2` 个核心钱包，在 `10` 分钟内买入同一 token，触发正式信号
- 同一正向分组内 `>= 3` 个核心钱包，标记为强信号
- 多个分组同时达标，标记为多组强信号
- 不同组各 1 个地址买入，只作为跨组观察，默认不当作正式信号

这些阈值可以自定义。你可以把它改成更激进的 `2 个钱包提醒`，也可以改成更保守的 `3 个钱包才提醒`。

### 5. OKX 官方 Signal 通道

除了你自己的私有地址池，监控器还可以接入 OKX 官方 Signal：

- 读取 OKX 聚合聪明钱 / 鲸鱼买入信号
- 根据触发钱包数、代币市值、组合分数做过滤
- 可作为私有地址池的外部确认源
- 也可以开启“OKX 官方独立提醒”，不依赖你的私有地址池同组共振

默认配置：

- `OKX_OFFICIAL_SIGNAL_ENABLED=1`
- `OKX_OFFICIAL_SOLO_ALERT=1`
- `OKX_SIGNAL_MIN_WALLETS=6`
- `OKX_SIGNAL_MAX_MARKET_CAP_USD=500000`

这能解释为什么有时 Telegram 没有信号：如果你的私有地址池没有同组共振，系统不会硬推噪音；开启 OKX 官方独立提醒后，信号来源会更宽，但仍然经过基础过滤。

## 自定义信号规则

最推荐的方式是复制规则模板：

```bash
cp config/signal-rules.example.json config/signal-rules.json
```

然后编辑：

```json
{
  "private": {
    "minWallets": 2,
    "strongMinWallets": 3,
    "windowMs": 600000,
    "sameGroupRequired": true,
    "crossGroupObserve": true
  },
  "okxOfficial": {
    "enabled": true,
    "soloAlert": true,
    "walletTypes": "1,3",
    "limit": 30,
    "minTriggerWallets": 6,
    "maxMarketCapUsd": 500000,
    "minCompositeScore": 3
  }
}
```

常见调法：

| 需求 | 改什么 |
| --- | --- |
| 信号太少 | 扩大地址池，或把 `private.minWallets` 从 3 调回 2 |
| 信号太多 | 把 `private.minWallets` 改为 3，提高 `okxOfficial.minTriggerWallets` |
| 更重视同组逻辑 | 保持 `sameGroupRequired=true` |
| 想看跨组共振 | 开启 `crossGroupObserve=true`，但建议只作为观察 |
| 想接收 OKX 官方信号 | 设置 `okxOfficial.enabled=true` 和 `soloAlert=true` |

环境变量也可以覆盖 JSON，适合服务器部署：

```bash
MIN_PRIVATE_WALLETS=2
PRIVATE_WINDOW_MS=600000
STRONG_PRIVATE_WALLETS=3
OKX_OFFICIAL_SIGNAL_ENABLED=1
OKX_OFFICIAL_SOLO_ALERT=1
OKX_SIGNAL_MIN_WALLETS=6
OKX_SIGNAL_MAX_MARKET_CAP_USD=500000
```

## Telegram 信号卡

触发后会发送 HTML 格式消息，大致如下：

```text
🚨 BSC 分组信号

🪙 TOKEN ｜ Token Name
📌 等级：强信号 ｜ 热点组 ｜ 情绪分 5.8
🔗 合约：0x...
📡 来源：private + okx

📊 市场数据
• 市值：$320.0K
• 流动性：$18.5K
• 持有人：142

🧠 聪明钱触发
• 触发地址：2 个
• 触发模式：热点组同组共振
• OKX Signal：官方聚合触发钱包 8 个，阈值 6 个

⚠️ 默认仅分析和提醒，不代表实盘建议。
```

## 快速安装

```bash
npx skills add https://github.com/qiuqiubuchongle-cloud/money-money-come
```

安装后重启 Codex / Agent，让 Skill 生效。

## 快速开始

### BSC 地址分析

```bash
npm run import-wallets -- examples/gmgn_wallets_input.example.json
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run profiles
npm run wallet-groups
npm run export-curated
npm run wallet-report -- 0x...
```

### Solana 地址分析

```bash
npm run sol:import-wallets -- examples/solana_wallets_input.example.json
OKX_PROFILE_TIME_FRAME_DAYS=3 npm run sol:profiles
npm run sol:wallet-groups
npm run sol:export-curated
npm run sol:wallet-report -- <solana-wallet-address>
```

Solana 会输出：

- `data/smart_wallet_profiles_solana.json`
- `data/smart_wallet_groups_solana.json`
- `data/curated_smart_wallets_solana.json`
- `data/curated_smart_wallets_solana.txt`

## 服务器监控

服务器长期运行使用：

- `deploy/server.env.example`
- `deploy/run-server-monitor.sh`
- `deploy/money-money-come.service`
- `config/server-core-profiles.json`
- `config/server-core-groups.json`
- `config/server-core-addresses.txt`
- `config/signal-rules.example.json`

部署步骤见 [`deploy/README-server.md`](./deploy/README-server.md)。

启动后，监控器会读取核心观察池、私有分组规则和 OKX 官方 Signal 配置，持续轮询并把达标信号推送到 Telegram。

## Agentic Wallet 与数据源边界

很多用户会问：使用 Agentic Wallet 能不能直接调用链上数据？

准确说：

- **Agentic Wallet** 更适合做钱包登录、签名、转账、合约调用等执行层能力
- **OnchainOS / OKX market、tracker、portfolio、signal 接口** 才是本 Skill 读取画像、行情、交易和信号的主要数据源

所以这个 Skill 的推荐架构是：

```text
用户地址池
  -> OnchainOS / OKX 数据读取
  -> Money Money Come 画像评分与分组
  -> 私有地址池共振 + OKX 官方 Signal
  -> Telegram 提醒 / 本地 JSON 复盘
```

如果未来要接入自动买卖，应该单独增加交易前风控、仓位管理、滑点控制、止盈止损和二次确认，而不是把提醒信号直接变成交易指令。

## 当前边界

- 不保存私钥
- 不自动买卖
- 不承诺收益
- 示例地址只用于格式演示，不是精选地址池
- Telegram token、OKX key、服务器 `.env` 不会进入公开仓库
- GMGN / Binance 是可选增强源，不是跑通主流程的必要依赖

## 适合谁

- 已经积累大量聪明钱地址，但缺少整理方法的人
- 想把 BSC / Solana 地址统一做画像的人
- 想减少 Telegram 噪音，只看更高质量共振提醒的人
- 想用 Agent 搭建个人链上研究工作流的人
- 想把“收藏地址”升级为“可复盘信号池”的扫链用户

## 风险提示

本 Skill 仅用于链上分析、信号整理与提醒，不构成投资建议。

任何实盘动作都建议额外复核：

- 合约风险
- 流动性
- 持有人集中度
- Dev / insider / bundler 风险
- 代币叙事真实性
- 仓位管理和止盈止损
