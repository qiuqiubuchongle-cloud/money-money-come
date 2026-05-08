# Money Money Come

> 链上聪明钱画像 Skill：把你收藏的一堆钱包地址，整理成可筛选、可分组、可提醒的个性化信号池。

`money-money-come` 是一个基于 **OnchainOS + OKX 官方链上画像能力** 的 BSC 聪明钱分析 Skill。  
它默认只做地址画像、分组筛选和 Telegram 信号提醒，不会自动交易。

![Money Money Come Flow](./assets/money-money-come-flow.svg)

## 思考来源：用户真正痛在哪里

很多扫链用户并不是没有地址，而是地址太多。

常见痛点是：

- 收藏夹越来越大，但不知道哪个地址还值得盯
- 地址备注很随意，过几天就忘了当初为什么收藏
- 休眠地址、亏损地址、噪音地址混在一起，手动清理很累
- 有些地址确实很聪明，但单独看一笔交易又容易误判
- 自定义分组靠人工维护，越用越乱
- Telegram 提醒如果只是原始成交流水，很快就变成噪音

所以这个 Skill 的目标不是“多推送几个买入”，而是先帮用户把地址列表整理成一个更干净的信号系统。

## 功能核心

### 1. 单地址画像

输入一个 BSC 钱包地址，Skill 会基于 OKX 官方链上画像接口，输出一份简洁地址报告：

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
链上小旋风｜叙事捕手｜热点组｜核心
擅长捕捉叙事，出手不算密但命中感不错；低市值偏好强，适合作为同组共振观察地址。
```

### 2. 批量地址筛选

导入 GMGN 风格的钱包列表后，Skill 会批量生成画像，并把地址分成：

- 核心：可进入正式信号池
- 观察：有亮点，但需要更多确认
- 降权：有噪音或稳定性不足
- 剔除：休眠、样本太薄或质量不够

### 3. 聪明钱分组

Skill 会把地址归到更容易理解的风格组：

- `热点组`：擅长捕捉热点轮动
- `百倍组`：偏早期、偏低市值、爆发弹性更强
- `盈利组`：历史收益更稳定
- `加仓组`：同一标的反复加仓，有信仰型行为
- `观察组`：样本还不够，需要继续跟踪
- `噪音组 / 休眠组`：默认不进入核心提醒

### 4. 分组集中买入提醒

真正有价值的不是“某一个地址买了”，而是：

> 同一正向分组里，多个高质量地址在同一时间窗口内买入同一个 meme。

默认提醒规则：

- `>= 2` 个同组核心地址买入：正式信号
- `>= 3` 个同组核心地址买入：强信号
- `2 个同组核心 + OKX / GMGN / Four.meme / Binance 辅助确认`：强信号

这样可以减少单钱包误触发，让提醒更像“情绪共振”，而不是链上流水。

### 5. Telegram 画像卡与信号卡

TG 消息默认展示少量关键数据：

- 地址标签
- 价值分
- 核心结论
- 已实现收益
- 胜率
- 最近活跃
- 低市值偏好
- 代表盈利
- 跟踪建议

亏损列表不会默认展示在 TG 卡片里，避免信息过载。更细的数据仍保留在本地 JSON 报告中，方便深度复盘。

## 聪明钱评分规则

Skill 会生成一个 `walletValueScore`，满分 100。它不是单纯按收益排序，而是综合判断地址是否值得被跟踪。

主要维度：

| 维度 | 看什么 | 作用 |
| --- | --- | --- |
| 盈利能力 | 已实现 PnL、平均盈利 | 判断地址是否真的赚到钱 |
| 稳定性 | 胜率、盈利 token 数、亏损分布 | 防止偶然暴赚掩盖长期乱冲 |
| 活跃度 | 最近交易时间、近期活跃天数 | 剔除长期休眠地址 |
| Meme 适配度 | 低市值买入占比、入场市值中位数 | 判断是否适合 meme 扫链 |
| 样本质量 | 交易数、参与 token 数 | 避免样本太薄就高估 |
| 可跟随性 | 平均买入金额、交易节奏 | 过滤过大资金或噪音节奏 |

默认分层：

| 层级 | 默认含义 |
| --- | --- |
| 核心 | 分数高、近期活跃、收益为正、胜率过线、样本足够 |
| 观察 | 有亮点，但还需要同组确认 |
| 降权 | 有一定价值，但稳定性或样本不足 |
| 剔除 | 休眠、亏损严重、噪音过高或样本太薄 |

默认安全池规则更严格：只有正向分组中的 `核心` 地址，才会进入正式提醒逻辑。

## 自定义调整

你可以通过环境变量调整策略，不需要改代码。

常用项：

```bash
OKX_PROFILE_TIME_FRAME_DAYS=3
POLL_MS=60000
MIN_PRIVATE_WALLETS=2
PRIVATE_WINDOW_MS=600000
GMGN_ENABLED=0
BINANCE_MEME_RUSH_ENABLED=0
BINANCE_TOKEN_INFO_ENABLED=0
```

建议：

- 新用户先保持 GMGN / Binance 关闭，只跑 OKX + 自己的钱包池
- 地址池稳定后，再把 GMGN、Four.meme、Binance 作为辅助确认源
- 不建议降低 `MIN_PRIVATE_WALLETS=2`，单地址买入很容易误报

## 安装

```bash
npx skills add https://github.com/qiuqiubuchongle-cloud/money-money-come
```

安装后重启 Codex / Agent，让 Skill 生效。

## 配置攻略

### 1. 配置 OKX

复制 `.env.example` 为你的本地配置文件，并填写：

```bash
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
```

然后登录 OnchainOS：

```bash
onchainos wallet login
```

检查状态：

```bash
onchainos wallet status
onchainos market portfolio-supported-chains
```

如果某些地址画像接口报 `timeFrame param error`，优先使用：

```bash
OKX_PROFILE_TIME_FRAME_DAYS=3
```

### 2. 配置 Telegram

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_PROXY=
```

如果网络需要代理，把 `TELEGRAM_PROXY` 设置成你的本地代理地址。

### 3. 导入地址

支持 GMGN 风格 JSON：

```json
[
  {
    "address": "0x...",
    "name": "optional",
    "emoji": ""
  }
]
```

导入：

```bash
npm run import-wallets -- examples/gmgn_wallets_input.example.json
```

仓库里的示例地址只用于说明格式，不代表高质量地址池。

### 4. 构建画像与分组

```bash
npm run profiles
npm run wallet-groups
npm run export-curated
```

主要输出：

- `data/smart_wallet_profiles_bsc.json`
- `data/smart_wallet_groups_bsc.json`
- `data/curated_smart_wallets_bsc.json`
- `data/curated_smart_wallets_bsc.txt`

重点看：

- `signalPool`：正向地址池
- `safeSignalPool`：更严格的安全信号池
- `excludedSignalPool`：被排除或降权的地址

### 5. 分析单个地址

```bash
npm run wallet-report -- 0x...
```

发送到 Telegram：

```bash
npm run wallet-report-tg -- 0x...
```

### 6. 开启监控

```bash
npm run monitor
```

监控会读取已经生成好的画像和分组文件，基于 `safeSignalPool` 做集中买入提醒。

## 当前边界

- 默认不自动买卖
- 默认不承诺盈利
- 默认不把单个地址买入当成正式信号
- 示例地址不是精选地址池
- GMGN / Binance 是可选增强源，不是跑通主流程的必要依赖

## 适合怎么用

最推荐的用法是：

1. 先导入你自己长期收藏的钱包地址
2. 用 OKX 官方画像批量筛选
3. 把核心地址分成不同风格组
4. 只跟踪 `safeSignalPool`
5. 等同组多地址共振，再看是否值得进一步研究

这个 Skill 的价值，不在于替你冲进去买，而在于帮你把杂乱的聪明钱收藏夹，变成一个能持续迭代的链上研究系统。

## 风险提示

本 Skill 仅用于链上分析、信号整理与提醒，不构成投资建议。

任何实盘动作都建议额外复核：

- 合约风险
- 流动性
- 持有人集中度
- Dev / insider / bundler 风险
- 代币叙事真实性
- 仓位管理和止盈止损
